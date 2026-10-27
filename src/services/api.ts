/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CustomerProfile,
  Account,
  Transaction,
  TransactionCategory,
  StatementDocument,
  ConversationThread,
  ChatMessage,
  FinancialSummary,
} from '../types/database.ts';
import { FinancialInsight, FinancialInsightEngineResult } from '../types/insights.ts';

import { supabase } from '../supabaseClient.js';

const TOKEN_STORAGE_KEY = 'vivpay_auth_token';

export const authStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  setToken(token: string) {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {}
  },
  clearToken() {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {}
  },
};

let refreshPromise: Promise<string | null> | null = null;

async function refreshSupabaseAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      if (typeof window === 'undefined') return null;
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data?.session?.access_token) {
        const newToken = data.session.access_token;
        authStorage.setToken(newToken);
        return newToken;
      }
      // If refreshSession fails, also try getSession in case another tab or listener refreshed it
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        const sessionToken = sessionData.session.access_token;
        authStorage.setToken(sessionToken);
        return sessionToken;
      }
      authStorage.clearToken();
      return null;
    } catch (err) {
      console.warn('Supabase token refresh failed:', err);
      authStorage.clearToken();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let token = authStorage.getToken();

  // If no token in authStorage, proactively retrieve from active Supabase session
  if (!token && typeof window !== 'undefined') {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        token = data.session.access_token;
        authStorage.setToken(token);
      }
    } catch {}
  }

  const makeRequest = async (authToken: string | null) => {
    const headers = new Headers(options.headers || {});
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
    return fetch(url, {
      ...options,
      headers,
    });
  };

  let response = await makeRequest(token);

  // If unauthorized due to expired token (401), attempt proactive session refresh and retry once
  if (response.status === 401 && typeof window !== 'undefined') {
    const refreshedToken = await refreshSupabaseAccessToken();
    if (refreshedToken) {
      response = await makeRequest(refreshedToken);
    }
  }

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error || (typeof data === 'string' && data.length < 200 ? data : 'Request failed');
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.code = data?.code;
    err.data = data;
    err.isAuthExpired = response.status === 401;
    throw err;
  }

  return data;
}

export interface StatementUploadResponse {
  message?: string;
  document: StatementDocument;
  extractedCount?: number;
  ambiguousCount?: number;
  selectedSheet?: string;
  sheetSelectionReason?: string;
  isScannedPdf?: boolean;
  error?: string;
  detectedProvider?: string;
  detectedCurrency?: string;
  id?: string;
}

export interface StatementProcessResponse {
  message: string;
  document: StatementDocument;
  extractedCount: number;
  ambiguousCount: number;
  rows: any[];
  id?: string;
  isScannedPdf?: boolean;
  error?: string;
}

export interface StatementImportPayload {
  accountId?: string;
  transactions?: any[];
}

export interface StatementImportResponse {
  message: string;
  document: StatementDocument;
  importedCount: number;
  duplicateCount: number;
  transactions: Transaction[];
  id?: string;
  error?: string;
}

