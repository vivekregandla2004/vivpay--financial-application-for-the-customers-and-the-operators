/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CanonicalTransaction,
  MonthlySummary,
  RecurringSubscriptionCandidate,
  RecurringFrequency,
  BehavioralMetrics,
  ChartDatasets,
  AutomatedInsight,
  CategoryName,
} from './types.ts';

const CATEGORY_COLORS: Record<string, string> = {
  Salary: '#10b981',
  'Food & Dining': '#f97316',
  Groceries: '#84cc16',
  Fuel: '#eab308',
  Transport: '#06b6d4',
  Shopping: '#ec4899',
  Medical: '#ef4444',
  Utilities: '#3b82f6',
  Recharge: '#8b5cf6',
  Entertainment: '#a855f7',
  Investment: '#14b8a6',
  Insurance: '#6366f1',
  Travel: '#0ea5e9',
  Education: '#f59e0b',
  'Cash Withdrawal': '#64748b',
  Rent: '#d946ef',
  EMI: '#dc2626',
  Loan: '#b91c1c',
  Tax: '#78716c',
  Transfer: '#94a3b8',
  UPI: '#8b5cf6',
  Others: '#94a3b8',
};

/**
 * Computes Monthly Summaries from canonical transactions
 */
export function computeMonthlySummaries(transactions: CanonicalTransaction[]): MonthlySummary[] {
  const monthMap = new Map<
    string,
    {
      income: number;
      expenses: number;
      grossCredits: number;
      grossDebits: number;
      count: number;
    }
  >();

  for (const tx of transactions) {
    if (!tx.date) continue;
    const monthKey = tx.date.slice(0, 7); // YYYY-MM
    const current = monthMap.get(monthKey) || {
      income: 0,
      expenses: 0,
      grossCredits: 0,
      grossDebits: 0,
      count: 0,
    };

    current.count++;
    if (tx.direction === 'credit') {
      current.grossCredits += tx.amount;
      // Real income excludes internal transfer self-credits if identified
      if (tx.category === 'Salary' || tx.category === 'Investment' || tx.category === 'Others') {
        current.income += tx.amount;
      } else {
        current.income += tx.amount;
      }
    } else {
      current.grossDebits += tx.amount;
      if (tx.category !== 'Transfer') {
        current.expenses += tx.amount;
      } else {
        current.expenses += tx.amount;
      }
    }

    monthMap.set(monthKey, current);
  }

  const sortedMonths = Array.from(monthMap.keys()).sort();

  return sortedMonths.map((m) => {
    const data = monthMap.get(m)!;
    const netCashFlow = data.income - data.expenses;
    const savingsRate =
      data.income > 0 ? parseFloat(((netCashFlow / data.income) * 100).toFixed(1)) : null;

    let monthLabel = m;
    try {
      const [year, month] = m.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      // fallback
    }

    return {
      month: m,
      monthLabel,
      income: Math.round(data.income),
      expenses: Math.round(data.expenses),
      netCashFlow: Math.round(netCashFlow),
      savingsRate,
      transactionCount: data.count,
      grossCredits: Math.round(data.grossCredits),
      grossDebits: Math.round(data.grossDebits),
    };
  });
}

/**
 * Detects recurring subscriptions and SIPs
 */
