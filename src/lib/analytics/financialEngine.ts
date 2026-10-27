/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction, Account, FinancialSummary } from '../../types/database.ts';
import { extractMerchantAndMethod } from '../finance/normalize.ts';

export interface CategorySummaryItem {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

export interface MonthlyTrendItem {
  month: string; // YYYY-MM
  monthLabel: string; // e.g. "Oct 2026"
  income: number;
  expenses: number;
  netCashFlow: number;
  savingsRate: number;
  transactionCount: number;
}

export interface MerchantSummaryItem {
  merchantName: string;
  totalAmount: number;
  transactionCount: number;
  categoryName: string;
}

/**
 * Generate a deterministic fingerprint for a transaction to prevent duplicates across imports
 */
export function generateTransactionChecksum(
  date: string,
  description: string,
  amount: number,
  type: 'debit' | 'credit',
  accountId?: string
): string {
  const normDate = (date || '').trim().substring(0, 10);
  const normDesc = (description || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normAmt = Math.abs(Number(amount) || 0).toFixed(2);
  const normType = (type || 'debit').toLowerCase();
  const acc = accountId ? accountId.trim() : 'default';

  // Deterministic DJB2-like hash representation
  const input = `${acc}|${normDate}|${normDesc}|${normAmt}|${normType}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return `txchk-${Math.abs(hash >>> 0).toString(16)}-${normAmt.replace('.', '')}`;
}

/**
 * Determines transaction business classification
 */
export function classifyTransactionType(tx: {
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  categoryName?: string;
}): {
  isInternalTransfer: boolean;
  isCreditCardPayment: boolean;
  isRefundOrReversal: boolean;
  isPureIncome: boolean;
  isPureExpense: boolean;
} {
  const desc = (tx.description || '').toLowerCase();
  const cat = (tx.categoryName || '').toLowerCase();

  const isInternalTransfer =
    cat.includes('internal transfer') ||
    desc.includes('self transfer') ||
    desc.includes('to own account') ||
    desc.includes('internal transfer') ||
    desc.includes('transfer received from') ||
    desc.includes('transfer to savings') ||
    desc.includes('transfer from checking') ||
    desc.includes('wallet top-up') ||
    desc.includes('wallet reload');

  const isCreditCardPayment =
    cat.includes('card payment') ||
    desc.includes('credit card bill') ||
    desc.includes('credit card payment') ||
    desc.includes('cred payment') ||
    desc.includes('cc payment');

  const isRefundOrReversal =
    desc.includes('refund') ||
    desc.includes('cashback') ||
    desc.includes('reversal') ||
    desc.includes('returned') ||
    desc.includes('chargeback');

  const isCredit = tx.type === 'credit';

  // Pure income: genuine incoming credits, excluding transfers and refunds
  const isPureIncome = isCredit && !isInternalTransfer && !isRefundOrReversal;

  // Pure expenses: debit outflows, excluding internal transfers and credit card payments
  const isPureExpense = !isCredit && !isInternalTransfer && !isCreditCardPayment;

  return {
    isInternalTransfer,
    isCreditCardPayment,
    isRefundOrReversal,
    isPureIncome,
    isPureExpense,
  };
}

/**
 * Comprehensive deterministic financial summary calculation
 */
export function calculateNormalizedSummary(
  accounts: Account[],
  transactions: (Transaction & { categoryName?: string; categoryColor?: string })[],
  currency: string = 'INR'
): FinancialSummary {
  let grossCredits = 0;
  let grossDebits = 0;
  let pureIncome = 0;
  let pureExpenses = 0;
  let refundTotal = 0;
  let totalDebitTransactions = 0;

  for (const tx of transactions) {
    const amt = Math.abs(Number(tx.amount) || 0);
    const classification = classifyTransactionType(tx);

    if (tx.type === 'credit') {
      grossCredits += amt;
      if (classification.isRefundOrReversal) {
        refundTotal += amt;
      } else if (classification.isPureIncome) {
        pureIncome += amt;
      }
    } else {
      grossDebits += amt;
      totalDebitTransactions++;
      if (classification.isPureExpense) {
        pureExpenses += amt;
      }
    }
  }

  // Adjust pure expenses by subtracting any refund credits
  const netAdjustedExpenses = Math.max(0, pureExpenses - refundTotal);

  const totalBalance = accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);
  const netCashFlow = Number((pureIncome - netAdjustedExpenses).toFixed(2));
  const rawSavingsRate =
    pureIncome > 0 ? Math.max(0, (((pureIncome - netAdjustedExpenses) / pureIncome) * 100)) : 0;
  const savingsRate =
    rawSavingsRate > 0 && rawSavingsRate < 0.1
      ? Number(rawSavingsRate.toFixed(2))
      : Number(rawSavingsRate.toFixed(1));

  // Category breakdown
  const categoryBreakdown = calculateCategoryBreakdown(transactions);
  const topExpenseMerchants = calculateTopMerchants(transactions);

  return {
    totalBalance: Number(totalBalance.toFixed(2)),
    grossCredits: Number(grossCredits.toFixed(2)),
    grossDebits: Number(grossDebits.toFixed(2)),
    pureIncome: Number(pureIncome.toFixed(2)),
    pureExpenses: Number(netAdjustedExpenses.toFixed(2)),
    netCashFlow,
    savingsRate,
    totalTransactions: transactions.length,
    currency,
    categoryBreakdown: categoryBreakdown.map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      amount: c.totalAmount,
      percentage: c.percentage,
      color: c.categoryColor,
    })),
    topExpenseMerchants: topExpenseMerchants.map((m) => ({
      merchant: m.merchantName,
      amount: m.totalAmount,
      count: m.transactionCount,
    })),
    recurringPayments: [],
    spendingTrend: [],
  };
}

/**
 * Deterministic category distribution calculation from debit transactions
 */
export function calculateCategoryBreakdown(
  transactions: (Transaction & { categoryName?: string; categoryColor?: string })[]
): CategorySummaryItem[] {
  const catMap: Record<
    string,
    { id: string; name: string; color: string; total: number; count: number }
  > = {};

  let totalExpenses = 0;

  for (const tx of transactions) {
    if (tx.type === 'debit') {
      const classification = classifyTransactionType(tx);
      // Skip internal transfers for pure spending analytics
      if (classification.isInternalTransfer) continue;

      const amt = Math.abs(Number(tx.amount) || 0);
      totalExpenses += amt;

      const catName = tx.categoryName || 'General / Other';
      const catId = tx.categoryId || 'cat-other';
      const catColor = (tx as any).categoryColor || '#7c3aed';

      if (!catMap[catName]) {
        catMap[catName] = { id: catId, name: catName, color: catColor, total: 0, count: 0 };
      }
      catMap[catName].total += amt;
      catMap[catName].count += 1;
    }
  }

  const result: CategorySummaryItem[] = Object.values(catMap).map((c) => ({
    categoryId: c.id,
    categoryName: c.name,
    categoryColor: c.color,
    totalAmount: Number(c.total.toFixed(2)),
    transactionCount: c.count,
    percentage: totalExpenses > 0 ? Number(((c.total / totalExpenses) * 100).toFixed(1)) : 0,
  }));

  // Sort descending by total spend
  return result.sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Deterministic top merchants calculation
 */
export function calculateTopMerchants(
  transactions: (Transaction & { categoryName?: string })[],
  limit: number = 5
): MerchantSummaryItem[] {
  const merchantMap: Record<string, { total: number; count: number; category: string }> = {};

  for (const tx of transactions) {
    if (tx.type === 'debit') {
      const classification = classifyTransactionType(tx);
      if (classification.isInternalTransfer) continue;

      const amt = Math.abs(Number(tx.amount) || 0);
      const extracted = extractMerchantAndMethod(tx.description, (tx as any).reference || null);
      let name = (tx as any).merchant || extracted.merchant || extracted.cleanDescription || tx.description;
      name = name.replace(/#[0-9a-z_]+/gi, '').replace(/\s+/g, ' ').trim();
      if (!name) name = tx.description;

      if (!merchantMap[name]) {
        merchantMap[name] = { total: 0, count: 0, category: tx.categoryName || 'General' };
      }
      merchantMap[name].total += amt;
      merchantMap[name].count += 1;
    }
  }

  return Object.entries(merchantMap)
    .map(([merchantName, data]) => ({
      merchantName,
      totalAmount: Number(data.total.toFixed(2)),
      transactionCount: data.count,
      categoryName: data.category,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, limit);
}

/**
 * Deterministic monthly cash flow trends calculation
 */
export function calculateMonthlyTrends(
  transactions: (Transaction & { categoryName?: string })[]
): MonthlyTrendItem[] {
  const monthMap: Record<
    string,
    { month: string; income: number; expenses: number; count: number }
  > = {};

  for (const tx of transactions) {
    const month = (tx.date || '').substring(0, 7); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) continue;

    if (!monthMap[month]) {
      monthMap[month] = { month, income: 0, expenses: 0, count: 0 };
    }

    const amt = Math.abs(Number(tx.amount) || 0);
    const classification = classifyTransactionType(tx);
    monthMap[month].count += 1;

    if (tx.type === 'credit' && classification.isPureIncome) {
      monthMap[month].income += amt;
    } else if (tx.type === 'debit' && classification.isPureExpense) {
      monthMap[month].expenses += amt;
    }
  }

  const sortedMonths = Object.keys(monthMap).sort();

  return sortedMonths.map((m) => {
    const data = monthMap[m];
    const income = Number(data.income.toFixed(2));
    const expenses = Number(data.expenses.toFixed(2));
    const net = Number((income - expenses).toFixed(2));
    const rawRate = income > 0 ? Math.max(0, (((income - expenses) / income) * 100)) : 0;
    const rate = rawRate > 0 && rawRate < 0.1 ? Number(rawRate.toFixed(2)) : Number(rawRate.toFixed(1));

    // e.g. "2026-10" -> "Oct 2026"
    const [y, mo] = m.split('-');
    const dateObj = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, 1);
    const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    return {
      month: m,
      monthLabel,
      income,
      expenses,
      netCashFlow: net,
      savingsRate: rate,
      transactionCount: data.count,
    };
  });
}
