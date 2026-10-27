/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  CustomerUser,
  CustomerProfile,
  Session,
  Account,
  StatementDocument,
  Transaction,
  TransactionCategory,
  CategoryCorrection,
  ConversationThread,
  ChatMessage,
} from '../../types/database.ts';
import { generateId, generateTransactionChecksum } from '../auth/crypto.ts';

// Database directory & path
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'vivpay.db');

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  dbInstance = new DatabaseSync(DB_PATH);
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA foreign_keys = ON;');

  // Run initial schema migration
  runMigrations(dbInstance);
  // Seed system default categories
  seedDefaultCategories(dbInstance);

  return dbInstance;
}

function runMigrations(db: DatabaseSync) {
  const migrationPath = path.resolve(process.cwd(), 'migrations', '001_initial_schema.sql');
  if (fs.existsSync(migrationPath)) {
    const ddl = fs.readFileSync(migrationPath, 'utf-8');
    db.exec(ddl);
  }
}

const DEFAULT_CATEGORIES = [
  { name: 'Income / Salary', slug: 'income', icon: 'Briefcase', color: '#10b981' },
  { name: 'Groceries & Dining', slug: 'food-dining', icon: 'Utensils', color: '#f59e0b' },
  { name: 'Housing & Rent', slug: 'housing', icon: 'Home', color: '#6366f1' },
  { name: 'Utilities & Bills', slug: 'utilities', icon: 'Zap', color: '#06b6d4' },
  { name: 'Transportation & Travel', slug: 'transport', icon: 'Car', color: '#3b82f6' },
  { name: 'Shopping & Retail', slug: 'shopping', icon: 'ShoppingBag', color: '#ec4899' },
  { name: 'Entertainment & Leisure', slug: 'entertainment', icon: 'Film', color: '#8b5cf6' },
  { name: 'Healthcare & Medical', slug: 'health', icon: 'HeartPulse', color: '#ef4444' },
  { name: 'Transfers & Payments', slug: 'transfers', icon: 'Repeat', color: '#64748b' },
  { name: 'Investments & Savings', slug: 'investments', icon: 'TrendingUp', color: '#14b8a6' },
  { name: 'General / Other', slug: 'other', icon: 'Tag', color: '#94a3b8' },
];

function seedDefaultCategories(db: DatabaseSync) {
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM transaction_categories WHERE is_system = 1');
  const result = checkStmt.get() as { count: number };
  if (result.count === 0) {
    const insertStmt = db.prepare(`
      INSERT INTO transaction_categories (id, customer_id, name, slug, icon, color, is_system, created_at)
      VALUES (?, NULL, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `);

    for (const cat of DEFAULT_CATEGORIES) {
      insertStmt.run(generateId(), cat.name, cat.slug, cat.icon, cat.color);
    }
  }
}

