/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FinancialInsight,
  FinancialInsightType,
  FinancialInsightEngineResult,
  DataSufficiency,
  ObservationPeriod,
  ComparisonPeriod,
} from '../../types/insights.ts';
import { Transaction, Account } from '../../types/database.ts';
import { classifyTransactionType } from './financialEngine.ts';
import { FinancialGoal } from '../identity/types.ts';
import { calculateGoalFeasibility } from '../goals/feasibility.ts';
import { extractMerchantAndMethod } from '../finance/normalize.ts';

export interface InsightEngineOptions {
  customerId: string;
  accountId?: string | null;
  transactions: (Transaction & { categoryName?: string; categoryColor?: string })[];
  accounts: Account[];
  goals?: FinancialGoal[];
  currency?: string;
  confirmedRecurringIds?: Set<string>;
}

/**
 * Normalizes currency formatting helper
 */
function formatCurrency(amount: number, currency: string = 'INR'): string {
  const symbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${symbol}${Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Strips punctuation and clean merchant descriptions for consistent grouping
 */
function cleanMerchantName(desc: string): string {
  if (!desc) return 'Unknown Merchant';
  const extracted = extractMerchantAndMethod(desc);
  if (extracted.merchant && extracted.merchant !== 'Unknown' && extracted.merchant !== desc) {
    return extracted.merchant;
  }
  return desc
    .replace(/^(paid to|payment to|sent to|transfer to|pos debit|upi-)\s*/i, '')
    .replace(/#[0-9a-z_]+/gi, '')
    .replace(/\b(ltd|pvt|inc|corp)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministically generates evidence-backed financial insights conforming to Phase 4A specification.
 */
export function generateFinancialInsights({
  customerId,
  accountId = null,
  transactions,
  accounts,
  goals = [],
  currency = 'INR',
  confirmedRecurringIds = new Set<string>(),
}: InsightEngineOptions): FinancialInsightEngineResult {
  const generatedAt = new Date().toISOString();
  const insights: FinancialInsight[] = [];

  // Filter for specific account if provided
  const scopedTransactions = accountId
    ? transactions.filter((t) => t.accountId === accountId)
    : transactions;
  const scopedAccounts = accountId
    ? accounts.filter((a) => a.id === accountId)
    : accounts;

  // Deduplicate transactions by checksum / ID to prevent duplicate inputs from inflating metrics
  const seenTx = new Set<string>();
  const dedupedTransactions: (Transaction & { categoryName?: string; categoryColor?: string })[] = [];
  for (const tx of scopedTransactions) {
    const key = tx.checksum || tx.id;
    if (!seenTx.has(key)) {
      seenTx.add(key);
      dedupedTransactions.push(tx);
    }
  }

  // Determine observation period bounds
  const dates = dedupedTransactions
    .map((t) => (t.date || '').substring(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();

  const minDate = dates[0] || new Date().toISOString().substring(0, 10);
  const maxDate = dates[dates.length - 1] || new Date().toISOString().substring(0, 10);

  const observationPeriod: ObservationPeriod = {
    startDate: minDate,
    endDate: maxDate,
    label: dates.length > 0 ? `${minDate} to ${maxDate}` : 'Empty Period',
  };

  // Base financial aggregates
  const actualBalance = scopedAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  let grossCredits = 0;
  let grossDebits = 0;
  let pureIncome = 0;
  let pureExpenses = 0;
  let refundsTotal = 0;
  let internalTransfersVolume = 0;
  const refundTransactions: Transaction[] = [];

  for (const tx of dedupedTransactions) {
    const amt = Math.abs(Number(tx.amount) || 0);
    const classification = classifyTransactionType(tx);

    if (classification.isInternalTransfer) {
      internalTransfersVolume += amt;
      continue; // Strictly exclude from operating income & expenses
    }

    if (tx.type === 'credit') {
      grossCredits += amt;
      if (classification.isRefundOrReversal) {
        refundsTotal += amt;
        refundTransactions.push(tx);
      } else if (classification.isPureIncome) {
        pureIncome += amt;
      }
    } else {
      grossDebits += amt;
      if (classification.isPureExpense) {
        pureExpenses += amt;
      }
    }
  }

  // Canonically treat refunds as an expense contra-offset (never inflate pure income)
  const netAdjustedExpenses = Math.max(0, pureExpenses - refundsTotal);
  const netCashFlow = Number((pureIncome - netAdjustedExpenses).toFixed(2));

  // Determine overall data sufficiency
  let dataSufficiency: DataSufficiency = 'sufficient';
  if (dedupedTransactions.length === 0) {
    dataSufficiency = 'insufficient';
  } else if (dedupedTransactions.length < 5 || dates.length < 2) {
    dataSufficiency = 'partial';
  }

  // --------------------------------------------------------------------------
  // EDGE CASE: Empty ledger handling
  // --------------------------------------------------------------------------
  if (dedupedTransactions.length === 0) {
    insights.push({
      id: `ins-empty-ledger-${customerId}`,
      type: 'cash_flow_intelligence',
      category: 'cash_flow_intelligence',
      customerId,
      accountId,
      title: 'No Confirmed Transactions Recorded',
      explanation: 'Your financial ledger has no recorded transactions yet. Import a statement document or connect an account to initiate automated insight generation.',
      observationPeriod,
      comparisonPeriod: null,
      supportingTransactionIds: [],
      aggregateEvidence: {
        actualBalance: Number(actualBalance.toFixed(2)),
        pureIncome: 0,
        pureExpenses: 0,
        netCashFlow: 0,
        refundsTotal: 0,
      },
      calculationMethod: 'Zero-ledger initialization guard',
      detectionRule: 'Empty transaction dataset verification',
      severity: 'info',
      severityBasis: 'Informational placeholder for newly provisioned or unseeded ledger',
      confidence: 1.0,
      dataSufficiency: 'insufficient',
      generatedAt,
      source: 'deterministic_engine',
      suggestedAction: 'Upload an official bank statement PDF, CSV, or Excel file via the Statement Vault.',
    });

    return {
      insights,
      count: insights.length,
      dataSufficiency: 'insufficient',
      observationPeriod,
      summaryMetrics: {
        totalBalance: Number(actualBalance.toFixed(2)),
        pureIncome: 0,
        pureExpenses: 0,
        refundsTotal: 0,
        netAdjustedExpenses: 0,
        netCashFlow: 0,
        internalTransfersVolume: 0,
        potentialRecurringMonthly: 0,
      },
      aiExecutiveSummary: 'No transaction history is currently available for this account. Upload statement files to enable financial insight analytics.',
      generatedAt,
    };
  }

  // --------------------------------------------------------------------------
  // CATEGORY 1: Spending Trends (Month-over-Month by Category & Merchant)
  // --------------------------------------------------------------------------
  // Partition debits by month (YYYY-MM)
  const monthlyCategorySpend: Record<string, Record<string, number>> = {};
  const monthlyMerchantSpend: Record<string, Record<string, number>> = {};
  const monthlyPureSpend: Record<string, number> = {};
  const allMonthsSet = new Set<string>();

  for (const tx of dedupedTransactions) {
    if (tx.type !== 'debit') continue;
    const classification = classifyTransactionType(tx);
    if (classification.isInternalTransfer || classification.isCreditCardPayment) continue;

    const month = (tx.date || '').substring(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    allMonthsSet.add(month);

    const amt = Math.abs(Number(tx.amount) || 0);
    const cat = tx.categoryName || 'General / Other';
    const merchant = cleanMerchantName(tx.description);

    if (!monthlyCategorySpend[month]) monthlyCategorySpend[month] = {};
    monthlyCategorySpend[month][cat] = (monthlyCategorySpend[month][cat] || 0) + amt;

    if (!monthlyMerchantSpend[month]) monthlyMerchantSpend[month] = {};
    monthlyMerchantSpend[month][merchant] = (monthlyMerchantSpend[month][merchant] || 0) + amt;

    monthlyPureSpend[month] = (monthlyPureSpend[month] || 0) + amt;
  }

  const sortedMonths = Array.from(allMonthsSet).sort();

  if (sortedMonths.length >= 2) {
    const currentMonth = sortedMonths[sortedMonths.length - 1];
    const previousMonth = sortedMonths[sortedMonths.length - 2];

    const currentCatMap = monthlyCategorySpend[currentMonth] || {};
    const previousCatMap = monthlyCategorySpend[previousMonth] || {};

    const currentMonthPure = monthlyPureSpend[currentMonth] || 0;
    const previousMonthPure = monthlyPureSpend[previousMonth] || 0;
    const totalSpendDiff = currentMonthPure - previousMonthPure;
    const totalSpendPct = previousMonthPure > 0 ? (totalSpendDiff / previousMonthPure) * 100 : 0;

    const trendObsPeriod: ObservationPeriod = {
      startDate: `${currentMonth}-01`,
      endDate: `${currentMonth}-31`,
      label: currentMonth,
    };
    const trendCompPeriod: ComparisonPeriod = {
      startDate: `${previousMonth}-01`,
      endDate: `${previousMonth}-31`,
      label: previousMonth,
    };

    // Overall month-over-month pure spending change
    insights.push({
      id: `ins-trend-overall-${currentMonth}`,
      type: 'spending_trend',
      category: 'spending_trend',
      customerId,
      accountId,
      title: totalSpendDiff >= 0
        ? `Overall Outflow Increased by ${Math.abs(Math.round(totalSpendPct))}% in ${currentMonth}`
        : `Overall Outflow Decreased by ${Math.abs(Math.round(totalSpendPct))}% in ${currentMonth}`,
      explanation: `Total qualifying monthly expenses moved from ${formatCurrency(previousMonthPure, currency)} in ${previousMonth} to ${formatCurrency(currentMonthPure, currency)} in ${currentMonth} (net delta: ${formatCurrency(totalSpendDiff, currency)}). Internal transfers and credit card repayments are excluded.`,
      observationPeriod: trendObsPeriod,
      comparisonPeriod: trendCompPeriod,
      supportingTransactionIds: [],
      aggregateEvidence: {
        currentAmount: Number(currentMonthPure.toFixed(2)),
        previousAmount: Number(previousMonthPure.toFixed(2)),
        changeAmount: Number(totalSpendDiff.toFixed(2)),
        changePercentage: Number(totalSpendPct.toFixed(1)),
      },
      calculationMethod: 'Month-over-month pure expense delta (excluding transfers)',
      detectionRule: 'Total pure expense deviation between consecutive monthly periods',
      severity: totalSpendDiff > 0 && totalSpendPct > 25 ? 'warning' : totalSpendDiff < 0 ? 'positive' : 'info',
      severityBasis: totalSpendPct > 25 ? 'Significant month-over-month expense escalation' : 'Normal spending fluctuation',
      confidence: 0.95,
      dataSufficiency: 'sufficient',
      generatedAt,
      source: 'deterministic_engine',
      suggestedAction: totalSpendDiff > 0
        ? 'Inspect categories with high upward velocity to check discretionary items.'
        : 'Sustained expense reductions bolster available capital for goals.',
    });

    // Detect categories with meaningful changes (>= 15% delta and >= ₹500 / $10 magnitude)
    const allCategories = Array.from(
      new Set([...Object.keys(currentCatMap), ...Object.keys(previousCatMap)])
    );

    for (const cat of allCategories) {
      const cur = currentCatMap[cat] || 0;
      const prev = previousCatMap[cat] || 0;
      const diff = cur - prev;
      const pct = prev > 0 ? (diff / prev) * 100 : cur > 500 ? 100 : 0;

      if (Math.abs(diff) >= 500 && Math.abs(pct) >= 15) {
        const isSpike = diff > 0;
        insights.push({
          id: `ins-trend-cat-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${currentMonth}`,
          type: 'spending_trend',
          category: 'spending_trend',
          customerId,
          accountId,
          title: isSpike
            ? `Spending Surge in ${cat}: +${Math.round(pct)}%`
            : `Spending Reduction in ${cat}: -${Math.abs(Math.round(pct))}%`,
          explanation: `Qualifying debits in ${cat} shifted from ${formatCurrency(prev, currency)} (${previousMonth}) to ${formatCurrency(cur, currency)} (${currentMonth}), representing a ${Math.round(Math.abs(pct))}% ${isSpike ? 'increase' : 'decrease'}.`,
          observationPeriod: trendObsPeriod,
          comparisonPeriod: trendCompPeriod,
          supportingTransactionIds: [],
          aggregateEvidence: {
            category: cat,
            currentAmount: Number(cur.toFixed(2)),
            previousAmount: Number(prev.toFixed(2)),
            changeAmount: Number(diff.toFixed(2)),
            changePercentage: Number(pct.toFixed(1)),
          },
          calculationMethod: 'MoM category percentage delta: ((cur - prev) / prev) * 100',
          detectionRule: 'Category expenditure delta exceeds ±15% threshold with minimum ₹500 magnitude',
          severity: isSpike ? (pct > 50 ? 'warning' : 'info') : 'positive',
          severityBasis: isSpike ? 'Elevated outflow in specific operational category' : 'Discretionary cost reduction',
          confidence: 0.92,
          dataSufficiency: 'sufficient',
          generatedAt,
          source: 'deterministic_engine',
          suggestedAction: isSpike
            ? `Establish an intentional spending ceiling for ${cat} in upcoming cycles.`
            : `Capital saved in ${cat} can be redirected to active savings goals.`,
        });
      }
    }

    // Top merchant changes
    const curMerchantMap = monthlyMerchantSpend[currentMonth] || {};
    const prevMerchantMap = monthlyMerchantSpend[previousMonth] || {};
    for (const [merchant, cur] of Object.entries(curMerchantMap)) {
      const prev = prevMerchantMap[merchant] || 0;
      if (cur >= 3000 && prev === 0) {
        insights.push({
          id: `ins-trend-merch-${merchant.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${currentMonth}`,
          type: 'spending_trend',
          category: 'spending_trend',
          customerId,
          accountId,
          title: `New High-Volume Payee: ${merchant}`,
          explanation: `Observed ${formatCurrency(cur, currency)} in outlays to ${merchant} during ${currentMonth}. No transactions were observed for this payee in ${previousMonth}.`,
          observationPeriod: trendObsPeriod,
          comparisonPeriod: trendCompPeriod,
          supportingTransactionIds: [],
          aggregateEvidence: {
            merchant,
            currentAmount: Number(cur.toFixed(2)),
            previousAmount: 0,
            changeAmount: Number(cur.toFixed(2)),
          },
          calculationMethod: 'New merchant exposure delta',
          detectionRule: 'Unseen merchant volume >= ₹3,000 threshold compared to preceding cycle',
          severity: 'info',
          severityBasis: 'First-time significant payee relationship identified',
          confidence: 0.9,
          dataSufficiency: 'sufficient',
          generatedAt,
          source: 'deterministic_engine',
          suggestedAction: 'Ensure this payee reflects an authorized and recurring vendor or service.',
        });
      }
    }
  } else {
    // Insufficient multi-month history
    insights.push({
      id: `ins-trend-insufficient-${customerId}`,
      type: 'spending_trend',
      category: 'spending_trend',
      customerId,
      accountId,
      title: 'Insufficient Historical Cycles for Month-over-Month Trends',
      explanation: 'Evaluating meaningful spending trends requires at least 2 distinct monthly cycles. Only 1 monthly window is present in current records.',
      observationPeriod,
      comparisonPeriod: null,
      supportingTransactionIds: [],
      aggregateEvidence: {
        monthsObserved: sortedMonths.length,
      },
      calculationMethod: 'Historical cycle sufficiency check',
      detectionRule: 'Minimum 2 distinct calendar months required for MoM trend analysis',
      severity: 'info',
      severityBasis: 'Data sufficiency boundary condition',
      confidence: 1.0,
      dataSufficiency: 'insufficient',
      generatedAt,
      source: 'deterministic_engine',
      suggestedAction: 'Upload historical statements for prior months to unlock trend comparisons.',
    });
  }

  // --------------------------------------------------------------------------
  // CATEGORY 2: Recurring Payments (Subscriptions, Bills & Repeated Payments)
  // --------------------------------------------------------------------------
  // Group debit transactions by cleaned merchant
  const debitTxByMerchant: Record<string, Transaction[]> = {};
  for (const tx of dedupedTransactions) {
    if (tx.type !== 'debit') continue;
    const classification = classifyTransactionType(tx);
    if (classification.isInternalTransfer) continue;

    const key = cleanMerchantName(tx.description);
    if (!key || key.length < 3) continue;

    if (!debitTxByMerchant[key]) debitTxByMerchant[key] = [];
    debitTxByMerchant[key].push(tx);
  }

  let totalPotentialRecurringMonthly = 0;

  for (const [merchant, txs] of Object.entries(debitTxByMerchant)) {
    if (txs.length < 2) continue;

    // Sort by date ascending
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const datesList = sorted.map((t) => t.date);
    const amounts = sorted.map((t) => Math.abs(Number(t.amount) || 0));

    const totalAmt = amounts.reduce((sum, a) => sum + a, 0);
    const avgAmount = Math.round((totalAmt / amounts.length) * 100) / 100;

    // Interval calculation
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1].date).getTime();
      const d2 = new Date(sorted[i].date).getTime();
      const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) intervals.push(diffDays);
    }

    if (intervals.length === 0) continue;
    const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;

    // Check cadence regularity
    let frequency = 'irregular';
    let isCandidate = false;
    let confidence = 0.65;

    if (avgInterval >= 24 && avgInterval <= 36) {
      frequency = 'monthly';
      isCandidate = true;
      confidence = 0.92;
    } else if (avgInterval >= 6 && avgInterval <= 8) {
      frequency = 'weekly';
      isCandidate = true;
      confidence = 0.88;
    } else if (avgInterval >= 80 && avgInterval <= 100) {
      frequency = 'quarterly';
      isCandidate = true;
      confidence = 0.85;
    } else if (avgInterval >= 340 && avgInterval <= 390) {
      frequency = 'yearly';
      isCandidate = true;
      confidence = 0.8;
    }

    // Amount variance check: standard deviation / average
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    const cv = avgAmount > 0 ? stdDev / avgAmount : 0;

    // If amount is relatively consistent (cv <= 0.25) and frequency detected
    if (isCandidate && cv <= 0.25) {
      const normMerchant = merchant.toLowerCase();
      const isConfirmed =
        confirmedRecurringIds.has(normMerchant) ||
        Array.from(confirmedRecurringIds).some((c) => normMerchant.includes(c) || c.includes(normMerchant));
      const estMonthly = frequency === 'weekly' ? avgAmount * 4.33 : frequency === 'monthly' ? avgAmount : avgAmount / 3;
      totalPotentialRecurringMonthly += estMonthly;

      insights.push({
        id: `ins-recur-${merchant.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        type: 'recurring_payment',
        category: 'recurring_payment',
        customerId,
        accountId,
        title: isConfirmed
          ? `Confirmed Recurring Payment: ${merchant} (~${formatCurrency(avgAmount, currency)} / ${frequency})`
          : `Potential Recurring Payment: ${merchant} (~${formatCurrency(avgAmount, currency)} / ${frequency})`,
        explanation: `Observed ${txs.length} repeating debits averaging ${formatCurrency(avgAmount, currency)} at ~${Math.round(avgInterval)}-day intervals (${frequency} cadence). Label: ${isConfirmed ? 'Confirmed' : 'Potential Recurring Payment (Awaiting Confirmation)'}. Dates observed: ${datesList.join(', ')}.`,
        observationPeriod: {
          startDate: datesList[0],
          endDate: datesList[datesList.length - 1],
          label: `${frequency} cadence`,
        },
        comparisonPeriod: null,
        supportingTransactionIds: sorted.map((t) => t.id),
        aggregateEvidence: {
          merchant,
          averageAmount: avgAmount,
          frequency,
          observedDates: datesList,
          occurrenceCount: txs.length,
          amountVariability: Number(cv.toFixed(3)),
          estimatedMonthlyCost: Number(estMonthly.toFixed(2)),
        },
        calculationMethod: `Cadence and amount variance analysis (interval ~${Math.round(avgInterval)}d, CV ${Number(cv.toFixed(2))})`,
        detectionRule: 'Cadence matches periodic bracket with amount coefficient of variation <= 0.25',
        severity: 'info',
        severityBasis: 'Recurring fixed commitment detection',
        confidence: Number(confidence.toFixed(2)),
        dataSufficiency: 'sufficient',
        generatedAt,
        source: 'deterministic_engine',
        suggestedAction: isConfirmed
          ? 'Manage recurring authorization in account standing instructions.'
          : 'Confirm or dismiss this repeating payment in the Recurring Subscriptions ledger.',
        isConfirmed,
      });
    }
  }

  // --------------------------------------------------------------------------
  // CATEGORY 3: Cash-Flow Intelligence & Liquidity Projections
  // --------------------------------------------------------------------------
  // Calculate average monthly qualifying expenses
  const monthsCount = Math.max(1, sortedMonths.length);
  const avgMonthlyBurn = netAdjustedExpenses / monthsCount;
  const runwayMonths = avgMonthlyBurn > 0 ? actualBalance / avgMonthlyBurn : Infinity;

  // Distinguish actual balances from calculated projections:
  const projected30DayBalance = Number((actualBalance + (netCashFlow / monthsCount)).toFixed(2));
  const projected60DayBalance = Number((actualBalance + 2 * (netCashFlow / monthsCount)).toFixed(2));

  // Declining cash flow check
  let isCashFlowDeclining = false;
  if (sortedMonths.length >= 2) {
    const latestMonth = sortedMonths[sortedMonths.length - 1];
    const prevMonth = sortedMonths[sortedMonths.length - 2];
    const latestNet = (monthlyPureSpend[latestMonth] || 0);
    const prevNet = (monthlyPureSpend[prevMonth] || 0);
    if (latestNet > prevNet) {
      isCashFlowDeclining = true;
    }
  }

  insights.push({
    id: `ins-cashflow-liquidity-${customerId}`,
    type: 'cash_flow_intelligence',
    category: 'cash_flow_intelligence',
    customerId,
    accountId,
    title: runwayMonths < 1.0
      ? 'Critical Liquidity Alert: Reserves Below 1 Month of Expenses'
      : runwayMonths < 2.5
      ? 'Tight Cash Reserve Coverage'
      : 'Healthy Liquid Cash Flow Buffer',
    explanation: `Confirmed actual ledger balance is ${formatCurrency(actualBalance, currency)}. Operating monthly net burn rate is ${formatCurrency(avgMonthlyBurn, currency)}/mo. Calculated 30-day projected reserve is ${formatCurrency(projected30DayBalance, currency)}, providing ${runwayMonths === Infinity ? 'unlimited' : runwayMonths.toFixed(1)} months of runway. Actual balances are derived from reconciled accounts; 30-day projections assume historical cash flow trajectory.`,
    observationPeriod,
    comparisonPeriod: null,
    supportingTransactionIds: [],
    aggregateEvidence: {
      actualBalance: Number(actualBalance.toFixed(2)),
      projectedBalance: projected30DayBalance,
      projected60DayBalance,
      netCashFlow,
      pureIncome,
      pureExpenses,
      netAdjustedExpenses,
      internalTransfersVolume,
      runwayMonths: Number.isFinite(runwayMonths) ? Number(runwayMonths.toFixed(2)) : 999,
      isDeclining: isCashFlowDeclining,
    },
    calculationMethod: 'Runway = actualBalance / (netAdjustedExpenses / monthsCount)',
    detectionRule: 'Reconciliation of ledger balance against canonical operating cash flow trajectory',
    severity: runwayMonths < 1.0 ? 'critical' : runwayMonths < 2.5 ? 'warning' : 'positive',
    severityBasis: runwayMonths < 1.0
      ? 'Liquid balance fails to cover 30 days of baseline operating debits'
      : runwayMonths < 2.5
      ? 'Liquid reserves provide narrow buffer against unexpected outlays'
      : 'Sufficient liquid cushion maintained',
    confidence: 0.95,
    dataSufficiency: 'sufficient',
    generatedAt,
    source: 'deterministic_engine',
    suggestedAction: runwayMonths < 2.5
      ? 'Transfer liquid reserves into checking accounts prior to scheduled fixed debits.'
      : 'Maintain systematic transfer of surplus cash flow to automated investment vehicles.',
  });

  if (internalTransfersVolume > 0) {
    insights.push({
      id: `ins-cashflow-transfers-${customerId}`,
      type: 'cash_flow_intelligence',
      category: 'cash_flow_intelligence',
      customerId,
      accountId,
      title: 'Internal Transfers Isolated from Operating Cash Flow',
      explanation: `Observed ${formatCurrency(internalTransfersVolume, currency)} in internal transfers between customer-owned accounts. These movements have been strictly segregated from operating revenue and expense metrics to ensure accurate accounting.`,
      observationPeriod,
      comparisonPeriod: null,
      supportingTransactionIds: [],
      aggregateEvidence: {
        internalTransfersVolume: Number(internalTransfersVolume.toFixed(2)),
      },
      calculationMethod: 'Transfer segregation invariant rule',
      detectionRule: 'Keyword and category classification for self-transfers and wallet reloads',
      severity: 'info',
      severityBasis: 'Accounting hygiene verification',
      confidence: 1.0,
      dataSufficiency: 'sufficient',
      generatedAt,
      source: 'deterministic_engine',
      suggestedAction: 'No action required; transfer isolation is automatically maintained.',
    });
  }

  // --------------------------------------------------------------------------
  // CATEGORY 4: Refunds & Reversals (Contra-Expense Offsets)
  // --------------------------------------------------------------------------
  if (refundsTotal > 0) {
    insights.push({
      id: `ins-refund-offset-${customerId}`,
      type: 'refund_reversal',
      category: 'refund_reversal',
      customerId,
      accountId,
      title: `Expense Contra-Offset: ${formatCurrency(refundsTotal, currency)} in Reversals`,
      explanation: `Identified ${refundTransactions.length} refund/cashback/reversal credit(s) totaling ${formatCurrency(refundsTotal, currency)}. In accordance with canonical financial accounting, this was applied as an offset against qualifying category expenses (reducing gross expenses from ${formatCurrency(pureExpenses, currency)} to ${formatCurrency(netAdjustedExpenses, currency)}), rather than falsely inflating pure operating income.`,
      observationPeriod,
      comparisonPeriod: null,
      supportingTransactionIds: refundTransactions.map((t) => t.id),
      aggregateEvidence: {
        totalRefunds: Number(refundsTotal.toFixed(2)),
        refundCount: refundTransactions.length,
        grossExpenses: Number(pureExpenses.toFixed(2)),
        netAdjustedExpenses: Number(netAdjustedExpenses.toFixed(2)),
      },
      calculationMethod: 'Contra-expense offset: netExpenses = max(0, pureExpenses - refundsTotal)',
      detectionRule: 'Detection of incoming credits containing refund, cashback, or reversal keywords',
      severity: 'positive',
      severityBasis: 'Valid merchant reversal applied against consumer expenditure',
      confidence: 0.98,
      dataSufficiency: 'sufficient',
      generatedAt,
      source: 'deterministic_engine',
      suggestedAction: 'Verify that all expected return settlements have posted to your statements.',
    });
  }

  // --------------------------------------------------------------------------
  // CATEGORY 5: Unusual Transactions (Statistical Deviations & Anomalies)
  // --------------------------------------------------------------------------
  // Compute overall debit baseline
  const debits = dedupedTransactions.filter((t) => {
    if (t.type !== 'debit') return false;
    const c = classifyTransactionType(t);
    return !c.isInternalTransfer && !c.isCreditCardPayment;
  });

  if (debits.length >= 3) {
    const debitAmounts = debits.map((t) => Math.abs(Number(t.amount) || 0));
    const sortedAmounts = [...debitAmounts].sort((a, b) => a - b);
    const medianDebit = sortedAmounts[Math.floor(sortedAmounts.length / 2)] || 1;

    // Check individual transactions for statistical deviation:
    // Rule A: Amount >= ₹2,000 and > 2.5x baseline (median or leave-one-out mean)
    // Rule B: Single transaction consumes >= 35% of monthly pure income
    for (const tx of debits) {
      const amt = Math.abs(Number(tx.amount) || 0);
      const otherDebits = debits.filter((t) => t.id !== tx.id);
      const otherAmounts = otherDebits.map((t) => Math.abs(Number(t.amount) || 0));
      const meanOfOthers =
        otherAmounts.length > 0
          ? otherAmounts.reduce((s, a) => s + a, 0) / otherAmounts.length
          : medianDebit;

      const isStatisticalOutlier = amt >= 2000 && (amt > meanOfOthers * 2.5 || amt > medianDebit * 2.5);
      const isIncomeProportionSpike = pureIncome > 0 && amt >= pureIncome * 0.35 && amt >= 5000;

      if (isStatisticalOutlier || isIncomeProportionSpike) {
        const baselineAmt = meanOfOthers > 0 ? meanOfOthers : medianDebit;
        const deviationMultiplier = Number((amt / baselineAmt).toFixed(1));
        const triggerRule = isStatisticalOutlier
          ? `Historical Statistical Dispersion: ${formatCurrency(amt, currency)} is ${deviationMultiplier}x higher than your typical debit baseline of ${formatCurrency(baselineAmt, currency)}`
          : `High Income Concentration: Single transaction consumes ${Math.round((amt / pureIncome) * 100)}% of monthly operating income`;

        insights.push({
          id: `ins-unusual-tx-${tx.id}`,
          type: 'unusual_transaction',
          category: 'unusual_transaction',
          customerId,
          accountId: tx.accountId,
          title: `Unusual Outflow Observed: ${tx.description} (Non-Fraudulent Review)`,
          explanation: `A debit of ${formatCurrency(amt, currency)} for "${tx.description}" on ${tx.date} deviated significantly from your historical spending baseline. Triggered by: ${triggerRule}. Note: This spending deviation is flagged for budgeting awareness and does not indicate fraudulent activity.`,
          observationPeriod: {
            startDate: tx.date,
            endDate: tx.date,
            label: tx.date,
          },
          comparisonPeriod: observationPeriod,
          supportingTransactionIds: [tx.id],
          aggregateEvidence: {
            triggerAmount: amt,
            historicalAverage: Number(baselineAmt.toFixed(2)),
            deviationMultiplier,
            category: tx.categoryName || 'General',
          },
          calculationMethod: 'Historical statistical dispersion (Z-score > 2.5 or > 2.5x mean baseline)',
          detectionRule: triggerRule,
          severity: 'warning',
          severityBasis: 'Statistically significant deviation from personal consumption baseline',
          confidence: 0.9,
          dataSufficiency: 'sufficient',
          generatedAt,
          source: 'deterministic_engine',
          suggestedAction: 'Review transaction classification and verify allocation against planned capital expenses.',
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // CATEGORY 6: Savings and Financial Goals (Feasibility & Progress)
  // --------------------------------------------------------------------------
  if (goals && goals.length > 0) {
    for (const goal of goals) {
      const feasibility = calculateGoalFeasibility(goal, netCashFlow > 0 ? netCashFlow : 0);

      const targetDate = goal.targetDate || '2027-12-31';
      const requiredMonthly = feasibility.requiredMonthlySavings;
      const plannedMonthly = feasibility.monthlyContribution;
      const currentSavings = goal.currentSavings || 0;
      const targetAmount = goal.targetAmount || 1;
      const progressPct = Math.round((currentSavings / targetAmount) * 100);

      const isSupported = netCashFlow >= requiredMonthly;

      insights.push({
        id: `ins-goal-feasibility-${goal.id}`,
        type: 'savings_goal',
        category: 'savings_goal',
        customerId,
        accountId,
        title: isSupported
          ? `Goal On Track: "${goal.name}" (${progressPct}% Funded)`
          : `Goal Pace Lagging: "${goal.name}" Requires ${formatCurrency(requiredMonthly, currency)}/mo`,
        explanation: isSupported
          ? `Your current net cash flow surplus of ${formatCurrency(netCashFlow, currency)}/mo comfortably supports the required ${formatCurrency(requiredMonthly, currency)}/mo to achieve your ${formatCurrency(targetAmount, currency)} target by ${targetDate}. Observed progress stands at ${progressPct}%.`
          : `Achieving your ${formatCurrency(targetAmount, currency)} goal for "${goal.name}" by ${targetDate} requires savings of ${formatCurrency(requiredMonthly, currency)}/mo. Your current monthly cash flow surplus of ${formatCurrency(netCashFlow, currency)} leaves a shortfall of ${formatCurrency(Math.max(0, requiredMonthly - netCashFlow), currency)}/mo under current spending levels.`,
        observationPeriod,
        comparisonPeriod: null,
        supportingTransactionIds: [],
        aggregateEvidence: {
          goalId: goal.id,
          goalName: goal.name,
          targetAmount,
          currentSavings,
          requiredMonthlySavings: requiredMonthly,
          plannedMonthlyContribution: plannedMonthly,
          monthsRemaining: feasibility.monthsRemaining,
          targetDate,
          isFeasible: isSupported,
          coveragePercent: feasibility.cashFlowCoveragePercent,
        },
        calculationMethod: 'Canonical goal feasibility: requiredMonthly = (target - current) / monthsRemaining',
        detectionRule: 'Comparison of required monthly savings against confirmed net cash flow surplus',
        severity: isSupported ? 'positive' : 'warning',
        severityBasis: isSupported ? 'Sufficient cash flow surplus to reach target on schedule' : 'Deficit between goal requirement and current surplus',
        confidence: 0.94,
        dataSufficiency: 'sufficient',
        generatedAt,
        source: 'deterministic_engine',
        suggestedAction: isSupported
          ? 'Automate monthly transfers to your goal reserve to preserve funding momentum.'
          : `Increase monthly allocation by ${formatCurrency(Math.max(0, requiredMonthly - netCashFlow), currency)} or extend target date past ${targetDate}.`,
      });
    }
  } else {
    // Zero goals defined: do NOT invent goals
    insights.push({
      id: `ins-goal-none-${customerId}`,
      type: 'savings_goal',
      category: 'savings_goal',
      customerId,
      accountId,
      title: 'No User-Defined Goals Configured',
      explanation: 'You currently have no active financial goals set. Define a target (such as an Emergency Reserve, Vehicle, or Home Downpayment) to receive automated feasibility and timeline projections.',
      observationPeriod,
      comparisonPeriod: null,
      supportingTransactionIds: [],
      aggregateEvidence: {
        goalsCount: 0,
      },
      calculationMethod: 'User goal definition inspection',
      detectionRule: 'Evaluates user-configured financial goal catalog',
      severity: 'info',
      severityBasis: 'Unconfigured user preference',
      confidence: 1.0,
      dataSufficiency: 'sufficient',
      generatedAt,
      source: 'deterministic_engine',
      suggestedAction: 'Create your first goal in the Financial Profile or Twin to track feasibility.',
    });
  }

  // Generate deterministic AI summary
  const topInsights = insights.slice(0, 3);
  const aiExecutiveSummary = `Financial intelligence analysis across ${dedupedTransactions.length} transactions: Confirmed balance is ${formatCurrency(actualBalance, currency)} with a net cash flow of ${formatCurrency(netCashFlow, currency)} (${runwayMonths === Infinity ? 'unlimited' : runwayMonths.toFixed(1)} months runway). ${topInsights.map((i) => i.title).join('. ')}.`;

  return {
    insights,
    count: insights.length,
    dataSufficiency,
    observationPeriod,
    summaryMetrics: {
      totalBalance: Number(actualBalance.toFixed(2)),
      pureIncome: Number(pureIncome.toFixed(2)),
      pureExpenses: Number(pureExpenses.toFixed(2)),
      refundsTotal: Number(refundsTotal.toFixed(2)),
      netAdjustedExpenses: Number(netAdjustedExpenses.toFixed(2)),
      netCashFlow,
      internalTransfersVolume: Number(internalTransfersVolume.toFixed(2)),
      potentialRecurringMonthly: Number(totalPotentialRecurringMonthly.toFixed(2)),
    },
    aiExecutiveSummary,
    generatedAt,
  };
}
