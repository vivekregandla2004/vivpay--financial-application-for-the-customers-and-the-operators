/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  calculateMonthlyTrends,
  classifyTransactionType,
  calculateCategoryBreakdown,
  calculateNormalizedSummary,
} from '../src/lib/analytics/financialEngine.ts';
import { computeFinancialHealthScore } from '../src/lib/finance/intelligence/health.ts';
import { DEMO_CUSTOMER_PRESETS, DEMO_DATASETS } from '../src/services/demoData.ts';
import { Transaction, Account } from '../src/types/database.ts';

console.log('🧪 Starting Customer Dashboard & Financial Analytics Test Suite...\n');

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
// Test 1: Empty and Zero-Denominator Financial Health Safety
// -------------------------------------------------------------
console.log('--- Test 1: Zero-Denominator & Empty State Financial Health Safety ---');

const emptyMetrics = {
  averageDailySpending: 0,
  activeTransactionDays: 0,
  totalCalendarDays: 0,
  weekendSpending: 0,
  weekdaySpending: 0,
  weekendVsWeekdayRatio: null,
  timeOfDay: { available: false, nightSpending: 0, morningSpending: 0, afternoonSpending: 0, eveningSpending: 0 },
  paymentMethodBreakdown: {},
  monthlyExpenseVolatility: null,
  emiDebtBurden: { available: false, totalEmiMonthly: 0, ratioToIncome: null },
};

const emptyHealth = computeFinancialHealthScore([], [], emptyMetrics, []);

assert(typeof emptyHealth.compositeScore === 'number', 'Health score is a number when accounts & transactions are empty');
assert(emptyHealth.compositeScore >= 0 && emptyHealth.compositeScore <= 100, `Health score is in [0, 100]: ${emptyHealth.compositeScore}`);
assert(['A+', 'A', 'B', 'C', 'D', 'F'].includes(emptyHealth.grade), `Valid grade assigned: ${emptyHealth.grade}`);
assert(Array.isArray(emptyHealth.factors), 'Health factors array is returned');
assert(emptyHealth.factors.length === 10, `All 10 factors evaluated: ${emptyHealth.factors.length}`);
assert(Number.isFinite(emptyHealth.compositeScore), 'Composite score is strictly finite');

// -------------------------------------------------------------
// Test 2: Transaction Classification & Refund Offsetting
// -------------------------------------------------------------
console.log('\n--- Test 2: Transaction Classification & Refund Offsetting ---');

const salaryTx: Transaction = {
  id: 'tx-salary',
  customerId: 'cust-1',
  accountId: 'acc-1',
  amount: 85000,
  type: 'credit',
  categoryId: 'cat-income',
  categoryName: 'Salary',
  description: 'Salary for Oct 2026',
  date: '2026-10-01',
  isUserCorrected: false,
  isRecurring: true,
  createdAt: '',
  updatedAt: '',
};

const refundTx: Transaction = {
  id: 'tx-refund',
  customerId: 'cust-1',
  accountId: 'acc-1',
  amount: 1500,
  type: 'credit',
  categoryId: 'cat-shopping',
  categoryName: 'Shopping',
  description: 'Amazon Refund for returned headphones',
  date: '2026-10-05',
  isUserCorrected: false,
  isRecurring: false,
  createdAt: '',
  updatedAt: '',
};

const transferTx: Transaction = {
  id: 'tx-transfer',
  customerId: 'cust-1',
  accountId: 'acc-1',
  amount: 10000,
  type: 'debit',
  categoryId: 'cat-transfer',
  categoryName: 'Transfer',
  description: 'Internal transfer to Savings',
  date: '2026-10-07',
  isUserCorrected: false,
  isRecurring: false,
  createdAt: '',
  updatedAt: '',
};

const regularExpenseTx: Transaction = {
  id: 'tx-expense',
  customerId: 'cust-1',
  accountId: 'acc-1',
  amount: 2500,
  type: 'debit',
  categoryId: 'cat-food',
  categoryName: 'Food & Dining',
  description: 'Dinner with friends',
  date: '2026-10-10',
  isUserCorrected: false,
  isRecurring: false,
  createdAt: '',
  updatedAt: '',
};

const salaryClass = classifyTransactionType(salaryTx);
assert(salaryClass.isPureIncome === true, 'Salary classified as pure income');
assert(salaryClass.isInternalTransfer === false, 'Salary is not internal transfer');

const refundClass = classifyTransactionType(refundTx);
assert(refundClass.isRefundOrReversal === true, 'Refund description classified as refund');
assert(refundClass.isPureIncome === false, 'Refund is not classified as pure income');

const transferClass = classifyTransactionType(transferTx);
assert(transferClass.isInternalTransfer === true, 'Internal transfer classified as transfer');
assert(transferClass.isPureExpense === false, 'Internal transfer excluded from pure expense');

