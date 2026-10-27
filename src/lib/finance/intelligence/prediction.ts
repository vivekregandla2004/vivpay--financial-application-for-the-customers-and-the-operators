/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RecurringSubscriptionCandidate } from '../types.ts';
import { Transaction } from '../../../types/database.ts';
import { classifyTransactionType, MonthlyTrendItem } from '../../analytics/financialEngine.ts';

export interface CategoryForecast {
  category: string;
  predictedAmount: number;
  historicalAverage: number;
  trend: 'up' | 'down' | 'stable';
  percentageOfTotal: number;
}

export interface SubscriptionForecast {
  detectedCommitment: number;
  minExpected: number; // 95%
  maxExpected: number; // 110%
  activeSubscriptionsCount: number;
  explanation: string;
}

export interface BudgetDeviation {
  latestActualSpend: number;
  expectedBaseline: number;
  deviationAmount: number;
  deviationPercentage: number;
  status: 'under_budget' | 'on_track' | 'over_budget';
  summary: string;
}

export interface SpendingPrediction {
  nextMonth: string; // e.g. "2026-04"
  nextMonthLabel: string; // e.g. "April 2026"
  predictedExpenses: number;
  expensesRange: {
    min: number;
    max: number;
    stdDev: number;
  };
  predictedIncome: number;
  incomeRange: {
    min: number;
    max: number;
    stdDev: number;
  };
  predictedNetCashFlow: number;
  predictedSavingsRate: number;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number; // 0.0 - 1.0
  monthsAnalyzed: number;
  model: 'EWMA (alpha=0.5)';
  explanation: string;
  categoryForecasts: CategoryForecast[];
  subscriptionForecast: SubscriptionForecast;
  budgetDeviation: BudgetDeviation;
}

/**
 * Computes Exponentially Weighted Moving Average (EWMA) with smoothing factor alpha
 */
export function computeEWMA(series: number[], alpha: number = 0.5): number {
  if (series.length === 0) return 0;
  if (series.length === 1) return series[0];

  let ewma = series[0];
  for (let i = 1; i < series.length; i++) {
    ewma = alpha * series[i] + (1 - alpha) * ewma;
  }
  return Number(ewma.toFixed(2));
}

/**
 * Computes sample standard deviation of a series
 */
export function computeStdDev(series: number[]): number {
  if (series.length <= 1) return 0;
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const variance = series.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / series.length;
  return Number(Math.sqrt(variance).toFixed(2));
}

/**
 * Generates next month identifier and human-readable label
 */