export function detectRecurringSubscriptions(
  transactions: CanonicalTransaction[]
): RecurringSubscriptionCandidate[] {
  // Group debit transactions by merchant or simplified description
  const groups = new Map<string, CanonicalTransaction[]>();

  for (const tx of transactions) {
    if (tx.direction !== 'debit') continue;
    const key = (tx.merchant || tx.description || 'Unknown').trim().toLowerCase();
    if (!key || key === 'unknown') continue;

    const list = groups.get(key) || [];
    list.push(tx);
    groups.set(key, list);
  }

  const candidates: RecurringSubscriptionCandidate[] = [];

  for (const [key, txList] of groups.entries()) {
    if (txList.length < 2) continue;

    // Sort by date ascending
    const sorted = [...txList].sort((a, b) => a.date.localeCompare(b.date));

    // Calculate intervals between successive dates
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1].date).getTime();
      const d2 = new Date(sorted[i].date).getTime();
      const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        intervals.push(diffDays);
      }
    }

    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((acc, v) => acc + v, 0) / intervals.length;

    // Determine frequency
    let detectedFrequency: RecurringFrequency = 'irregular';
    if (avgInterval >= 5 && avgInterval <= 10) {
      detectedFrequency = 'weekly';
    } else if (avgInterval >= 25 && avgInterval <= 35) {
      detectedFrequency = 'monthly';
    } else if (avgInterval >= 75 && avgInterval <= 105) {
      detectedFrequency = 'quarterly';
    } else if (avgInterval >= 340 && avgInterval <= 390) {
      detectedFrequency = 'yearly';
    }

    // Skip purely irregular one-off clustered spending unless monthly/weekly pattern
    if (detectedFrequency === 'irregular' && sorted.length < 3) {
      continue;
    }

    // Calculate amounts statistics
    const amounts = sorted.map((t) => t.amount);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance =
      amounts.reduce((acc, v) => acc + Math.pow(v - avgAmount, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    const amountVariability = avgAmount > 0 ? stdDev / avgAmount : 0; // Coefficient of Variation

    let confidence: 'high' | 'medium' | 'tentative' = 'tentative';
    if (amountVariability < 0.15 && (detectedFrequency === 'monthly' || detectedFrequency === 'weekly')) {
      confidence = 'high';
    } else if (amountVariability < 0.35 || detectedFrequency !== 'irregular') {
      confidence = 'medium';
    }

    // Estimated monthly cost
    let estimatedMonthlyCost = avgAmount;
    if (detectedFrequency === 'weekly') {
      estimatedMonthlyCost = avgAmount * 4.33;
    } else if (detectedFrequency === 'quarterly') {
      estimatedMonthlyCost = avgAmount / 3;
    } else if (detectedFrequency === 'yearly') {
      estimatedMonthlyCost = avgAmount / 12;
    }

    const displayName = sorted[0].merchant || sorted[0].description;

    candidates.push({
      id: `rec-${key.replace(/[^a-z0-9]/g, '-')}`,
      merchant: displayName,
      occurrenceCount: sorted.length,
      averageAmount: Math.round(avgAmount * 100) / 100,
      amountVariability: Math.round(amountVariability * 100) / 100,
      averageIntervalDays: Math.round(avgInterval),
      detectedFrequency,
      estimatedMonthlyCost: Math.round(estimatedMonthlyCost),
      confidence,
      supportingTransactionIds: sorted.map((t) => t.id),
      reviewStatus: confidence === 'high' ? 'verified' : 'tentative',
      lastPaymentDate: sorted[sorted.length - 1].date,
    });
  }

  // Sort descending by monthly cost
  candidates.sort((a, b) => b.estimatedMonthlyCost - a.estimatedMonthlyCost);

  return candidates;
}

/**
 * Computes behavioral metrics across transactions
 */
