/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { requireCustomerAuth, AuthenticatedRequest } from '../auth/middleware.ts';
import {
  supabaseCustomerRepo,
  supabaseAccountRepo,
  supabaseTransactionRepo,
  supabaseIdentityRepo,
  supabaseGoalsRepo,
  supabaseAuditRepo,
} from '../db/supabaseRepository.ts';
import { loadIdentityFromStorage, saveIdentityToStorage, appendTimelineEvent } from '../../lib/identity/store.ts';
import { analyzeBehaviour } from '../../lib/identity/behavior.ts';
import { generateProactiveInsights } from '../../lib/copilot/insights.ts';
import { generateFinancialInsights } from '../../lib/analytics/financialInsightEngine.ts';

// In-memory registry of confirmed recurring payees per customer
const confirmedRecurringRegistry = new Map<string, Set<string>>();

export const customerRouter = Router();

// Protect all customer routes with authentication
customerRouter.use(requireCustomerAuth);

/**
 * GET /api/customer/profile
 * Return authenticated customer's profile
 */
customerRouter.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await supabaseCustomerRepo.getProfile(req.customer!.id);
    if (!profile) {
      return res.status(404).json({ error: 'Customer profile not found.' });
    }
    return res.json({ profile });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

/**
 * PUT /api/customer/profile
 * Validate and update permitted profile fields
 */
