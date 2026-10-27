/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransactionDirection = 'debit' | 'credit';

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'atm' | 'cheque' | 'other';

export type CategoryName =
  | 'Salary'
  | 'Food & Dining'
  | 'Groceries'
  | 'Fuel'
  | 'Transport'
  | 'Shopping'
  | 'Medical'
  | 'Utilities'
  | 'Recharge'
  | 'Entertainment'
  | 'Investment'
  | 'Insurance'
  | 'Travel'
  | 'Education'
  | 'Cash Withdrawal'
  | 'Rent'
  | 'EMI'
  | 'Loan'
  | 'Tax'
  | 'Transfer'
  | 'UPI'
  | 'Others';

export const ALL_CATEGORIES: CategoryName[] = [
  'Salary',
  'Food & Dining',
  'Groceries',
  'Fuel',
  'Transport',
  'Shopping',
  'Medical',
  'Utilities',
  'Recharge',
  'Entertainment',
  'Investment',
  'Insurance',
  'Travel',
  'Education',
  'Cash Withdrawal',
  'Rent',
  'EMI',
  'Loan',
  'Tax',
  'Transfer',
  'UPI',
  'Others',
];

export interface CanonicalTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string; // Cleaned / display description
  originalDescription: string; // Exact unmodified description from statement
  amount: number;
  debit: number;
  credit: number;
  balance: number | null;
  reference: string | null;
  merchant: string | null;
  upiHandle: string | null;
  paymentMethod: PaymentMethod;
  category: CategoryName;
  direction: TransactionDirection;
  confidence: number; // 0.0 - 1.0
  reviewRequired: boolean;
  reviewReason?: string;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  isDuplicate?: boolean;
  isSuspectedDuplicate?: boolean;
}

export interface DetectedProvider {
  name: string; // 'HDFC' | 'SBI' | 'ICICI' | 'Axis' | 'Kotak' | 'PhonePe' | 'Paytm' | 'Google Pay' | 'Amazon Pay' | 'Credit Card' | 'Generic'
  confidence: number; // 0.0 - 1.0
  format: string;
  accountNumberMasked?: string;
  detectedCurrency?: string;
}

export interface SheetScore {
  sheetName: string;
  score: number;
  validDateCount: number;
  amountCount: number;
  keywordHits: number;
  rowCount: number;
  isSummaryOrDisclaimer: boolean;
  selectionReason: string;
}

export interface ImportDiagnostics {
  fileName: string;
  detectedProvider: string;
  providerConfidence: number;
  selectedSheet: string;
  sheetSelectionReason: string;
  totalSheets: number;
  totalRowsParsed: number;
  validRowCount: number;
  invalidRowCount: number;
  duplicateCount: number;
  suspectedDuplicateCount: number;
  ambiguousDateCount: number;
  lowConfidenceCategoryCount: number;
  dateRange: {
    from: string;
    to: string;
  };
  warnings: string[];
  errors: string[];
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  monthLabel: string; // e.g. "Oct 2026"
  income: number;
  expenses: number;
  netCashFlow: number;
  savingsRate: number | null; // null if income is 0 or negative
  transactionCount: number;
  grossCredits: number;
  grossDebits: number;
}

export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'irregular';

export interface RecurringSubscriptionCandidate {
  id: string;
  merchant: string;
  occurrenceCount: number;
  averageAmount: number;
  amountVariability: number; // Coefficient of variation (CV)
  averageIntervalDays: number;
  detectedFrequency: RecurringFrequency;
  estimatedMonthlyCost: number;
  confidence: 'high' | 'medium' | 'tentative';
  supportingTransactionIds: string[];
  reviewStatus: 'verified' | 'tentative' | 'dismissed';
  lastPaymentDate: string;
}

export interface BehavioralMetrics {
  averageDailySpending: number;
  averageTransactionValue?: number;
  activeTransactionDays: number;
  totalCalendarDays: number;
  weekendSpending: number;
  weekdaySpending: number;
  weekendVsWeekdayRatio: number | null; // null if weekday is 0
  timeOfDay: {
    available: boolean;
    reason?: string;
    nightSpending: number; // 21:00 - 05:00
    morningSpending: number; // 05:00 - 12:00
    afternoonSpending: number; // 12:00 - 17:00
    eveningSpending: number; // 17:00 - 21:00
  };
  paymentMethodBreakdown: Record<string, { amount: number; count: number; percentage: number }>;
  monthlyExpenseVolatility: number | null;
  emiDebtBurden: {
    available: boolean;
    totalEmiMonthly: number;
    ratioToIncome: number | null;
  };
}

export interface ChartDatasets {
  dailySpending: { date: string; amount: number }[];
  weeklySpending: { week: string; amount: number }[];
  monthlyIncomeVsExpenses: { month: string; income: number; expenses: number }[];
  monthlyNetCashFlow: { month: string; netCashFlow: number }[];
  categoryBreakdown: { category: CategoryName; amount: number; percentage: number; count: number; color: string }[];
  topMerchants: { merchant: string; amount: number; count: number; category: string }[];
  paymentMethods: { method: string; amount: number; percentage: number }[];
  timeOfDay: { period: string; amount: number }[] | null;
}

export interface AutomatedInsight {
  id: string;
  title: string;
  explanation: string;
  severity: 'positive' | 'info' | 'warning' | 'alert';
  metricValue: string;
  comparisonPeriod?: string;
  supportingTransactionIds?: string[];
  confidence: 'high' | 'medium';
  suggestedAction: string;
}

export type HealthGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface HealthFactorResult {
  factorKey: string;
  name: string;
  maxPoints: number;
  awardedPoints: number | null; // null if data is insufficient
  measuredValue: string;
  numericValue?: number;
  explanation: string;
  dataSufficiency: 'sufficient' | 'partial' | 'insufficient';
  recommendation: string;
}

export interface FinancialHealthResult {
  compositeScore: number; // 0 - 100
  grade: HealthGrade;
  coveragePercentage: number; // Available factors point coverage
  isProvisional: boolean;
  factors: HealthFactorResult[];
  summary: string;
}

export interface AnalysisResult {
  success: boolean;
  provider: DetectedProvider;
  selectedSheet: string;
  sheetDiagnostics: SheetScore[];
  transactions: CanonicalTransaction[];
  diagnostics: ImportDiagnostics;
  monthlySummaries: MonthlySummary[];
  recurringCandidates: RecurringSubscriptionCandidate[];
  metrics: BehavioralMetrics;
  charts: ChartDatasets;
  insights: AutomatedInsight[];
  health: FinancialHealthResult;
  currency: string;
}
