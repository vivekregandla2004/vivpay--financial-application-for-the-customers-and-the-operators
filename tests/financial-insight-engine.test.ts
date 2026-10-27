/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { generateFinancialInsights } from '../src/lib/analytics/financialInsightEngine.ts';
import { classifyTransactionType } from '../src/lib/analytics/financialEngine.ts';
import { Transaction, Account } from '../src/types/database.ts';
import { FinancialGoal } from '../src/lib/identity/types.ts';

console.log('🧪 Starting VivPay Phase 4A Financial Insight Engine Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
  passedTests++;
}

// -------------------------------------------------------------
// Test 1: Empty Ledger & Zero-Denominator Safety
// -------------------------------------------------------------
console.log('--- Test 1: Empty Ledger & Zero-Denominator Safety ---');

const emptyResult = generateFinancialInsights({
  customerId: 'cust-empty',
  transactions: [],
  accounts: [
    {
      id: 'acc-empty',
      customerId: 'cust-empty',
      accountName: 'Empty Account',
      accountNumberMasked: '•••• 0000',
      accountType: 'checking',
      institutionName: 'HDFC',
      balance: 0,
      currency: 'INR',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
  ],
  currency: 'INR',
});

assert(emptyResult.dataSufficiency === 'insufficient', 'Empty ledger marked with dataSufficiency = insufficient');
assert(emptyResult.insights.length > 0, 'Empty ledger generates an informational guidance insight');
assert(emptyResult.summaryMetrics.totalBalance === 0, 'Total balance is 0 and finite');
assert(emptyResult.summaryMetrics.pureIncome === 0, 'Pure income is 0 and finite');
assert(emptyResult.summaryMetrics.pureExpenses === 0, 'Pure expenses is 0 and finite');
assert(emptyResult.summaryMetrics.netCashFlow === 0, 'Net cash flow is 0 and finite');
assert(Number.isFinite(emptyResult.summaryMetrics.netAdjustedExpenses), 'Adjusted expenses is strictly finite');
assert(typeof emptyResult.aiExecutiveSummary === 'string', 'Executive summary is present');

// -------------------------------------------------------------
// Test 2: Spending Trends (Month-over-Month & Comparison Periods)
// -------------------------------------------------------------
console.log('\n--- Test 2: Spending Trends (Month-over-Month by Category & Merchant) ---');

const sepDate = '2026-09-15';
const octDate = '2026-10-15';

const trendTransactions: (Transaction & { categoryName?: string })[] = [
  // September (Previous Month)
  {
    id: 'tx-sep-salary',
    customerId: 'cust-trends',
    accountId: 'acc-1',
    amount: 100000,
    type: 'credit',
    categoryId: 'cat-inc',
    categoryName: 'Salary',
    description: 'TechCorp Sept Salary',
    date: sepDate,
    isUserCorrected: false,
    isRecurring: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-sep-dining',
    customerId: 'cust-trends',
    accountId: 'acc-1',
    amount: 5000,
    type: 'debit',
    categoryId: 'cat-food',
    categoryName: 'Food & Dining',
    description: 'Bistro Dining',
    date: sepDate,
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-sep-shopping',
    customerId: 'cust-trends',
    accountId: 'acc-1',
    amount: 10000,
    type: 'debit',
    categoryId: 'cat-shop',
    categoryName: 'Shopping',
    description: 'Zudio Apparel',
    date: sepDate,
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },

  // October (Current Month)
  {
    id: 'tx-oct-salary',
    customerId: 'cust-trends',
    accountId: 'acc-1',
    amount: 100000,
    type: 'credit',
    categoryId: 'cat-inc',
    categoryName: 'Salary',
    description: 'TechCorp Oct Salary',
    date: octDate,
    isUserCorrected: false,
    isRecurring: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-oct-dining',
    customerId: 'cust-trends',
    accountId: 'acc-1',
    amount: 12000, // +140% surge in dining (>15% and >₹500)
    type: 'debit',
    categoryId: 'cat-food',
    categoryName: 'Food & Dining',
    description: 'Fine Dining & Catering',
    date: octDate,
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-oct-shopping',
    customerId: 'cust-trends',
    accountId: 'acc-1',
    amount: 4000, // -60% reduction in shopping
    type: 'debit',
    categoryId: 'cat-shop',
    categoryName: 'Shopping',
    description: 'Retail Outlet',
    date: octDate,
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-oct-apple',
    customerId: 'cust-trends',
    accountId: 'acc-1',
    amount: 35000, // New major payee (>₹3000)
    type: 'debit',
    categoryId: 'cat-tech',
    categoryName: 'Electronics',
    description: 'Apple Store India',
    date: octDate,
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
];

const trendAccounts: Account[] = [
  {
    id: 'acc-1',
    customerId: 'cust-trends',
    accountName: 'Operating Account',
    accountNumberMasked: '•••• 1234',
    accountType: 'checking',
    institutionName: 'HDFC',
    balance: 75000,
    currency: 'INR',
    createdAt: '2026-09-01',
    updatedAt: '2026-10-15',
  },
];

const trendResult = generateFinancialInsights({
  customerId: 'cust-trends',
  transactions: trendTransactions,
  accounts: trendAccounts,
  currency: 'INR',
});

const trendInsights = trendResult.insights.filter((i) => i.type === 'spending_trend');
assert(trendInsights.length >= 3, `Identified spending trends: ${trendInsights.length}`);

// Verify category surge detection
const diningSurge = trendInsights.find((i) => i.aggregateEvidence?.category === 'Food & Dining');
assert(!!diningSurge, 'Detected surge in Food & Dining category');
assert(diningSurge!.aggregateEvidence!.changePercentage! > 100, `Surge percentage verified: ${diningSurge?.aggregateEvidence?.changePercentage}%`);
assert(diningSurge!.observationPeriod.label === '2026-10', 'Observation period clearly labeled as 2026-10');
assert(diningSurge!.comparisonPeriod?.label === '2026-09', 'Comparison period clearly labeled as 2026-09');

// Verify category reduction detection
const shoppingDrop = trendInsights.find((i) => i.aggregateEvidence?.category === 'Shopping');
assert(!!shoppingDrop, 'Detected spending reduction in Shopping category');
assert(shoppingDrop!.aggregateEvidence!.changePercentage! < 0, `Reduction percentage negative: ${shoppingDrop?.aggregateEvidence?.changePercentage}%`);
assert(shoppingDrop!.severity === 'positive', 'Expense reduction marked with positive severity');

// Verify new high-volume payee detection
const newPayee = trendInsights.find((i) => i.aggregateEvidence?.merchant?.includes('Apple Store'));
assert(!!newPayee, 'Detected first-time high-volume payee: Apple Store');
assert(newPayee!.aggregateEvidence!.currentAmount === 35000, 'Current volume correctly recorded as ₹35,000');

// -------------------------------------------------------------
// Test 3: Potential Recurring Payments Detection & Confirmation
// -------------------------------------------------------------
console.log('\n--- Test 3: Potential Recurring Payments Detection & Confirmation ---');

const recurringTransactions: Transaction[] = [
  {
    id: 'tx-net-1',
    customerId: 'cust-recur',
    accountId: 'acc-1',
    amount: 649,
    type: 'debit',
    categoryId: 'cat-sub',
    description: 'Netflix Monthly Plan',
    date: '2026-08-10',
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-net-2',
    customerId: 'cust-recur',
    accountId: 'acc-1',
    amount: 649,
    type: 'debit',
    categoryId: 'cat-sub',
    description: 'Netflix Monthly Plan',
    date: '2026-09-09', // 30-day cadence
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-net-3',
    customerId: 'cust-recur',
    accountId: 'acc-1',
    amount: 649,
    type: 'debit',
    categoryId: 'cat-sub',
    description: 'Netflix Monthly Plan',
    date: '2026-10-10', // 31-day cadence
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
];

const unconfirmedResult = generateFinancialInsights({
  customerId: 'cust-recur',
  transactions: recurringTransactions,
  accounts: trendAccounts,
  currency: 'INR',
  confirmedRecurringIds: new Set<string>(), // None confirmed yet
});

const netflixInsight = unconfirmedResult.insights.find(
  (i) => i.type === 'recurring_payment' && i.aggregateEvidence?.merchant?.includes('Netflix')
);
assert(!!netflixInsight, 'Detected recurring payment candidate for Netflix');
assert(netflixInsight!.isConfirmed === false, 'Candidate is labeled as POTENTIAL recurring until confirmed');
assert(netflixInsight!.title.startsWith('Potential Recurring Payment'), 'Title explicitly begins with "Potential Recurring Payment"');
assert(netflixInsight!.aggregateEvidence?.frequency === 'monthly', 'Cadence classified accurately as monthly');
assert(netflixInsight!.aggregateEvidence?.averageAmount === 649, 'Average amount is ₹649');
assert(netflixInsight!.aggregateEvidence?.observedDates?.length === 3, 'All 3 occurrence dates recorded in evidence');
assert(netflixInsight!.confidence >= 0.85, `Confidence score is high: ${netflixInsight!.confidence}`);
assert(netflixInsight!.supportingTransactionIds?.length === 3, 'Supporting transaction IDs attached');

// Now simulate user confirming this recurring payment
const confirmedResult = generateFinancialInsights({
  customerId: 'cust-recur',
  transactions: recurringTransactions,
  accounts: trendAccounts,
  currency: 'INR',
  confirmedRecurringIds: new Set(['netflix monthly']), // Confirmed!
});

const confirmedNetflix = confirmedResult.insights.find(
  (i) => i.type === 'recurring_payment' && i.aggregateEvidence?.merchant?.includes('Netflix')
);
assert(!!confirmedNetflix, 'Confirmed recurring payment found');
assert(confirmedNetflix!.isConfirmed === true, 'isConfirmed is now true');
assert(confirmedNetflix!.title.startsWith('Confirmed Recurring Payment'), 'Title updated to "Confirmed Recurring Payment"');

// -------------------------------------------------------------
// Test 4: Cash-Flow Intelligence & Actual vs Projected Balances
// -------------------------------------------------------------
console.log('\n--- Test 4: Cash-Flow Intelligence (Actual vs Projected Balances) ---');

const cashflowTransactions: Transaction[] = [
  {
    id: 'tx-sal',
    customerId: 'cust-cf',
    accountId: 'acc-cf',
    amount: 80000,
    type: 'credit',
    categoryId: 'cat-inc',
    description: 'Monthly Salary',
    date: '2026-10-01',
    isUserCorrected: false,
    isRecurring: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-transfer',
    customerId: 'cust-cf',
    accountId: 'acc-cf',
    amount: 25000, // Internal transfer to savings - must be excluded from operating expenses!
    type: 'debit',
    categoryId: 'cat-transfer',
    description: 'Self transfer to Wealth Account',
    date: '2026-10-02',
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-living',
    customerId: 'cust-cf',
    accountId: 'acc-cf',
    amount: 30000,
    type: 'debit',
    categoryId: 'cat-living',
    description: 'Rent & Living Expenses',
    date: '2026-10-05',
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
];

const cfAccounts: Account[] = [
  {
    id: 'acc-cf',
    customerId: 'cust-cf',
    accountName: 'Operating Checking',
    accountNumberMasked: '•••• 5555',
    accountType: 'checking',
    institutionName: 'SBI',
    balance: 90000, // Confirmed ledger balance
    currency: 'INR',
    createdAt: '2026-10-01',
    updatedAt: '2026-10-15',
  },
];

const cfResult = generateFinancialInsights({
  customerId: 'cust-cf',
  transactions: cashflowTransactions,
  accounts: cfAccounts,
  currency: 'INR',
});

// Verify internal transfers isolation
assert(cfResult.summaryMetrics.internalTransfersVolume === 25000, 'Internal transfers volume is ₹25,000');
assert(cfResult.summaryMetrics.pureIncome === 80000, 'Operating pure income is ₹80,000');
assert(cfResult.summaryMetrics.pureExpenses === 30000, 'Pure expenses is ₹30,000 (transfer excluded)');
assert(cfResult.summaryMetrics.netCashFlow === 50000, 'Operating net cash flow is ₹50,000');

// Verify actual vs projected balances distinction in Cash-Flow insight
const liquidityInsight = cfResult.insights.find((i) => i.id.startsWith('ins-cashflow-liquidity'));
assert(!!liquidityInsight, 'Liquidity cash-flow insight generated');
assert(liquidityInsight!.aggregateEvidence?.actualBalance === 90000, 'Confirmed ledger balance is ₹90,000');
assert(typeof liquidityInsight!.aggregateEvidence?.projectedBalance === 'number', 'Calculated projected balance is numeric');
assert(liquidityInsight!.explanation.includes('Confirmed actual ledger balance is ₹90,000'), 'Explanation explicitly distinguishes actual balance');
assert(liquidityInsight!.explanation.includes('Calculated 30-day projected reserve'), 'Explanation explicitly identifies calculated projection');

// -------------------------------------------------------------
// Test 5: Refunds & Reversals Treated as Contra-Expense Offsets
// -------------------------------------------------------------
console.log('\n--- Test 5: Refunds & Reversals (Contra-Expense Accounting) ---');

const refundTransactions: Transaction[] = [
  {
    id: 'tx-store-buy',
    customerId: 'cust-ref',
    accountId: 'acc-ref',
    amount: 15000,
    type: 'debit',
    categoryId: 'cat-shop',
    description: 'Electronics Retail Purchase',
    date: '2026-10-01',
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-store-refund',
    customerId: 'cust-ref',
    accountId: 'acc-ref',
    amount: 3000, // Refund credit
    type: 'credit',
    categoryId: 'cat-shop',
    description: 'Refund for returned monitor',
    date: '2026-10-05',
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-duplicate-refund-checksum',
    customerId: 'cust-ref',
    accountId: 'acc-ref',
    amount: 3000,
    type: 'credit',
    categoryId: 'cat-shop',
    description: 'Refund for returned monitor',
    date: '2026-10-05',
    checksum: 'tx-store-refund', // Duplicate checksum
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
];

const refResult = generateFinancialInsights({
  customerId: 'cust-ref',
  transactions: refundTransactions,
  accounts: cfAccounts,
  currency: 'INR',
});

// Deduplication check: duplicate refund with matching checksum ignored
assert(refResult.summaryMetrics.refundsTotal === 3000, 'Duplicate refund deduplicated; total refunds is ₹3,000');
assert(refResult.summaryMetrics.pureExpenses === 15000, 'Gross expenses is ₹15,000');
assert(refResult.summaryMetrics.netAdjustedExpenses === 12000, 'Net adjusted expenses is ₹12,000 (15,000 - 3,000)');
assert(refResult.summaryMetrics.pureIncome === 0, 'Refund does NOT inflate pure operating income (remains ₹0)');

const refundInsight = refResult.insights.find((i) => i.type === 'refund_reversal');
assert(!!refundInsight, 'Refund contra-expense insight produced');
assert(refundInsight!.explanation.includes('offset against qualifying category expenses'), 'Explains contra-expense offset rule');
assert(refundInsight!.explanation.includes('rather than falsely inflating pure operating income'), 'Emphasizes pure income preservation');
assert(refundInsight!.severity === 'positive', 'Contra-refund marked with positive severity');

// -------------------------------------------------------------
// Test 6: Unusual Outflows (Statistical Dispersion & Non-Fraudulent)
// -------------------------------------------------------------
console.log('\n--- Test 6: Unusual Transactions (Non-Fraudulent Explainable Rules) ---');

const anomalyTransactions: (Transaction & { categoryName?: string })[] = [
  {
    id: 'tx-norm-1',
    customerId: 'cust-anom',
    accountId: 'acc-1',
    amount: 250,
    type: 'debit',
    categoryId: 'cat-coffee',
    categoryName: 'Café & Snacks',
    description: 'Coffee Shop',
    date: '2026-10-02',
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-norm-2',
    customerId: 'cust-anom',
    accountId: 'acc-1',
    amount: 300,
    type: 'debit',
    categoryId: 'cat-coffee',
    categoryName: 'Café & Snacks',
    description: 'Espresso Bar',
    date: '2026-10-04',
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-norm-3',
    customerId: 'cust-anom',
    accountId: 'acc-1',
    amount: 280,
    type: 'debit',
    categoryId: 'cat-coffee',
    categoryName: 'Café & Snacks',
    description: 'Bakery & Tea',
    date: '2026-10-06',
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-norm-4',
    customerId: 'cust-anom',
    accountId: 'acc-1',
    amount: 320,
    type: 'debit',
    categoryId: 'cat-coffee',
    categoryName: 'Café & Snacks',
    description: 'Coffee Bar',
    date: '2026-10-08',
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-massive-outlier',
    customerId: 'cust-anom',
    accountId: 'acc-1',
    amount: 18500, // Massive deviation (>20x mean)
    type: 'debit',
    categoryId: 'cat-luxury',
    categoryName: 'Luxury & Jewelry',
    description: 'Diamond Boutique Outlay',
    date: '2026-10-10',
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
];

const anomResult = generateFinancialInsights({
  customerId: 'cust-anom',
  transactions: anomalyTransactions,
  accounts: cfAccounts,
  currency: 'INR',
});

const unusualInsight = anomResult.insights.find((i) => i.type === 'unusual_transaction');
assert(!!unusualInsight, 'Unusual outflow transaction detected');
assert(unusualInsight!.supportingTransactionIds?.includes('tx-massive-outlier'), 'Outlier transaction ID attached');
assert(unusualInsight!.title.includes('(Non-Fraudulent Review)'), 'Title contains non-fraudulent disclosure');
assert(unusualInsight!.explanation.includes('does not indicate fraudulent activity'), 'Explanation explicitly states it does not indicate fraud');
assert(unusualInsight!.calculationMethod.includes('Historical statistical dispersion'), 'Calculation method documented');
assert(unusualInsight!.severity === 'warning', 'Severity is warning, not critical fraud');

// -------------------------------------------------------------
// Test 7: Savings & Goals (Grounded Without Invention)
// -------------------------------------------------------------
console.log('\n--- Test 7: Savings & Financial Goals (Grounded Feasibility) ---');

const userGoals: FinancialGoal[] = [
  {
    id: 'goal-emergency-fund',
    name: 'Emergency Buffer 6-Months',
    targetAmount: 300000,
    currentSavings: 180000,
    targetDate: '2027-10-31', // ~12 months away
    monthlyContribution: 10000,
    priority: 'high',
  },
];

const goalResult = generateFinancialInsights({
  customerId: 'cust-cf',
  transactions: cashflowTransactions, // net cash flow is 50,000
  accounts: cfAccounts,
  goals: userGoals,
  currency: 'INR',
});

const goalInsight = goalResult.insights.find((i) => i.type === 'savings_goal');
assert(!!goalInsight, 'Goal feasibility insight generated');
assert(goalInsight!.title.includes('Goal On Track'), 'Goal is on track because 50,000 net surplus covers ~10,000/mo required');
assert(goalInsight!.aggregateEvidence?.isFeasible === true, 'Feasibility flag is true');
assert(goalInsight!.aggregateEvidence?.targetAmount === 300000, 'Target amount is ₹300,000');
assert(goalInsight!.aggregateEvidence?.currentSavings === 180000, 'Current savings is ₹180,000');
assert(goalInsight!.severity === 'positive', 'On-track goal is positive');

// Test Zero Goals (Non-Invention Invariant)
const zeroGoalsResult = generateFinancialInsights({
  customerId: 'cust-cf',
  transactions: cashflowTransactions,
  accounts: cfAccounts,
  goals: [], // Zero goals configured
  currency: 'INR',
});

const zeroGoalInsight = zeroGoalsResult.insights.find((i) => i.type === 'savings_goal');
assert(!!zeroGoalInsight, 'Informational insight produced when no goals exist');
assert(zeroGoalInsight!.title === 'No User-Defined Goals Configured', 'Informs user instead of inventing artificial goals');
assert(zeroGoalInsight!.aggregateEvidence?.goalsCount === 0, 'Goals count is strictly 0');

// -------------------------------------------------------------
// Test 8: Cross-Customer Isolation
// -------------------------------------------------------------
console.log('\n--- Test 8: Cross-Customer Isolation Invariant ---');

const customerA = generateFinancialInsights({
  customerId: 'cust-A',
  transactions: [
    {
      id: 'tx-cust-A',
      customerId: 'cust-A',
      accountId: 'acc-A',
      amount: 150000,
      type: 'credit',
      categoryId: 'cat-inc',
      description: 'Customer A Salary',
      date: '2026-10-01',
      isUserCorrected: false,
      isRecurring: true,
      createdAt: '',
      updatedAt: '',
    },
  ],
  accounts: [
    {
      id: 'acc-A',
      customerId: 'cust-A',
      accountName: 'Account A',
      accountNumberMasked: '•••• 1111',
      accountType: 'checking',
      institutionName: 'HDFC',
      balance: 150000,
      currency: 'INR',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
  ],
  currency: 'INR',
});

const customerB = generateFinancialInsights({
  customerId: 'cust-B',
  transactions: [
    {
      id: 'tx-cust-B',
      customerId: 'cust-B',
      accountId: 'acc-B',
      amount: 45000,
      type: 'credit',
      categoryId: 'cat-inc',
      description: 'Customer B Freelance',
      date: '2026-10-01',
      isUserCorrected: false,
      isRecurring: false,
      createdAt: '',
      updatedAt: '',
    },
  ],
  accounts: [
    {
      id: 'acc-B',
      customerId: 'cust-B',
      accountName: 'Account B',
      accountNumberMasked: '•••• 2222',
      accountType: 'checking',
      institutionName: 'ICICI',
      balance: 45000,
      currency: 'INR',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
  ],
  currency: 'INR',
});

assert(customerA.summaryMetrics.totalBalance === 150000, 'Customer A balance isolated to 150,000');
assert(customerB.summaryMetrics.totalBalance === 45000, 'Customer B balance isolated to 45,000');
assert(customerA.insights.every((i) => i.customerId === 'cust-A'), 'All insights for Customer A have customerId = cust-A');
assert(customerB.insights.every((i) => i.customerId === 'cust-B'), 'All insights for Customer B have customerId = cust-B');

console.log(`\n✨ VivPay Phase 4A Financial Insight Engine Test Suite Complete: ${passedTests}/${totalTests} assertions passed!`);
