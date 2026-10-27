/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type FinancialInsightType =
  | 'spending_trend'
  | 'recurring_payment'
  | 'cash_flow_intelligence'
  | 'refund_reversal'
  | 'unusual_transaction'
  | 'savings_goal';

export type InsightSeverity = 'positive' | 'info' | 'warning' | 'critical';

export type DataSufficiency = 'sufficient' | 'partial' | 'insufficient';

export interface ObservationPeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label?: string; // e.g. "Oct 2026", "Last 30 Days"
}

export interface ComparisonPeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label?: string; // e.g. "Sep 2026", "Prior 30 Days"
}

export interface AggregateEvidence {
  // Spending Trends
  currentAmount?: number;
  previousAmount?: number;
  changeAmount?: number;
  changePercentage?: number;
  category?: string;
  merchant?: string;

  // Recurring Payments
  averageAmount?: number;
  frequency?: string;
  observedDates?: string[];
  occurrenceCount?: number;
  amountVariability?: number;

  // Cash Flow & Balances
  actualBalance?: number;
  projectedBalance?: number;
  netCashFlow?: number;
  pureIncome?: number;
  pureExpenses?: number;
  netAdjustedExpenses?: number;
  internalTransfersVolume?: number;
  runwayMonths?: number;

  // Refunds & Reversals
  totalRefunds?: number;
  refundCount?: number;
  offsetCategory?: string;

  // Unusual Transactions
  triggerAmount?: number;
  historicalAverage?: number;
  deviationMultiplier?: number;

  // Goals
  goalId?: string;
  goalName?: string;
  targetAmount?: number;
  currentSavings?: number;
  requiredMonthlySavings?: number;
  plannedMonthlyContribution?: number;
  monthsRemaining?: number;
  targetDate?: string;
  isFeasible?: boolean;

  [key: string]: any;
}

export interface FinancialInsight {
  id: string; // Stable deterministic or UUID identifier
  type: FinancialInsightType;
  category?: string; // Compatibility field
  customerId: string;
  accountId?: string | null; // Relevant account scope
  title: string;
  explanation: string;
  observationPeriod: ObservationPeriod;
  comparisonPeriod?: ComparisonPeriod | null;
  supportingTransactionIds?: string[];
  aggregateEvidence?: AggregateEvidence;
  calculationMethod: string;
  detectionRule: string;
  severity: InsightSeverity;
  severityBasis: string;
  confidence: number; // 0.0 - 1.0
  dataSufficiency: DataSufficiency;
  generatedAt: string; // ISO 8601 timestamp
  source: 'deterministic_engine' | 'ai_enhanced' | 'derived';
  suggestedAction?: string;
  isConfirmed?: boolean; // For potential recurring payments
}

export interface FinancialInsightEngineResult {
  insights: FinancialInsight[];
  count: number;
  dataSufficiency: DataSufficiency;
  observationPeriod: ObservationPeriod;
  summaryMetrics: {
    totalBalance: number;
    pureIncome: number;
    pureExpenses: number;
    refundsTotal: number;
    netAdjustedExpenses: number;
    netCashFlow: number;
    internalTransfersVolume: number;
    potentialRecurringMonthly: number;
  };
  aiExecutiveSummary?: string | null;
  generatedAt: string;
}