export function computeBehavioralMetrics(
  transactions: CanonicalTransaction[],
  monthlySummaries: MonthlySummary[] = computeMonthlySummaries(transactions)
): BehavioralMetrics {
  const debits = transactions.filter((t) => t.direction === 'debit');
  const distinctDebitDays = new Set(debits.map((t) => t.date));

  // Date range
  const allDates = transactions.map((t) => t.date).filter(Boolean).sort();
  let totalCalendarDays = 30;
  if (allDates.length > 0) {
    const dMin = new Date(allDates[0]).getTime();
    const dMax = new Date(allDates[allDates.length - 1]).getTime();
    const diff = Math.round((dMax - dMin) / (1000 * 60 * 60 * 24)) + 1;
    totalCalendarDays = Math.max(diff, 1);
  }

  const totalDebitAmount = debits.reduce((acc, t) => acc + t.amount, 0);
  const averageDailySpending = Math.round((totalDebitAmount / totalCalendarDays) * 100) / 100;

  let weekendSpending = 0;
  let weekdaySpending = 0;

  for (const t of debits) {
    const d = new Date(t.date);
    const day = d.getDay();
    if (day === 0 || day === 6) {
      weekendSpending += t.amount;
    } else {
      weekdaySpending += t.amount;
    }
  }

  const weekendVsWeekdayRatio =
    weekdaySpending > 0 ? parseFloat((weekendSpending / weekdaySpending).toFixed(2)) : null;

  // Payment Method Breakdown
  const methodMap: Record<string, { amount: number; count: number; percentage: number }> = {};
  for (const t of debits) {
    const m = t.paymentMethod || 'other';
    const cur = methodMap[m] || { amount: 0, count: 0, percentage: 0 };
    cur.amount += t.amount;
    cur.count++;
    methodMap[m] = cur;
  }

  for (const m in methodMap) {
    methodMap[m].amount = Math.round(methodMap[m].amount);
    methodMap[m].percentage =
      totalDebitAmount > 0 ? parseFloat(((methodMap[m].amount / totalDebitAmount) * 100).toFixed(1)) : 0;
  }

  // Monthly Expense Volatility
  let monthlyExpenseVolatility: number | null = null;
  if (monthlySummaries.length >= 2) {
    const expList = monthlySummaries.map((m) => m.expenses);
    const meanExp = expList.reduce((a, b) => a + b, 0) / expList.length;
    if (meanExp > 0) {
      const varExp =
        expList.reduce((acc, e) => acc + Math.pow(e - meanExp, 2), 0) / expList.length;
      monthlyExpenseVolatility = parseFloat((Math.sqrt(varExp) / meanExp).toFixed(2));
    }
  }

  // EMI / Debt Burden
  const emiDebits = debits.filter((t) => t.category === 'EMI' || t.category === 'Loan');
  const totalEmi = emiDebits.reduce((acc, t) => acc + t.amount, 0);
  const totalMonths = Math.max(monthlySummaries.length, 1);
  const totalEmiMonthly = Math.round(totalEmi / totalMonths);

  const totalIncome = monthlySummaries.reduce((acc, m) => acc + m.income, 0);
  const avgMonthlyIncome = totalIncome / totalMonths;
  const ratioToIncome =
    avgMonthlyIncome > 0 ? parseFloat(((totalEmiMonthly / avgMonthlyIncome) * 100).toFixed(1)) : null;

  const averageTransactionValue = debits.length > 0 ? Math.round((totalDebitAmount / debits.length) * 100) / 100 : 0;

  // Time-of-day analytics: evaluate reliable timestamps if available in source data
  let nightSpending = 0; // 21:00 - 05:00
  let morningSpending = 0; // 05:00 - 12:00
  let afternoonSpending = 0; // 12:00 - 17:00
  let eveningSpending = 0; // 17:00 - 21:00
  let timedDebitCount = 0;

  for (const t of debits) {
    const rawTime = (t as any).timeStr;
    const timeMatch = rawTime ? String(rawTime).match(/^(\d{1,2}):(\d{2})/) : t.description.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\b/i);
    if (timeMatch) {
      let hh = parseInt(timeMatch[1], 10);
      const ampm = timeMatch[3]?.toLowerCase();
      if (ampm === 'pm' && hh < 12) hh += 12;
      if (ampm === 'am' && hh === 12) hh = 0;

      if (hh >= 0 && hh <= 23) {
        timedDebitCount++;
        if (hh >= 21 || hh < 5) nightSpending += t.amount;
        else if (hh >= 5 && hh < 12) morningSpending += t.amount;
        else if (hh >= 12 && hh < 17) afternoonSpending += t.amount;
        else eveningSpending += t.amount;
      }
    }
  }

  const timeOfDayAvailable = timedDebitCount >= Math.min(3, debits.length) && debits.length > 0;

  return {
    averageDailySpending,
    averageTransactionValue,
    activeTransactionDays: distinctDebitDays.size,
    totalCalendarDays,
    weekendSpending: Math.round(weekendSpending),
    weekdaySpending: Math.round(weekdaySpending),
    weekendVsWeekdayRatio,
    timeOfDay: timeOfDayAvailable
      ? {
          available: true,
          nightSpending: Math.round(nightSpending),
          morningSpending: Math.round(morningSpending),
          afternoonSpending: Math.round(afternoonSpending),
          eveningSpending: Math.round(eveningSpending),
        }
      : {
          available: false,
          reason: 'Transaction timestamps not universally provided in tabular statement format',
          nightSpending: 0,
          morningSpending: 0,
          afternoonSpending: 0,
          eveningSpending: 0,
        },
    paymentMethodBreakdown: methodMap,
    monthlyExpenseVolatility,
    emiDebtBurden: {
      available: emiDebits.length > 0,
      totalEmiMonthly,
      ratioToIncome,
    },
  };
}

