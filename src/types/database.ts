/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan';
export type TransactionType = 'debit' | 'credit';
export type ProcessingStatus = 'uploaded' | 'processing' | 'completed' | 'partially_completed' | 'failed';
export type MessageRole = 'user' | 'assistant' | 'system';

export interface CustomerUser {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  fullName: string;
  phone?: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  tokenHash: string;
  customerId: string;
  expiresAt: string;
  lastActiveAt: string;
  createdAt: string;
  userAgent?: string | null;
}

export interface Account {
  id: string;
  customerId: string;
  accountName: string;
  accountNumberMasked: string;
  accountType: AccountType;
  institutionName: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatementDocument {
  id: string;
  customerId: string;
  accountId: string;
  fileName: string;
  originalName: string;
  fileSizeBytes: number;
  mimeType: string;
  checksum: string;
  processingStatus: ProcessingStatus;
  extractedCount: number;
  importedCount: number;
  duplicateCount: number;
  storagePath?: string | null;
  errorMessage?: string | null;
  rawTextPreview?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionCategory {
  id: string;
  customerId?: string | null; // null if default/system category
  name: string;
  slug: string;
  icon: string;
  color: string;
  isSystem: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  accountId: string;
  statementId?: string | null;
  date: string; // YYYY-MM-DD
  description: string;
  rawDescription?: string | null;
  amount: number; // positive number
  type: TransactionType; // 'debit' = money out, 'credit' = money in
  categoryId: string;
  categoryName?: string;
  isUserCorrected: boolean;
  isRecurring: boolean;
  balanceAfter?: number | null;
  checksum: string; // hash(customerId + accountId + date + amount + description) for deduplication
  createdAt: string;
  updatedAt: string;
}

export interface CategoryCorrection {
  id: string;
  customerId: string;
  merchantPattern: string;
  categoryId: string;
  createdAt: string;
}

export interface ConversationThread {
  id: string;
  customerId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  customerId: string;
  threadId: string;
  role: MessageRole;
  content: string;
  groundingsJson?: string | null; // JSON of financial figures referenced
  createdAt: string;
}

export interface FinancialSummary {
  totalBalance: number;
  totalIncome?: number;
  totalExpenses?: number;
  grossCredits?: number;
  grossDebits?: number;
  pureIncome: number;
  pureExpenses: number;
  netCashFlow: number;
  savingsRate: number;
  totalTransactions: number;
  currency: string;
  month?: string; // YYYY-MM
  accountSummaries?: {
    accountId: string;
    accountName: string;
    institution: string;
    balance: number;
    type: AccountType;
  }[];
  categoryBreakdown: {
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
    color: string;
  }[];
  topExpenseMerchants: {
    merchant: string;
    amount: number;
    count: number;
  }[];
  recurringPayments: {
    description: string;
    estimatedAmount: number;
    frequency: string;
    lastDate: string;
  }[];
  spendingTrend: {
    month: string;
    income: number;
    expenses: number;
    net: number;
  }[];
}