function getNextMonthInfo(lastMonthStr?: string): { nextMonth: string; nextMonthLabel: string } {
  let date: Date;
  if (lastMonthStr && /^\d{4}-\d{2}$/.test(lastMonthStr)) {
    const [y, m] = lastMonthStr.split('-').map(Number);
    date = new Date(y, m, 1); // Month is 0-indexed in Date, so m is next month
  } else {
    date = new Date();
    date.setMonth(date.getMonth() + 1);
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const nextMonth = `${y}-${m}`;
  const nextMonthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { nextMonth, nextMonthLabel };
}

/**
 * Computes explainable spending and financial predictions using historical data
 */
export function computeSpendingPredictions(
  transactions: (Transaction & { categoryName?: string; categoryColor?: string })[] = [],
  monthlyTrends: MonthlyTrendItem[] = [],
  recurringList: RecurringSubscriptionCandidate[] = []
): SpendingPrediction | null {
  if (!monthlyTrends || monthlyTrends.length === 0) {
    return null;
  }

  const monthsAnalyzed = monthlyTrends.length;
  const lastMonth = monthlyTrends[monthlyTrends.length - 1].month;
  const { nextMonth, nextMonthLabel } = getNextMonthInfo(lastMonth);

  // 1. Time series extraction
  const expenseSeries = monthlyTrends.map((m) => m.expenses);
  const incomeSeries = monthlyTrends.map((m) => m.income);

  // 2. EWMA forecasting (alpha = 0.5)
  const ALPHA = 0.5;
  const predictedExpenses = computeEWMA(expenseSeries, ALPHA);
  const expStdDev = computeStdDev(expenseSeries);
  const minExpenses = Math.max(0, Number((predictedExpenses - expStdDev).toFixed(2)));
  const maxExpenses = Number((predictedExpenses + expStdDev).toFixed(2));

  const predictedIncome = computeEWMA(incomeSeries, ALPHA);
  const incStdDev = computeStdDev(incomeSeries);
  const minIncome = Math.max(0, Number((predictedIncome - incStdDev).toFixed(2)));
  const maxIncome = Number((predictedIncome + incStdDev).toFixed(2));

  const predictedNetCashFlow = Number((predictedIncome - predictedExpenses).toFixed(2));
  const rawSavingsRate = predictedIncome > 0 ? ((predictedIncome - predictedExpenses) / predictedIncome) * 100 : 0;
  const predictedSavingsRate =
    rawSavingsRate > 0 && rawSavingsRate < 0.1
      ? Number(rawSavingsRate.toFixed(2))
      : Number(rawSavingsRate.toFixed(1));

  // 3. Confidence determination
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let confidenceScore = 0.5;
  if (monthsAnalyzed >= 12) {
    confidence = 'high';
    confidenceScore = 0.95;
  } else if (monthsAnalyzed >= 6) {
    confidence = 'medium';
    confidenceScore = 0.8;
  } else {
    confidence = 'low';
    confidenceScore = 0.6;
  }

  // 4. Category-level predictions for top 6 categories
  const categoryMonthlySpend: Record<string, Record<string, number>> = {};
  const categoryTotalSpend: Record<string, number> = {};

  for (const t of transactions) {
    if (t.type !== 'debit') continue;
    const c = classifyTransactionType(t);
    if (c.isInternalTransfer || c.isCreditCardPayment) continue;

    const month = (t.date || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;

    const catName = t.categoryName || 'Others';
    const amt = Math.abs(Number(t.amount) || 0);

    if (!categoryMonthlySpend[catName]) categoryMonthlySpend[catName] = {};
    categoryMonthlySpend[catName][month] = (categoryMonthlySpend[catName][month] || 0) + amt;
    categoryTotalSpend[catName] = (categoryTotalSpend[catName] || 0) + amt;
  }

  // Pick top 6 categories by cumulative spend
  const sortedCategories = Object.keys(categoryTotalSpend)
    .sort((a, b) => categoryTotalSpend[b] - categoryTotalSpend[a])
    .slice(0, 6);

  const allMonths = monthlyTrends.map((m) => m.month);

  const categoryForecasts: CategoryForecast[] = sortedCategories.map((cat) => {
    const series = allMonths.map((m) => categoryMonthlySpend[cat]?.[m] || 0);
    const predictedAmt = computeEWMA(series, ALPHA);
    const avgAmt = Number((series.reduce((a, b) => a + b, 0) / Math.max(1, series.length)).toFixed(2));

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (predictedAmt > avgAmt * 1.05) trend = 'up';
    else if (predictedAmt < avgAmt * 0.95) trend = 'down';

    const pctOfTotal = predictedExpenses > 0 ? Number(((predictedAmt / predictedExpenses) * 100).toFixed(1)) : 0;

    return {
      category: cat,
      predictedAmount: predictedAmt,
      historicalAverage: avgAmt,
      trend,
      percentageOfTotal: pctOfTotal,
    };
  });

  // 5. Subscription forecast (95% - 110% of detected commitment)
  const detectedMonthlyCommitment = recurringList.reduce(
    (sum, r) => sum + (r.estimatedMonthlyCost || r.averageAmount || 0),
    0
  );
  const minSubExpected = Number((detectedMonthlyCommitment * 0.95).toFixed(2));
  const maxSubExpected = Number((detectedMonthlyCommitment * 1.1).toFixed(2));

  const subscriptionForecast: SubscriptionForecast = {
    detectedCommitment: Number(detectedMonthlyCommitment.toFixed(2)),
    minExpected: minSubExpected,
    maxExpected: maxSubExpected,
    activeSubscriptionsCount: recurringList.length,
    explanation: `Identified ${recurringList.length} recurring obligations representing an estimated commitment between ${minSubExpected.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} and ${maxSubExpected.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} (95%–110% bounds).`,
  };

  // 6. Budget deviation against historical trend
  const latestMonthData = monthlyTrends[monthlyTrends.length - 1];
  const priorExpenseSeries = expenseSeries.slice(0, expenseSeries.length - 1);
  const expectedBaseline = priorExpenseSeries.length > 0 ? computeEWMA(priorExpenseSeries, ALPHA) : expenseSeries[0];
  const deviationAmount = Number((latestMonthData.expenses - expectedBaseline).toFixed(2));
  const deviationPercentage = expectedBaseline > 0 ? Number(((deviationAmount / expectedBaseline) * 100).toFixed(1)) : 0;

  let deviationStatus: 'under_budget' | 'on_track' | 'over_budget' = 'on_track';
  if (deviationPercentage > 10) deviationStatus = 'over_budget';
  else if (deviationPercentage < -10) deviationStatus = 'under_budget';

  const budgetDeviation: BudgetDeviation = {
    latestActualSpend: latestMonthData.expenses,
    expectedBaseline,
    deviationAmount,
    deviationPercentage,
    status: deviationStatus,
    summary:
      deviationStatus === 'over_budget'
        ? `Spending in ${latestMonthData.monthLabel} exceeded expected baseline by ${Math.abs(deviationPercentage)}% (+${deviationAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}).`
        : deviationStatus === 'under_budget'
        ? `Spending in ${latestMonthData.monthLabel} was ${Math.abs(deviationPercentage)}% below historical baseline.`
        : `Spending in ${latestMonthData.monthLabel} tracked within expected variance bounds of the historical baseline.`,
  };

  const explanation = `Forecast modeled using Exponentially Weighted Moving Average (EWMA, α=0.5) over ${monthsAnalyzed} continuous monthly intervals. Predicted next-month expenditure is expected between ₹${minExpenses.toLocaleString('en-IN')} and ₹${maxExpenses.toLocaleString('en-IN')} (mean ± 1σ of ₹${expStdDev.toLocaleString('en-IN')}). Expected net cash flow is ₹${predictedNetCashFlow.toLocaleString('en-IN')} with an anticipated ${predictedSavingsRate}% savings retention.`;

  return {
    nextMonth,
    nextMonthLabel,
    predictedExpenses,
    expensesRange: {
      min: minExpenses,
      max: maxExpenses,
      stdDev: expStdDev,
    },
    predictedIncome,
    incomeRange: {
      min: minIncome,
      max: maxIncome,
      stdDev: incStdDev,
    },
    predictedNetCashFlow,
    predictedSavingsRate,
    confidence,
    confidenceScore,
    monthsAnalyzed,
    model: 'EWMA (alpha=0.5)',
    explanation,
    categoryForecasts,
    subscriptionForecast,
    budgetDeviation,
  };
}