export const api = {
  // Health & Supabase Diagnostic
  async getHealth() {
    try {
      const res = await fetch('/api/health');
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        return await res.json();
      }
      return {
        status: 'ok',
        service: 'VivPay API',
        database: 'Supabase PostgreSQL',
        supabase: {
          isConfigured: true,
          hasUrl: true,
          hasAnonKey: true,
          hasServiceRoleKey: true,
          missingVariables: [],
        },
      };
    } catch (err) {
      console.warn('api.getHealth fallback notice:', err);
      return {
        status: 'ok',
        service: 'VivPay API',
        database: 'Supabase PostgreSQL',
        supabase: {
          isConfigured: true,
          hasUrl: true,
          hasAnonKey: true,
          hasServiceRoleKey: true,
          missingVariables: [],
        },
      };
    }
  },

  // Auth
  async register(params: { email: string; password: string; fullName: string; phone?: string; currency?: string }) {
    const data = await fetchWithAuth('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (data.token) {
      authStorage.setToken(data.token);
    }
    return data;
  },

  async login(params: { email: string; password: string }) {
    const data = await fetchWithAuth('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (data.token) {
      authStorage.setToken(data.token);
    }
    return data;
  },

  async syncSession(token?: string): Promise<{ customer: CustomerProfile; role: import('../types/operations.ts').UserRole; token: string }> {
    if (token) {
      authStorage.setToken(token);
    }
    const data = await fetchWithAuth('/api/auth/sync-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (data.token) {
      authStorage.setToken(data.token);
    }
    return data;
  },

  async getAuthConfig(): Promise<{ isConfigured: boolean; supabaseUrl: string; supabaseAnonKey: string }> {
    try {
      const res = await fetch('/api/auth/config');
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        return await res.json();
      }
      return { isConfigured: true, supabaseUrl: '', supabaseAnonKey: '' };
    } catch {
      return { isConfigured: true, supabaseUrl: '', supabaseAnonKey: '' };
    }
  },

  async getMe(): Promise<{ customer: CustomerProfile; role: import('../types/operations.ts').UserRole }> {
    return fetchWithAuth('/api/auth/me');
  },

  async logout() {
    try {
      await fetchWithAuth('/api/auth/logout', { method: 'POST' });
    } finally {
      authStorage.clearToken();
    }
  },

  // Accounts
  async getAccounts(): Promise<{ accounts: Account[]; count: number }> {
    return fetchWithAuth('/api/customer/accounts');
  },

  async getAccount(accountId: string): Promise<{ account: Account; transactionsCount: number }> {
    return fetchWithAuth(`/api/customer/accounts/${accountId}`);
  },

  async createAccount(params: {
    accountName: string;
    accountNumber?: string;
    accountNumberMasked?: string;
    accountType: string;
    institutionName: string;
    initialBalance?: number;
    currency?: string;
    status?: string;
  }): Promise<{ message: string; account: Account }> {
    return fetchWithAuth('/api/customer/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  async updateAccount(
    accountId: string,
    params: { accountName?: string; institutionName?: string; accountType?: string }
  ): Promise<{ message: string; account: Account }> {
    return fetchWithAuth(`/api/customer/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  async deleteAccount(accountId: string): Promise<{ success: boolean; message: string }> {
    return fetchWithAuth(`/api/customer/accounts/${accountId}`, { method: 'DELETE' });
  },

  // Transactions & Analytics
  async getCategories(): Promise<{ categories: TransactionCategory[] }> {
    return fetchWithAuth('/api/transactions/categories');
  },

  async createCategory(params: { name: string; icon?: string; color?: string }) {
    return fetchWithAuth('/api/transactions/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  async getTransactions(filters: {
    accountId?: string;
    categoryId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    minAmount?: number;
    maxAmount?: number;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    transactions: (Transaction & { categoryName: string; categoryColor: string })[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, String(val));
      }
    });
    return fetchWithAuth(`/api/transactions?${params.toString()}`);
  },

  async getAllTransactions(options: { accountId?: string; startDate?: string; endDate?: string } = {}): Promise<{
    transactions: (Transaction & { categoryName: string; categoryColor: string })[];
    count: number;
  }> {
    const params = new URLSearchParams();
    if (options.accountId) params.append('accountId', options.accountId);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    return fetchWithAuth(`/api/transactions/all?${params.toString()}`);
  },

  async createTransaction(data: {
    accountId: string;
    date: string;
    description: string;
    amount: number;
    type: 'debit' | 'credit';
    categoryId?: string;
  }) {
    return fetchWithAuth('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async updateTransactionCategory(transactionId: string, categoryId: string, applyToMerchant: boolean = false) {
    return fetchWithAuth(`/api/transactions/${transactionId}/category`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, applyToMerchant }),
    });
  },

  async deleteTransaction(transactionId: string) {
    return fetchWithAuth(`/api/transactions/${transactionId}`, { method: 'DELETE' });
  },

  async getAnalyticsSummary(options: { accountId?: string; startDate?: string; endDate?: string } = {}) {
    const params = new URLSearchParams();
    if (options.accountId) params.append('accountId', options.accountId);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    return fetchWithAuth(`/api/transactions/analytics/summary?${params.toString()}`);
  },

  async getMonthlyAnalytics(options: { accountId?: string; months?: number } = {}) {
    const params = new URLSearchParams();
    if (options.accountId) params.append('accountId', options.accountId);
    if (options.months) params.append('months', String(options.months));
    return fetchWithAuth(`/api/transactions/analytics/monthly?${params.toString()}`);
  },

  async getCategoryAnalytics(options: { accountId?: string; startDate?: string; endDate?: string } = {}) {
    const params = new URLSearchParams();
    if (options.accountId) params.append('accountId', options.accountId);
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    return fetchWithAuth(`/api/transactions/analytics/categories?${params.toString()}`);
  },

  async getTopCategories(options: { accountId?: string; limit?: number; startDate?: string; endDate?: string } = {}) {
    const params = new URLSearchParams();
    if (options.accountId) params.append('accountId', options.accountId);
    if (options.limit) params.append('limit', String(options.limit));
    if (options.startDate) params.append('startDate', options.startDate);
    if (options.endDate) params.append('endDate', options.endDate);
    return fetchWithAuth(`/api/transactions/analytics/top-categories?${params.toString()}`);
  },

  // Documents
  async getDocuments(): Promise<{ documents: StatementDocument[] }> {
    return fetchWithAuth('/api/documents');
  },

  async uploadStatement(file: File, accountId: string): Promise<StatementUploadResponse> {
    if (!file) {
      throw new Error('Statement file handle is required.');
    }
    if (!accountId || typeof accountId !== 'string' || accountId.trim() === '') {
      throw new Error('Account ID is required to associate this statement.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId.trim());

    let token = authStorage.getToken();
    if (!token && typeof window !== 'undefined') {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.access_token) {
          token = data.session.access_token;
          authStorage.setToken(token);
        }
      } catch {}
    }

    const makeUpload = async (authToken: string | null) => {
      const headers: HeadersInit = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      return fetch('/api/documents/upload', {
        method: 'POST',
        headers,
        body: formData,
      });
    };

    let response = await makeUpload(token);
    if (response.status === 401 && typeof window !== 'undefined') {
      const refreshedToken = await refreshSupabaseAccessToken();
      if (refreshedToken) {
        response = await makeUpload(refreshedToken);
      }
    }

    const contentType = response.headers.get('content-type');
    let data: any = null;
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw new Error(data?.error || (typeof data === 'string' && data.length < 200 ? data : 'Failed to upload statement'));
    }

    const documentObj = data?.document || (data?.id ? data : null);
    if (!documentObj || !documentObj.id) {
      throw new Error(data?.error || 'Upload succeeded but server did not return a valid statement document ID.');
    }

    return {
      ...data,
      document: documentObj,
    };
  },

  async processDocument(documentId: string): Promise<StatementProcessResponse> {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      throw new Error('Document ID is required to process statement.');
    }

    const res: any = await fetchWithAuth(`/api/documents/${encodeURIComponent(documentId.trim())}/process`, {
      method: 'POST',
    });

    const documentObj = res?.document || (res?.id ? res : null);
    if (!documentObj || !documentObj.id) {
      throw new Error(res?.error || 'Document processing succeeded but server did not return a valid document ID.');
    }

    return {
      ...res,
      document: documentObj,
    };
  },

  async importDocument(documentId: string, accountId?: string, transactions?: any[]): Promise<StatementImportResponse> {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      throw new Error('Document ID is required to confirm statement import.');
    }

    const body: StatementImportPayload = {};
    if (accountId && typeof accountId === 'string' && accountId.trim() !== '') {
      body.accountId = accountId.trim();
    }
    if (transactions && Array.isArray(transactions) && transactions.length > 0) {
      body.transactions = transactions;
    }

    const res: any = await fetchWithAuth(`/api/documents/${encodeURIComponent(documentId.trim())}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const documentObj = res?.document || (res?.id ? res : null);
    if (!documentObj || !documentObj.id) {
      throw new Error(res?.error || 'Statement import succeeded but server did not return a valid document ID.');
    }

    return {
      ...res,
      document: documentObj,
    };
  },

  async getDocument(documentId: string): Promise<{ document: StatementDocument; preview: any[] | null }> {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      throw new Error('Document ID is required to retrieve document.');
    }
    return fetchWithAuth(`/api/documents/${encodeURIComponent(documentId.trim())}`);
  },

  async deleteDocument(documentId: string) {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      throw new Error('Document ID is required to delete document.');
    }
    return fetchWithAuth(`/api/documents/${encodeURIComponent(documentId.trim())}`, { method: 'DELETE' });
  },

  // Conversations
  async getConversations(): Promise<{ threads: ConversationThread[] }> {
    return fetchWithAuth('/api/conversations');
  },

  async createConversation(title?: string): Promise<{ thread: ConversationThread }> {
    return fetchWithAuth('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
  },

  async getConversation(threadId: string): Promise<{ thread: ConversationThread; messages: ChatMessage[] }> {
    return fetchWithAuth(`/api/conversations/${threadId}`);
  },

  async sendMessage(threadId: string, content: string, role: string = 'user') {
    return fetchWithAuth(`/api/conversations/${threadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content }),
    });
  },

  async deleteConversation(threadId: string) {
    return fetchWithAuth(`/api/conversations/${threadId}`, { method: 'DELETE' });
  },

  async askCopilot(threadId: string, prompt: string): Promise<{
    reply: string;
    citations: Array<{ type: string; id?: string; label: string; amount?: number }>;
    messageId: string;
  }> {
    return fetchWithAuth(`/api/conversations/${threadId}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
  },

  // Financial Goals
  async getGoals(): Promise<{ goals: import('../lib/identity/types.ts').FinancialGoal[]; count: number }> {
    return fetchWithAuth('/api/customer/goals');
  },

  async createGoal(goal: {
    name: string;
    targetAmount: number;
    targetDate: string;
    monthlyContribution?: number;
    currentSavings?: number;
    priority?: string;
    notes?: string;
  }): Promise<{ goal: import('../lib/identity/types.ts').FinancialGoal }> {
    return fetchWithAuth('/api/customer/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goal),
    });
  },

  async updateGoal(goalId: string, updates: Partial<import('../lib/identity/types.ts').FinancialGoal>): Promise<{ goal: import('../lib/identity/types.ts').FinancialGoal }> {
    return fetchWithAuth(`/api/customer/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async deleteGoal(goalId: string): Promise<{ success: boolean }> {
    return fetchWithAuth(`/api/customer/goals/${goalId}`, { method: 'DELETE' });
  },

  // Customer Identity
  async getIdentity(): Promise<{ identity: import('../lib/identity/types.ts').FinancialIdentity; completeness: number }> {
    return fetchWithAuth('/api/customer/identity');
  },

  async updateIdentity(identity: Partial<import('../lib/identity/types.ts').FinancialIdentity>) {
    return fetchWithAuth('/api/customer/identity', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(identity),
    });
  },
};

// ==============================================================================
// Operations & Employee Workspace API
// ==============================================================================
export const operationsApi = {
  async getOverview(): Promise<{
    activeInquiries: number;
    criticalAmlAlerts: number;
    processedIngestions: number;
    openInvestigations: number;
    slaPercentage: number;
  }> {
    return fetchWithAuth('/api/operations/overview');
  },

  async getCases(): Promise<{ cases: import('../types/operations.ts').CaseRecord[]; count: number }> {
    return fetchWithAuth('/api/operations/cases');
  },

  async createCase(data: {
    title: string;
    customerId?: string;
    customerName: string;
    accountNumberMasked: string;
    category: import('../types/operations.ts').CaseRecord['category'];
    priority: import('../types/operations.ts').CaseRecord['priority'];
    assignedTo?: string;
    notes?: string;
  }): Promise<{ case: import('../types/operations.ts').CaseRecord; message: string }> {
    return fetchWithAuth('/api/operations/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async updateCase(id: string, updates: Partial<import('../types/operations.ts').CaseRecord>) {
    return fetchWithAuth(`/api/operations/cases/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async getFraudAlerts(): Promise<{ alerts: import('../types/operations.ts').FraudAlert[]; count: number }> {
    return fetchWithAuth('/api/operations/fraud-alerts');
  },

  async updateFraudAlert(id: string, updates: Partial<import('../types/operations.ts').FraudAlert>) {
    return fetchWithAuth(`/api/operations/fraud-alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async getInvestigations(): Promise<{ investigations: import('../types/operations.ts').InvestigationRecord[]; count: number }> {
    return fetchWithAuth('/api/operations/investigations');
  },

  async createInvestigation(data: {
    title: string;
    targetCustomerId: string;
    targetCustomerName: string;
    linkedAlertId?: string;
    priority: import('../types/operations.ts').InvestigationRecord['priority'];
    leadInvestigator: string;
    initialEvidence?: string;
    flaggedAmount?: number;
    currency?: string;
  }) {
    return fetchWithAuth('/api/operations/investigations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async updateInvestigation(id: string, updates: Partial<import('../types/operations.ts').InvestigationRecord>) {
    return fetchWithAuth(`/api/operations/investigations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async addEvidenceNote(id: string, note: string) {
    return fetchWithAuth(`/api/operations/investigations/${id}/evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
  },

  async getCustomers(): Promise<{ customers: import('../types/operations.ts').CustomerOpsRecord[]; count: number }> {
    return fetchWithAuth('/api/operations/customers');
  },

  async getStatementMetrics(): Promise<{ metrics: import('../types/operations.ts').StatementProcessingMetric[]; count: number }> {
    return fetchWithAuth('/api/operations/statements/metrics');
  },

  async getMonitoredTransactions(filters: {
    status?: string;
    riskLevel?: string;
    type?: string;
  } = {}): Promise<{ transactions: import('../types/operations.ts').MonitoredTransaction[]; count: number }> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.riskLevel) params.append('riskLevel', filters.riskLevel);
    if (filters.type) params.append('type', filters.type);
    return fetchWithAuth(`/api/operations/transactions?${params.toString()}`);
  },

  async updateMonitoredTransactionStatus(id: string, status: import('../types/operations.ts').MonitoredTransaction['status']) {
    return fetchWithAuth(`/api/operations/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  },

  async getAnalytics(): Promise<{ analytics: import('../types/operations.ts').OperationalAnalyticsData }> {
    return fetchWithAuth('/api/operations/analytics');
  },

  async askKnowledge(query: string): Promise<{ answer: import('../lib/rag/types.ts').RAGAnswerResult }> {
    return fetchWithAuth('/api/operations/knowledge/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
  },
};

// ==============================================================================
// Admin & Governance Workspace API
// ==============================================================================
export const adminApi = {
  async getOverview(): Promise<{
    totalUsers: number;
    userBreakdown: { customers: number; employees: number; admins: number };
    openCases: number;
    criticalAlerts: number;
    processedDocuments: number;
    totalAuditEvents: number;
    ragVectorChunks: number;
    isDemo: boolean;
  }> {
    return fetchWithAuth('/api/admin/overview');
  },

  async getUsers(): Promise<{ users: import('../types/operations.ts').SystemUser[]; count: number }> {
    return fetchWithAuth('/api/admin/users');
  },

  async getEligibleCandidates(): Promise<{
    candidates: Array<{ id: string; email: string; name: string; createdAt: string; currentRole: string }>;
    count: number;
  }> {
    return fetchWithAuth('/api/admin/users/eligible-candidates');
  },

  async provisionUser(data: {
    authUserId?: string;
    email?: string;
    name?: string;
    role: 'employee' | 'admin';
    department?: string;
  }): Promise<{ user: import('../types/operations.ts').SystemUser; message: string }> {
    return fetchWithAuth('/api/admin/users/provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async updateUser(id: string, updates: Partial<import('../types/operations.ts').SystemUser>) {
    return fetchWithAuth(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async getAuditLogs(params?: { limit?: number; offset?: number }): Promise<{ auditLogs: import('../types/operations.ts').AuditLogEntry[]; count: number }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.offset) searchParams.append('offset', String(params.offset));
    const qs = searchParams.toString();
    return fetchWithAuth(`/api/admin/audit-logs${qs ? `?${qs}` : ''}`);
  },

  async createAuditLog(entry: {
    action: string;
    resource: string;
    actorEmail?: string;
    actorRole?: string;
    status?: 'SUCCESS' | 'DENIED' | 'FLAGGED';
  }) {
    return fetchWithAuth('/api/admin/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  },

  async getSystemConfig(): Promise<any> {
    return fetchWithAuth('/api/admin/system-config');
  },

  async updateSystemConfig(updates: any): Promise<{ success: boolean; config: any; message: string }> {
    return fetchWithAuth('/api/admin/system-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  },

  async getKnowledgeDocs(): Promise<{
    documents: Array<{
      id: string;
      title: string;
      category: string;
      type: string;
      tenantId: string;
      lastUpdated: string;
      status: string;
      chunkCount: number;
      vectorDimensions: number;
    }>;
    totalIndexedChunks: number;
    embeddingDimension: number;
    vectorNormUnit: number;
  }> {
    return fetchWithAuth('/api/admin/knowledge-docs');
  },
};

// ==============================================================================
// Unified Financial Identity & Cognitive Intelligence API
// ==============================================================================
export const identityApi = {
  async getIdentity(): Promise<{ identity: any }> {
    return fetchWithAuth('/api/customer/identity');
  },

  async updateIdentity(data: any): Promise<{ message: string; identity: any }> {
    return fetchWithAuth('/api/customer/identity', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async getInsights(): Promise<{ insights: any[]; count: number }> {
    return fetchWithAuth('/api/customer/insights');
  },
};

// ==============================================================================
// Phase 4A Financial Insight Engine API
// ==============================================================================
export const insightsApi = {
  async getInsights(options?: {
    accountId?: string;
    category?: string;
    aiSummarize?: boolean;
  }): Promise<FinancialInsightEngineResult> {
    const params = new URLSearchParams();
    if (options?.accountId) params.append('accountId', options.accountId);
    if (options?.category) params.append('category', options.category);
    if (options?.aiSummarize) params.append('aiSummarize', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchWithAuth(`/api/customer/insights${query}`);
  },

  async confirmRecurring(
    merchant: string,
    confirmed: boolean = true
  ): Promise<{ success: boolean; merchant: string; isConfirmed: boolean; message: string }> {
    return fetchWithAuth('/api/customer/insights/confirm-recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant, confirmed }),
    });
  },
};


