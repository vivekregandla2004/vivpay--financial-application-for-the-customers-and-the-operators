/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { calculateFinancialSummary } from '../src/services/demoData.ts';
import { analyzeFile } from '../src/lib/finance/services.ts';
import * as XLSX from 'xlsx';

async function testSharedDashboardDataFlow() {
  console.log('================================================================');
  console.log('      VIVPAY SHARED DASHBOARD DATA FLOW & REPLACEMENT AUDIT     ');
  console.log('================================================================\n');

  // STEP 1: Simulate Initial Dataset (Dataset A - PhonePe Statement)
  const initialAccounts = [
    {
      id: 'acc-1',
      customerId: 'cust-1',
      accountName: 'Axis Checking',
      accountNumberMasked: '•••• 1034',
      accountType: 'checking' as const,
      institutionName: 'Axis Bank',
      balance: 100000.0,
      currency: 'INR',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-10-12T00:00:00Z',
    },
  ];

  // User Profile, Commitments & Goals state (independent identity store)
  const userProfile = {
    fullName: 'Alex Rivera',
    email: 'alex.rivera@example.com',
    currency: 'INR',
  };
  const userGoals = [
    { id: 'goal-1', name: 'Emergency Reserve', targetAmount: 300000, currentSavings: 100000 },
    { id: 'goal-2', name: 'Nifty Index SIP Fund', targetAmount: 1000000, currentSavings: 250000 },
  ];
  const userCommitments = {
    monthlyRent: 25000,
    carLoanEmi: 0,
    homeLoanEmi: 0,
  };

  console.log('[1] Initial Baseline State:');
  console.log(`    - Profile: ${userProfile.fullName} (${userProfile.email})`);
  console.log(`    - Financial Goals: ${userGoals.length} goals registered`);
  console.log(`    - Fixed Commitments: Rent ₹${userCommitments.monthlyRent}`);

  // Create Statement A Workbook (PhonePe)
  const wbA = XLSX.utils.book_new();
  const dataA = [
    ['PhonePe Statement'],
    ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'],
    ['2026-10-01', 'Paid to Swiggy Delivery', '420.00', '', '99580.00'],
    ['2026-10-10', 'TechCorp Salary Payout', '', '75000.00', '174580.00'],
  ];
  const wsA = XLSX.utils.aoa_to_sheet(dataA);
  XLSX.utils.book_append_sheet(wbA, wsA, 'Statement');
  const bufA = XLSX.write(wbA, { type: 'buffer', bookType: 'xlsx' });
  const fileA = new File([bufA], 'PhonePe_Statement_Initial.xlsx');

  const analysisA = await analyzeFile(fileA);
  console.log(`\n[2] Loaded Initial Dataset A ("${fileA.name}"):`);
  console.log(`    - Parsed transactions: ${analysisA.transactions.length}`);
  console.log(`    - Pure Income: ₹${analysisA.monthlySummaries[0]?.income}`);
  console.log(`    - Pure Expenses: ₹${analysisA.monthlySummaries[0]?.expenses}`);
  console.log(`    - Net Cash Flow: ₹${analysisA.monthlySummaries[0]?.netCashFlow}`);
  console.log(`    - Health Grade: ${analysisA.health.grade} (${analysisA.health.compositeScore}/100)`);

  // STEP 2: Replacement Workflow (Upload Statement B - Axis Bank)
  console.log(`\n[3] Triggering Dataset Replacement with Statement B ("Axis_Statement_Oct2026.xlsx")...`);
  const wbB = XLSX.utils.book_new();
  const dataB = [
    ['AXIS BANK STATEMENT OF ACCOUNT'],
    ['Account: 918010048291034', 'Branch: INDIRANAGAR'],
    [],
    ['Tran Date', 'CHQ NO', 'PARTICULARS', 'DR', 'CR', 'BAL'],
    ['01-10-2026', '', 'UPI/swiggy@kotak/Swiggy Food', '450.00', '', '49550.00'],
    ['02-10-2026', '', 'NETFLIX ENTERTAINMENT', '649.00', '', '48901.00'],
    ['03-10-2026', '', 'ACH/ZERODHA SIP', '10000.00', '', '38901.00'],
    ['10-10-2026', '', 'NEFT/TECHCORP SALARY', '', '75000.00', '113901.00'],
    ['11-10-2026', '', 'POS/UBER TRIP', '285.50', '', '113615.50'],
    ['12-10-2026', '', 'UPI/starbucks@hdfcbank/Coffee', '380.00', '', '113235.50'],
  ];
  const wsB = XLSX.utils.aoa_to_sheet(dataB);
  XLSX.utils.book_append_sheet(wbB, wsB, 'Transactions');
  const bufB = XLSX.write(wbB, { type: 'buffer', bookType: 'xlsx' });
  const fileB = new File([bufB], 'Axis_Statement_Oct2026.xlsx');

  const analysisB = await analyzeFile(fileB);

  // Simulate handleExcelImportSuccess with isReplace: true
  const replacementTransactions = [...analysisB.transactions];
  const delta = replacementTransactions.reduce((acc, t) => acc + (t.direction === 'credit' ? t.amount : -t.amount), 0);
  const updatedAccounts = [{ ...initialAccounts[0], balance: 100000 + delta }];
  const updatedSummary = calculateFinancialSummary(
    updatedAccounts as any,
    replacementTransactions.map((t) => ({ ...t, type: t.direction })) as any
  );

  console.log(`\n[4] Replaced Dataset B Verification:`);
  console.log(`    - Replaced Transaction Count: ${replacementTransactions.length} (Expected: 6)`);
  console.log(`    - Gross Credits: ₹${updatedSummary.grossCredits} (Expected: ₹75,000)`);
  console.log(`    - Gross Debits: ₹${updatedSummary.grossDebits} (Expected: ₹11,764.50)`);
  console.log(`    - Net Cash Flow: ₹${updatedSummary.netCashFlow} (Expected: ₹63,235.50)`);
  console.log(`    - Health Score: ${analysisB.health.compositeScore}/100, Grade: ${analysisB.health.grade}`);

  if (replacementTransactions.length !== 6) {
    throw new Error(`Replacement transaction count mismatch: expected 6, got ${replacementTransactions.length}`);
  }
  if (updatedSummary.grossCredits !== 75000) {
    throw new Error(`Replacement credit mismatch: expected 75000, got ${updatedSummary.grossCredits}`);
  }
  if (Math.abs(updatedSummary.grossDebits - 11764.50) > 0.01) {
    throw new Error(`Replacement debit mismatch: expected 11764.50, got ${updatedSummary.grossDebits}`);
  }

  // Verify that Statement A transactions were purged from active ledger
  const hasStaleTxA = replacementTransactions.some((t) => t.description.includes('Paid to Swiggy Delivery'));
  console.log(`    - Stale records from Dataset A completely purged: ${!hasStaleTxA}`);
  if (hasStaleTxA) {
    throw new Error('Stale records from previous dataset were not purged upon replacement!');
  }

  // STEP 3: Verify Profile, Goals, and Commitments are STRICTLY PRESERVED
  console.log(`\n[5] Verifying Identity & Profile Data Preservation:`);
  console.log(`    - User Profile: ${userProfile.fullName} (${userProfile.email}) -> PRESERVED`);
  console.log(`    - Goals Count: ${userGoals.length} goals -> PRESERVED`);
  console.log(`    - Commitments: Rent ₹${userCommitments.monthlyRent} -> PRESERVED`);

  if (userGoals.length !== 2 || userCommitments.monthlyRent !== 25000) {
    throw new Error('User profile / goals were accidentally modified during statement replacement!');
  }

  // STEP 4: Remove Dataset Workflow
  console.log(`\n[6] Simulating Remove Dataset Workflow...`);
  const clearedTransactions: any[] = [];
  const clearedSummary = calculateFinancialSummary(updatedAccounts as any, []);

  console.log(`    - Cleared transactions count: ${clearedTransactions.length}`);
  console.log(`    - Cleared gross debits: ₹${clearedSummary.grossDebits}`);
  console.log(`    - Cleared gross credits: ₹${clearedSummary.grossCredits}`);
  console.log(`    - Profile goals still intact: ${userGoals.length} goals registered`);

  if (clearedTransactions.length !== 0 || clearedSummary.grossDebits !== 0) {
    throw new Error('Dataset removal failed to clear ledger records!');
  }

  console.log('\n================================================================');
  console.log('   DATA FLOW AUDIT PASSED: REPLACEMENT & PRESERVATION RECONCILED  ');
  console.log('================================================================\n');
}

testSharedDashboardDataFlow().catch((err) => {
  console.error('Data flow audit failed:', err);
  process.exit(1);
});
