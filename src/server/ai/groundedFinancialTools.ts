/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  supabaseAccountRepo,
  supabaseTransactionRepo,
  supabaseGoalsRepo,
} from '../db/supabaseRepository.ts';
import {
  calculateNormalizedSummary,
  calculateCategoryBreakdown,
  calculateMonthlyTrends,
  classifyTransactionType,
} from '../../lib/analytics/financialEngine.ts';
import { generateFinancialInsights } from '../../lib/analytics/financialInsightEngine.ts';
import { calculateGoalFeasibility } from '../../lib/goals/feasibility.ts';
import { FinancialInsightEngineResult } from '../../types/insights.ts';
import { Account, Transaction, FinancialSummary } from '../../types/database.ts';

/**
 * Server-side grounded financial tools for Ask Viv.
 * All functions strictly take `verifiedCustomerId` extracted from the server session (JWT).
 * NEVER trusts any parameter from the model or browser.
 */

export interface CashFlowToolResult {
  scope: {
    customerId: string;
    accountCount: number;
    transactionCount: number;
    currency: string;
    periodLabel: string;
  };
  metrics: {
    totalBalance: number;
    pureIncome: number;
    grossExpenses: number;
    refundsOffset: number;
    netAdjustedExpenses: number;
    internalTransfersVolume: number;
    netCashFlow: number;
    savingsRate: number;
  };
  explanation: string;
  supportingAccountIds: string[];
  supportingTransactionIds: string[];
}

export interface SpendingTrendsToolResult {
  scope: {
    periodLabel: string;
    totalTrackedMonths: number;
  };
  monthlyTrends: Array<{
    month: string;
    monthLabel: string;
    income: number;
    expenses: number;
    netCashFlow: number;
    savingsRate: number;
    transactionCount: number;
    monthOverMonthChangePct?: number;
  }>;
  categoryBreakdown: Array<{
    categoryName: string;
    totalAmount: number;
    percentage: number;
    transactionCount: number;
  }>;
  explanation: string;
  supportingTransactionIds: string[];
}

export interface RecurringPaymentsToolResult {
  confirmedRecurring: Array<{
    merchant: string;
    frequency: string;
    typicalAmount: number;
    lastSeenDate: string;
    status: 'confirmed';
    confidence: number;
    transactionIds: string[];
  }>;
  potentialRecurring: Array<{
    merchant: string;
    frequency: string;
    typicalAmount: number;
    observedDates: string[];
    status: 'potential';
    confidence: number;
    transactionIds: string[];
  }>;
  totalMonthlyCommitment: number;
  explanation: string;
}

export interface GoalFeasibilityToolResult {
  goals: Array<{
    id: string;
    name: string;
    targetAmount: number;
    currentSavings: number;
    targetDate: string;
    monthlyContribution: number;
    priority: string;
    feasibilityStatus: 'feasible' | 'tight' | 'unfeasible';
    feasibilityReason: string;
    monthsRemaining: number;
    projectedCompletionDate: string;
  }>;
  observedMonthlyCashFlow: number;
  explanation: string;
}

export interface UnusualTransactionsToolResult {
  unusualTransactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    categoryName?: string;
    detectionRule: string;
    deviationFactor: number;
    historicalAverageForCategoryOrMerchant: number;
    isFraudAccusation: false;
  }>;
  explanation: string;
}

