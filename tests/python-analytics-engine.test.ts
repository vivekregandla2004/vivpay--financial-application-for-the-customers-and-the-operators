/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

function runPythonEngine(input: any): Promise<{ code: number | null; stdout: string; stderr: string; data?: any }> {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'python_analytics.py');
    const proc = spawn('python3', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (c) => (stdout += c.toString()));
    proc.stderr.on('data', (c) => (stderr += c.toString()));

    proc.on('close', (code) => {
      let data;
      try {
        data = JSON.parse(stdout);
      } catch {}
      resolve({ code, stdout, stderr, data });
    });

    if (typeof input === 'string') {
      proc.stdin.write(input);
    } else {
      proc.stdin.write(JSON.stringify(input));
    }
    proc.stdin.end();
  });
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

async function runTestSuite() {
  console.log('🧪 Starting VivPay Python 3 Analytics Engine Verification Suite...\n');

  // Test 1: Empty dataset handling
  console.log('--- Test 1: Empty Dataset Handling ---');
  const emptyRes = await runPythonEngine({ transactions: [], startingBalance: 5000 });
  assert(emptyRes.code === 0, 'Python engine exits with 0 on empty dataset');
  assert(emptyRes.data.status === 'empty', 'Returns empty status indicator');
  assert(emptyRes.data.metrics.netCashFlow === 0, 'Zero net cash flow on empty dataset');
  assert(emptyRes.data.linearProjection.projected30DayBalance === 5000, 'Projected balance preserves starting balance');

  // Test 2: Core financial metric calculations
  console.log('\n--- Test 2: Inflow, Outflow, Net, and Savings Rate ---');
  const sampleTransactions = [
    { date: '2026-01-01', amount: 80000, type: 'credit', category: 'Salary', merchantName: 'Tech Corp' },
    { date: '2026-01-02', amount: 20000, type: 'debit', category: 'Housing', merchantName: 'Property Management' },
    { date: '2026-01-05', amount: 5000, type: 'debit', category: 'Groceries', merchantName: 'Whole Foods' },
    { date: '2026-01-10', amount: 1500, type: 'debit', category: 'Dining', merchantName: 'Sushi Bar' },
    { date: '2026-01-15', amount: 499, type: 'debit', category: 'Entertainment', merchantName: 'Spotify' },
  ];

  const coreRes = await runPythonEngine({ transactions: sampleTransactions, startingBalance: 10000 });
  assert(coreRes.code === 0, 'Python engine executed successfully');
  assert(coreRes.data.metrics.totalInflow === 80000, 'Total inflow matches 80,000');
  assert(coreRes.data.metrics.totalOutflow === 26999, 'Total outflow matches 26,999');
  assert(coreRes.data.metrics.netCashFlow === 53001, 'Net cash flow matches 53,001');
  const expectedRate = Math.round((53001 / 80000) * 1000) / 10;
  assert(coreRes.data.metrics.savingsRatePct === expectedRate, `Savings rate is exactly ${expectedRate}%`);

  // Test 3: Category breakdown and ordering
  console.log('\n--- Test 3: Category Breakdown & Proportions ---');
  assert(coreRes.data.categoryBreakdown.length === 4, 'Exactly 4 spending categories identified');
  assert(coreRes.data.categoryBreakdown[0].category === 'Housing', 'Top spend category is Housing');
  assert(coreRes.data.categoryBreakdown[0].totalSpend === 20000, 'Housing spend equals 20,000');

  // Test 4: Statistical Anomaly Detection (Z-Score)
  console.log('\n--- Test 4: Statistical Outlier / Anomaly Detection ---');
  const anomalyDataset = [
    { id: 'tx-1', date: '2026-01-01', amount: 500, type: 'debit', category: 'Food', merchantName: 'Cafe' },
    { id: 'tx-2', date: '2026-01-02', amount: 450, type: 'debit', category: 'Food', merchantName: 'Bakery' },
    { id: 'tx-3', date: '2026-01-03', amount: 600, type: 'debit', category: 'Food', merchantName: 'Bistro' },
    { id: 'tx-4', date: '2026-01-04', amount: 550, type: 'debit', category: 'Food', merchantName: 'Diner' },
    { id: 'tx-5', date: '2026-01-05', amount: 520, type: 'debit', category: 'Food', merchantName: 'Coffee' },
    { id: 'tx-6', date: '2026-01-06', amount: 25000, type: 'debit', category: 'Electronics', merchantName: 'Mega Electronics' },
  ];

  const anomalyRes = await runPythonEngine({ transactions: anomalyDataset, startingBalance: 50000 });
  assert(anomalyRes.data.anomalies.length >= 1, 'Outlier transaction detected');
  assert(anomalyRes.data.anomalies[0].id === 'tx-6', 'Correctly flagged tx-6 as statistical anomaly');
  assert(anomalyRes.data.anomalies[0].zScore > 2.0, 'Z-score is significantly above normal variance');

  // Test 5: Subscription / Recurring Cadence Detection
  console.log('\n--- Test 5: Recurring Subscription Cadence Detection ---');
  const recurringDataset = [
    { date: '2026-01-10', amount: 649, type: 'debit', category: 'Subscriptions', merchantName: 'Netflix' },
    { date: '2026-02-09', amount: 649, type: 'debit', category: 'Subscriptions', merchantName: 'Netflix' },
    { date: '2026-03-11', amount: 649, type: 'debit', category: 'Subscriptions', merchantName: 'Netflix' },
  ];

  const recRes = await runPythonEngine({ transactions: recurringDataset, startingBalance: 2000 });
  assert(recRes.data.recurringCandidates.length === 1, 'Detected exactly 1 recurring candidate');
  assert(recRes.data.recurringCandidates[0].merchant === 'Netflix', 'Candidate merchant is Netflix');
  assert(recRes.data.recurringCandidates[0].cadence === 'monthly', 'Cadence correctly resolved as monthly');
  assert(recRes.data.recurringCandidates[0].confidence === 'high', 'High confidence flag on consistent monthly recurrence');

  // Test 6: OLS Linear Regression Cash Flow Projection
  console.log('\n--- Test 6: Linear Regression & 30-Day Cash Flow Projection ---');
  const trendDataset = [
    { date: '2026-01-01', amount: 1000, type: 'credit', category: 'Income' },
    { date: '2026-01-10', amount: 1000, type: 'credit', category: 'Income' },
    { date: '2026-01-20', amount: 1000, type: 'credit', category: 'Income' },
    { date: '2026-01-30', amount: 1000, type: 'credit', category: 'Income' },
  ];

  const trendRes = await runPythonEngine({ transactions: trendDataset, startingBalance: 1000 });
  assert(trendRes.data.linearProjection.dailySlope > 0, 'Positive daily slope for sustained income trend');
  assert(trendRes.data.linearProjection.trendDirection === 'positive', 'Trend direction evaluated as positive');
  assert(trendRes.data.linearProjection.projected30DayBalance > 5000, 'Projected 30-day balance exceeds current balance');

  // Test 7: Missing or invalid fields
  console.log('\n--- Test 7: Missing and Invalid Fields Resilience ---');
  const messyDataset = [
    null,
    42,
    "not-a-tx",
    { amount: 500 }, // missing date, category, type
    { date: "2026-01-02", type: "credit" }, // missing amount
    { date: "2026-01-03", amount: 1200, category: null, merchantName: null },
  ];
  const messyRes = await runPythonEngine({ transactions: messyDataset, startingBalance: "invalid-balance" });
  assert(messyRes.code === 0, 'Exits with 0 when handling malformed transaction array elements');
  assert(messyRes.data.status === 'success', 'Gracefully processes valid transaction elements');
  assert(messyRes.data.totalTransactions === 3, 'Only counts valid dictionary items (3 found)');
  assert(messyRes.data.metrics.totalOutflow === 1700, 'Total outflow correctly calculated from valid debit elements (500 + 1200)');

  // Test 8: Non-finite numeric inputs and invalid dates
  console.log('\n--- Test 8: Non-Finite Numeric Inputs & Invalid Dates ---');
  const nonFiniteDataset = [
    { date: "invalid-date-format-999", amount: "150.50", type: "debit" },
    { date: "2026-01-05", amount: null, type: "debit" },
    { date: "2026-01-06", amount: true, type: "credit" }, // boolean amount defaults to 0.0
    { date: "2026-01-07", amount: 200, type: "debit" },
  ];
  const nonFiniteRes = await runPythonEngine({ transactions: nonFiniteDataset });
  assert(nonFiniteRes.code === 0, 'Processes non-finite inputs without raising unhandled exceptions');
  assert(nonFiniteRes.data.metrics.totalOutflow === 350.5, 'Parsed string numeric "150.50" + 200 = 350.50');

  // Test 9: Zero-Income and Zero-Expense Edge Cases
  console.log('\n--- Test 9: Zero-Income and Zero-Expense Edge Cases ---');
  // Sub-case A: Zero Income, strictly expenses
  const onlyExpenseRes = await runPythonEngine({
    transactions: [{ date: "2026-01-01", amount: 500, type: "debit" }],
    startingBalance: 1000
  });
  assert(onlyExpenseRes.data.metrics.totalInflow === 0, 'Total inflow is 0');
  assert(onlyExpenseRes.data.metrics.totalOutflow === 500, 'Total outflow is 500');
  assert(onlyExpenseRes.data.metrics.savingsRatePct === -100.0, 'Savings rate is bounded to -100% on zero-income with expenses');

  // Sub-case B: Zero Expense, strictly income
  const onlyIncomeRes = await runPythonEngine({
    transactions: [{ date: "2026-01-01", amount: 2500, type: "credit" }],
    startingBalance: 1000
  });
  assert(onlyIncomeRes.data.metrics.totalInflow === 2500, 'Total inflow is 2500');
  assert(onlyIncomeRes.data.metrics.totalOutflow === 0, 'Total outflow is 0');
  assert(onlyIncomeRes.data.metrics.savingsRatePct === 100.0, 'Savings rate is 100% on pure income');
  assert(onlyIncomeRes.data.metrics.averageExpense === 0, 'Average expense is 0 when zero expenses occur');

  // Test 10: Insufficient History for Forecasting
  console.log('\n--- Test 10: Insufficient History for Forecasting ---');
  const sameDayDataset = [
    { date: "2026-01-01", amount: 500, type: "debit" },
    { date: "2026-01-01", amount: 200, type: "debit" },
  ];
  const sameDayRes = await runPythonEngine({ transactions: sameDayDataset, startingBalance: 2000 });
  assert(sameDayRes.data.linearProjection.dailySlope === 0, 'Daily slope is 0 with < 2 distinct dates');
  assert(sameDayRes.data.linearProjection.trendDirection === 'neutral', 'Trend direction is neutral');
  assert(sameDayRes.data.linearProjection.notes.includes('Insufficient'), 'Descriptive explanatory note attached');

  // Test 11: Malformed raw JSON handling
  console.log('\n--- Test 11: Malformed JSON Input Safety ---');
  const malformedRes = await runPythonEngine("THIS_IS_NOT_VALID_JSON{:::broken");
  assert(malformedRes.code === 0, 'Returns cleanly without unhandled exception');
  assert(malformedRes.data.status === 'error', 'Returns structured error indicator');
  assert(malformedRes.data.error.includes('Invalid JSON'), 'Actionable error message returned');

  console.log('\n======================================================');
  console.log('🎉 ALL PYTHON ANALYTICS ENGINE TESTS PASSED!');
  console.log('======================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
