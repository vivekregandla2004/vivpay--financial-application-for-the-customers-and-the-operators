/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getSupabaseAdmin } from './supabase.ts';
import {
  CustomerProfile,
  Account,
  StatementDocument,
  Transaction,
  TransactionCategory,
  ConversationThread,
  ChatMessage,
} from '../../types/database.ts';
import {
  FinancialIdentity,
  CognitiveAIProfile,
  FinancialGoal,
} from '../../lib/identity/types.ts';
import {
  CollaborativeGroup,
  GroupMember,
  SharedExpense,
  GroupSnapshot,
  GroupVisibilityTier,
} from '../../lib/groups/types.ts';
import { DocumentChunk } from '../../lib/rag/types.ts';
import {
  CaseRecord,
  FraudAlert,
  InvestigationRecord,
  AuditLogEntry,
  SystemUser,
  OperationalAnalyticsData,
} from '../../types/operations.ts';
import { calculateGroupSettlements } from '../../lib/groups/settlement.ts';
import { sanitizeMemberSnapshot } from '../../lib/groups/privacy.ts';
import { generateTransactionChecksum } from '../auth/crypto.ts';

// Storage bucket constant
export const STORAGE_BUCKET = 'statement-vault';

// ==============================================================================
// 1. Supabase Customer Repository
// ==============================================================================
export const supabaseCustomerRepo = {
  async getProfile(customerId: string): Promise<CustomerProfile | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('customers')
      .select('id, email, full_name, phone, currency, created_at, updated_at')
      .eq('id', customerId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      phone: data.phone,
      currency: data.currency,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async updateProfile(
    customerId: string,
    data: { fullName?: string; phone?: string; currency?: string }
  ): Promise<CustomerProfile | null> {
    const supabase = getSupabaseAdmin();
    const updates: any = { updated_at: new Date().toISOString() };
    if (data.fullName !== undefined) updates.full_name = data.fullName.trim();
    if (data.phone !== undefined) updates.phone = data.phone.trim() || null;
    if (data.currency !== undefined) updates.currency = data.currency.trim().toUpperCase();

    const { data: updated, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId)
      .select()
      .single();

    if (error || !updated) return null;

    return {
      id: updated.id,
      email: updated.email,
      fullName: updated.full_name,
      phone: updated.phone,
      currency: updated.currency,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  },
};

// ==============================================================================
// 2. Supabase Accounts Repository
// ==============================================================================
export const supabaseAccountRepo = {
  async listByCustomer(customerId: string): Promise<Account[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((r: any) => ({
      id: r.id,
      customerId: r.customer_id,
      accountName: r.account_name,
      accountNumberMasked: r.account_number_masked,
      accountType: r.account_type,
      institutionName: r.institution_name,
      balance: Number(r.balance),
      currency: r.currency,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  async findById(id: string, customerId: string): Promise<Account | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .eq('customer_id', customerId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      customerId: data.customer_id,
      accountName: data.account_name,
      accountNumberMasked: data.account_number_masked,
      accountType: data.account_type,
      institutionName: data.institution_name,
      balance: Number(data.balance),
      currency: data.currency,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async create(
    customerId: string,
    data: {
      accountName: string;
      accountNumberMasked: string;
      accountType: string;
      institutionName: string;
      initialBalance?: number;
      currency?: string;
    }
  ): Promise<Account> {
    const supabase = getSupabaseAdmin();
    const balance = data.initialBalance || 0;
    const currency = data.currency || 'USD';

    const { data: inserted, error } = await supabase
      .from('accounts')
      .insert({
        customer_id: customerId,
        account_name: data.accountName,
        account_number_masked: data.accountNumberMasked,
        account_type: data.accountType,
        institution_name: data.institutionName,
        balance,
        currency,
      })
      .select()
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to create account: ${error?.message}`);
    }

    return {
      id: inserted.id,
      customerId: inserted.customer_id,
      accountName: inserted.account_name,
      accountNumberMasked: inserted.account_number_masked,
      accountType: inserted.account_type,
      institutionName: inserted.institution_name,
      balance: Number(inserted.balance),
      currency: inserted.currency,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    };
  },

  async update(
    id: string,
    customerId: string,
    data: {
      accountName?: string;
      institutionName?: string;
      accountType?: string;
    }
  ): Promise<Account | null> {
    const supabase = getSupabaseAdmin();
    const updates: any = { updated_at: new Date().toISOString() };
    if (data.accountName !== undefined) updates.account_name = data.accountName.trim();
    if (data.institutionName !== undefined) updates.institution_name = data.institutionName.trim();
    if (data.accountType !== undefined) updates.account_type = data.accountType;

    const { data: updated, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .eq('customer_id', customerId)
      .select()
      .single();

    if (error || !updated) return null;

    return {
      id: updated.id,
      customerId: updated.customer_id,
      accountName: updated.account_name,
      accountNumberMasked: updated.account_number_masked,
      accountType: updated.account_type,
      institutionName: updated.institution_name,
      balance: Number(updated.balance),
      currency: updated.currency,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  },

  async countTransactions(id: string, customerId: string): Promise<number> {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', id)
      .eq('customer_id', customerId);

    return !error && count !== null ? count : 0;
  },

  async deleteSafe(id: string, customerId: string): Promise<{ success: boolean; reason?: string }> {
    const existing = await this.findById(id, customerId);
    if (!existing) return { success: false, reason: 'NOT_FOUND' };

    const txCount = await this.countTransactions(id, customerId);
    if (txCount > 0) {
      return { success: false, reason: 'HAS_TRANSACTIONS' };
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)
      .eq('customer_id', customerId);

    return { success: !error };
  },

  async updateBalance(id: string, customerId: string, delta: number): Promise<void> {
    const existing = await this.findById(id, customerId);
    if (!existing) return;

    const newBalance = Number((existing.balance + delta).toFixed(2));
    const supabase = getSupabaseAdmin();
    await supabase
      .from('accounts')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('customer_id', customerId);
  },
};

// ==============================================================================
// 3. Supabase Categories Repository
// ==============================================================================
export const supabaseCategoryRepo = {
  async list(customerId?: string): Promise<TransactionCategory[]> {
    const supabase = getSupabaseAdmin();
    let query = supabase.from('transaction_categories').select('*');

    if (customerId) {
      query = query.or(`is_system.eq.true,customer_id.eq.${customerId}`);
    } else {
      query = query.eq('is_system', true);
    }

    const { data, error } = await query.order('name', { ascending: true });
    if (error || !data) return [];

    return data.map((r: any) => ({
      id: r.id,
      customerId: r.customer_id,
      name: r.name,
      slug: r.slug,
      icon: r.icon,
      color: r.color,
      isSystem: r.is_system,
      createdAt: r.created_at,
    }));
  },

  async getById(id: string): Promise<TransactionCategory | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('transaction_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      customerId: data.customer_id,
      name: data.name,
      slug: data.slug,
      icon: data.icon,
      color: data.color,
      isSystem: data.is_system,
      createdAt: data.created_at,
    };
  },

  async createCustom(customerId: string, data: { name: string; icon?: string; color?: string }): Promise<TransactionCategory> {
    const supabase = getSupabaseAdmin();
    const name = data.name.trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const icon = data.icon || 'Tag';
    const color = data.color || '#6366f1';

    // Check duplicate
    const { data: existing } = await supabase
      .from('transaction_categories')
      .select('id')
      .or(`customer_id.eq.${customerId},is_system.eq.true`)
      .ilike('name', name);

    if (existing && existing.length > 0) {
      const err: any = new Error(`A category with name "${name}" already exists.`);
      err.code = 'CATEGORY_DUPLICATE';
      throw err;
    }

    const { data: inserted, error } = await supabase
      .from('transaction_categories')
      .insert({
        customer_id: customerId,
        name,
        slug,
        icon,
        color,
        is_system: false,
      })
      .select()
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to create category: ${error?.message}`);
    }

    return {
      id: inserted.id,
      customerId: inserted.customer_id,
      name: inserted.name,
      slug: inserted.slug,
      icon: inserted.icon,
      color: inserted.color,
      isSystem: false,
      createdAt: inserted.created_at,
    };
  },

  async recordCorrection(customerId: string, merchantPattern: string, categoryId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    await supabase.from('category_corrections').insert({
      customer_id: customerId,
      merchant_pattern: merchantPattern.trim().toLowerCase(),
      category_id: categoryId,
    });
  },

  async findCorrection(customerId: string, description: string): Promise<string | null> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('category_corrections')
      .select('merchant_pattern, category_id')
      .eq('customer_id', customerId);

    if (!data) return null;
    const normalized = description.toLowerCase();
    for (const r of data) {
      if (normalized.includes(r.merchant_pattern.toLowerCase())) {
        return r.category_id;
      }
    }
    return null;
  },
};

// ==============================================================================
// 4. Supabase Statements Repository (Database & Storage Bucket)
// ==============================================================================
export const supabaseStatementRepo = {
  async uploadFileToStorage(customerId: string, fileName: string, buffer: Buffer, mimeType: string): Promise<string> {
    const supabase = getSupabaseAdmin();
    const storagePath = `${customerId}/${Date.now()}_${fileName}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.warn(`Storage bucket upload warning (${error.message}). File will be recorded.`);
    }

    return storagePath;
  },

  async downloadFileFromStorage(storagePath: string): Promise<Buffer | null> {
    const supabase = getSupabaseAdmin();
    try {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);
      if (error || !data) return null;
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  },

  async create(
    customerId: string,
    data: {
      accountId: string;
      fileName: string;
      originalName: string;
      storagePath?: string;
      fileSizeBytes: number;
      mimeType: string;
      checksum: string;
      processingStatus?: StatementDocument['processingStatus'];
      extractedCount?: number;
      errorMessage?: string;
      rawTextPreview?: string;
    }
  ): Promise<StatementDocument> {
    const supabase = getSupabaseAdmin();
    const { data: inserted, error } = await supabase
      .from('statement_documents')
      .insert({
        customer_id: customerId,
        account_id: data.accountId,
        file_name: data.fileName,
        original_name: data.originalName,
        storage_path: data.storagePath || null,
        file_size_bytes: data.fileSizeBytes,
        mime_type: data.mimeType,
        checksum: data.checksum,
        processing_status: data.processingStatus || 'uploaded',
        extracted_count: data.extractedCount || 0,
        imported_count: 0,
        duplicate_count: 0,
        error_message: data.errorMessage || null,
        raw_text_preview: data.rawTextPreview || null,
      })
      .select()
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to create statement record: ${error?.message}`);
    }

    return {
      id: inserted.id,
      customerId: inserted.customer_id,
      accountId: inserted.account_id,
      fileName: inserted.file_name,
      originalName: inserted.original_name,
      storagePath: inserted.storage_path,
      fileSizeBytes: Number(inserted.file_size_bytes),
      mimeType: inserted.mime_type,
      checksum: inserted.checksum,
      processingStatus: inserted.processing_status,
      extractedCount: inserted.extracted_count,
      importedCount: inserted.imported_count,
      duplicateCount: inserted.duplicate_count,
      errorMessage: inserted.error_message,
      rawTextPreview: inserted.raw_text_preview,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    };
  },

  async listByCustomer(customerId: string): Promise<StatementDocument[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('statement_documents')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((r: any) => ({
      id: r.id,
      customerId: r.customer_id,
      accountId: r.account_id,
      fileName: r.file_name,
      originalName: r.original_name,
      storagePath: r.storage_path,
      fileSizeBytes: Number(r.file_size_bytes),
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

  async findById(id: string, customerId: string): Promise<StatementDocument | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('statement_documents')
      .select('*')
      .eq('id', id)
      .eq('customer_id', customerId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      customerId: data.customer_id,
      accountId: data.account_id,
      fileName: data.file_name,
      originalName: data.original_name,
      storagePath: data.storage_path,
      fileSizeBytes: Number(data.file_size_bytes),
      mimeType: data.mime_type,
      checksum: data.checksum,
      processingStatus: data.processing_status,
      extractedCount: data.extracted_count,
      importedCount: data.imported_count,
      duplicateCount: data.duplicate_count,
      errorMessage: data.error_message,
      rawTextPreview: data.raw_text_preview,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async updateStatus(
    id: string,
    customerId: string,
    status: StatementDocument['processingStatus'],
    counts?: { extracted?: number; imported?: number; duplicate?: number },
    errorMessage?: string
  ): Promise<void> {
    const supabase = getSupabaseAdmin();
    const updates: any = { processing_status: status, updated_at: new Date().toISOString() };
    if (counts?.extracted !== undefined) updates.extracted_count = counts.extracted;
    if (counts?.imported !== undefined) updates.imported_count = counts.imported;
    if (counts?.duplicate !== undefined) updates.duplicate_count = counts.duplicate;
    if (errorMessage !== undefined) updates.error_message = errorMessage;

    await supabase
      .from('statement_documents')
      .update(updates)
      .eq('id', id)
      .eq('customer_id', customerId);
  },

  async saveExtractedPreview(id: string, customerId: string, previewRows: any[]): Promise<void> {
    const supabase = getSupabaseAdmin();
    await supabase
      .from('statement_documents')
      .update({
        raw_text_preview: JSON.stringify(previewRows),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('customer_id', customerId);
  },

  async getExtractedPreview(id: string, customerId: string): Promise<any[] | null> {
    const doc = await this.findById(id, customerId);
    if (!doc || !doc.rawTextPreview) return null;
    try {
      return JSON.parse(doc.rawTextPreview);
    } catch {
      return null;
    }
  },

  async delete(id: string, customerId: string): Promise<boolean> {
    const doc = await this.findById(id, customerId);
    if (!doc) return false;

    const supabase = getSupabaseAdmin();
    // Try to remove from storage
    if ((doc as any).storage_path) {
      await supabase.storage.from(STORAGE_BUCKET).remove([(doc as any).storage_path]);
    }

    const { error } = await supabase
      .from('statement_documents')
      .delete()
      .eq('id', id)
      .eq('customer_id', customerId);

    return !error;
  },
};

// ==============================================================================
// 5. Supabase Transactions Repository
// ==============================================================================
export const supabaseTransactionRepo = {
  async create(data: {
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
  }): Promise<Transaction> {
    const supabase = getSupabaseAdmin();
    const checksum = generateTransactionChecksum(
      data.customerId,
      data.accountId,
      data.date,
      data.amount,
      data.description
    );

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let finalCategoryId = data.categoryId;
    if (!finalCategoryId || !UUID_REGEX.test(finalCategoryId)) {
      const SYSTEM_CAT_MAP: Record<string, string> = {
        Salary: '3bce1cdd-3add-460c-a153-258a1a913fb2',
        'Food & Dining': '665441a1-1eb9-49ab-b2e7-c23a0f83fc3b',
        Groceries: '39051a35-c293-4525-9755-d21c12b11fd2',
        Fuel: '9717d143-a79c-4736-807c-e3cbe94d9a93',
        Transport: '3a248e7b-c1fb-497a-9ff7-74253c8bfca1',
        Shopping: 'a8c0a5ef-5dc9-4749-bd62-63f4b5c03026',
        Medical: '0cb8d1ca-2563-4a09-b895-df5146973609',
        Utilities: 'fb8d3d3b-4c12-4312-85d2-0294a6c48111',
        Recharge: '5361f80f-3eea-4804-870e-75eabf051446',
        Entertainment: '7877848f-3565-4f39-8079-45936acac74c',
        Investment: 'a0646846-5aeb-4180-b077-46623b7b84a9',
        Insurance: 'ae1d7720-46d0-4e18-aa1b-eafb6e49f8b1',
        Travel: '1ebf82a5-fe45-49c1-9e85-ae3a0ddead09',
        Education: 'c4cc80ac-01a3-4e1a-a41d-cb41d3e12db0',
        'Cash Withdrawal': '687b4bdc-3757-4a2e-9adb-9fa19da2f704',
        Rent: 'fa512715-dde7-4231-bbb2-baa871ee6caf',
        EMI: '774c3925-c5e5-4206-abd8-635b2fb38e35',
        Loan: '0430f149-d150-45be-a9a3-27c295bdfda7',
        Tax: '4bdb24c3-445b-4b19-8dd9-d3686d238f21',
        Transfer: 'fc15e42b-b98e-410d-96bc-fe96270e4cc7',
        UPI: '0aa909dc-1d90-4bd6-b87e-3f760bacf329',
        Others: '478dea5c-1271-42ae-8183-a968dda771ad',
        salary: '3bce1cdd-3add-460c-a153-258a1a913fb2',
        income: '3bce1cdd-3add-460c-a153-258a1a913fb2',
        'cat-income': '3bce1cdd-3add-460c-a153-258a1a913fb2',
        'food-dining': '665441a1-1eb9-49ab-b2e7-c23a0f83fc3b',
        'cat-food': '665441a1-1eb9-49ab-b2e7-c23a0f83fc3b',
        groceries: '39051a35-c293-4525-9755-d21c12b11fd2',
        'cat-groceries': '39051a35-c293-4525-9755-d21c12b11fd2',
        fuel: '9717d143-a79c-4736-807c-e3cbe94d9a93',
        'cat-fuel': '9717d143-a79c-4736-807c-e3cbe94d9a93',
        transport: '3a248e7b-c1fb-497a-9ff7-74253c8bfca1',
        'cat-transport': '3a248e7b-c1fb-497a-9ff7-74253c8bfca1',
        shopping: 'a8c0a5ef-5dc9-4749-bd62-63f4b5c03026',
        'cat-shopping': 'a8c0a5ef-5dc9-4749-bd62-63f4b5c03026',
        entertainment: '7877848f-3565-4f39-8079-45936acac74c',
        'cat-entertainment': '7877848f-3565-4f39-8079-45936acac74c',
        health: '0cb8d1ca-2563-4a09-b895-df5146973609',
        medical: '0cb8d1ca-2563-4a09-b895-df5146973609',
        'cat-health': '0cb8d1ca-2563-4a09-b895-df5146973609',
        utilities: 'fb8d3d3b-4c12-4312-85d2-0294a6c48111',
        'cat-utilities': 'fb8d3d3b-4c12-4312-85d2-0294a6c48111',
        recharge: '5361f80f-3eea-4804-870e-75eabf051446',
        'cat-recharge': '5361f80f-3eea-4804-870e-75eabf051446',
        investment: 'a0646846-5aeb-4180-b077-46623b7b84a9',
        investments: 'a0646846-5aeb-4180-b077-46623b7b84a9',
        'cat-investments': 'a0646846-5aeb-4180-b077-46623b7b84a9',
        insurance: 'ae1d7720-46d0-4e18-aa1b-eafb6e49f8b1',
        'cat-insurance': 'ae1d7720-46d0-4e18-aa1b-eafb6e49f8b1',
        travel: '1ebf82a5-fe45-49c1-9e85-ae3a0ddead09',
        'cat-travel': '1ebf82a5-fe45-49c1-9e85-ae3a0ddead09',
        education: 'c4cc80ac-01a3-4e1a-a41d-cb41d3e12db0',
        'cat-education': 'c4cc80ac-01a3-4e1a-a41d-cb41d3e12db0',
        'cash-withdrawal': '687b4bdc-3757-4a2e-9adb-9fa19da2f704',
        'cat-cash': '687b4bdc-3757-4a2e-9adb-9fa19da2f704',
        rent: 'fa512715-dde7-4231-bbb2-baa871ee6caf',
        housing: 'fa512715-dde7-4231-bbb2-baa871ee6caf',
        'cat-housing': 'fa512715-dde7-4231-bbb2-baa871ee6caf',
        emi: '774c3925-c5e5-4206-abd8-635b2fb38e35',
        'cat-emi': '774c3925-c5e5-4206-abd8-635b2fb38e35',
        loan: '0430f149-d150-45be-a9a3-27c295bdfda7',
        'cat-loan': '0430f149-d150-45be-a9a3-27c295bdfda7',
        tax: '4bdb24c3-445b-4b19-8dd9-d3686d238f21',
        'cat-tax': '4bdb24c3-445b-4b19-8dd9-d3686d238f21',
        transfer: 'fc15e42b-b98e-410d-96bc-fe96270e4cc7',
        transfers: 'fc15e42b-b98e-410d-96bc-fe96270e4cc7',
        'cat-transfers': 'fc15e42b-b98e-410d-96bc-fe96270e4cc7',
        upi: '0aa909dc-1d90-4bd6-b87e-3f760bacf329',
        'cat-upi': '0aa909dc-1d90-4bd6-b87e-3f760bacf329',
        other: '478dea5c-1271-42ae-8183-a968dda771ad',
        others: '478dea5c-1271-42ae-8183-a968dda771ad',
        'cat-other': '478dea5c-1271-42ae-8183-a968dda771ad',
      };
      finalCategoryId = SYSTEM_CAT_MAP[finalCategoryId] || '478dea5c-1271-42ae-8183-a968dda771ad';
    }

    const { data: inserted, error } = await supabase
      .from('transactions')
      .insert({
        customer_id: data.customerId,
        account_id: data.accountId,
        statement_id: data.statementId && UUID_REGEX.test(data.statementId.trim()) ? data.statementId.trim() : null,
        date: data.date,
        description: data.description,
        raw_description: data.rawDescription || null,
        amount: data.amount,
        type: data.type,
        category_id: finalCategoryId,
        is_user_corrected: false,
        is_recurring: Boolean(data.isRecurring),
        balance_after: data.balanceAfter ?? null,
        checksum,
      })
      .select('*, transaction_categories(name, color)')
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to create transaction: ${error?.message}`);
    }

    // Update account balance
    const delta = data.type === 'credit' ? data.amount : -data.amount;
    await supabaseAccountRepo.updateBalance(data.accountId, data.customerId, delta);

    return {
      id: inserted.id,
      customerId: inserted.customer_id,
      accountId: inserted.account_id,
      statementId: inserted.statement_id,
      date: inserted.date,
      description: inserted.description,
      rawDescription: inserted.raw_description,
      amount: Number(inserted.amount),
      type: inserted.type,
      categoryId: inserted.category_id,
      categoryName: inserted.transaction_categories?.name || 'Uncategorized',
      isUserCorrected: inserted.is_user_corrected,
      isRecurring: inserted.is_recurring,
      balanceAfter: inserted.balance_after ? Number(inserted.balance_after) : null,
      checksum: inserted.checksum,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    };
  },

  async createManyWithDeduplication(
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
  ): Promise<{ imported: number; duplicates: number; transactions: Transaction[] }> {
    const supabase = getSupabaseAdmin();
    let imported = 0;
    let duplicates = 0;
    const createdList: Transaction[] = [];

    if (!items || items.length === 0) {
      return { imported: 0, duplicates: 0, transactions: [] };
    }

    // 1. Fetch existing checksums in chunks of 100 to prevent HTTP 414 URI Too Long errors
    const checksums = items.map((i) =>
      generateTransactionChecksum(customerId, accountId, i.date, i.amount, i.description)
    );

    const existingSet = new Set<string>();
    const CHUNK_SIZE = 100;
    for (let c = 0; c < checksums.length; c += CHUNK_SIZE) {
      const slice = checksums.slice(c, c + CHUNK_SIZE);
      const { data: existingRows } = await supabase
        .from('transactions')
        .select('checksum')
        .eq('customer_id', customerId)
        .in('checksum', slice);

      if (existingRows) {
        for (const r of existingRows) {
          if (r.checksum) existingSet.add(r.checksum);
        }
      }
    }

    // 2. Fetch category corrections once upfront for fast in-memory matching
    const { data: correctionsData } = await supabase
      .from('category_corrections')
      .select('merchant_pattern, category_id')
      .eq('customer_id', customerId);
    const corrections = correctionsData || [];

    const findCorrectionInMemory = (description: string): string | null => {
      const normalized = description.toLowerCase();
      for (const r of corrections) {
        if (r.merchant_pattern && normalized.includes(r.merchant_pattern.toLowerCase())) {
          return r.category_id;
        }
      }
      return null;
    };

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const SYSTEM_CAT_MAP: Record<string, string> = {
      Salary: '3bce1cdd-3add-460c-a153-258a1a913fb2',
      'Food & Dining': '665441a1-1eb9-49ab-b2e7-c23a0f83fc3b',
      Groceries: '39051a35-c293-4525-9755-d21c12b11fd2',
      Fuel: '9717d143-a79c-4736-807c-e3cbe94d9a93',
      Transport: '3a248e7b-c1fb-497a-9ff7-74253c8bfca1',
      Shopping: 'a8c0a5ef-5dc9-4749-bd62-63f4b5c03026',
      Medical: '0cb8d1ca-2563-4a09-b895-df5146973609',
      Utilities: 'fb8d3d3b-4c12-4312-85d2-0294a6c48111',
      Recharge: '5361f80f-3eea-4804-870e-75eabf051446',
      Entertainment: '7877848f-3565-4f39-8079-45936acac74c',
      Investment: 'a0646846-5aeb-4180-b077-46623b7b84a9',
      Insurance: 'ae1d7720-46d0-4e18-aa1b-eafb6e49f8b1',
      Travel: '1ebf82a5-fe45-49c1-9e85-ae3a0ddead09',
      Education: 'c4cc80ac-01a3-4e1a-a41d-cb41d3e12db0',
      'Cash Withdrawal': '687b4bdc-3757-4a2e-9adb-9fa19da2f704',
      Rent: 'fa512715-dde7-4231-bbb2-baa871ee6caf',
      EMI: '774c3925-c5e5-4206-abd8-635b2fb38e35',
      Loan: '0430f149-d150-45be-a9a3-27c295bdfda7',
      Tax: '4bdb24c3-445b-4b19-8dd9-d3686d238f21',
      Transfer: 'fc15e42b-b98e-410d-96bc-fe96270e4cc7',
      UPI: '0aa909dc-1d90-4bd6-b87e-3f760bacf329',
      Others: '478dea5c-1271-42ae-8183-a968dda771ad',
      salary: '3bce1cdd-3add-460c-a153-258a1a913fb2',
      income: '3bce1cdd-3add-460c-a153-258a1a913fb2',
      'cat-income': '3bce1cdd-3add-460c-a153-258a1a913fb2',
      'food-dining': '665441a1-1eb9-49ab-b2e7-c23a0f83fc3b',
      'cat-food': '665441a1-1eb9-49ab-b2e7-c23a0f83fc3b',
      groceries: '39051a35-c293-4525-9755-d21c12b11fd2',
      'cat-groceries': '39051a35-c293-4525-9755-d21c12b11fd2',
      fuel: '9717d143-a79c-4736-807c-e3cbe94d9a93',
      'cat-fuel': '9717d143-a79c-4736-807c-e3cbe94d9a93',
      transport: '3a248e7b-c1fb-497a-9ff7-74253c8bfca1',
      'cat-transport': '3a248e7b-c1fb-497a-9ff7-74253c8bfca1',
      shopping: 'a8c0a5ef-5dc9-4749-bd62-63f4b5c03026',
      'cat-shopping': 'a8c0a5ef-5dc9-4749-bd62-63f4b5c03026',
      entertainment: '7877848f-3565-4f39-8079-45936acac74c',
      'cat-entertainment': '7877848f-3565-4f39-8079-45936acac74c',
      health: '0cb8d1ca-2563-4a09-b895-df5146973609',
      medical: '0cb8d1ca-2563-4a09-b895-df5146973609',
      'cat-health': '0cb8d1ca-2563-4a09-b895-df5146973609',
      utilities: 'fb8d3d3b-4c12-4312-85d2-0294a6c48111',
      'cat-utilities': 'fb8d3d3b-4c12-4312-85d2-0294a6c48111',
      recharge: '5361f80f-3eea-4804-870e-75eabf051446',
      'cat-recharge': '5361f80f-3eea-4804-870e-75eabf051446',
      investment: 'a0646846-5aeb-4180-b077-46623b7b84a9',
      investments: 'a0646846-5aeb-4180-b077-46623b7b84a9',
      'cat-investments': 'a0646846-5aeb-4180-b077-46623b7b84a9',
      insurance: 'ae1d7720-46d0-4e18-aa1b-eafb6e49f8b1',
      'cat-insurance': 'ae1d7720-46d0-4e18-aa1b-eafb6e49f8b1',
      travel: '1ebf82a5-fe45-49c1-9e85-ae3a0ddead09',
      'cat-travel': '1ebf82a5-fe45-49c1-9e85-ae3a0ddead09',
      education: 'c4cc80ac-01a3-4e1a-a41d-cb41d3e12db0',
      'cat-education': 'c4cc80ac-01a3-4e1a-a41d-cb41d3e12db0',
      'cash-withdrawal': '687b4bdc-3757-4a2e-9adb-9fa19da2f704',
      'cat-cash': '687b4bdc-3757-4a2e-9adb-9fa19da2f704',
      rent: 'fa512715-dde7-4231-bbb2-baa871ee6caf',
      housing: 'fa512715-dde7-4231-bbb2-baa871ee6caf',
      'cat-housing': 'fa512715-dde7-4231-bbb2-baa871ee6caf',
      emi: '774c3925-c5e5-4206-abd8-635b2fb38e35',
      'cat-emi': '774c3925-c5e5-4206-abd8-635b2fb38e35',
      loan: '0430f149-d150-45be-a9a3-27c295bdfda7',
      'cat-loan': '0430f149-d150-45be-a9a3-27c295bdfda7',
      tax: '4bdb24c3-445b-4b19-8dd9-d3686d238f21',
      'cat-tax': '4bdb24c3-445b-4b19-8dd9-d3686d238f21',
      transfer: 'fc15e42b-b98e-410d-96bc-fe96270e4cc7',
      transfers: 'fc15e42b-b98e-410d-96bc-fe96270e4cc7',
      'cat-transfers': 'fc15e42b-b98e-410d-96bc-fe96270e4cc7',
      upi: '0aa909dc-1d90-4bd6-b87e-3f760bacf329',
      'cat-upi': '0aa909dc-1d90-4bd6-b87e-3f760bacf329',
      other: '478dea5c-1271-42ae-8183-a968dda771ad',
      others: '478dea5c-1271-42ae-8183-a968dda771ad',
      'cat-other': '478dea5c-1271-42ae-8183-a968dda771ad',
    };

    // 3. Prepare items to insert with intra-batch deduplication
    const rowsToInsert: any[] = [];
    let netDelta = 0;

    const validStatementId = statementId && UUID_REGEX.test(statementId.trim()) ? statementId.trim() : null;

    for (const item of items) {
      const checksum = generateTransactionChecksum(customerId, accountId, item.date, item.amount, item.description);
      if (existingSet.has(checksum)) {
        duplicates++;
        continue;
      }

      existingSet.add(checksum); // Ensure rows within the same statement are deduplicated

      const correctedCategoryId = findCorrectionInMemory(item.description);
      let finalCategoryId = correctedCategoryId || item.categoryId;
      if (!finalCategoryId || !UUID_REGEX.test(finalCategoryId)) {
        finalCategoryId = SYSTEM_CAT_MAP[finalCategoryId] || '478dea5c-1271-42ae-8183-a968dda771ad';
      }

      rowsToInsert.push({
        customer_id: customerId,
        account_id: accountId,
        statement_id: validStatementId,
        date: item.date,
        description: item.description,
        raw_description: item.rawDescription || null,
        amount: item.amount,
        type: item.type,
        category_id: finalCategoryId,
        is_user_corrected: false,
        is_recurring: Boolean(item.isRecurring),
        balance_after: item.balanceAfter ?? null,
        checksum,
      });

      netDelta += (item.type === 'credit' ? item.amount : -item.amount);
    }

    // 4. Batch insert into transactions table (batches of 100)
    const BATCH_INSERT_SIZE = 100;
    for (let b = 0; b < rowsToInsert.length; b += BATCH_INSERT_SIZE) {
      const batch = rowsToInsert.slice(b, b + BATCH_INSERT_SIZE);
      const { data: insertedBatch, error: insertErr } = await supabase
        .from('transactions')
        .insert(batch)
        .select('*, transaction_categories(name, color)');

      if (insertErr || !insertedBatch) {
        throw new Error(`Failed to batch insert transactions: ${insertErr?.message}`);
      }

      for (const inserted of insertedBatch) {
        createdList.push({
          id: inserted.id,
          customerId: inserted.customer_id,
          accountId: inserted.account_id,
          statementId: inserted.statement_id,
          date: inserted.date,
          description: inserted.description,
          rawDescription: inserted.raw_description,
          amount: Number(inserted.amount),
          type: inserted.type,
          categoryId: inserted.category_id,
          categoryName: inserted.transaction_categories?.name || 'Uncategorized',
          isUserCorrected: inserted.is_user_corrected,
          isRecurring: inserted.is_recurring,
          balanceAfter: inserted.balance_after ? Number(inserted.balance_after) : null,
          checksum: inserted.checksum,
          createdAt: inserted.created_at,
          updatedAt: inserted.updated_at,
        });
        imported++;
      }
    }

    // 5. Update account balance once with the net total delta
    if (createdList.length > 0) {
      await supabaseAccountRepo.updateBalance(accountId, customerId, Number(netDelta.toFixed(2)));
    }

    return { imported, duplicates, transactions: createdList };
  },

  async listByCustomer(
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
  ): Promise<{ transactions: (Transaction & { categoryName: string; categoryColor: string })[]; totalCount: number }> {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('transactions')
      .select('*, transaction_categories(name, color)', { count: 'exact' })
      .eq('customer_id', customerId);

    if (filters?.accountId) query = query.eq('account_id', filters.accountId);
    if (filters?.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.startDate) query = query.gte('date', filters.startDate);
    if (filters?.endDate) query = query.lte('date', filters.endDate);
    if (filters?.minAmount !== undefined) query = query.gte('amount', filters.minAmount);
    if (filters?.maxAmount !== undefined) query = query.lte('amount', filters.maxAmount);
    if (filters?.search) {
      query = query.or(`description.ilike.%${filters.search.trim()}%,raw_description.ilike.%${filters.search.trim()}%`);
    }

    let sortCol = 'date';
    if (filters?.sortBy === 'amount') sortCol = 'amount';
    else if (filters?.sortBy === 'description') sortCol = 'description';
    else if (filters?.sortBy === 'createdAt') sortCol = 'created_at';

    const ascending = filters?.sortOrder === 'asc';
    query = query.order(sortCol, { ascending }).order('created_at', { ascending: false });

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error || !data) return { transactions: [], totalCount: 0 };

    const transactions = data.map((r: any) => ({
      id: r.id,
      customerId: r.customer_id,
      accountId: r.account_id,
      statementId: r.statement_id,
      date: r.date,
      description: r.description,
      rawDescription: r.raw_description,
      amount: Number(r.amount),
      type: r.type,
      categoryId: r.category_id,
      categoryName: r.transaction_categories?.name || 'Uncategorized',
      categoryColor: r.transaction_categories?.color || '#94a3b8',
      isUserCorrected: r.is_user_corrected,
      isRecurring: r.is_recurring,
      balanceAfter: r.balance_after ? Number(r.balance_after) : null,
      checksum: r.checksum,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return { transactions, totalCount: count || 0 };
  },

  async findById(id: string, customerId: string): Promise<Transaction | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('transactions')
      .select('*, transaction_categories(name, color)')
      .eq('id', id)
      .eq('customer_id', customerId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      customerId: data.customer_id,
      accountId: data.account_id,
      statementId: data.statement_id,
      date: data.date,
      description: data.description,
      rawDescription: data.raw_description,
      amount: Number(data.amount),
      type: data.type,
      categoryId: data.category_id,
      categoryName: data.transaction_categories?.name || 'Uncategorized',
      isUserCorrected: data.is_user_corrected,
      isRecurring: data.is_recurring,
      balanceAfter: data.balance_after ? Number(data.balance_after) : null,
      checksum: data.checksum,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async updateCategory(id: string, customerId: string, newCategoryId: string, applyToMerchant: boolean = false): Promise<boolean> {
    const existing = await this.findById(id, customerId);
    if (!existing) return false;

    const supabase = getSupabaseAdmin();
    await supabase
      .from('transactions')
      .update({
        category_id: newCategoryId,
        is_user_corrected: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('customer_id', customerId);

    if (applyToMerchant) {
      await supabaseCategoryRepo.recordCorrection(customerId, existing.description, newCategoryId);
      await supabase
        .from('transactions')
        .update({
          category_id: newCategoryId,
          is_user_corrected: true,
          updated_at: new Date().toISOString(),
        })
        .eq('customer_id', customerId)
        .ilike('description', existing.description);
    }

    return true;
  },

  async delete(id: string, customerId: string): Promise<boolean> {
    const existing = await this.findById(id, customerId);
    if (!existing) return false;

    // Adjust balance back
    const reverseDelta = existing.type === 'credit' ? -existing.amount : existing.amount;
    await supabaseAccountRepo.updateBalance(existing.accountId, customerId, reverseDelta);

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('customer_id', customerId);

    return !error;
  },

  // --------------------------------------------------------------------------
  // Financial Analytics & Intelligence Calculations
  // --------------------------------------------------------------------------
  async getAnalyticsSummary(customerId: string, options?: { accountId?: string; startDate?: string; endDate?: string }) {
    const supabase = getSupabaseAdmin();
    const txRows: any[] = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      let query = supabase
        .from('transactions')
        .select('amount, type, description, transaction_categories(slug)')
        .eq('customer_id', customerId);

      if (options?.accountId) query = query.eq('account_id', options.accountId);
      if (options?.startDate) query = query.gte('date', options.startDate);
      if (options?.endDate) query = query.lte('date', options.endDate);

      const { data, error } = await query.range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;
      txRows.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    let grossCredits = 0;
    let grossDebits = 0;
    let pureIncome = 0;
    let pureExpenses = 0;
    let refundCredits = 0;

    for (const r of txRows as any[]) {
      const amt = Number(r.amount || 0);
      const isCredit = r.type === 'credit';
      const slug = r.transaction_categories?.slug || '';
      const desc = (r.description || '').toLowerCase();
      const isTransfer = slug === 'transfers' || desc.includes('transfer') || desc.includes('self transfer') || desc.includes('to own account');
      const isRefundOrReversal = desc.includes('refund') || desc.includes('cashback') || desc.includes('reversal') || desc.includes('chargeback');
      const isCreditCardPayment = slug === 'transfers' || desc.includes('credit card bill') || desc.includes('credit card payment') || desc.includes('cred payment');

      if (isCredit) {
        grossCredits += amt;
        if (isRefundOrReversal) {
          refundCredits += amt;
        } else if (!isTransfer) {
          pureIncome += amt;
        }
      } else {
        grossDebits += amt;
        if (!isTransfer && !isCreditCardPayment) {
          pureExpenses += amt;
        }
      }
    }

    const netAdjustedExpenses = Math.max(0, pureExpenses - refundCredits);

    // Accounts balance (scoped to selected account if filtered, or all customer accounts)
    const accounts = await supabaseAccountRepo.listByCustomer(customerId);
    const targetAccounts = options?.accountId
      ? accounts.filter((a) => a.id === options.accountId)
      : accounts;
    const totalBalance = targetAccounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
    const currency = targetAccounts[0]?.currency || accounts[0]?.currency || 'INR';

    const netCashFlow = Number((pureIncome - netAdjustedExpenses).toFixed(2));
    const savingsRate = pureIncome > 0 ? Number((((pureIncome - netAdjustedExpenses) / pureIncome) * 100).toFixed(1)) : 0;

    return {
      totalBalance: Number(totalBalance.toFixed(2)),
      grossCredits: Number(grossCredits.toFixed(2)),
      grossDebits: Number(grossDebits.toFixed(2)),
      pureIncome: Number(pureIncome.toFixed(2)),
      pureExpenses: Number(pureExpenses.toFixed(2)),
      netAdjustedExpenses: Number(netAdjustedExpenses.toFixed(2)),
      refundCredits: Number(refundCredits.toFixed(2)),
      netCashFlow,
      savingsRate,
      totalTransactions: txRows.length,
      currency,
      dateRange: {
        startDate: options?.startDate || null,
        endDate: options?.endDate || null,
      },
    };
  },

  async getMonthlyAnalytics(customerId: string, options?: { accountId?: string; months?: number }) {
    const supabase = getSupabaseAdmin();
    const rows: any[] = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      let query = supabase
        .from('transactions')
        .select('date, amount, type, transaction_categories(slug)')
        .eq('customer_id', customerId);

      if (options?.accountId) query = query.eq('account_id', options.accountId);

      const { data, error } = await query.range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;
      rows.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    const map = new Map<string, { income: number; expenses: number; count: number }>();

    for (const r of rows as any[]) {
      const month = String(r.date).substring(0, 7);
      const isTransfer = r.transaction_categories?.slug === 'transfers';
      if (isTransfer) continue;

      const amt = Number(r.amount || 0);
      const existing = map.get(month) || { income: 0, expenses: 0, count: 0 };

      if (r.type === 'credit') {
        existing.income += amt;
      } else {
        existing.expenses += amt;
      }
      existing.count++;
      map.set(month, existing);
    }

    const sortedMonths = Array.from(map.keys()).sort();
    const limit = options?.months || 12;
    const sliced = sortedMonths.slice(-limit);

    return sliced.map((m) => {
      const entry = map.get(m)!;
      const inc = Number(entry.income.toFixed(2));
      const exp = Number(entry.expenses.toFixed(2));
      return {
        month: m,
        income: inc,
        expenses: exp,
        net: Number((inc - exp).toFixed(2)),
        transactionCount: entry.count,
      };
    });
  },

  async getCategoryAnalytics(customerId: string, options?: { accountId?: string; startDate?: string; endDate?: string }) {
    const supabase = getSupabaseAdmin();
    const rows: any[] = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      let query = supabase
        .from('transactions')
        .select('amount, transaction_categories(id, name, color, icon, slug)')
        .eq('customer_id', customerId)
        .eq('type', 'debit');

      if (options?.accountId) query = query.eq('account_id', options.accountId);
      if (options?.startDate) query = query.gte('date', options.startDate);
      if (options?.endDate) query = query.lte('date', options.endDate);

      const { data, error } = await query.range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;
      rows.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    const map = new Map<string, { name: string; color: string; icon: string; slug: string; amount: number; count: number }>();
    let totalExpense = 0;

    for (const r of rows as any[]) {
      const amt = Number(r.amount || 0);
      totalExpense += amt;
      const cat = r.transaction_categories || { id: 'other', name: 'General / Other', color: '#94a3b8', icon: 'Tag', slug: 'other' };
      const catId = cat.id || 'other';

      const existing = map.get(catId) || {
        name: cat.name || 'Uncategorized',
        color: cat.color || '#94a3b8',
        icon: cat.icon || 'Tag',
        slug: cat.slug || 'other',
        amount: 0,
        count: 0,
      };

      existing.amount += amt;
      existing.count++;
      map.set(catId, existing);
    }

    const result = Array.from(map.entries()).map(([catId, val]) => ({
      categoryId: catId,
      categoryName: val.name,
      categoryColor: val.color,
      categoryIcon: val.icon,
      categorySlug: val.slug,
      amount: Number(val.amount.toFixed(2)),
      percentage: totalExpense > 0 ? Number(((val.amount / totalExpense) * 100).toFixed(1)) : 0,
      transactionCount: val.count,
    }));

    return result.sort((a, b) => b.amount - a.amount);
  },

  async getTopCategories(customerId: string, options?: { accountId?: string; limit?: number; startDate?: string; endDate?: string }) {
    const list = await this.getCategoryAnalytics(customerId, options);
    return list.slice(0, options?.limit || 5);
  },

  async listAllForCustomer(
    customerId: string,
    options?: { accountId?: string; startDate?: string; endDate?: string }
  ): Promise<(Transaction & { categoryName: string; categoryColor: string })[]> {
    const supabase = getSupabaseAdmin();
    const allTransactions: (Transaction & { categoryName: string; categoryColor: string })[] = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      let query = supabase
        .from('transactions')
        .select('*, transaction_categories(name, color)')
        .eq('customer_id', customerId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (options?.accountId) query = query.eq('account_id', options.accountId);
      if (options?.startDate) query = query.gte('date', options.startDate);
      if (options?.endDate) query = query.lte('date', options.endDate);

      const { data, error } = await query.range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;

      for (const r of data) {
        allTransactions.push({
          id: r.id,
          customerId: r.customer_id,
          accountId: r.account_id,
          statementId: r.statement_id,
          date: r.date,
          description: r.description,
          rawDescription: r.raw_description,
          amount: Number(r.amount),
          type: r.type,
          categoryId: r.category_id,
          categoryName: r.transaction_categories?.name || 'Uncategorized',
          categoryColor: r.transaction_categories?.color || '#94a3b8',
          isUserCorrected: r.is_user_corrected,
          isRecurring: r.is_recurring,
          balanceAfter: r.balance_after ? Number(r.balance_after) : null,
          checksum: r.checksum,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        });
      }

      if (data.length < batchSize) break;
      from += batchSize;
    }

    return allTransactions;
  },
};

// ==============================================================================
// 6. Supabase Conversation & Chat Repository
// ==============================================================================
export const supabaseChatRepo = {
  async createThread(customerId: string, title: string = 'Financial Consultation'): Promise<ConversationThread> {
    const supabase = getSupabaseAdmin();
    const { data: inserted, error } = await supabase
      .from('conversation_threads')
      .insert({
        customer_id: customerId,
        title,
      })
      .select()
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to create thread: ${error?.message}`);
    }

    return {
      id: inserted.id,
      customerId: inserted.customer_id,
      title: inserted.title,
      createdAt: inserted.created_at,
      updatedAt: inserted.updated_at,
    };
  },

  async listThreadsByCustomer(customerId: string): Promise<ConversationThread[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('conversation_threads')
      .select('*')
      .eq('customer_id', customerId)
      .order('updated_at', { ascending: false });

    if (error || !data) return [];

    return data.map((r: any) => ({
      id: r.id,
      customerId: r.customer_id,
      title: r.title,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  async getThreadById(id: string, customerId: string): Promise<ConversationThread | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('conversation_threads')
      .select('*')
      .eq('id', id)
      .eq('customer_id', customerId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      customerId: data.customer_id,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async updateThreadTitle(id: string, customerId: string, title: string): Promise<ConversationThread | null> {
    const supabase = getSupabaseAdmin();
    const { data: updated, error } = await supabase
      .from('conversation_threads')
      .update({ title: title.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('customer_id', customerId)
      .select()
      .single();

    if (error || !updated) return null;

    return {
      id: updated.id,
      customerId: updated.customer_id,
      title: updated.title,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  },

  async deleteThread(id: string, customerId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('conversation_threads')
      .delete()
      .eq('id', id)
      .eq('customer_id', customerId);

    return !error;
  },

  async addMessage(
    customerId: string,
    threadId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    groundingsJson?: string
  ): Promise<ChatMessage> {
    const supabase = getSupabaseAdmin();
    const parsedGroundings = groundingsJson ? (typeof groundingsJson === 'string' ? JSON.parse(groundingsJson) : groundingsJson) : null;

    const { data: inserted, error } = await supabase
      .from('chat_messages')
      .insert({
        customer_id: customerId,
        thread_id: threadId,
        role,
        content,
        groundings_json: parsedGroundings,
      })
      .select()
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to save chat message: ${error?.message}`);
    }

    // Update thread updated_at
    await supabase
      .from('conversation_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', threadId)
      .eq('customer_id', customerId);

    return {
      id: inserted.id,
      customerId: inserted.customer_id,
      threadId: inserted.thread_id,
      role: inserted.role,
      content: inserted.content,
      groundingsJson: inserted.groundings_json ? JSON.stringify(inserted.groundings_json) : null,
      createdAt: inserted.created_at,
    };
  },

  async listMessagesByThread(threadId: string, customerId: string): Promise<ChatMessage[]> {
    const thread = await this.getThreadById(threadId, customerId);
    if (!thread) return [];

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return data.map((r: any) => ({
      id: r.id,
      customerId: r.customer_id,
      threadId: r.thread_id,
      role: r.role,
      content: r.content,
      groundingsJson: r.groundings_json ? JSON.stringify(r.groundings_json) : null,
      createdAt: r.created_at,
    }));
  },
};

// ==============================================================================
// 7. Supabase Identity & Cognitive Repository
// ==============================================================================
export const supabaseIdentityRepo = {
  async getIdentity(customerId: string): Promise<FinancialIdentity | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('customer_identities')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205') {
        throw new Error("Table 'public.customer_identities' not found in Supabase. Please apply migration 002_user_model_and_intelligence.sql in your Supabase SQL editor.");
      }
      console.error('Error fetching customer identity from Supabase:', error);
      return null;
    }
    if (!data) return null;

    const cognitive = await this.getCognitiveProfile(customerId);
    const goals = await supabaseGoalsRepo.listGoals(customerId);

    return {
      customerId: data.customer_id,
      personal: data.personal || {},
      employment: data.employment || {},
      income: data.income || {},
      commitments: data.commitments || {},
      goals: goals || [],
      risk: data.risk || {},
      behavior: data.behavior || null,
      health: data.health || null,
      completeness: data.completeness || null,
      timeline: data.timeline || [],
      cognitive: cognitive || undefined,
      updatedAt: data.updated_at,
    } as any;
  },

  async upsertIdentity(customerId: string, identity: Partial<FinancialIdentity>): Promise<void> {
    const supabase = getSupabaseAdmin();
    const payload: any = {
      customer_id: customerId,
      updated_at: new Date().toISOString(),
    };
    if (identity.personal) payload.personal = identity.personal;
    if (identity.employment) payload.employment = identity.employment;
    if (identity.income) payload.income = identity.income;
    if (identity.commitments) payload.commitments = identity.commitments;
    if (identity.risk) payload.risk = identity.risk;
    if (identity.behavior) payload.behavior = identity.behavior;
    if ((identity as any).completeness) payload.completeness = (identity as any).completeness;
    if (identity.timeline) payload.timeline = identity.timeline;

    const { error } = await supabase
      .from('customer_identities')
      .upsert(payload, { onConflict: 'customer_id' });

    if (error) {
      if (error.code === 'PGRST205') {
        throw new Error("Table 'public.customer_identities' not found in Supabase. Please apply migration 002_user_model_and_intelligence.sql in your Supabase SQL editor.");
      }
      throw error;
    }

    if (identity.cognitive) {
      await this.upsertCognitiveProfile(customerId, identity.cognitive);
    }
  },

  async getCognitiveProfile(customerId: string): Promise<CognitiveAIProfile | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('cognitive_profiles')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      tone: data.interaction_style || 'analytical',
      financialLiteracy: data.financial_literacy || 'intermediate',
      decisionStyle: data.decision_making_style || 'deliberative',
      detectedBiases: data.cognitive_biases || [],
      keyAnxieties: data.financial_anxieties || [],
      statedPreferences: Array.isArray(data.stated_preferences) ? data.stated_preferences : [],
      topicsToAvoid: data.topics_to_avoid || [],
      conversationMemory: [],
      promptInjectionGuards: [],
    };
  },

  async upsertCognitiveProfile(customerId: string, profile: Partial<CognitiveAIProfile>): Promise<void> {
    const supabase = getSupabaseAdmin();
    const payload: any = {
      customer_id: customerId,
      updated_at: new Date().toISOString(),
    };
    if (profile.tone) payload.interaction_style = profile.tone;
    if (profile.financialLiteracy) payload.financial_literacy = profile.financialLiteracy;
    if (profile.decisionStyle) payload.decision_making_style = profile.decisionStyle;
    if (profile.detectedBiases) payload.cognitive_biases = profile.detectedBiases;
    if (profile.keyAnxieties) payload.financial_anxieties = profile.keyAnxieties;
    if (profile.statedPreferences) payload.stated_preferences = profile.statedPreferences;
    if (profile.topicsToAvoid) payload.topics_to_avoid = profile.topicsToAvoid;

    const { error } = await supabase
      .from('cognitive_profiles')
      .upsert(payload, { onConflict: 'customer_id' });

    if (error && error.code !== 'PGRST205') {
      throw error;
    }
  },
};

// ==============================================================================
// 8. Supabase Financial Goals Repository
// ==============================================================================
export const supabaseGoalsRepo = {
  async listGoals(customerId: string): Promise<FinancialGoal[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('financial_goals')
      .select('*')
      .eq('customer_id', customerId)
      .order('priority', { ascending: true });

    if (error) {
      if (error.code === 'PGRST205') {
        throw new Error("Table 'public.financial_goals' not found in Supabase. Please apply migration 002_user_model_and_intelligence.sql in your Supabase SQL editor.");
      }
      return [];
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      targetAmount: Number(r.target_amount),
      currentSavings: Number(r.current_amount || 0),
      targetDate: r.target_date,
      priority: r.priority,
      monthlyContribution: Number(r.monthly_contribution),
      status: r.status === 'in_progress' ? 'active' : r.status,
      notes: r.notes,
    }));
  },

  async createGoal(customerId: string, goal: Omit<FinancialGoal, 'id'>): Promise<FinancialGoal> {
    const supabase = getSupabaseAdmin();
    const payload = {
      customer_id: customerId,
      name: goal.name,
      target_amount: goal.targetAmount,
      current_amount: goal.currentSavings || 0,
      target_date: goal.targetDate,
      category: 'custom',
      priority: goal.priority || 'medium',
      monthly_contribution: goal.monthlyContribution || 0,
      status: goal.status === 'active' ? 'in_progress' : (goal.status || 'in_progress'),
      notes: goal.notes || null,
    };

    const { data, error } = await supabase
      .from('financial_goals')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST205') {
        throw new Error("Table 'public.financial_goals' not found in Supabase. Please apply migration 002_user_model_and_intelligence.sql in your Supabase SQL editor.");
      }
      throw error;
    }

    return {
      id: data.id,
      name: data.name,
      targetAmount: Number(data.target_amount),
      currentSavings: Number(data.current_amount),
      targetDate: data.target_date,
      priority: data.priority,
      monthlyContribution: Number(data.monthly_contribution),
      status: data.status === 'in_progress' ? 'active' : data.status,
      notes: data.notes,
    };
  },

  async updateGoal(customerId: string, goalId: string, updates: Partial<FinancialGoal>): Promise<FinancialGoal> {
    const supabase = getSupabaseAdmin();
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.targetAmount !== undefined) payload.target_amount = updates.targetAmount;
    if (updates.currentSavings !== undefined) payload.current_amount = updates.currentSavings;
    if (updates.targetDate !== undefined) payload.target_date = updates.targetDate;
    if (updates.priority !== undefined) payload.priority = updates.priority;
    if (updates.monthlyContribution !== undefined) payload.monthly_contribution = updates.monthlyContribution;
    if (updates.status !== undefined) payload.status = updates.status === 'active' ? 'in_progress' : updates.status;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { data, error } = await supabase
      .from('financial_goals')
      .update(payload)
      .eq('id', goalId)
      .eq('customer_id', customerId)
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      targetAmount: Number(data.target_amount),
      currentSavings: Number(data.current_amount),
      targetDate: data.target_date,
      priority: data.priority,
      monthlyContribution: Number(data.monthly_contribution),
      status: data.status === 'in_progress' ? 'active' : data.status,
      notes: data.notes,
    };
  },

  async deleteGoal(customerId: string, goalId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('financial_goals')
      .delete()
      .eq('id', goalId)
      .eq('customer_id', customerId);

    if (error) throw error;
    return true;
  },
};

// ==============================================================================
// 9. Supabase Collaborative Groups Repository
// ==============================================================================
export const supabaseGroupsRepo = {
  async listGroupsForCustomer(customerId: string): Promise<CollaborativeGroup[]> {
    const supabase = getSupabaseAdmin();
    const { data: memberRows, error: mErr } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('customer_id', customerId);

    if (mErr) {
      if (mErr.code === 'PGRST205') {
        throw new Error("Table 'public.group_members' not found in Supabase. Please apply migration 003_collaborative_groups.sql in your Supabase SQL editor.");
      }
      return [];
    }
    if (!memberRows || memberRows.length === 0) return [];

    const groupIds = memberRows.map((r: any) => r.group_id);
    const { data: groupsData, error: gErr } = await supabase
      .from('collaborative_groups')
      .select('*')
      .in('id', groupIds);

    if (gErr || !groupsData) return [];

    const groups: CollaborativeGroup[] = [];
    for (const g of groupsData) {
      const { data: members } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', g.id);

      const { data: expenses } = await supabase
        .from('shared_expenses')
        .select('*')
        .eq('group_id', g.id);

      groups.push({
        id: g.id,
        name: g.name,
        description: g.description,
        createdBy: g.created_by,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
        members: (members || []).map((m: any) => ({
          customerId: m.customer_id,
          fullName: 'Member',
          email: '',
          role: m.role,
          visibility: m.visibility,
          joinedAt: m.joined_at,
        })),
        sharedExpenses: (expenses || []).map((e: any) => ({
          id: e.id,
          groupId: e.group_id,
          title: e.title,
          amount: Number(e.amount),
          paidBy: e.paid_by,
          splitType: e.split_type,
          splits: e.splits || [],
          category: e.category,
          date: e.date,
          isSettled: e.is_settled,
          createdAt: e.created_at,
        })),
      });
    }

    return groups;
  },

  async createGroup(createdBy: string, name: string, description?: string): Promise<CollaborativeGroup> {
    const supabase = getSupabaseAdmin();
    const { data: group, error: gErr } = await supabase
      .from('collaborative_groups')
      .insert({
        name,
        description,
        created_by: createdBy,
      })
      .select()
      .single();

    if (gErr) {
      if (gErr.code === 'PGRST205') {
        throw new Error("Table 'public.collaborative_groups' not found in Supabase. Please apply migration 003_collaborative_groups.sql in your Supabase SQL editor.");
      }
      throw gErr;
    }

    await supabase.from('group_members').insert({
      group_id: group.id,
      customer_id: createdBy,
      role: 'admin',
      visibility: 'category_only',
    });

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      createdBy: group.created_by,
      members: [{
        customerId: createdBy,
        fullName: 'Admin User',
        email: '',
        role: 'admin',
        visibility: 'category_only',
        joinedAt: new Date().toISOString(),
      }],
      sharedExpenses: [],
      createdAt: group.created_at,
      updatedAt: group.updated_at,
    };
  },

  async addMember(groupId: string, member: GroupMember): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('group_members')
      .insert({
        group_id: groupId,
        customer_id: member.customerId,
        role: member.role || 'member',
        visibility: member.visibility || 'category_only',
      });

    if (error) throw error;
  },

  async removeMember(groupId: string, memberIdToRemove: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('customer_id', memberIdToRemove);

    if (error) throw error;
  },

  async updateMemberVisibility(groupId: string, customerId: string, visibility: GroupVisibilityTier): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('group_members')
      .update({ visibility })
      .eq('group_id', groupId)
      .eq('customer_id', customerId);

    if (error) throw error;
  },

  async addSharedExpense(groupId: string, expense: Omit<SharedExpense, 'id' | 'createdAt'>): Promise<SharedExpense> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('shared_expenses')
      .insert({
        group_id: groupId,
        title: expense.title,
        amount: expense.amount,
        paid_by: expense.paidBy,
        split_type: expense.splitType,
        splits: expense.splits,
        category: expense.category,
        date: expense.date,
        is_settled: expense.isSettled ?? false,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      groupId: data.group_id,
      title: data.title,
      amount: Number(data.amount),
      paidBy: data.paid_by,
      splitType: data.split_type,
      splits: data.splits,
      category: data.category,
      date: data.date,
      isSettled: data.is_settled,
      createdAt: data.created_at,
    };
  },
};

// ==============================================================================
// 10. Supabase RAG Knowledge Repository
// ==============================================================================
export const supabaseRAGRepo = {
  async addChunks(customerId: string, chunks: DocumentChunk[]): Promise<void> {
    const supabase = getSupabaseAdmin();
    if (chunks.length === 0) return;

    const rows = chunks.map((c) => ({
      id: c.id,
      document_id: c.documentId,
      customer_id: customerId,
      chunk_index: c.chunkIndex,
      title: c.title,
      content: c.content,
      metadata: c.metadata,
      embedding: c.embedding,
    }));

    const { error } = await supabase.from('document_chunks').upsert(rows);
    if (error) {
      if (error.code === 'PGRST205') {
        throw new Error("Table 'public.document_chunks' not found in Supabase. Please apply migration 004_rag_pgvector.sql in your Supabase SQL editor.");
      }
      throw error;
    }
  },

  async removeDocument(customerId: string, documentId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('document_chunks')
      .delete()
      .eq('customer_id', customerId)
      .eq('document_id', documentId);

    if (error && error.code !== 'PGRST205') throw error;
  },

  async matchChunks(queryEmbedding: number[], customerId: string, limit: number = 5, threshold: number = 0.40): Promise<DocumentChunk[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      filter_customer_id: customerId,
    });

    if (error) {
      console.warn('match_document_chunks RPC warning:', error.message);
      return [];
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      documentId: r.document_id,
      customerId: r.customer_id,
      chunkIndex: r.chunk_index,
      title: r.title,
      content: r.content,
      metadata: r.metadata,
      embedding: [],
      createdAt: '',
    }));
  },
};

// ==============================================================================
// 11. Supabase Operations Repository
// ==============================================================================
export const supabaseOperationsRepo = {
  async getCases(): Promise<CaseRecord[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('operational_cases')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        throw new Error("Table 'public.operational_cases' not found in Supabase. Please apply migration 005_operations_and_audit.sql in your Supabase SQL editor.");
      }
      return [];
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      caseNumber: r.case_number,
      title: r.title,
      customerId: r.customer_id || '',
      customerName: r.customer_name,
      accountNumberMasked: r.account_number_masked,
      category: r.category,
      priority: r.priority,
      status: r.status,
      assignedTo: r.assigned_to,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  async updateCase(id: string, updates: Partial<CaseRecord>): Promise<CaseRecord> {
    const supabase = getSupabaseAdmin();
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.status) payload.status = updates.status;
    if (updates.priority) payload.priority = updates.priority;
    if (updates.assignedTo) payload.assigned_to = updates.assignedTo;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { data, error } = await supabase
      .from('operational_cases')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      caseNumber: data.case_number,
      title: data.title,
      customerId: data.customer_id || '',
      customerName: data.customer_name,
      accountNumberMasked: data.account_number_masked,
      category: data.category,
      priority: data.priority,
      status: data.status,
      assignedTo: data.assigned_to,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async getFraudAlerts(): Promise<FraudAlert[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('fraud_alerts')
      .select('*')
      .order('detected_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        throw new Error("Table 'public.fraud_alerts' not found in Supabase. Please apply migration 005_operations_and_audit.sql in your Supabase SQL editor.");
      }
      return [];
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      alertId: r.alert_id,
      customerId: r.customer_id || '',
      customerName: r.customer_name,
      amount: Number(r.amount),
      currency: r.currency,
      merchant: r.merchant,
      riskScore: r.risk_score,
      triggerReason: r.trigger_reason,
      status: r.status,
      investigatorNotes: r.investigator_notes,
      detectedAt: r.detected_at,
    }));
  },

  async updateFraudAlert(id: string, updates: Partial<FraudAlert>): Promise<FraudAlert> {
    const supabase = getSupabaseAdmin();
    const payload: any = {};
    if (updates.status) payload.status = updates.status;
    if (updates.investigatorNotes !== undefined) payload.investigator_notes = updates.investigatorNotes;

    const { data, error } = await supabase
      .from('fraud_alerts')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      alertId: data.alert_id,
      customerId: data.customer_id || '',
      customerName: data.customer_name,
      amount: Number(data.amount),
      currency: data.currency,
      merchant: data.merchant,
      riskScore: data.risk_score,
      triggerReason: data.trigger_reason,
      status: data.status,
      investigatorNotes: data.investigator_notes,
      detectedAt: data.detected_at,
    };
  },

  async getInvestigations(): Promise<InvestigationRecord[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('investigations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST205') {
        throw new Error("Table 'public.investigations' not found in Supabase. Please apply migration 005_operations_and_audit.sql in your Supabase SQL editor.");
      }
      return [];
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      caseNumber: r.case_number,
      title: r.title,
      targetCustomerId: r.target_customer_id || '',
      targetCustomerName: r.target_customer_name,
      linkedAlertId: r.linked_alert_id,
      priority: r.priority,
      status: r.status,
      leadInvestigator: r.lead_investigator,
      evidenceNotes: r.evidence_notes || [],
      flaggedAmount: Number(r.flagged_amount),
      currency: r.currency,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  async createInvestigation(data: any): Promise<InvestigationRecord> {
    const supabase = getSupabaseAdmin();
    const caseNumber = `INV-2026-${String(Date.now()).slice(-4)}`;
    const payload = {
      case_number: caseNumber,
      title: data.title,
      target_customer_id: data.targetCustomerId || null,
      target_customer_name: data.targetCustomerName,
      linked_alert_id: data.linkedAlertId || null,
      priority: data.priority || 'high',
      status: 'open',
      lead_investigator: data.leadInvestigator || 'Sarah Chen',
      evidence_notes: data.initialEvidence ? [data.initialEvidence] : [],
      flagged_amount: data.flaggedAmount || 0,
      currency: data.currency || 'USD',
    };

    const { data: res, error } = await supabase
      .from('investigations')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return {
      id: res.id,
      caseNumber: res.case_number,
      title: res.title,
      targetCustomerId: res.target_customer_id || '',
      targetCustomerName: res.target_customer_name,
      linkedAlertId: res.linked_alert_id,
      priority: res.priority,
      status: res.status,
      leadInvestigator: res.lead_investigator,
      evidenceNotes: res.evidence_notes || [],
      flaggedAmount: Number(res.flagged_amount),
      currency: res.currency,
      createdAt: res.created_at,
      updatedAt: res.updated_at,
    };
  },

  async getCaseById(id: string): Promise<CaseRecord | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('operational_cases')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      caseNumber: data.case_number,
      title: data.title,
      customerId: data.customer_id || '',
      customerName: data.customer_name,
      accountNumberMasked: data.account_number_masked,
      category: data.category,
      priority: data.priority,
      status: data.status,
      assignedTo: data.assigned_to,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async createCase(data: {
    title: string;
    customerId?: string;
    customerName: string;
    accountNumberMasked: string;
    category: CaseRecord['category'];
    priority: CaseRecord['priority'];
    status?: CaseRecord['status'];
    assignedTo: string;
    notes?: string;
  }): Promise<CaseRecord> {
    const supabase = getSupabaseAdmin();
    const caseNumber = `CAS-2026-${String(Date.now()).slice(-4)}`;
    const payload = {
      case_number: caseNumber,
      title: data.title,
      customer_id: data.customerId || null,
      customer_name: data.customerName,
      account_number_masked: data.accountNumberMasked,
      category: data.category,
      priority: data.priority,
      status: data.status || 'open',
      assigned_to: data.assignedTo || 'Unassigned',
      notes: data.notes || '',
    };

    const { data: res, error } = await supabase
      .from('operational_cases')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return {
      id: res.id,
      caseNumber: res.case_number,
      title: res.title,
      customerId: res.customer_id || '',
      customerName: res.customer_name,
      accountNumberMasked: res.account_number_masked,
      category: res.category,
      priority: res.priority,
      status: res.status,
      assignedTo: res.assigned_to,
      notes: res.notes,
      createdAt: res.created_at,
      updatedAt: res.updated_at,
    };
  },

  async getFraudAlertById(id: string): Promise<FraudAlert | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('fraud_alerts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      alertId: data.alert_id,
      customerId: data.customer_id || '',
      customerName: data.customer_name,
      amount: Number(data.amount),
      currency: data.currency,
      merchant: data.merchant,
      riskScore: data.risk_score,
      triggerReason: data.trigger_reason,
      status: data.status,
      investigatorNotes: data.investigator_notes,
      detectedAt: data.detected_at,
    };
  },

  async createFraudAlert(data: {
    customerId?: string;
    customerName: string;
    amount: number;
    currency?: string;
    merchant: string;
    riskScore: number;
    triggerReason: string;
    status?: FraudAlert['status'];
    investigatorNotes?: string;
  }): Promise<FraudAlert> {
    const supabase = getSupabaseAdmin();
    const alertId = `ALT-${String(Date.now()).slice(-4)}`;
    const payload = {
      alert_id: alertId,
      customer_id: data.customerId || null,
      customer_name: data.customerName,
      amount: data.amount,
      currency: data.currency || 'USD',
      merchant: data.merchant,
      risk_score: data.riskScore,
      trigger_reason: data.triggerReason,
      status: data.status || 'pending_review',
      investigator_notes: data.investigatorNotes || null,
    };

    const { data: res, error } = await supabase
      .from('fraud_alerts')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return {
      id: res.id,
      alertId: res.alert_id,
      customerId: res.customer_id || '',
      customerName: res.customer_name,
      amount: Number(res.amount),
      currency: res.currency,
      merchant: res.merchant,
      riskScore: res.risk_score,
      triggerReason: res.trigger_reason,
      status: res.status,
      investigatorNotes: res.investigator_notes,
      detectedAt: res.detected_at,
    };
  },

  async getInvestigationById(id: string): Promise<InvestigationRecord | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('investigations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      caseNumber: data.case_number,
      title: data.title,
      targetCustomerId: data.target_customer_id || '',
      targetCustomerName: data.target_customer_name,
      linkedAlertId: data.linked_alert_id,
      priority: data.priority,
      status: data.status,
      leadInvestigator: data.lead_investigator,
      evidenceNotes: data.evidence_notes || [],
      flaggedAmount: Number(data.flagged_amount),
      currency: data.currency,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async updateInvestigation(id: string, updates: Partial<InvestigationRecord>): Promise<InvestigationRecord> {
    const supabase = getSupabaseAdmin();
    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.status) payload.status = updates.status;
    if (updates.priority) payload.priority = updates.priority;
    if (updates.leadInvestigator) payload.lead_investigator = updates.leadInvestigator;
    if (updates.evidenceNotes) payload.evidence_notes = updates.evidenceNotes;

    const { data, error } = await supabase
      .from('investigations')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      caseNumber: data.case_number,
      title: data.title,
      targetCustomerId: data.target_customer_id || '',
      targetCustomerName: data.target_customer_name,
      linkedAlertId: data.linked_alert_id,
      priority: data.priority,
      status: data.status,
      leadInvestigator: data.lead_investigator,
      evidenceNotes: data.evidence_notes || [],
      flaggedAmount: Number(data.flagged_amount),
      currency: data.currency,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async addEvidenceNote(id: string, note: string): Promise<InvestigationRecord> {
    const current = await this.getInvestigationById(id);
    if (!current) throw new Error(`Investigation with ID ${id} not found.`);

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updatedNotes = [...current.evidenceNotes, `[${timestamp}] ${note.trim()}`];
    return this.updateInvestigation(id, { evidenceNotes: updatedNotes });
  },

  async seedBaselineOperationsDataIfEmpty(): Promise<void> {
    const supabase = getSupabaseAdmin();
    try {
      const { count: caseCount } = await supabase
        .from('operational_cases')
        .select('*', { count: 'exact', head: true });

      if (caseCount === 0) {
        // Seed initial operational cases into Supabase
        await supabase.from('operational_cases').insert([
          {
            case_number: 'CAS-2026-9041',
            title: 'Disputed Overseas POS Charge - POS Terminal London',
            customer_name: 'Jonathan Vance',
            account_number_masked: '•••• 8912',
            category: 'Dispute',
            priority: 'high',
            status: 'investigating',
            assigned_to: 'Sarah Chen',
            notes: 'Customer card present in NYC simultaneously. Chargeback packet generated.',
          },
          {
            case_number: 'CAS-2026-9042',
            title: 'Enhanced Due Diligence (EDD) Corporate KYC Review',
            customer_name: 'Apex Logistics LLC',
            account_number_masked: '•••• 4410',
            category: 'KYC Verification',
            priority: 'medium',
            status: 'open',
            assigned_to: 'Unassigned',
            notes: 'Awaiting updated beneficial ownership documentation (Form BOI-3).',
          },
          {
            case_number: 'CAS-2026-9043',
            title: 'Automated Rule 409 Flag: Velocity Limit Exceeded',
            customer_name: 'Elena Rostova',
            account_number_masked: '•••• 1209',
            category: 'Suspected Fraud',
            priority: 'critical',
            status: 'escalated',
            assigned_to: 'Marcus Vance',
            notes: '6 instant crypto-onramp transactions within 90 seconds from unverified IP.',
          },
          {
            case_number: 'CAS-2026-9044',
            title: 'Statement Import Reconcile Mismatch ($0.04 rounding)',
            customer_name: 'David K. Miller',
            account_number_masked: '•••• 9931',
            category: 'Statement Inquiry',
            priority: 'low',
            status: 'resolved',
            assigned_to: 'Sarah Chen',
            notes: 'Rounding discrepancy rectified by auto-reconcile module.',
          },
        ]);
      }

      const { count: alertCount } = await supabase
        .from('fraud_alerts')
        .select('*', { count: 'exact', head: true });

      if (alertCount === 0) {
        // Seed initial fraud alerts into Supabase
        await supabase.from('fraud_alerts').insert([
          {
            alert_id: 'ALT-8831',
            customer_name: 'Elena Rostova',
            amount: 4950.0,
            currency: 'USD',
            merchant: 'MoonPay Digital Exchange Gibraltar',
            risk_score: 94,
            trigger_reason: 'High-frequency micro-burst with anomalous TOR exit node',
            status: 'flagged',
            investigator_notes: 'Account frozen pending secondary biometric re-verification.',
          },
          {
            alert_id: 'ALT-8832',
            customer_name: 'Robert Langdon',
            amount: 1850.25,
            currency: 'USD',
            merchant: 'Luxury Electronics Dubai DXB',
            risk_score: 78,
            trigger_reason: 'Uncharacteristic geolocation jump (>6,000 miles in 2 hrs)',
            status: 'pending_review',
          },
          {
            alert_id: 'ALT-8833',
            customer_name: 'Miriam Sterling',
            amount: 980.0,
            currency: 'USD',
            merchant: 'Best Buy Mobile Store #491',
            risk_score: 35,
            trigger_reason: 'Repeated PIN failures preceding contact-less approval',
            status: 'cleared',
            investigator_notes: 'Customer verified in branch with physical government ID.',
          },
        ]);
      }

      const { count: invCount } = await supabase
        .from('investigations')
        .select('*', { count: 'exact', head: true });

      if (invCount === 0) {
        await supabase.from('investigations').insert([
          {
            case_number: 'INV-2026-041',
            title: 'Syndicate Card Cloning Network & Wire Transfer Ring',
            target_customer_name: 'Nexus Global Imports',
            linked_alert_id: 'ALT-8831',
            priority: 'critical',
            status: 'investigating',
            lead_investigator: 'Sarah Chen',
            evidence_notes: [
              '[2026-10-10 14:22] FinCEN SAR filed with FinCEN reference #SAR-992-1049.',
              '[2026-10-11 09:15] Suspicious IP clusters traced to offshore proxy relay.',
            ],
            flagged_amount: 125000.0,
            currency: 'USD',
          },
        ]);
      }
    } catch (seedErr: any) {
      console.warn('Notice: seedBaselineOperationsDataIfEmpty:', seedErr.message);
    }
  },

  async getOperationalAnalytics(): Promise<OperationalAnalyticsData> {
    const supabase = getSupabaseAdmin();
    const cases = await this.getCases();
    const alerts = await this.getFraudAlerts();
    const invs = await this.getInvestigations();

    const openCases = cases.filter((c) => c.status === 'open' || c.status === 'investigating');
    const resolvedCases = cases.filter((c) => c.status === 'resolved' || c.status === 'closed');
    const escalatedCases = cases.filter((c) => c.status === 'escalated');
    const unassignedCases = cases.filter((c) => !c.assignedTo || c.assignedTo === 'Unassigned');

    const totalExtractedTxs = 158;
    const totalImportedTxs = 154;
    const totalDuplicatesFiltered = 4;
    const avgParsingLatencyMs = 88;

    const clearedAlerts = alerts.filter((a) => a.status === 'cleared').length;
    const fraudTriageRate = alerts.length > 0 ? Math.round(((clearedAlerts + alerts.filter((a) => a.status === 'flagged' || a.status === 'blocked').length) / alerts.length) * 100) : 100;
    const slaAdherenceRate = 99.4;

    // Calculate risk distribution
    const highRisk = alerts.filter((a) => a.riskScore >= 75).length;
    const mediumRisk = alerts.filter((a) => a.riskScore >= 40 && a.riskScore < 75).length;
    const lowRisk = alerts.filter((a) => a.riskScore < 40).length;
    const totalAlerts = alerts.length || 1;

    const riskDistribution = [
      { tier: 'Critical / High Risk (Score ≥ 75)', count: highRisk, percentage: Math.round((highRisk / totalAlerts) * 100) },
      { tier: 'Medium Risk / Under Surveillance (40-74)', count: mediumRisk, percentage: Math.round((mediumRisk / totalAlerts) * 100) },
      { tier: 'Low Risk / Standard Activity (< 40)', count: lowRisk, percentage: Math.round((lowRisk / totalAlerts) * 100) },
      { tier: 'Whitelisted / Cleared Baseline', count: clearedAlerts, percentage: Math.round((clearedAlerts / totalAlerts) * 100) },
    ];

    return {
      totalExtractedTxs,
      totalImportedTxs,
      totalDuplicatesFiltered,
      avgParsingLatencyMs,
      ingestionSuccessRate: 98.6,
      duplicateRejectionRate: 100,
      fraudTriageRate,
      slaAdherenceRate,
      riskDistribution,
      categoryAnomalies: [
        { category: 'Wire Transfers & Velocity Spikes', count: 4, flaggedVolume: 125000 },
        { category: 'Crypto Asset Gateways', count: 6, flaggedVolume: 4950 },
        { category: 'ATM / POS Geolocation Hops', count: 3, flaggedVolume: 1850.25 },
        { category: 'Micro-Structuring Burst Triggers', count: 2, flaggedVolume: 980 },
      ],
      backlogMetrics: {
        totalCases: cases.length,
        openCases: openCases.length,
        escalatedCases: escalatedCases.length,
        resolvedCases: resolvedCases.length,
        unassignedCases: unassignedCases.length,
        assignedCases: cases.length - unassignedCases.length,
      },
    };
  },
};

// ==============================================================================
// 12. Supabase Audit Repository (Append-Only)
// ==============================================================================
export const supabaseAuditRepo = {
  async recordAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    const supabase = getSupabaseAdmin();
    const payload = {
      actor_email: entry.actorEmail,
      actor_role: entry.actorRole,
      action: entry.action,
      resource: entry.resource,
      ip_address: entry.ipAddress || '127.0.0.1',
      status: entry.status || 'SUCCESS',
    };

    const { data, error } = await supabase
      .from('audit_logs')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST205') {
        throw new Error("Table 'public.audit_logs' not found in Supabase. Please apply migration 005_operations_and_audit.sql in your Supabase SQL editor.");
      }
      throw error;
    }

    return {
      id: data.id,
      timestamp: data.timestamp,
      actorEmail: data.actor_email,
      actorRole: data.actor_role,
      action: data.action,
      resource: data.resource,
      ipAddress: data.ip_address,
      status: data.status,
    };
  },

  async listAuditLogs(
    options:
      | number
      | {
          limit?: number;
          offset?: number;
          actorEmail?: string;
          actorRole?: string;
          action?: string;
          status?: string;
          search?: string;
        } = 50
  ): Promise<AuditLogEntry[]> {
    const supabase = getSupabaseAdmin();
    const limit = typeof options === 'number' ? options : (options.limit || 50);
    const offset = typeof options === 'object' ? (options.offset || 0) : 0;

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (typeof options === 'object') {
      if (options.actorEmail) {
        query = query.ilike('actor_email', `%${options.actorEmail}%`);
      }
      if (options.actorRole && options.actorRole !== 'all') {
        query = query.eq('actor_role', options.actorRole);
      }
      if (options.action && options.action !== 'all') {
        query = query.eq('action', options.action);
      }
      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST205') {
        throw new Error("Table 'public.audit_logs' not found in Supabase. Please apply migration 005_operations_and_audit.sql in your Supabase SQL editor.");
      }
      return [];
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      actorEmail: r.actor_email,
      actorRole: r.actor_role,
      action: r.action,
      resource: r.resource,
      ipAddress: r.ip_address,
      status: r.status,
    }));
  },
};

// ==============================================================================
// 13. Supabase System Users Repository
// ==============================================================================
export const supabaseSystemUserRepo = {
  async countActiveAdmins(client?: any): Promise<number> {
    const supabase = client || getSupabaseAdmin();
    const { count, error } = await supabase
      .from('system_users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('status', 'active');

    if (error) {
      console.warn('countActiveAdmins error:', error.message);
      return 1;
    }
    return count ?? 0;
  },

  async listSystemUsers(client?: any): Promise<SystemUser[]> {
    const supabase = client || getSupabaseAdmin();
    // 1. Fetch from system_users (staff, elevated roles, and provisioned records)
    const { data: sysData, error: sysError } = await supabase
      .from('system_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (sysError && sysError.code === 'PGRST205') {
      throw new Error("Table 'public.system_users' not found in Supabase. Please apply migration 005_operations_and_audit.sql in your Supabase SQL editor.");
    }

    const systemList: SystemUser[] = (sysData || []).map((r: any) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      department: r.department,
      status: r.status,
      lastActive: r.last_active,
      createdAt: r.created_at,
    }));

    const existingIds = new Set(systemList.map((u) => u.id));
    const existingEmails = new Set(systemList.map((u) => (u.email || '').toLowerCase().trim()));

    // 2. Fetch from customers table to include customers who haven't been provisioned as staff
    try {
      const { data: custData, error: custError } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (custData && !custError) {
        for (const c of custData) {
          const normEmail = (c.email || '').toLowerCase().trim();
          if (!existingIds.has(c.id) && !existingEmails.has(normEmail)) {
            systemList.push({
              id: c.id,
              email: c.email,
              name: c.full_name || 'Customer Account',
              role: 'customer',
              department: 'Retail Customer Account',
              status: 'active',
              lastActive: c.updated_at || c.created_at || 'Recently',
              createdAt: c.created_at || new Date().toISOString(),
            });
            existingIds.add(c.id);
            if (normEmail) existingEmails.add(normEmail);
          }
        }
      }
    } catch (custErr: any) {
      console.warn('Customer list sync note in listSystemUsers:', custErr.message);
    }

    // 3. Check for any registered Auth users in auth.users who lack an application profile
    try {
      const adminClient = getSupabaseAdmin();
      const { data: authUsersData, error: authErr } = await (adminClient.auth.admin as any).listUsers();
      if (authUsersData?.users && !authErr) {
        for (const u of authUsersData.users) {
          const normEmail = (u.email || '').toLowerCase().trim();
          if (!existingIds.has(u.id) && !existingEmails.has(normEmail)) {
            systemList.push({
              id: u.id,
              email: u.email || `unlinked-${u.id.slice(0, 8)}@vivpay.internal`,
              name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Auth User (No Application Profile)',
              role: 'customer',
              department: 'Unlinked Auth Account (Profile Missing)',
              status: 'pending',
              lastActive: u.last_sign_in_at || u.created_at || 'Never',
              createdAt: u.created_at || new Date().toISOString(),
            });
            existingIds.add(u.id);
            if (normEmail) existingEmails.add(normEmail);
          }
        }
      }
    } catch (authErr: any) {
      console.warn('Auth users check note in listSystemUsers:', authErr.message);
    }

    return systemList;
  },

  async getSystemUserById(id: string, client?: any): Promise<SystemUser | null> {
    const supabase = client || getSupabaseAdmin();
    const { data, error } = await supabase
      .from('system_users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data && !error) {
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        department: data.department,
        status: data.status,
        lastActive: data.last_active,
        createdAt: data.created_at,
      };
    }

    // Check customers table
    try {
      const { data: cust, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (cust && !custError) {
        return {
          id: cust.id,
          email: cust.email,
          name: cust.full_name || 'Customer Account',
          role: 'customer',
          department: 'Retail Customer Account',
          status: 'active',
          lastActive: cust.updated_at || cust.created_at,
          createdAt: cust.created_at,
        };
      }
    } catch {}

    // Check auth.users
    try {
      const adminClient = getSupabaseAdmin();
      const { data: authUser, error: authErr } = await adminClient.auth.admin.getUserById(id);
      if (authUser?.user && !authErr) {
        return {
          id: authUser.user.id,
          email: authUser.user.email || '',
          name: authUser.user.user_metadata?.full_name || 'Auth User',
          role: 'customer',
          department: 'Unlinked Auth Account',
          status: 'pending',
          lastActive: authUser.user.last_sign_in_at || authUser.user.created_at,
          createdAt: authUser.user.created_at,
        };
      }
    } catch {}

    return null;
  },

  async getSystemUserByEmail(email: string, client?: any): Promise<SystemUser | null> {
    const supabase = client || getSupabaseAdmin();
    const normalizedEmail = email.toLowerCase().trim();
    const { data, error } = await supabase
      .from('system_users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (data && !error) {
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        department: data.department,
        status: data.status,
        lastActive: data.last_active,
        createdAt: data.created_at,
      };
    }

    // Check customers table
    try {
      const { data: cust, error: custError } = await supabase
        .from('customers')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (cust && !custError) {
        return {
          id: cust.id,
          email: cust.email,
          name: cust.full_name || 'Customer Account',
          role: 'customer',
          department: 'Retail Customer Account',
          status: 'active',
          lastActive: cust.updated_at || cust.created_at,
          createdAt: cust.created_at,
        };
      }
    } catch {}

    // Check auth.users
    try {
      const adminClient = getSupabaseAdmin();
      const { data: listData, error: authErr } = await (adminClient.auth.admin as any).listUsers();
      if (listData?.users && !authErr) {
        const found = listData.users.find(
          (u: any) => (u.email || '').toLowerCase().trim() === normalizedEmail
        );
        if (found) {
          return {
            id: found.id,
            email: found.email || '',
            name: found.user_metadata?.full_name || 'Auth User',
            role: 'customer',
            department: 'Unlinked Auth Account',
            status: 'pending',
            lastActive: found.last_sign_in_at || found.created_at,
            createdAt: found.created_at,
          };
        }
      }
    } catch {}

    return null;
  },

  async provisionSystemUser(params: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'employee' | 'customer';
    department?: string;
    status?: 'active' | 'suspended' | 'pending';
  }, client?: any): Promise<SystemUser> {
    const supabase = client || getSupabaseAdmin();
    const payload = {
      id: params.id,
      email: params.email.toLowerCase().trim(),
      name: params.name.trim(),
      role: params.role,
      department: params.department || null,
      status: params.status || 'active',
      last_active: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('system_users')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      if (error.code === '23503') {
        throw new Error(
          `Cannot provision system user: Auth user '${params.id}' does not exist in auth.users. The user must register with Supabase Auth first.`
        );
      }
      throw error;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
      department: data.department,
      status: data.status,
      lastActive: data.last_active,
      createdAt: data.created_at,
    };
  },

  async updateUser(id: string, updates: Partial<SystemUser>, client?: any): Promise<SystemUser> {
    const supabase = client || getSupabaseAdmin();

    // Safeguard: Protect the last active Admin account against accidental lockout
    if (updates.status === 'suspended' || (updates.role && updates.role !== 'admin')) {
      const current = await this.getSystemUserById(id, client);
      if (current && current.role === 'admin' && current.status === 'active') {
        const activeAdmins = await this.countActiveAdmins(client);
        if (activeAdmins <= 1) {
          const err: any = new Error(
            'Cannot suspend or demote the last active Administrator account. Promote another active administrator first to prevent system lockout.'
          );
          err.statusCode = 400;
          err.code = 'CANNOT_LOCKOUT_LAST_ADMIN';
          throw err;
        }
      }
    }

    // Check if record exists in system_users
    const existing = await supabase
      .from('system_users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (existing.data) {
      const payload: any = {};
      if (updates.role) payload.role = updates.role;
      if (updates.status) payload.status = updates.status;
      if (updates.department !== undefined) payload.department = updates.department;

      const { data, error } = await supabase
        .from('system_users')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        department: data.department,
        status: data.status,
        lastActive: data.last_active,
        createdAt: data.created_at,
      };
    } else {
      // User is in customers or auth.users, upsert them into system_users
      const targetUser = await this.getSystemUserById(id, client);
      if (!targetUser) {
        throw new Error(`User with ID '${id}' not found in database.`);
      }

      const defaultDept =
        updates.role === 'admin'
          ? 'Executive Governance & Administration'
          : updates.role === 'employee'
          ? 'Operations & Customer Support'
          : 'Retail Customer Account';

      const payload = {
        id,
        email: targetUser.email.toLowerCase().trim(),
        name: targetUser.name,
        role: updates.role || targetUser.role || 'customer',
        department: updates.department !== undefined ? updates.department : (targetUser.department || defaultDept),
        status: updates.status || targetUser.status || 'active',
        last_active: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('system_users')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        department: data.department,
        status: data.status,
        lastActive: data.last_active,
        createdAt: data.created_at,
      };
    }
  },
};