// ==============================================================================
// 1. Customer Repository
// ==============================================================================
export const customerRepo = {
  create(data: {
    email: string;
    passwordHash: string;
    salt: string;
    fullName: string;
    phone?: string;
    currency?: string;
  }): CustomerProfile {
    const db = getDatabase();
    const id = generateId();
    const currency = data.currency || 'USD';
    const stmt = db.prepare(`
      INSERT INTO customers (id, email, password_hash, salt, full_name, phone, currency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    stmt.run(id, data.email.toLowerCase().trim(), data.passwordHash, data.salt, data.fullName.trim(), data.phone || null, currency);

    return {
      id,
      email: data.email.toLowerCase().trim(),
      fullName: data.fullName.trim(),
      phone: data.phone || null,
      currency,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  findByEmail(email: string): CustomerUser | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM customers WHERE email = ?');
    const row = stmt.get(email.toLowerCase().trim()) as any;
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      salt: row.salt,
      fullName: row.full_name,
      phone: row.phone,
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  findById(id: string): CustomerProfile | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT id, email, full_name, phone, currency, created_at, updated_at FROM customers WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      phone: row.phone,
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  updateProfile(id: string, data: { fullName?: string; phone?: string; currency?: string }): CustomerProfile | null {
    const db = getDatabase();
    const existing = this.findById(id);
    if (!existing) return null;

    const fullName = data.fullName !== undefined ? data.fullName : existing.fullName;
    const phone = data.phone !== undefined ? data.phone : existing.phone;
    const currency = data.currency !== undefined ? data.currency : existing.currency;

    const stmt = db.prepare(`
      UPDATE customers 
      SET full_name = ?, phone = ?, currency = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const safePhone = phone ?? null;
    stmt.run(fullName, safePhone, currency, id);

    return this.findById(id);
  },
};

// ==============================================================================
// 2. Session Repository
// ==============================================================================
export const sessionRepo = {
  create(customerId: string, tokenHash: string, expiresInDays: number = 7, userAgent?: string): Session {
    const db = getDatabase();
    const id = generateId();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const stmt = db.prepare(`
      INSERT INTO sessions (id, token_hash, customer_id, expires_at, last_active_at, created_at, user_agent)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
    `);
    stmt.run(id, tokenHash, customerId, expiresAt, userAgent || null);

    return {
      id,
      tokenHash,
      customerId,
      expiresAt,
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      userAgent: userAgent || null,
    };
  },

  findByTokenHash(tokenHash: string): Session | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM sessions WHERE token_hash = ?');
    const row = stmt.get(tokenHash) as any;
    if (!row) return null;

    // Check expiration
    if (new Date(row.expires_at).getTime() < Date.now()) {
      this.delete(tokenHash);
      return null;
    }

    // Update last_active_at
    db.prepare('UPDATE sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);

    return {
      id: row.id,
      tokenHash: row.token_hash,
      customerId: row.customer_id,
      expiresAt: row.expires_at,
      lastActiveAt: row.last_active_at,
      createdAt: row.created_at,
      userAgent: row.user_agent,
    };
  },

  delete(tokenHash: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  },

  deleteByCustomer(customerId: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM sessions WHERE customer_id = ?').run(customerId);
  },
};

// ==============================================================================
// 3. Account Repository
// ==============================================================================
export const accountRepo = {
  create(customerId: string, data: {
    accountName: string;
    accountNumberMasked: string;
    accountType: string;
    institutionName: string;
    initialBalance?: number;
    currency?: string;
  }): Account {
    const db = getDatabase();
    const id = generateId();
    const balance = data.initialBalance || 0;
    const currency = data.currency || 'USD';

    const stmt = db.prepare(`
      INSERT INTO accounts (id, customer_id, account_name, account_number_masked, account_type, institution_name, balance, currency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    stmt.run(id, customerId, data.accountName, data.accountNumberMasked, data.accountType, data.institutionName, balance, currency);

    return {
      id,
      customerId,
      accountName: data.accountName,
      accountNumberMasked: data.accountNumberMasked,
      accountType: data.accountType as any,
      institutionName: data.institutionName,
      balance,
      currency,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  listByCustomer(customerId: string): Account[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM accounts WHERE customer_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(customerId) as any[];
    return rows.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      accountName: r.account_name,
      accountNumberMasked: r.account_number_masked,
      accountType: r.account_type,
      institutionName: r.institution_name,
      balance: r.balance,
      currency: r.currency,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  findByIdAndCustomer(id: string, customerId: string): Account | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM accounts WHERE id = ? AND customer_id = ?');
    const r = stmt.get(id, customerId) as any;
    if (!r) return null;
    return {
      id: r.id,
      customerId: r.customer_id,
      accountName: r.account_name,
      accountNumberMasked: r.account_number_masked,
      accountType: r.account_type,
      institutionName: r.institution_name,
      balance: r.balance,
      currency: r.currency,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },

  updateBalance(id: string, customerId: string, deltaBalance: number): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE accounts 
      SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND customer_id = ?
    `);
    stmt.run(deltaBalance, id, customerId);
  },

  update(id: string, customerId: string, data: {
    accountName?: string;
    institutionName?: string;
    accountType?: string;
  }): Account | null {
    const db = getDatabase();
    const existing = this.findByIdAndCustomer(id, customerId);
    if (!existing) return null;

    const accountName = data.accountName?.trim() || existing.accountName;
    const institutionName = data.institutionName?.trim() || existing.institutionName;
    const accountType = data.accountType || existing.accountType;

    db.prepare(`
      UPDATE accounts 
      SET account_name = ?, institution_name = ?, account_type = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND customer_id = ?
    `).run(accountName, institutionName, accountType, id, customerId);

    return this.findByIdAndCustomer(id, customerId);
  },

  countTransactions(id: string, customerId: string): number {
    const db = getDatabase();
    const row = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE account_id = ? AND customer_id = ?').get(id, customerId) as any;
    return row ? row.count : 0;
  },

  deleteSafe(id: string, customerId: string): { success: boolean; reason?: string } {
    const db = getDatabase();
    const existing = this.findByIdAndCustomer(id, customerId);
    if (!existing) return { success: false, reason: 'NOT_FOUND' };

    const txCount = this.countTransactions(id, customerId);
    if (txCount > 0) {
      return { success: false, reason: 'HAS_TRANSACTIONS' };
    }

    const stmt = db.prepare('DELETE FROM accounts WHERE id = ? AND customer_id = ?');
    const result = stmt.run(id, customerId);
    return { success: result.changes > 0 };
  },

  delete(id: string, customerId: string): boolean {
    const res = this.deleteSafe(id, customerId);
    return res.success;
  },
};

// ==============================================================================
// 4. Categories Repository
// ==============================================================================
export const categoryRepo = {
  list(customerId?: string): TransactionCategory[] {
    const db = getDatabase();
    let query = 'SELECT * FROM transaction_categories WHERE is_system = 1';
    let params: any[] = [];
    if (customerId) {
      query += ' OR customer_id = ?';
      params.push(customerId);
    }
    query += ' ORDER BY name ASC';
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      name: r.name,
      slug: r.slug,
      icon: r.icon,
      color: r.color,
      isSystem: Boolean(r.is_system),
      createdAt: r.created_at,
    }));
  },

  getById(id: string): TransactionCategory | null {
    const db = getDatabase();
    const r = db.prepare('SELECT * FROM transaction_categories WHERE id = ?').get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      customerId: r.customer_id,
      name: r.name,
      slug: r.slug,
      icon: r.icon,
      color: r.color,
      isSystem: Boolean(r.is_system),
      createdAt: r.created_at,
    };
  },

  createCustom(customerId: string, data: { name: string; icon?: string; color?: string }): TransactionCategory {
    const db = getDatabase();
    const id = generateId();
    const name = data.name.trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const icon = data.icon || 'Tag';
    const color = data.color || '#6366f1';

    // Check duplicate name for customer
    const existing = db.prepare(`
      SELECT id FROM transaction_categories 
      WHERE (customer_id = ? OR is_system = 1) AND LOWER(name) = LOWER(?)
    `).get(customerId, name) as any;
    if (existing) {
      const err: any = new Error(`A category with name "${name}" already exists.`);
      err.code = 'CATEGORY_DUPLICATE';
      throw err;
    }

    const stmt = db.prepare(`
      INSERT INTO transaction_categories (id, customer_id, name, slug, icon, color, is_system, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `);
    stmt.run(id, customerId, name, slug, icon, color);

    return {
      id,
      customerId,
      name,
      slug,
      icon,
      color,
      isSystem: false,
      createdAt: new Date().toISOString(),
    };
  },

  getDefaultCategoryId(): string {
    const db = getDatabase();
    const row = db.prepare("SELECT id FROM transaction_categories WHERE slug = 'other' LIMIT 1").get() as any;
    return row ? row.id : 'other';
  },

  recordCorrection(customerId: string, merchantPattern: string, categoryId: string): void {
    const db = getDatabase();
    const pattern = merchantPattern.trim().toLowerCase();
    const stmt = db.prepare(`
      INSERT INTO category_corrections (id, customer_id, merchant_pattern, category_id, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(generateId(), customerId, pattern, categoryId);
  },

  findCorrection(customerId: string, description: string): string | null {
    const db = getDatabase();
    const normalized = description.trim().toLowerCase();
    const stmt = db.prepare('SELECT merchant_pattern, category_id FROM category_corrections WHERE customer_id = ?');
    const rows = stmt.all(customerId) as any[];
    for (const r of rows) {
      if (normalized.includes(r.merchant_pattern.toLowerCase())) {
        return r.category_id;
      }
    }
    return null;
  },
};

// ==============================================================================
// 5. Statement Repository
// ==============================================================================
export const statementRepo = {
  create(customerId: string, data: {
    accountId: string;
    fileName: string;
    originalName: string;
    fileSizeBytes: number;
    mimeType: string;
    checksum: string;
    rawTextPreview?: string;
  }): StatementDocument {
    const db = getDatabase();
    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO statement_documents (
        id, customer_id, account_id, file_name, original_name, file_size_bytes, 
        mime_type, checksum, processing_status, extracted_count, imported_count, 
        duplicate_count, raw_text_preview, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', 0, 0, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    stmt.run(
      id,
      customerId,
      data.accountId,
      data.fileName,
      data.originalName,
      data.fileSizeBytes,
      data.mimeType,
      data.checksum,
      data.rawTextPreview || null
    );

    return {
      id,
      customerId,
      accountId: data.accountId,
      fileName: data.fileName,
      originalName: data.originalName,
      fileSizeBytes: data.fileSizeBytes,
      mimeType: data.mimeType,
      checksum: data.checksum,
      processingStatus: 'uploaded',
      extractedCount: 0,
      importedCount: 0,
      duplicateCount: 0,
      rawTextPreview: data.rawTextPreview || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  listByCustomer(customerId: string): StatementDocument[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM statement_documents 
      WHERE customer_id = ? 
      ORDER BY created_at DESC
    `).all(customerId) as any[];

    return rows.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      accountId: r.account_id,
      fileName: r.file_name,
      originalName: r.original_name,
      fileSizeBytes: r.file_size_bytes,
      mimeType: r.mime_type,
      checksum: r.checksum,
      processingStatus: r.processing_status,
      extractedCount: r.extracted_count,
      importedCount: r.imported_count,
      duplicateCount: r.duplicate_count,
      errorMessage: r.error_message,
      rawTextPreview: r.raw_text_preview,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  findByIdAndCustomer(id: string, customerId: string): StatementDocument | null {
    const db = getDatabase();
    const r = db.prepare('SELECT * FROM statement_documents WHERE id = ? AND customer_id = ?').get(id, customerId) as any;
    if (!r) return null;
    return {
      id: r.id,
      customerId: r.customer_id,
      accountId: r.account_id,
      fileName: r.file_name,
      originalName: r.original_name,
      fileSizeBytes: r.file_size_bytes,
      mimeType: r.mime_type,
      checksum: r.checksum,
      processingStatus: r.processing_status,
      extractedCount: r.extracted_count,
      importedCount: r.imported_count,
      duplicateCount: r.duplicate_count,
      errorMessage: r.error_message,
      rawTextPreview: r.raw_text_preview,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },

  updateStatus(
    id: string,
    customerId: string,
    status: StatementDocument['processingStatus'],
    counts?: { extracted?: number; imported?: number; duplicate?: number },
    errorMessage?: string
  ): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE statement_documents 
      SET processing_status = ?,
          extracted_count = COALESCE(?, extracted_count),
          imported_count = COALESCE(?, imported_count),
          duplicate_count = COALESCE(?, duplicate_count),
          error_message = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND customer_id = ?
    `);
    stmt.run(
      status,
      counts?.extracted ?? null,
      counts?.imported ?? null,
      counts?.duplicate ?? null,
      errorMessage || null,
      id,
      customerId
    );
  },

  saveExtractedPreview(id: string, customerId: string, previewRows: any[]): void {
    const db = getDatabase();
    const json = JSON.stringify(previewRows);
    db.prepare(`
      UPDATE statement_documents 
      SET raw_text_preview = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND customer_id = ?
    `).run(json, id, customerId);
  },

  getExtractedPreview(id: string, customerId: string): any[] | null {
    const doc = this.findByIdAndCustomer(id, customerId);
    if (!doc || !doc.rawTextPreview) return null;
    try {
      return JSON.parse(doc.rawTextPreview);
    } catch {
      return null;
    }
  },

  delete(id: string, customerId: string): boolean {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM statement_documents WHERE id = ? AND customer_id = ?').run(id, customerId);
    return result.changes > 0;
  },
};

// ==============================================================================
// 6. Transaction Repository
// ==============================================================================
export const transactionRepo = {
  create(data: {
    customerId: string;
    accountId: string;
    statementId?: string;
    date: string;
    description: string;
    rawDescription?: string;
    amount: number;
    type: 'debit' | 'credit';
    categoryId: string;
    balanceAfter?: number;
    isRecurring?: boolean;
  }): Transaction {
    const db = getDatabase();
    const id = generateId();
    const checksum = generateTransactionChecksum(
      data.customerId,
      data.accountId,
      data.date,
      data.amount,
      data.description
    );

    const stmt = db.prepare(`
      INSERT INTO transactions (
        id, customer_id, account_id, statement_id, date, description, raw_description,
        amount, type, category_id, is_user_corrected, is_recurring, balance_after,
        checksum, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    stmt.run(
      id,
      data.customerId,
      data.accountId,
      data.statementId || null,
      data.date,
      data.description,
      data.rawDescription || null,
      data.amount,
      data.type,
      data.categoryId,
      data.isRecurring ? 1 : 0,
      data.balanceAfter ?? null,
      checksum
    );

    // Update account balance
    const delta = data.type === 'credit' ? data.amount : -data.amount;
    accountRepo.updateBalance(data.accountId, data.customerId, delta);

    return {
      id,
      customerId: data.customerId,
      accountId: data.accountId,
      statementId: data.statementId || null,
      date: data.date,
      description: data.description,
      rawDescription: data.rawDescription || null,
      amount: data.amount,
      type: data.type,
      categoryId: data.categoryId,
      isUserCorrected: false,
      isRecurring: Boolean(data.isRecurring),
      balanceAfter: data.balanceAfter ?? null,
      checksum,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  createManyWithDeduplication(
    customerId: string,
    accountId: string,
    statementId: string,
    items: {
      date: string;
      description: string;
      rawDescription?: string;
      amount: number;
      type: 'debit' | 'credit';
      categoryId: string;
      balanceAfter?: number;
      isRecurring?: boolean;
    }[]
  ): { imported: number; duplicates: number; transactions: Transaction[] } {
    const db = getDatabase();
    let imported = 0;
    let duplicates = 0;
    const createdList: Transaction[] = [];

    const checkStmt = db.prepare('SELECT id FROM transactions WHERE checksum = ? AND customer_id = ?');

    for (const item of items) {
      const checksum = generateTransactionChecksum(
        customerId,
        accountId,
        item.date,
        item.amount,
        item.description
      );

      const existing = checkStmt.get(checksum, customerId);
      if (existing) {
        duplicates++;
        continue;
      }

      // Check if user has an existing category correction for this merchant
      const correctedCategoryId = categoryRepo.findCorrection(customerId, item.description);
      const finalCategoryId = correctedCategoryId || item.categoryId;

      const created = this.create({
        customerId,
        accountId,
        statementId,
        date: item.date,
        description: item.description,
        rawDescription: item.rawDescription,
        amount: item.amount,
        type: item.type,
        categoryId: finalCategoryId,
        balanceAfter: item.balanceAfter,
        isRecurring: item.isRecurring,
      });

      createdList.push(created);
      imported++;
    }

    return { imported, duplicates, transactions: createdList };
  },

  listByCustomer(
    customerId: string,
    filters?: {
      accountId?: string;
      categoryId?: string;
      type?: 'debit' | 'credit';
      startDate?: string;
      endDate?: string;
      search?: string;
      minAmount?: number;
      maxAmount?: number;
      sortBy?: 'date' | 'amount' | 'description' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    }
  ): { transactions: (Transaction & { categoryName: string; categoryColor: string })[]; totalCount: number } {
    const db = getDatabase();
    let whereClauses = ['t.customer_id = ?'];
    let params: any[] = [customerId];

    if (filters?.accountId) {
      whereClauses.push('t.account_id = ?');
      params.push(filters.accountId);
    }
    if (filters?.categoryId) {
      whereClauses.push('t.category_id = ?');
      params.push(filters.categoryId);
    }
    if (filters?.type) {
      whereClauses.push('t.type = ?');
      params.push(filters.type);
    }
    if (filters?.startDate) {
      whereClauses.push('t.date >= ?');
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      whereClauses.push('t.date <= ?');
      params.push(filters.endDate);
    }
    if (filters?.minAmount !== undefined) {
      whereClauses.push('t.amount >= ?');
      params.push(filters.minAmount);
    }
    if (filters?.maxAmount !== undefined) {
      whereClauses.push('t.amount <= ?');
      params.push(filters.maxAmount);
    }
    if (filters?.search) {
      whereClauses.push('(LOWER(t.description) LIKE ? OR LOWER(t.raw_description) LIKE ?)');
      const term = `%${filters.search.toLowerCase().trim()}%`;
      params.push(term, term);
    }

    const whereSql = whereClauses.join(' AND ');

    // Count
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM transactions t WHERE ${whereSql}`).get(...params) as any;
    const totalCount = countRow ? countRow.count : 0;

    // Sorting
    let sortColumn = 't.date';
    if (filters?.sortBy === 'amount') sortColumn = 't.amount';
    else if (filters?.sortBy === 'description') sortColumn = 't.description';
    else if (filters?.sortBy === 'createdAt') sortColumn = 't.created_at';

    const direction = filters?.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Data query with category join
    let sql = `
      SELECT t.*, c.name as category_name, c.color as category_color
      FROM transactions t
      LEFT JOIN transaction_categories c ON t.category_id = c.id
      WHERE ${whereSql}
      ORDER BY ${sortColumn} ${direction}, t.created_at DESC
    `;

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    sql += ` LIMIT ? OFFSET ?`;
    const rows = db.prepare(sql).all(...params, limit, offset) as any[];

    const transactions = rows.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      accountId: r.account_id,
      statementId: r.statement_id,
      date: r.date,
      description: r.description,
      rawDescription: r.raw_description,
      amount: r.amount,
      type: r.type,
      categoryId: r.category_id,
      categoryName: r.category_name || 'Uncategorized',
      categoryColor: r.category_color || '#94a3b8',
      isUserCorrected: Boolean(r.is_user_corrected),
      isRecurring: Boolean(r.is_recurring),
      balanceAfter: r.balance_after,
      checksum: r.checksum,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return { transactions, totalCount };
  },

  findByIdAndCustomer(id: string, customerId: string): Transaction | null {
    const db = getDatabase();
    const r = db.prepare('SELECT * FROM transactions WHERE id = ? AND customer_id = ?').get(id, customerId) as any;
    if (!r) return null;
    return {
      id: r.id,
      customerId: r.customer_id,
      accountId: r.account_id,
      statementId: r.statement_id,
      date: r.date,
      description: r.description,
      rawDescription: r.raw_description,
      amount: r.amount,
      type: r.type,
      categoryId: r.category_id,
      isUserCorrected: Boolean(r.is_user_corrected),
      isRecurring: Boolean(r.is_recurring),
      balanceAfter: r.balance_after,
      checksum: r.checksum,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },

  updateCategory(id: string, customerId: string, newCategoryId: string, applyToMerchant: boolean = false): boolean {
    const db = getDatabase();
    const existing = this.findByIdAndCustomer(id, customerId);
    if (!existing) return false;

    db.prepare(`
      UPDATE transactions 
      SET category_id = ?, is_user_corrected = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND customer_id = ?
    `).run(newCategoryId, id, customerId);

    if (applyToMerchant) {
      // Record merchant pattern correction
      categoryRepo.recordCorrection(customerId, existing.description, newCategoryId);
      // Update other matching historical transactions
      db.prepare(`
        UPDATE transactions
        SET category_id = ?, is_user_corrected = 1, updated_at = CURRENT_TIMESTAMP
        WHERE customer_id = ? AND LOWER(description) = LOWER(?)
      `).run(newCategoryId, customerId, existing.description);
    }

    return true;
  },

  delete(id: string, customerId: string): boolean {
    const db = getDatabase();
    const existing = this.findByIdAndCustomer(id, customerId);
    if (!existing) return false;

    // Adjust balance back
    const reverseDelta = existing.type === 'credit' ? -existing.amount : existing.amount;
    accountRepo.updateBalance(existing.accountId, customerId, reverseDelta);

    const result = db.prepare('DELETE FROM transactions WHERE id = ? AND customer_id = ?').run(id, customerId);
    return result.changes > 0;
  },

  // --------------------------------------------------------------------------
  // Financial Analytics & Intelligence Calculations (Deterministic Backend)
  // --------------------------------------------------------------------------

  getAnalyticsSummary(customerId: string, options?: { accountId?: string; startDate?: string; endDate?: string }) {
    const db = getDatabase();
    let whereClauses = ['t.customer_id = ?'];
    let params: any[] = [customerId];

    if (options?.accountId) {
      whereClauses.push('t.account_id = ?');
      params.push(options.accountId);
    }
    if (options?.startDate) {
      whereClauses.push('t.date >= ?');
      params.push(options.startDate);
    }
    if (options?.endDate) {
      whereClauses.push('t.date <= ?');
      params.push(options.endDate);
    }

    const whereSql = whereClauses.join(' AND ');

    // Aggregate totals with distinction between pure income/expense vs transfers/refunds
    const query = `
      SELECT 
        SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END) as gross_credits,
        SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END) as gross_debits,
        SUM(CASE 
          WHEN t.type = 'credit' AND c.slug != 'transfers' AND LOWER(t.description) NOT LIKE '%transfer%' AND LOWER(t.description) NOT LIKE '%refund%'
          THEN t.amount ELSE 0 
        END) as pure_income,
        SUM(CASE 
          WHEN t.type = 'debit' AND c.slug != 'transfers' AND LOWER(t.description) NOT LIKE '%transfer%' AND LOWER(t.description) NOT LIKE '%credit card payment%'
          THEN t.amount ELSE 0 
        END) as pure_expenses,
        COUNT(*) as total_transactions
      FROM transactions t
      LEFT JOIN transaction_categories c ON t.category_id = c.id
      WHERE ${whereSql}
    `;

    const row = db.prepare(query).get(...params) as any;

    const grossCredits = Number(row?.gross_credits || 0);
    const grossDebits = Number(row?.gross_debits || 0);
    const pureIncome = Number(row?.pure_income || 0);
    const pureExpenses = Number(row?.pure_expenses || 0);
    const totalTransactions = Number(row?.total_transactions || 0);

    // Sum balances across accounts
    let accountsQuery = 'SELECT SUM(balance) as total_balance, currency FROM accounts WHERE customer_id = ?';
    let accParams: any[] = [customerId];
    if (options?.accountId) {
      accountsQuery += ' AND id = ?';
      accParams.push(options.accountId);
    }
    const accRow = db.prepare(accountsQuery).get(...accParams) as any;
    const totalBalance = Number(accRow?.total_balance || 0);
    const currency = accRow?.currency || 'USD';

    const netCashFlow = Number((pureIncome - pureExpenses).toFixed(2));
    const savingsRate = pureIncome > 0 ? Number((((pureIncome - pureExpenses) / pureIncome) * 100).toFixed(1)) : 0;

    return {
      totalBalance: Number(totalBalance.toFixed(2)),
      grossCredits: Number(grossCredits.toFixed(2)),
      grossDebits: Number(grossDebits.toFixed(2)),
      pureIncome: Number(pureIncome.toFixed(2)),
      pureExpenses: Number(pureExpenses.toFixed(2)),
      netCashFlow,
      savingsRate,
      totalTransactions,
      currency,
      dateRange: {
        startDate: options?.startDate || null,
        endDate: options?.endDate || null,
      },
    };
  },

  getMonthlyAnalytics(customerId: string, options?: { accountId?: string; months?: number }) {
    const db = getDatabase();
    let whereClauses = ['t.customer_id = ?'];
    let params: any[] = [customerId];

    if (options?.accountId) {
      whereClauses.push('t.account_id = ?');
      params.push(options.accountId);
    }

    const whereSql = whereClauses.join(' AND ');
    const limitMonths = options?.months || 12;

    const query = `
      SELECT 
        substr(t.date, 1, 7) as month,
        SUM(CASE WHEN t.type = 'credit' AND c.slug != 'transfers' THEN t.amount ELSE 0 END) as income,
        SUM(CASE WHEN t.type = 'debit' AND c.slug != 'transfers' THEN t.amount ELSE 0 END) as expenses,
        COUNT(*) as count
      FROM transactions t
      LEFT JOIN transaction_categories c ON t.category_id = c.id
      WHERE ${whereSql}
      GROUP BY substr(t.date, 1, 7)
      ORDER BY month DESC
      LIMIT ?
    `;

    const rows = db.prepare(query).all(...params, limitMonths) as any[];

    // Sort ascending for chart display
    return rows.reverse().map((r) => {
      const income = Number(Number(r.income || 0).toFixed(2));
      const expenses = Number(Number(r.expenses || 0).toFixed(2));
      const net = Number((income - expenses).toFixed(2));
      return {
        month: r.month,
        income,
        expenses,
        net,
        transactionCount: Number(r.count || 0),
      };
    });
  },

  getCategoryAnalytics(customerId: string, options?: { accountId?: string; startDate?: string; endDate?: string }) {
    const db = getDatabase();
    let whereClauses = ["t.customer_id = ?", "t.type = 'debit'"];
    let params: any[] = [customerId];

    if (options?.accountId) {
      whereClauses.push('t.account_id = ?');
      params.push(options.accountId);
    }
    if (options?.startDate) {
      whereClauses.push('t.date >= ?');
      params.push(options.startDate);
    }
    if (options?.endDate) {
      whereClauses.push('t.date <= ?');
      params.push(options.endDate);
    }

    const whereSql = whereClauses.join(' AND ');

    // Total expense sum for percentage calculation
    const totalRow = db.prepare(`SELECT SUM(amount) as total FROM transactions t WHERE ${whereSql}`).get(...params) as any;
    const totalExpense = Number(totalRow?.total || 0);

    const query = `
      SELECT 
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        c.slug as category_slug,
        SUM(t.amount) as amount,
        COUNT(t.id) as count
      FROM transactions t
      LEFT JOIN transaction_categories c ON t.category_id = c.id
      WHERE ${whereSql}
      GROUP BY c.id, c.name, c.color, c.icon, c.slug
      ORDER BY amount DESC
    `;

    const rows = db.prepare(query).all(...params) as any[];

    return rows.map((r) => {
      const amount = Number(Number(r.amount || 0).toFixed(2));
      const percentage = totalExpense > 0 ? Number(((amount / totalExpense) * 100).toFixed(1)) : 0;
      return {
        categoryId: r.category_id || 'other',
        categoryName: r.category_name || 'Uncategorized',
        categoryColor: r.category_color || '#94a3b8',
        categoryIcon: r.category_icon || 'Tag',
        categorySlug: r.category_slug || 'other',
        amount,
        percentage,
        transactionCount: Number(r.count || 0),
      };
    });
  },

  getTopCategories(customerId: string, options?: { accountId?: string; limit?: number; startDate?: string; endDate?: string }) {
    const categories = this.getCategoryAnalytics(customerId, options);
    const limit = options?.limit || 5;
    return categories.slice(0, limit);
  },
};

// ==============================================================================
// 7. Conversation & Chat Messages Repository
// ==============================================================================
export const chatRepo = {
  createThread(customerId: string, title: string = 'Financial Consultation'): ConversationThread {
    const db = getDatabase();
    const id = generateId();
    db.prepare(`
      INSERT INTO conversation_threads (id, customer_id, title, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, customerId, title);

    return {
      id,
      customerId,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  listThreadsByCustomer(customerId: string): ConversationThread[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM conversation_threads 
      WHERE customer_id = ? 
      ORDER BY updated_at DESC
    `).all(customerId) as any[];

    return rows.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      title: r.title,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  getThreadByIdAndCustomer(id: string, customerId: string): ConversationThread | null {
    const db = getDatabase();
    const r = db.prepare('SELECT * FROM conversation_threads WHERE id = ? AND customer_id = ?').get(id, customerId) as any;
    if (!r) return null;
    return {
      id: r.id,
      customerId: r.customer_id,
      title: r.title,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  },

  updateThreadTitle(id: string, customerId: string, title: string): ConversationThread | null {
    const db = getDatabase();
    const existing = this.getThreadByIdAndCustomer(id, customerId);
    if (!existing) return null;

    db.prepare(`
      UPDATE conversation_threads 
      SET title = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND customer_id = ?
    `).run(title.trim(), id, customerId);

    return this.getThreadByIdAndCustomer(id, customerId);
  },

  deleteThread(id: string, customerId: string): boolean {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM conversation_threads WHERE id = ? AND customer_id = ?').run(id, customerId);
    return result.changes > 0;
  },

  addMessage(
    customerId: string,
    threadId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    groundingsJson?: string
  ): ChatMessage {
    const db = getDatabase();
    const id = generateId();

    db.prepare(`
      INSERT INTO chat_messages (id, customer_id, thread_id, role, content, groundings_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, customerId, threadId, role, content, groundingsJson || null);

    // Update thread updated_at
    db.prepare('UPDATE conversation_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(threadId);

    return {
      id,
      customerId,
      threadId,
      role,
      content,
      groundingsJson: groundingsJson || null,
      createdAt: new Date().toISOString(),
    };
  },

  listMessagesByThread(threadId: string, customerId: string): ChatMessage[] {
    const db = getDatabase();
    // Validate thread ownership
    const thread = this.getThreadByIdAndCustomer(threadId, customerId);
    if (!thread) return [];

    const rows = db.prepare(`
      SELECT * FROM chat_messages 
      WHERE thread_id = ? AND customer_id = ? 
      ORDER BY created_at ASC
    `).all(threadId, customerId) as any[];

    return rows.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      threadId: r.thread_id,
      role: r.role,
      content: r.content,
      groundingsJson: r.groundings_json,
      createdAt: r.created_at,
    }));
  },
};