customerRouter.put('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fullName, phone, currency, role, is_admin, isAdmin, system_role } = req.body;

    // Privilege escalation prevention: users cannot update their own role or administrative flags
    if (role !== undefined || is_admin !== undefined || isAdmin !== undefined || system_role !== undefined) {
      return res.status(403).json({
        error: 'Forbidden: Self-assignment or alteration of user roles is strictly prohibited.',
        code: 'FORBIDDEN_PRIVILEGE_ESCALATION',
      });
    }

    if (fullName !== undefined && (typeof fullName !== 'string' || fullName.trim().length === 0)) {
      return res.status(400).json({ error: 'Full name cannot be empty.' });
    }

    if (currency !== undefined && (typeof currency !== 'string' || currency.trim().length !== 3)) {
      return res.status(400).json({ error: 'Currency must be a valid 3-letter ISO code (e.g. USD, EUR).' });
    }

    const updated = await supabaseCustomerRepo.updateProfile(req.customer!.id, {
      fullName: fullName?.trim(),
      phone: phone ? String(phone).trim() : undefined,
      currency: currency?.toUpperCase().trim(),
    });

    return res.json({
      message: 'Profile updated successfully in Supabase.',
      profile: updated,
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

/**
 * GET /api/customer/accounts
 * List all accounts owned by the authenticated customer
 */
customerRouter.get('/accounts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const accounts = await supabaseAccountRepo.listByCustomer(req.customer!.id);
    return res.json({
      accounts,
      count: accounts.length,
    });
  } catch (error: any) {
    console.error('Error listing accounts:', error);
    return res.status(500).json({ error: 'Failed to retrieve accounts.' });
  }
});

/**
 * POST /api/customer/accounts
 * Create a new account owned by the authenticated customer
 */
customerRouter.post('/accounts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      accountName,
      accountNumber,
      accountNumberMasked,
      accountType,
      institutionName,
      initialBalance,
      currency,
    } = req.body;

    if (!accountName || typeof accountName !== 'string' || accountName.trim().length === 0) {
      return res.status(400).json({ error: 'Account name is required.' });
    }

    if (!institutionName || typeof institutionName !== 'string' || institutionName.trim().length === 0) {
      return res.status(400).json({ error: 'Financial institution name is required.' });
    }

    if (!accountType || typeof accountType !== 'string' || accountType.trim().length === 0) {
      return res.status(400).json({ error: 'Account type is required.' });
    }

    const rawType = accountType.trim().toLowerCase().replace(/[\s-]+/g, '_');
    const typeMap: Record<string, 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan'> = {
      checking: 'checking',
      savings: 'savings',
      current: 'checking',
      credit_card: 'credit_card',
      creditcard: 'credit_card',
      credit: 'credit_card',
      investment: 'investment',
      investments: 'investment',
      loan: 'loan',
      loans: 'loan',
    };

    const normalizedType = typeMap[rawType];
    if (!normalizedType) {
      return res.status(400).json({
        error: 'Account type must be one of: Checking, Savings, Current, Credit Card, Investment, Loan',
      });
    }

    // Validate opening balance: must be a finite number >= 0
    let initial = 0.0;
    if (initialBalance !== undefined && initialBalance !== null && initialBalance !== '') {
      const parsed = Number(initialBalance);
      if (isNaN(parsed) || !isFinite(parsed) || parsed < 0) {
        return res.status(400).json({ error: 'Initial balance must be a non-negative number.' });
      }
      initial = parsed;
    }

    // Account number masking: accepts full number or masked digits, never stores full number
    const rawNum = accountNumber !== undefined
      ? String(accountNumber).trim()
      : (accountNumberMasked ? String(accountNumberMasked).trim() : '');

    let maskedNumber = '';
    if (rawNum) {
      const digitsOnly = rawNum.replace(/\D/g, '');
      if (digitsOnly.length >= 4) {
        maskedNumber = `•••• ${digitsOnly.slice(-4)}`;
      } else if (rawNum.startsWith('••••')) {
        maskedNumber = rawNum;
      } else {
        maskedNumber = `•••• ${digitsOnly.padStart(4, '0')}`;
      }
    } else {
      maskedNumber = `•••• ${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const accountCurrency = (currency && typeof currency === 'string' && currency.trim().length === 3)
      ? currency.trim().toUpperCase()
      : (req.customer!.currency || 'INR');

    const account = await supabaseAccountRepo.create(req.customer!.id, {
      accountName: accountName.trim(),
      accountNumberMasked: maskedNumber,
      accountType: normalizedType,
      institutionName: institutionName.trim(),
      initialBalance: initial,
      currency: accountCurrency,
    });

    // Record audit action
    try {
      await supabaseAuditRepo.recordAuditEvent({
        actorEmail: req.customer!.email,
        actorRole: 'customer',
        action: 'ACCOUNT_CREATE',
        resource: `account:${account.id}:${account.accountName}`,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1',
        status: 'SUCCESS',
      });
    } catch (auditErr) {
      console.warn('Audit log write warning:', auditErr);
    }

    return res.status(201).json({
      message: 'Account created successfully in Supabase.',
      account,
    });
  } catch (error: any) {
    console.error('Error creating account:', error);
    return res.status(500).json({ error: error.message || 'Failed to create account.' });
  }
});

/**
 * GET /api/customer/accounts/:accountId
 * Retrieve a specific account owned by the authenticated customer
 */
customerRouter.get('/accounts/:accountId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const account = await supabaseAccountRepo.findById(accountId, req.customer!.id);

    if (!account) {
      return res.status(404).json({ error: 'Account not found or access denied.' });
    }

    const transactionsCount = await supabaseAccountRepo.countTransactions(accountId, req.customer!.id);

    return res.json({
      account,
      transactionsCount,
    });
  } catch (error: any) {
    console.error('Error fetching account:', error);
    return res.status(500).json({ error: 'Failed to retrieve account.' });
  }
});

/**
 * Shared handler for PUT and PATCH /api/customer/accounts/:accountId
 * Update permitted account metadata with strict immutability checks
 */
const handleUpdateAccount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const existing = await supabaseAccountRepo.findById(accountId, req.customer!.id);
    if (!existing) {
      return res.status(404).json({ error: 'Account not found or access denied.' });
    }

    // Immutability checks:
    if (req.body.id !== undefined && req.body.id !== accountId) {
      return res.status(400).json({ error: 'Account ID is immutable.' });
    }
    if (req.body.customerId !== undefined || req.body.customer_id !== undefined) {
      return res.status(400).json({ error: 'Account ownership cannot be transferred.' });
    }
    if (req.body.balance !== undefined) {
      return res.status(400).json({ error: 'Account balance cannot be modified via metadata update.' });
    }
    if (req.body.createdAt !== undefined || req.body.created_at !== undefined) {
      return res.status(400).json({ error: 'Account creation date is immutable.' });
    }

    const { accountName, institutionName, accountType } = req.body;

    if (accountName !== undefined && (typeof accountName !== 'string' || accountName.trim().length === 0)) {
      return res.status(400).json({ error: 'Account name cannot be empty.' });
    }

    if (institutionName !== undefined && (typeof institutionName !== 'string' || institutionName.trim().length === 0)) {
      return res.status(400).json({ error: 'Financial institution name cannot be empty.' });
    }

    let normalizedType: 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan' | undefined = undefined;
    if (accountType !== undefined) {
      if (typeof accountType !== 'string' || accountType.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid account type.' });
      }
      const rawType = accountType.trim().toLowerCase().replace(/[\s-]+/g, '_');
      const typeMap: Record<string, 'checking' | 'savings' | 'credit_card' | 'investment' | 'loan'> = {
        checking: 'checking',
        savings: 'savings',
        current: 'checking',
        credit_card: 'credit_card',
        creditcard: 'credit_card',
        credit: 'credit_card',
        investment: 'investment',
        investments: 'investment',
        loan: 'loan',
        loans: 'loan',
      };
      normalizedType = typeMap[rawType];
      if (!normalizedType) {
        return res.status(400).json({
          error: 'Account type must be one of: Checking, Savings, Current, Credit Card, Investment, Loan',
        });
      }
    }

    const updated = await supabaseAccountRepo.update(accountId, req.customer!.id, {
      accountName: accountName?.trim(),
      institutionName: institutionName?.trim(),
      accountType: normalizedType,
    });

    // Record audit action
    try {
      await supabaseAuditRepo.recordAuditEvent({
        actorEmail: req.customer!.email,
        actorRole: 'customer',
        action: 'ACCOUNT_UPDATE',
        resource: `account:${accountId}:${updated?.accountName || existing.accountName}`,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1',
        status: 'SUCCESS',
      });
    } catch (auditErr) {
      console.warn('Audit log write warning:', auditErr);
    }

    return res.json({
      message: 'Account updated successfully in Supabase.',
      account: updated,
    });
  } catch (error: any) {
    console.error('Error updating account:', error);
    return res.status(500).json({ error: 'Failed to update account.' });
  }
};

customerRouter.put('/accounts/:accountId', handleUpdateAccount);
customerRouter.patch('/accounts/:accountId', handleUpdateAccount);

/**
 * DELETE /api/customer/accounts/:accountId
 * Safely delete an account; prevents deletion of customer's last account and accounts with transactions
 */
customerRouter.delete('/accounts/:accountId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const existing = await supabaseAccountRepo.findById(accountId, req.customer!.id);
    if (!existing) {
      return res.status(404).json({ error: 'Account not found or access denied.' });
    }

    // Rule 1: Cannot delete the customer's only account
    const allCustomerAccounts = await supabaseAccountRepo.listByCustomer(req.customer!.id);
    if (allCustomerAccounts.length <= 1) {
      return res.status(400).json({
        error: 'Cannot delete your only account. Customers must maintain at least one primary account.',
        code: 'MINIMUM_ACCOUNT_REQUIRED',
      });
    }

    // Rule 2: Cannot delete account with linked transactions
    const deleteResult = await supabaseAccountRepo.deleteSafe(accountId, req.customer!.id);
    if (!deleteResult.success) {
      if (deleteResult.reason === 'HAS_TRANSACTIONS') {
        return res.status(409).json({
          error: 'Cannot delete account with existing transactions. Delete or reassign associated transactions first to preserve financial history.',
          code: 'ACCOUNT_HAS_TRANSACTIONS',
        });
      }
      return res.status(500).json({ error: 'Failed to delete account.' });
    }

    // Record audit action
    try {
      await supabaseAuditRepo.recordAuditEvent({
        actorEmail: req.customer!.email,
        actorRole: 'customer',
        action: 'ACCOUNT_DELETE',
        resource: `account:${accountId}:${existing.accountName}`,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1',
        status: 'SUCCESS',
      });
    } catch (auditErr) {
      console.warn('Audit log write warning:', auditErr);
    }

    return res.json({
      success: true,
      message: `Account "${existing.accountName}" deleted successfully from Supabase.`,
    });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ error: 'Failed to delete account.' });
  }
});

/**
 * GET /api/customer/identity
 * Returns the unified 3-layer financial identity for the authenticated customer
 */
customerRouter.get('/identity', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.customer!.id;
    let baseIdentity: any = null;
    try {
      baseIdentity = await supabaseIdentityRepo.getIdentity(customerId);
    } catch (dbErr: any) {
      console.warn('Supabase identity fetch note:', dbErr.message);
    }
    if (!baseIdentity) {
      baseIdentity = loadIdentityFromStorage('customer');
    }
    
    // Ensure customerId matches authenticated customer (strict RBAC ownership)
    const identity = {
      ...baseIdentity,
      customerId,
    };

    // Load transactions and accounts to calculate fresh behavioral metrics and proactive insights
    const txRes = await supabaseTransactionRepo.listByCustomer(customerId, { limit: 100 });
    const accounts = await supabaseAccountRepo.listByCustomer(customerId);
    const summary = await supabaseTransactionRepo.getAnalyticsSummary(customerId);

    const { behavior, archetypes } = analyzeBehaviour(txRes.transactions, identity);
    const insights = generateProactiveInsights({
      identity,
      transactions: txRes.transactions,
      accounts,
      summary,
      behavior,
      archetypes,
    });

    const unifiedModel = {
      ...identity,
      behavior,
      archetypes,
      proactiveInsights: insights,
    };

    return res.json({ identity: unifiedModel });
  } catch (error: any) {
    console.error('Error fetching customer identity:', error);
    return res.status(500).json({ error: 'Failed to retrieve unified financial identity.' });
  }
});

/**
 * PUT /api/customer/identity
 * Updates permitted financial identity and cognitive preferences with strict RBAC ownership
 */
customerRouter.put('/identity', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.customer!.id;
    const currentIdentity = loadIdentityFromStorage('customer');
    const { personal, employment, income, commitments, goals, risk, cognitive } = req.body;

    let updated = {
      ...currentIdentity,
      customerId,
      updatedAt: new Date().toISOString(),
    };

    if (personal) updated.personal = { ...updated.personal, ...personal };
    if (employment) updated.employment = { ...updated.employment, ...employment };
    if (income) updated.income = { ...updated.income, ...income };
    if (commitments) updated.commitments = { ...updated.commitments, ...commitments };
    if (goals) updated.goals = goals;
    if (risk) updated.risk = { ...updated.risk, ...risk };
    if (cognitive) updated.cognitive = { ...updated.cognitive, ...cognitive };

    updated = appendTimelineEvent(updated, {
      type: 'commitment_updated',
      title: 'Unified Identity Synchronized',
      description: 'Customer profile parameters updated via authenticated API.',
      actor: 'customer',
      evidenceSource: 'declared',
    });

    saveIdentityToStorage('customer', updated);

    // Sync to Supabase customer_identities table
    try {
      await supabaseIdentityRepo.upsertIdentity(customerId, updated);
    } catch (dbErr: any) {
      console.warn('Supabase identity persistence note:', dbErr.message);
    }

    return res.json({
      message: 'Financial identity updated successfully.',
      identity: updated,
    });
  } catch (error: any) {
    console.error('Error updating customer identity:', error);
    return res.status(500).json({ error: 'Failed to update financial identity.' });
  }
});

/**
 * GET /api/customer/goals
 * List goals for the authenticated customer from Supabase
 */
customerRouter.get('/goals', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const goals = await supabaseGoalsRepo.listGoals(req.customer!.id);
    return res.json({ goals, count: goals.length });
  } catch (error: any) {
    console.error('Error fetching goals from Supabase:', error);
    return res.status(500).json({ error: error.message || 'Failed to retrieve financial goals from Supabase.' });
  }
});

/**
 * POST /api/customer/goals
 * Create a new goal in Supabase
 */
customerRouter.post('/goals', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, targetAmount, targetDate, monthlyContribution, currentSavings, priority, notes } = req.body;
    if (!name || !targetAmount || !targetDate) {
      return res.status(400).json({ error: 'Name, targetAmount, and targetDate are required.' });
    }
    const created = await supabaseGoalsRepo.createGoal(req.customer!.id, {
      name,
      targetAmount: Number(targetAmount),
      targetDate,
      monthlyContribution: Number(monthlyContribution || 0),
      currentSavings: Number(currentSavings || 0),
      priority: priority || 'medium',
      notes,
    });
    return res.status(201).json({ goal: created, message: 'Goal created in Supabase.' });
  } catch (error: any) {
    console.error('Error creating goal in Supabase:', error);
    return res.status(500).json({ error: error.message || 'Failed to create financial goal in Supabase.' });
  }
});

/**
 * PATCH /api/customer/goals/:id
 * Update an owned goal in Supabase
 */
customerRouter.patch('/goals/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await supabaseGoalsRepo.updateGoal(req.customer!.id, req.params.id, req.body);
    return res.json({ goal: updated, message: 'Goal updated in Supabase.' });
  } catch (error: any) {
    console.error('Error updating goal in Supabase:', error);
    return res.status(500).json({ error: error.message || 'Failed to update financial goal in Supabase.' });
  }
});

/**
 * DELETE /api/customer/goals/:id
 * Delete an owned goal from Supabase
 */
customerRouter.delete('/goals/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await supabaseGoalsRepo.deleteGoal(req.customer!.id, req.params.id);
    return res.json({ success: true, message: 'Goal removed from Supabase.' });
  } catch (error: any) {
    console.error('Error deleting goal from Supabase:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete financial goal from Supabase.' });
  }
});

/**
 * GET /api/customer/insights
 * Returns evidence-backed financial insights conforming to Phase 4A specification.
 * Analyzes authenticated customer's actual ledger records across 6 categories:
 * 1. Spending trends
 * 2. Recurring payments (potential until confirmed)
 * 3. Cash-flow intelligence (balances vs projections, transfers excluded)
 * 4. Refunds & reversals (expense contra-offset)
 * 5. Unusual transactions (non-fraudulent explainable anomaly rules)
 * 6. Savings & financial goals (grounded in actual goals without invention)
 */
customerRouter.get('/insights', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.customer!.id;
    const { accountId, category, aiSummarize } = req.query as Record<string, string | undefined>;

    // Fetch accounts scoped strictly to the authenticated customer
    const accounts = await supabaseAccountRepo.listByCustomer(customerId);

    // Fetch transactions scoped strictly to the authenticated customer
    const txRes = await supabaseTransactionRepo.listByCustomer(customerId, {
      accountId: accountId || undefined,
      limit: 500,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    // Fetch user-defined financial goals (strict non-invention)
    let goals: any[] = [];
    try {
      goals = await supabaseGoalsRepo.listGoals(customerId);
    } catch (goalsErr: any) {
      console.warn('Goals fetch note:', goalsErr.message);
      const identity = loadIdentityFromStorage('customer');
      goals = identity.goals || [];
    }

    // Retrieve confirmed recurring payees for this customer
    const confirmedSet = confirmedRecurringRegistry.get(customerId) || new Set<string>();

    // Execute canonical deterministic Financial Insight Engine
    const engineResult = generateFinancialInsights({
      customerId,
      accountId: accountId || null,
      transactions: txRes.transactions,
      accounts,
      goals,
      currency: req.customer!.currency || 'INR',
      confirmedRecurringIds: confirmedSet,
    });

    // Optional server-side AI executive brief generation via Gemini if requested
    if (aiSummarize === 'true' && process.env.GEMINI_API_KEY && engineResult.insights.length > 0) {
      try {
        const ai = new GoogleGenAI();
        const topEvidence = engineResult.insights.slice(0, 4).map((i) => `- [${i.type}]: ${i.title} (${i.explanation})`).join('\n');
        const prompt = `You are Viv, an expert personal financial intelligence advisor. Summarize the following evidence-backed financial findings for the customer into a clear, empowering 2-3 sentence executive brief.\nStrict requirement: Do not invent any numbers, transactions, merchant names, or financial facts. Base your brief strictly on these calculated figures:\n- Ledger Balance: ${engineResult.summaryMetrics.totalBalance}\n- Operating Net Cash Flow: ${engineResult.summaryMetrics.netCashFlow}\n- Pure Income: ${engineResult.summaryMetrics.pureIncome}\n- Net Adjusted Expenses: ${engineResult.summaryMetrics.netAdjustedExpenses}\n- Refunds Total: ${engineResult.summaryMetrics.refundsTotal}\nKey verified findings:\n${topEvidence}`;

        const aiResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        if (aiResponse && aiResponse.text) {
          engineResult.aiExecutiveSummary = aiResponse.text.trim();
        }
      } catch (aiErr: any) {
        console.warn('AI summary enhancement note:', aiErr.message);
      }
    }

    // Apply category filter if requested
    let filteredInsights = engineResult.insights;
    if (category && category !== 'all') {
      filteredInsights = engineResult.insights.filter(
        (i) => i.type === category || i.category === category
      );
    }

    return res.json({
      insights: filteredInsights,
      count: filteredInsights.length,
      dataSufficiency: engineResult.dataSufficiency,
      summaryMetrics: engineResult.summaryMetrics,
      observationPeriod: engineResult.observationPeriod,
      aiExecutiveSummary: engineResult.aiExecutiveSummary,
      generatedAt: engineResult.generatedAt,
      engineVersion: '4.0.0',
    });
  } catch (error: any) {
    console.error('Error generating financial insights:', error);
    return res.status(500).json({ error: 'Failed to generate financial insights engine analysis.' });
  }
});

/**
 * POST /api/customer/insights/confirm-recurring
 * Confirms or dismisses a detected potential recurring payment candidate
 */
customerRouter.post('/insights/confirm-recurring', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.customer!.id;
    const { merchant, confirmed } = req.body;

    if (!merchant || typeof merchant !== 'string') {
      return res.status(400).json({ error: 'Merchant identifier is required.' });
    }

    const key = merchant.trim().toLowerCase();
    let currentSet = confirmedRecurringRegistry.get(customerId);
    if (!currentSet) {
      currentSet = new Set<string>();
      confirmedRecurringRegistry.set(customerId, currentSet);
    }

    if (confirmed !== false) {
      currentSet.add(key);
    } else {
      currentSet.delete(key);
    }

    return res.json({
      success: true,
      merchant: key,
      isConfirmed: currentSet.has(key),
      message: currentSet.has(key)
        ? `Recurring payment for "${merchant}" confirmed successfully.`
        : `Recurring payment for "${merchant}" unconfirmed.`,
    });
  } catch (error: any) {
    console.error('Error confirming recurring payment:', error);
    return res.status(500).json({ error: 'Failed to update recurring payment confirmation.' });
  }
});