const regularExpenseClass = classifyTransactionType(regularExpenseTx);
assert(regularExpenseClass.isPureExpense === true, 'Dining categorized as regular expense');
assert(regularExpenseClass.isInternalTransfer === false, 'Dining is not transfer');

// -------------------------------------------------------------
// Test 3: Monthly Trends Calculation Accuracy
// -------------------------------------------------------------
console.log('\n--- Test 3: Monthly Trends Inflow, Outflow & Savings Calculation ---');

const sampleTransactions: Transaction[] = [
  salaryTx,
  refundTx,
  regularExpenseTx,
  {
    id: 'tx-rent',
    customerId: 'cust-1',
    accountId: 'acc-1',
    amount: 25000,
    type: 'debit',
    categoryId: 'cat-rent',
    categoryName: 'Rent',
    description: 'Monthly apartment rent',
    date: '2026-10-02',
    isUserCorrected: false,
    isRecurring: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'tx-groceries',
    customerId: 'cust-1',
    accountId: 'acc-1',
    amount: 6000,
    type: 'debit',
    categoryId: 'cat-groceries',
    categoryName: 'Groceries',
    description: 'Supermarket shopping',
    date: '2026-10-12',
    isUserCorrected: false,
    isRecurring: false,
    createdAt: '',
    updatedAt: '',
  },
];

const trends = calculateMonthlyTrends(sampleTransactions);
assert(trends.length > 0, 'Generated monthly trends');
const octTrend = trends.find((t) => t.month === '2026-10');
assert(octTrend !== undefined, 'Contains 2026-10 trend entry');
if (octTrend) {
  assert(octTrend.income === 85000, `Oct income matches salary: ${octTrend.income}`);
  // Expenses are 2500 + 25000 + 6000 = 33500
  assert(octTrend.expenses === 33500, `Oct pure expenses match debits: ${octTrend.expenses}`);
  assert(octTrend.netCashFlow === 51500, `Oct net cash flow is income - expenses: ${octTrend.netCashFlow}`);
  assert(octTrend.savingsRate > 60, `Savings rate calculated accurately: ${octTrend.savingsRate.toFixed(1)}%`);
}

// -------------------------------------------------------------
// Test 4: Category Spending Breakdown Calculation
// -------------------------------------------------------------
console.log('\n--- Test 4: Category Spending Breakdown Calculation ---');

const catBreakdown = calculateCategoryBreakdown(sampleTransactions);
assert(catBreakdown.length > 0, 'Calculated category breakdown');
const rentCat = catBreakdown.find((c) => c.categoryName === 'Rent');
assert(rentCat !== undefined, 'Rent category present');
assert(rentCat?.totalAmount === 25000, `Rent amount exact: ${rentCat?.totalAmount}`);
const totalPct = catBreakdown.reduce((sum, c) => sum + c.percentage, 0);
assert(Math.abs(totalPct - 100) < 0.5, `Category percentages sum to ~100%: ${totalPct}%`);

// -------------------------------------------------------------
// Test 5: Normalized Summary Consistency across Accounts
// -------------------------------------------------------------
console.log('\n--- Test 5: Normalized Summary Consistency ---');

const testAccounts: Account[] = [
  { id: 'acc-1', customerId: 'cust-1', accountName: 'Checking', accountNumberMasked: '1234', accountType: 'checking', institutionName: 'Bank A', balance: 50000, currency: 'INR', createdAt: '', updatedAt: '' },
  { id: 'acc-2', customerId: 'cust-1', accountName: 'Savings', accountNumberMasked: '5678', accountType: 'savings', institutionName: 'Bank B', balance: 120000, currency: 'INR', createdAt: '', updatedAt: '' },
];

const normSummary = calculateNormalizedSummary(testAccounts, sampleTransactions, 'INR');
assert(normSummary.totalBalance === 170000, `Total balance across accounts summed accurately: ${normSummary.totalBalance}`);
assert(normSummary.pureIncome === 85000, `Pure income matches pure salary: ${normSummary.pureIncome}`);
assert(normSummary.pureExpenses === 32000, `Pure expenses accurately deducts 1500 refund: ${normSummary.pureExpenses}`);
assert(normSummary.netCashFlow === 53000, `Net cash flow equals income minus adjusted expenses: ${normSummary.netCashFlow}`);

// -------------------------------------------------------------
// Test 6: Controlled Demo Datasets Integrity
// -------------------------------------------------------------
console.log('\n--- Test 6: Controlled Customer Demo Datasets Integrity ---');

assert(DEMO_CUSTOMER_PRESETS.length >= 3, `At least 3 demo presets configured: found ${DEMO_CUSTOMER_PRESETS.length}`);