export const groundedFinancialTools = {
  /**
   * 1. Cash flow & exact metrics
   * Enforces that refunds strictly offset qualifying expenses,
   * internal transfers are excluded from operating totals.
   */
  async getCashFlowSummary(
    verifiedCustomerId: string,
    specificAccountId?: string,
    currency: string = 'INR'
  ): Promise<CashFlowToolResult> {
    const accounts = await supabaseAccountRepo.listByCustomer(verifiedCustomerId);
    const txRes = await supabaseTransactionRepo.listByCustomer(verifiedCustomerId, {
      limit: 1000,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    let relevantTx = txRes.transactions;
    let relevantAccounts = accounts;

    if (specificAccountId && specificAccountId !== 'all') {
      relevantAccounts = accounts.filter((a) => a.id === specificAccountId);
      relevantTx = relevantTx.filter((t) => t.accountId === specificAccountId);
    }

    const summary = calculateNormalizedSummary(relevantAccounts, relevantTx, currency);

    // Calculate refund volume and transfer volume directly
    let refundTotal = 0;
    let transferTotal = 0;
    const supportingTxIds: string[] = [];

    for (const tx of relevantTx) {
      const cType = classifyTransactionType(tx);
      if (cType.isRefundOrReversal) {
        refundTotal += tx.amount;
        supportingTxIds.push(tx.id);
      } else if (cType.isInternalTransfer || cType.isCreditCardPayment) {
        transferTotal += tx.amount;
      }
    }

    const grossExpenses = summary.pureExpenses + refundTotal;
    const netAdjustedExpenses = summary.pureExpenses;

    const explanation = `Operating cash flow computed via canonical ledger engine: Pure income of ${currency} ${summary.pureIncome.toFixed(2)} against gross expenses of ${currency} ${grossExpenses.toFixed(2)}, reduced by ${currency} ${refundTotal.toFixed(2)} in refund offsets (yielding net expenses of ${currency} ${netAdjustedExpenses.toFixed(2)}). Internal transfers of ${currency} ${transferTotal.toFixed(2)} excluded from income and expenses. Net cash flow stands at ${currency} ${summary.netCashFlow.toFixed(2)}.`;

    return {
      scope: {
        customerId: verifiedCustomerId,
        accountCount: relevantAccounts.length,
        transactionCount: relevantTx.length,
        currency,
        periodLabel: relevantTx.length > 0 ? `Ledger spanning ${relevantTx[relevantTx.length - 1].date} to ${relevantTx[0].date}` : 'Empty ledger',
      },
      metrics: {
        totalBalance: summary.totalBalance,
        pureIncome: summary.pureIncome,
        grossExpenses,
        refundsOffset: refundTotal,
        netAdjustedExpenses,
        internalTransfersVolume: transferTotal,
        netCashFlow: summary.netCashFlow,
        savingsRate: summary.savingsRate,
      },
      explanation,
      supportingAccountIds: relevantAccounts.map((a) => a.id),
      supportingTransactionIds: supportingTxIds.slice(0, 10),
    };
  },

  /**
   * 2. Spending trends and month-over-month comparisons
   */
  async getSpendingTrends(
    verifiedCustomerId: string,
    specificAccountId?: string
  ): Promise<SpendingTrendsToolResult> {
    const txRes = await supabaseTransactionRepo.listByCustomer(verifiedCustomerId, {
      limit: 1000,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    let relevantTx = txRes.transactions;
    if (specificAccountId && specificAccountId !== 'all') {
      relevantTx = relevantTx.filter((t) => t.accountId === specificAccountId);
    }

    const monthlyTrends = calculateMonthlyTrends(relevantTx);
    const categoryBreakdown = calculateCategoryBreakdown(relevantTx);

    // Compute month-over-month percentage changes
    const enrichedTrends = monthlyTrends.map((t, idx) => {
      let momPct: number | undefined = undefined;
      if (idx > 0 && monthlyTrends[idx - 1].expenses > 0) {
        momPct = ((t.expenses - monthlyTrends[idx - 1].expenses) / monthlyTrends[idx - 1].expenses) * 100;
      }
      return {
        ...t,
        monthOverMonthChangePct: momPct !== undefined ? Math.round(momPct * 10) / 10 : undefined,
      };
    });

    const explanation = enrichedTrends.length >= 2
      ? `Analyzed ${enrichedTrends.length} months of statement records. Most recent monthly outflow was ${enrichedTrends[enrichedTrends.length - 1].monthLabel} with expenses of ₹${enrichedTrends[enrichedTrends.length - 1].expenses.toFixed(2)}${
          enrichedTrends[enrichedTrends.length - 1].monthOverMonthChangePct !== undefined
            ? ` (${enrichedTrends[enrichedTrends.length - 1].monthOverMonthChangePct! > 0 ? '+' : ''}${enrichedTrends[enrichedTrends.length - 1].monthOverMonthChangePct}% vs previous month)`
            : ''
        }. Top spending category is ${categoryBreakdown[0]?.categoryName || 'General'} representing ${categoryBreakdown[0]?.percentage || 0}% of qualifying outflows.`
      : 'Insufficient historical months to construct a multi-month trend comparison.';

    return {
      scope: {
        periodLabel: enrichedTrends.map((t) => t.monthLabel).join(', ') || 'Current Month',
        totalTrackedMonths: enrichedTrends.length,
      },
      monthlyTrends: enrichedTrends,
      categoryBreakdown,
      explanation,
      supportingTransactionIds: relevantTx.slice(0, 10).map((t) => t.id),
    };
  },

  /**
   * 3. Potential and confirmed recurring payments
   */
  async getRecurringPayments(
    verifiedCustomerId: string
  ): Promise<RecurringPaymentsToolResult> {
    const accounts = await supabaseAccountRepo.listByCustomer(verifiedCustomerId);
    const txRes = await supabaseTransactionRepo.listByCustomer(verifiedCustomerId, {
      limit: 1000,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    const engineResult = generateFinancialInsights({
      customerId: verifiedCustomerId,
      transactions: txRes.transactions,
      accounts,
      currency: accounts[0]?.currency || 'INR',
    });

    const recurringInsights = engineResult.insights.filter((i) => i.type === 'recurring_payment');

    const confirmedList: RecurringPaymentsToolResult['confirmedRecurring'] = [];
    const potentialList: RecurringPaymentsToolResult['potentialRecurring'] = [];
    let totalCommitment = 0;

    for (const ins of recurringInsights) {
      const ev = ins.aggregateEvidence || {};
      const typicalAmount = ev.amount || ev.lastAmount || 0;
      totalCommitment += typicalAmount;

      if (ins.isConfirmed) {
        confirmedList.push({
          merchant: ev.merchant || ins.title,
          frequency: ev.frequency || 'monthly',
          typicalAmount,
          lastSeenDate: ev.lastSeenDate || ins.observationPeriod.endDate,
          status: 'confirmed',
          confidence: ins.confidence,
          transactionIds: ins.supportingTransactionIds || [],
        });
      } else {
        potentialList.push({
          merchant: ev.merchant || ins.title,
          frequency: ev.frequency || 'monthly',
          typicalAmount,
          observedDates: ev.observedDates || [ins.observationPeriod.endDate],
          status: 'potential',
          confidence: ins.confidence,
          transactionIds: ins.supportingTransactionIds || [],
        });
      }
    }

    const explanation = `Identified ${recurringInsights.length} recurring payment candidates (${confirmedList.length} confirmed, ${potentialList.length} potential) with estimated recurring monthly commitment of ₹${totalCommitment.toFixed(2)}. Potential candidates require customer confirmation.`;

    return {
      confirmedRecurring: confirmedList,
      potentialRecurring: potentialList,
      totalMonthlyCommitment: totalCommitment,
      explanation,
    };
  },

  /**
   * 4. Savings and financial goals feasibility based on actual net cash flow
   */
  async getGoalFeasibility(
    verifiedCustomerId: string
  ): Promise<GoalFeasibilityToolResult> {
    const accounts = await supabaseAccountRepo.listByCustomer(verifiedCustomerId);
    const txRes = await supabaseTransactionRepo.listByCustomer(verifiedCustomerId, {
      limit: 1000,
    });
    const goals = await supabaseGoalsRepo.listGoals(verifiedCustomerId);

    const summary = calculateNormalizedSummary(accounts, txRes.transactions, accounts[0]?.currency || 'INR');
    const monthlyNetCashFlow = summary.netCashFlow;

    const evaluatedGoals = goals.map((g) => {
      const feasibility = calculateGoalFeasibility(g, monthlyNetCashFlow);
      return {
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentSavings: g.currentSavings,
        targetDate: g.targetDate,
        monthlyContribution: g.monthlyContribution,
        priority: g.priority,
        feasibilityStatus: feasibility.feasibilityStatus,
        feasibilityReason: feasibility.feasibilityReason,
        monthsRemaining: feasibility.monthsRemaining,
        projectedCompletionDate: g.targetDate,
      };
    });

    const explanation = evaluatedGoals.length > 0
      ? `Evaluated ${evaluatedGoals.length} user-defined financial goals against verified average net cash flow of ₹${monthlyNetCashFlow.toFixed(2)}. ${
          evaluatedGoals.filter((g) => g.feasibilityStatus === 'feasible').length
        } goal(s) on track under current savings velocity.`
      : 'No active user goals registered in your profile. You can declare a target savings amount and completion date.';

    return {
      goals: evaluatedGoals,
      observedMonthlyCashFlow: monthlyNetCashFlow,
      explanation,
    };
  },

  /**
   * 5. Unusual transactions explanations (no false fraud accusations)
   */
  async getUnusualTransactions(
    verifiedCustomerId: string
  ): Promise<UnusualTransactionsToolResult> {
    const accounts = await supabaseAccountRepo.listByCustomer(verifiedCustomerId);
    const txRes = await supabaseTransactionRepo.listByCustomer(verifiedCustomerId, {
      limit: 1000,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    const engineResult = generateFinancialInsights({
      customerId: verifiedCustomerId,
      transactions: txRes.transactions,
      accounts,
      currency: accounts[0]?.currency || 'INR',
    });

    const unusualInsights = engineResult.insights.filter((i) => i.type === 'unusual_transaction');

    const resultList: UnusualTransactionsToolResult['unusualTransactions'] = [];

    for (const ins of unusualInsights) {
      const ev = ins.aggregateEvidence || {};
      resultList.push({
        id: ins.supportingTransactionIds?.[0] || ins.id,
        date: ins.observationPeriod.startDate,
        description: ev.merchant || ins.title,
        amount: ev.amount || 0,
        categoryName: ev.category,
        detectionRule: ins.detectionRule,
        deviationFactor: ev.deviationFactor || 2.5,
        historicalAverageForCategoryOrMerchant: ev.meanAmount || 0,
        isFraudAccusation: false,
      });
    }

    const explanation = resultList.length > 0
      ? `Flagged ${resultList.length} transaction(s) deviating mathematically from your own historical spending baseline (> 2.5 standard deviations or 2.5x personal mean). Note: flagged purely for financial review and cash flow tracking, not deemed fraudulent.`
      : 'No statistically unusual outflows detected in your current ledger history.';

    return {
      unusualTransactions: resultList,
      explanation,
    };
  },

  /**
   * 6. Financial Insight Engine complete results
   */
  async getEngineInsights(
    verifiedCustomerId: string,
    specificAccountId?: string
  ): Promise<FinancialInsightEngineResult> {
    const accounts = await supabaseAccountRepo.listByCustomer(verifiedCustomerId);
    const txRes = await supabaseTransactionRepo.listByCustomer(verifiedCustomerId, {
      limit: 1000,
      sortBy: 'date',
      sortOrder: 'desc',
    });
    const goals = await supabaseGoalsRepo.listGoals(verifiedCustomerId);

    return generateFinancialInsights({
      customerId: verifiedCustomerId,
      accountId: specificAccountId,
      transactions: txRes.transactions,
      accounts,
      goals,
      currency: accounts[0]?.currency || 'INR',
    });
  },
};
