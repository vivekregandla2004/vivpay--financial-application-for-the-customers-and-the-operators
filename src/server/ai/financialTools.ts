/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  supabaseAccountRepo,
  supabaseTransactionRepo,
  supabaseGoalsRepo,
} from '../db/supabaseRepository.ts';
import { generateFinancialInsights } from '../../lib/analytics/financialInsightEngine.ts';
import { calculateGoalFeasibility } from '../../lib/goals/feasibility.ts';
import { loadIdentityFromStorage } from '../../lib/identity/store.ts';
import { FinancialInsight } from '../../types/insights.ts';

export interface GroundedFinancialData {
  metrics: {
    totalBalance: number;
    pureIncome: number;
    pureExpenses: number;
    refundsTotal: number;
    netAdjustedExpenses: number;
    netCashFlow: number;
    internalTransfersVolume: number;
    savingsRate: number;
    totalTransactions: number;
  };
  accounts: {
    id: string;
    accountName: string;
    accountType: string;
    accountNumberMasked: string;
    balance: number;
    currency: string;
  }[];
  topCategories: {
    categoryId: string;
    categoryName: string;
    totalAmount: number;
    percentage: number;
  }[];
  spendingTrends: FinancialInsight[];
  recurringPayments: FinancialInsight[];
  unusualTransactions: FinancialInsight[];
  goalsFeasibility: {
    hasGoals: boolean;
    goals: {
      id: string;
      name: string;
      targetAmount: number;
      currentSavings: number;
      targetDate: string;
      requiredMonthly: number;
      isFeasible: boolean;
      feasibilityReason: string;
    }[];
  };
  rawTransactionsSample: {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'debit' | 'credit';
    categoryName?: string;
  }[];
}

/**
 * Server-side grounded financial tools suite.
 * Enforces customer isolation: customerId MUST originate from verified session token.
 */
export const financialTools = {
  /**
   * Tool 1: getFinancialMetrics
   * Computes verified income, expenses, refunds, transfers, and net cash flow
   */
  async getFinancialMetrics(customerId: string) {
    if (!customerId) throw new Error('customerId is strictly required for financial metrics execution.');
    const summary = await supabaseTransactionRepo.getAnalyticsSummary(customerId);
    const accounts = await supabaseAccountRepo.listByCustomer(customerId);

    return {
      totalBalance: summary.totalBalance,
      pureIncome: summary.pureIncome,
      pureExpenses: summary.pureExpenses,
      netCashFlow: summary.netCashFlow,
      savingsRate: summary.savingsRate,
      grossCredits: summary.grossCredits,
      grossDebits: summary.grossDebits,
      totalTransactions: summary.totalTransactions,
      currency: summary.currency,
      accountsCount: accounts.length,
    };
  },

  /**
   * Tool 2: getSpendingTrends
   * Month-over-month category deltas and merchant changes from Phase 4A engine
   */
  async getSpendingTrends(customerId: string) {
    if (!customerId) throw new Error('customerId is strictly required for spending trends execution.');
    const accounts = await supabaseAccountRepo.listByCustomer(customerId);
    const txRes = await supabaseTransactionRepo.listByCustomer(customerId, { limit: 500 });

    const engineResult = generateFinancialInsights({
      customerId,
      accounts,
      transactions: txRes.transactions,
    });

    return engineResult.insights.filter((i) => i.type === 'spending_trend');
  },

  /**
   * Tool 3: getRecurringPayments
   * Potential and confirmed recurring subscriptions, bills, and cadence evidence
   */
  async getRecurringPayments(customerId: string) {
    if (!customerId) throw new Error('customerId is strictly required for recurring payments execution.');
    const accounts = await supabaseAccountRepo.listByCustomer(customerId);
    const txRes = await supabaseTransactionRepo.listByCustomer(customerId, { limit: 500 });

    const engineResult = generateFinancialInsights({
      customerId,
      accounts,
      transactions: txRes.transactions,
    });

    return engineResult.insights.filter((i) => i.type === 'recurring_payment');
  },

  /**
   * Tool 4: getFinancialInsights
   * Full Phase 4A Financial Insight Engine execution across all 6 pillars
   */
  async getFinancialInsights(customerId: string, categoryFilter?: string) {
    if (!customerId) throw new Error('customerId is strictly required for financial insights execution.');
    const accounts = await supabaseAccountRepo.listByCustomer(customerId);
    const txRes = await supabaseTransactionRepo.listByCustomer(customerId, { limit: 500 });
    let goals: any[] = [];
    try {
      goals = await supabaseGoalsRepo.listGoals(customerId);
    } catch {
      const identity = loadIdentityFromStorage('customer');
      goals = identity.goals || [];
    }

    const engineResult = generateFinancialInsights({
      customerId,
      accounts,
      transactions: txRes.transactions,
      goals,
    });

    if (categoryFilter && categoryFilter !== 'all') {
      return engineResult.insights.filter(
        (i) => i.type === categoryFilter || i.category === categoryFilter
      );
    }

    return engineResult.insights;
  },

  /**
   * Tool 5: getGoalFeasibility
   * Evaluates user-defined goals against verified surplus cash flow (Zero Invention)
   */
  async getGoalFeasibility(customerId: string) {
    if (!customerId) throw new Error('customerId is strictly required for goal feasibility execution.');
    const summary = await supabaseTransactionRepo.getAnalyticsSummary(customerId);
    const netCashFlow = summary.netCashFlow > 0 ? summary.netCashFlow : 0;

    let goals: any[] = [];
    try {
      goals = await supabaseGoalsRepo.listGoals(customerId);
    } catch {
      const identity = loadIdentityFromStorage('customer');
      goals = identity.goals || [];
    }

    if (goals.length === 0) {
      return {
        hasGoals: false,
        message: 'No active user-defined goals configured. Do not invent arbitrary goals.',
        goals: [],
      };
    }

    const evaluated = goals.map((goal) => {
      const feasibility = calculateGoalFeasibility(goal, netCashFlow);
      return {
        id: goal.id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        currentSavings: goal.currentSavings,
        targetDate: goal.targetDate,
        requiredMonthly: feasibility.requiredMonthlySavings,
        plannedMonthly: feasibility.monthlyContribution,
        isFeasible: feasibility.isFeasible,
        feasibilityReason: feasibility.feasibilityReason,
      };
    });

    return {
      hasGoals: true,
      availableNetCashFlow: netCashFlow,
      goals: evaluated,
    };
  },

  /**
   * Tool 6: getAccountSummary
   * Authorized account balances and verified transaction sample
   */
  async getAccountSummary(customerId: string, accountId?: string) {
    if (!customerId) throw new Error('customerId is strictly required for account summary execution.');
    const allAccounts = await supabaseAccountRepo.listByCustomer(customerId);
    const targetAccounts = accountId
      ? allAccounts.filter((a) => a.id === accountId)
      : allAccounts;

    const txRes = await supabaseTransactionRepo.listByCustomer(customerId, {
      accountId: accountId || undefined,
      limit: 30,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    return {
      accounts: targetAccounts.map((a) => ({
        id: a.id,
        accountName: a.accountName,
        accountType: a.accountType,
        accountNumberMasked: a.accountNumberMasked,
        balance: a.balance,
        currency: a.currency,
      })),
      recentTransactions: txRes.transactions.map((t) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
        categoryName: t.categoryName,
      })),
    };
  },
};