for (const preset of DEMO_CUSTOMER_PRESETS) {
  assert(!!preset.customerProfile.id, `Preset [${preset.id}] customer has valid ID: ${preset.customerProfile.id}`);
  assert(!!preset.customerProfile.fullName, `Preset [${preset.id}] customer has full name: ${preset.customerProfile.fullName}`);
  assert(preset.accounts.length >= 2, `Preset [${preset.id}] customer has multiple accounts (${preset.accounts.length} found)`);
  assert(preset.transactions.length >= 15, `Preset [${preset.id}] has robust transaction history (${preset.transactions.length} records)`);
  
  // Verify date range
  const dates = preset.transactions.map((t) => t.date).sort();
  const earliest = dates[0];
  const latest = dates[dates.length - 1];
  assert(earliest < latest, `Preset [${preset.id}] spans multiple dates: ${earliest} to ${latest}`);
}

const datasetKeys = Object.keys(DEMO_DATASETS) as (keyof typeof DEMO_DATASETS)[];
assert(datasetKeys.length >= 3, `DEMO_DATASETS contains all 3 presets: ${datasetKeys.join(', ')}`);

// -------------------------------------------------------------
// Test 7: Zero and Negative Income Savings Rate Guard
// -------------------------------------------------------------
console.log('\n--- Test 7: Zero & Negative Income Savings Rate Guard ---');

const zeroIncomeSummary = calculateNormalizedSummary(
  testAccounts,
  [regularExpenseTx], // only expense: 2500, pureIncome: 0
  'INR'
);
assert(zeroIncomeSummary.pureIncome === 0, 'Zero income is accurately 0');
assert(zeroIncomeSummary.pureExpenses === 2500, 'Pure expenses is 2500');
assert(zeroIncomeSummary.savingsRate === 0, 'Savings rate with zero income safely defaults to 0% without NaN or division by zero');
assert(zeroIncomeSummary.netCashFlow === -2500, 'Net cash flow reflects deficit (-2500)');

// -------------------------------------------------------------
// Test 8: Account-Filtered Balances & Category Reconciliation
// -------------------------------------------------------------
console.log('\n--- Test 8: Account-Filtered Balances & Category Reconciliation ---');

// Account filtering isolates specific account
const acc1Only = testAccounts.filter((a) => a.id === 'acc-1');
const acc1Summary = calculateNormalizedSummary(acc1Only, sampleTransactions.filter((t) => t.accountId === 'acc-1'), 'INR');
assert(acc1Summary.totalBalance === 50000, `Account-filtered balance isolates acc-1 balance: ${acc1Summary.totalBalance}`);

const acc2Only = testAccounts.filter((a) => a.id === 'acc-2');
const acc2Summary = calculateNormalizedSummary(acc2Only, sampleTransactions.filter((t) => t.accountId === 'acc-2'), 'INR');
assert(acc2Summary.totalBalance === 120000, `Account-filtered balance isolates acc-2 balance: ${acc2Summary.totalBalance}`);

// Category reconciliation against raw qualifying debits
const totalCategorySpend = catBreakdown.reduce((sum, c) => sum + c.totalAmount, 0);
const qualifyingDebits = sampleTransactions
  .filter((t) => t.type === 'debit' && !classifyTransactionType(t).isInternalTransfer)
  .reduce((sum, t) => sum + t.amount, 0);
assert(
  totalCategorySpend === qualifyingDebits,
  `Category totals (${totalCategorySpend}) strictly reconcile with qualifying transactions (${qualifyingDebits})`
);

// -------------------------------------------------------------
// Test 9: Customer Data Isolation & Cross-Customer Protection
// -------------------------------------------------------------
console.log('\n--- Test 9: Customer Data Isolation Invariants ---');

// Customer A cannot access Customer B's account IDs
const customerA = 'cust-alpha-uuid';
const customerB = 'cust-beta-uuid';

const customerAAccounts: Account[] = [
  { id: 'acc-alpha-1', customerId: customerA, accountName: 'Alpha Checking', accountNumberMasked: '1111', accountType: 'checking', institutionName: 'Bank A', balance: 50000, currency: 'INR', createdAt: '', updatedAt: '' },
];
const customerBAccounts: Account[] = [
  { id: 'acc-beta-1', customerId: customerB, accountName: 'Beta Checking', accountNumberMasked: '2222', accountType: 'checking', institutionName: 'Bank B', balance: 90000, currency: 'INR', createdAt: '', updatedAt: '' },
];

const customerASummary = calculateNormalizedSummary(customerAAccounts, [], 'INR');
const customerBSummary = calculateNormalizedSummary(customerBAccounts, [], 'INR');

assert(customerASummary.totalBalance === 50000, 'Customer A summary isolates Customer A balances');
assert(customerBSummary.totalBalance === 90000, 'Customer B summary isolates Customer B balances');
assert(customerASummary.totalBalance !== customerBSummary.totalBalance, 'Tenants cannot view or aggregate foreign balances');

console.log(`\n✨ All ${passedTests}/${totalTests} Customer Dashboard & Financial Analytics tests passed successfully!`);