/**
 * Builds Chart Datasets for all visual dashboard components
 */
export function buildChartDatasets(
  transactions: CanonicalTransaction[],
  monthlySummaries: MonthlySummary[] = computeMonthlySummaries(transactions)
): ChartDatasets {
  const debits = transactions.filter((t) => t.direction === 'debit');

  // Daily Spending
  const dailyMap = new Map<string, number>();
  for (const t of debits) {
    dailyMap.set(t.date, (dailyMap.get(t.date) || 0) + t.amount);
  }
  const dailySpending = Array.from(dailyMap.entries())
    .sort(([d1], [d2]) => d1.localeCompare(d2))
    .slice(-30) // last 30 days
    .map(([date, amount]) => ({ date, amount: Math.round(amount) }));

  // Weekly Spending
  const weeklyMap = new Map<string, number>();
  for (const t of debits) {
    const d = new Date(t.date);
    const dayNr = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dayNr + 3);
    const firstThursday = d.getTime();
    d.setMonth(0, 1);
    if (d.getDay() !== 4) {
      d.setMonth(0, 1 + ((4 - d.getDay() + 7) % 7));
    }
    const weekNr = 1 + Math.ceil((firstThursday - d.getTime()) / 604800000);
    const weekKey = `${t.date.slice(0, 4)}-W${String(weekNr).padStart(2, '0')}`;
    weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + t.amount);
  }
  const weeklySpending = Array.from(weeklyMap.entries())
    .sort(([w1], [w2]) => w1.localeCompare(w2))
    .slice(-12)
    .map(([week, amount]) => ({ week, amount: Math.round(amount) }));

  // Monthly Income vs Expenses
  const monthlyIncomeVsExpenses = monthlySummaries.map((m) => ({
    month: m.monthLabel,
    income: m.income,
    expenses: m.expenses,
  }));

  // Monthly Net Cash Flow
  const monthlyNetCashFlow = monthlySummaries.map((m) => ({
    month: m.monthLabel,
    netCashFlow: m.netCashFlow,
  }));

  // Category Breakdown
  const catMap = new Map<CategoryName, { amount: number; count: number }>();
  let totalDebit = 0;
  for (const t of debits) {
    const cur = catMap.get(t.category) || { amount: 0, count: 0 };
    cur.amount += t.amount;
    cur.count++;
    catMap.set(t.category, cur);
    totalDebit += t.amount;
  }

  const categoryBreakdown = Array.from(catMap.entries())
    .map(([category, { amount, count }]) => ({
      category,
      amount: Math.round(amount),
      percentage: totalDebit > 0 ? parseFloat(((amount / totalDebit) * 100).toFixed(1)) : 0,
      count,
      color: CATEGORY_COLORS[category] || '#94a3b8',
    }))
    .sort((a, b) => b.amount - a.amount);

  // Top Merchants
  const merchantMap = new Map<string, { amount: number; count: number; category: string }>();
  for (const t of debits) {
    const m = t.merchant || t.description;
    const cur = merchantMap.get(m) || { amount: 0, count: 0, category: t.category };
    cur.amount += t.amount;
    cur.count++;
    merchantMap.set(m, cur);
  }

  const topMerchants = Array.from(merchantMap.entries())
    .map(([merchant, data]) => ({
      merchant,
      amount: Math.round(data.amount),
      count: data.count,
      category: data.category,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Payment Methods
  const methodMap = new Map<string, number>();
  for (const t of debits) {
    methodMap.set(t.paymentMethod, (methodMap.get(t.paymentMethod) || 0) + t.amount);
  }
  const paymentMethods = Array.from(methodMap.entries())
    .map(([method, amount]) => ({
      method: method.toUpperCase(),
      amount: Math.round(amount),
      percentage: totalDebit > 0 ? parseFloat(((amount / totalDebit) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Time of Day Chart (if reliable timestamps exist in source data)
  let timeOfDayChart: { period: string; amount: number }[] | null = null;
  let nightTot = 0, morningTot = 0, afternoonTot = 0, eveningTot = 0, timedCount = 0;
  for (const t of debits) {
    const rawTime = (t as any).timeStr;
    const timeMatch = rawTime ? String(rawTime).match(/^(\d{1,2}):(\d{2})/) : t.description.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?\b/i);
    if (timeMatch) {
      let hh = parseInt(timeMatch[1], 10);
      const ampm = timeMatch[3]?.toLowerCase();
      if (ampm === 'pm' && hh < 12) hh += 12;
      if (ampm === 'am' && hh === 12) hh = 0;
      if (hh >= 0 && hh <= 23) {
        timedCount++;
        if (hh >= 21 || hh < 5) nightTot += t.amount;
        else if (hh >= 5 && hh < 12) morningTot += t.amount;
        else if (hh >= 12 && hh < 17) afternoonTot += t.amount;
        else eveningTot += t.amount;
      }
    }
  }
  if (timedCount >= Math.min(3, debits.length) && debits.length > 0) {
    timeOfDayChart = [
      { period: 'Morning (05:00–12:00)', amount: Math.round(morningTot) },
      { period: 'Afternoon (12:00–17:00)', amount: Math.round(afternoonTot) },
      { period: 'Evening (17:00–21:00)', amount: Math.round(eveningTot) },
      { period: 'Night (21:00–05:00)', amount: Math.round(nightTot) },
    ];
  }

  return {
    dailySpending,
    weeklySpending,
    monthlyIncomeVsExpenses,
    monthlyNetCashFlow,
    categoryBreakdown,
    topMerchants,
    paymentMethods,
    timeOfDay: timeOfDayChart,
  };
}

/**
 * Generates automated data-driven insights
 */
export function generateAutomatedInsights(
  monthlySummaries: MonthlySummary[],
  categoryBreakdown: { category: CategoryName; amount: number; percentage: number }[],
  recurringCandidates: RecurringSubscriptionCandidate[],
  metrics: BehavioralMetrics
): AutomatedInsight[] {
  const insights: AutomatedInsight[] = [];

  // 1. Savings Rate / Cash Flow Insight
  if (monthlySummaries.length > 0) {
    const latestMonth = monthlySummaries[monthlySummaries.length - 1];
    if (latestMonth.savingsRate !== null && latestMonth.savingsRate >= 20) {
      insights.push({
        id: 'ins-savings-strong',
        title: 'Strong Cash Flow Surplus',
        explanation: `In ${latestMonth.monthLabel}, you maintained a healthy savings margin of ${latestMonth.savingsRate}%, generating ₹${latestMonth.netCashFlow.toLocaleString()} in net positive cash flow.`,
        severity: 'positive',
        metricValue: `${latestMonth.savingsRate}%`,
        confidence: 'high',
        suggestedAction: 'Channel surplus capital into liquid emergency funds or automated index SIPs.',
      });
    } else if (latestMonth.savingsRate !== null && latestMonth.savingsRate < 5) {
      insights.push({
        id: 'ins-savings-tight',
        title: 'Tight Cash Flow Margin',
        explanation: `In ${latestMonth.monthLabel}, your net savings rate contracted to ${latestMonth.savingsRate}%. Total outflows consumed almost all inbound credits.`,
        severity: 'warning',
        metricValue: `${latestMonth.savingsRate}%`,
        confidence: 'high',
        suggestedAction: 'Review discretionary lifestyle spending to restore a minimum 15% safety buffer.',
      });
    }
  }

  // 2. Dominant Spending Category Insight
  if (categoryBreakdown.length > 0) {
    const top = categoryBreakdown[0];
    if (top.percentage > 25 && top.category !== 'Salary') {
      insights.push({
        id: 'ins-category-dominant',
        title: `Heavy Outflow in ${top.category}`,
        explanation: `${top.category} represents ${top.percentage}% of total observed spending (₹${top.amount.toLocaleString()}), dominating your debit transactions.`,
        severity: top.percentage > 40 ? 'warning' : 'info',
        metricValue: `${top.percentage}%`,
        confidence: 'high',
        suggestedAction: `Set an explicit monthly budget ceiling for ${top.category} to curb outflow concentration.`,
      });
    }
  }

  // 3. Recurring Subscriptions & Fixed Burdens
  if (recurringCandidates.length > 0) {
    const totalRecurringMonthly = recurringCandidates.reduce((acc, c) => acc + c.estimatedMonthlyCost, 0);
    insights.push({
      id: 'ins-recurring-load',
      title: `${recurringCandidates.length} Active Recurring Commitments`,
      explanation: `Identified ${recurringCandidates.length} repeating subscriptions/SIPs consuming approx ₹${totalRecurringMonthly.toLocaleString()} every month.`,
      severity: 'info',
      metricValue: `₹${totalRecurringMonthly.toLocaleString()}/mo`,
      confidence: 'high',
      suggestedAction: 'Audit unutilized streaming memberships or underperforming subscriptions in the Recurring Ledger.',
    });
  }

  // 4. Weekend vs Weekday Outflow
  if (metrics.weekendVsWeekdayRatio && metrics.weekendVsWeekdayRatio > 0.5) {
    insights.push({
      id: 'ins-weekend-spike',
      title: 'Elevated Weekend Leisure Spending',
      explanation: `Weekend debits account for a high proportion (${Math.round(metrics.weekendVsWeekdayRatio * 100)}% of weekday volume), driven primarily by dining, delivery, and entertainment.`,
      severity: 'info',
      metricValue: `${Math.round(metrics.weekendVsWeekdayRatio * 100)}%`,
      confidence: 'medium',
      suggestedAction: 'Allocate a dedicated weekend leisure cap on payment cards.',
    });
  }

  // 5. Payment Method UPI Dominance
  const upiStats = metrics.paymentMethodBreakdown['upi'];
  if (upiStats && upiStats.percentage > 60) {
    insights.push({
      id: 'ins-upi-volume',
      title: 'High UPI Micro-Transaction Frequency',
      explanation: `UPI powers ${upiStats.percentage}% of your debit value across ${upiStats.count} separate transactions.`,
      severity: 'info',
      metricValue: `${upiStats.percentage}% UPI`,
      confidence: 'high',
      suggestedAction: 'Consolidate small-ticket merchant scans via UPI Lite to keep your primary bank statement tidy.',
    });
  }

  return insights;
}
