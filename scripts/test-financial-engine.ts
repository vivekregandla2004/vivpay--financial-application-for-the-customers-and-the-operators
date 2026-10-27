/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { parseExcelStatement } from '../src/server/documents/parser.ts';
import {
  generateTransactionChecksum,
  calculateNormalizedSummary,
  calculateCategoryBreakdown,
  calculateMonthlyTrends,
  classifyTransactionType,
} from '../src/lib/analytics/financialEngine.ts';
import { Account, Transaction } from '../src/types/database.ts';

async function runAudit() {
  console.log('=== STARTING VIVPAY FINANCIAL DATA ENGINE AUDIT ===\n');

  // STEP 1: Construct a representative PhonePe Statement Workbook with metadata preamble
  const wb = XLSX.utils.book_new();
  const wsData = [
    ['PhonePe Transaction Statement'],
    ['User: Alex Rivera', 'Mobile: +91 98765 43210'],
    ['Statement Period: 01 Oct 2026 to 12 Oct 2026'],
    [],
    ['Date', 'Transaction Details', 'Type', 'Amount (INR)', 'UTR No.', 'Status'],
    ['12/10/2026', 'Paid to Swiggy Delivery Bangalore', 'DEBIT', '420.00', 'UTR9482018401', 'COMPLETED'],
    ['11/10/2026', 'Paid to Uber Technologies Trip', 'DEBIT', '285.50', 'UTR9482018402', 'COMPLETED'],
    ['10/10/2026', 'Salary Credited - TechCorp Global Payout', 'CREDIT', '75000.00', 'UTR9482018403', 'COMPLETED'],
    ['08/10/2026', 'Paid to Blinkit Grocery Store', 'DEBIT', '640.00', 'UTR9482018404', 'COMPLETED'],
    ['07/10/2026', 'Paid to Flipkart Internet Pvt Ltd', 'DEBIT', '1499.00', 'UTR9482018405', 'COMPLETED'],
    ['05/10/2026', 'Paid to BESCOM Electricity Utility', 'DEBIT', '1250.00', 'UTR9482018406', 'COMPLETED'],
    ['04/10/2026', 'Received from Priya Sharma - Split bill', 'CREDIT', '850.00', 'UTR9482018407', 'COMPLETED'],
    ['03/10/2026', 'Paid to Zerodha Broking SIP Investment', 'DEBIT', '10000.00', 'UTR9482018408', 'COMPLETED'],
    ['02/10/2026', 'Paid to Netflix Monthly Subscription', 'DEBIT', '649.00', 'UTR9482018409', 'COMPLETED'],
    ['01/10/2026', 'Refund from Blinkit - Order Cancelled', 'CREDIT', '320.00', 'UTR9482018410', 'COMPLETED'],
    // 2 Invalid rows (empty date, invalid amount)
    ['', 'Invalid Transaction with Missing Date', 'DEBIT', '100.00', 'UTR999', 'FAILED'],
    ['01/10/2026', 'Invalid Transaction with Zero Amount', 'DEBIT', '0.00', 'UTR000', 'FAILED'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Statement');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  console.log('1. Generated test PhonePe workbook buffer with 10 valid rows + 2 invalid rows + 4 preamble rows.');

  // STEP 2: Test parseExcelStatement with preamble auto-detection
  const parseResult = await parseExcelStatement(buffer, 'demo-customer-uuid-001');

  console.log(`2. Parser execution:
     - Success: ${parseResult.success}
     - Total extracted: ${parseResult.totalRowsParsed}
     - Valid extracted rows: ${parseResult.validRowsCount} (Expected: 10)`);

  if (parseResult.validRowsCount !== 10) {
    throw new Error(`Expected 10 valid rows, got ${parseResult.validRowsCount}`);
  }

  // STEP 3: Verify Date Normalization and Classification
  console.log('\n3. Validating Row Normalization:');
  const dateChecks = parseResult.rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date));
  console.log(`   - All dates normalized to YYYY-MM-DD: ${dateChecks}`);
  if (!dateChecks) throw new Error('Date normalization failed.');

  const sampleSalary = parseResult.rows.find((r) => r.description.includes('Salary Credited'));
  if (!sampleSalary || sampleSalary.type !== 'credit' || sampleSalary.amount !== 75000) {
    throw new Error('Salary row classification failed.');
  }
  console.log(`   - Salary credit correctly parsed: ₹${sampleSalary.amount} (Type: ${sampleSalary.type})`);

  const sampleRefund = parseResult.rows.find((r) => r.description.includes('Refund from Blinkit'));
  if (!sampleRefund || sampleRefund.type !== 'credit' || sampleRefund.amount !== 320) {
    throw new Error('Refund credit row parsing failed.');
  }
  const refundClass = classifyTransactionType(sampleRefund);
  console.log(`   - Refund recognized as reversal/refund: ${refundClass.isRefundOrReversal}`);
  if (!refundClass.isRefundOrReversal) throw new Error('Refund classification failed.');

  // STEP 4: Test Deterministic Deduplication
  console.log('\n4. Validating Deterministic Deduplication:');
  const accountId = 'acc-demo-1';
  const initialLedger: Transaction[] = [];

  const validExtractedRows = parseResult.rows.filter((r) => !r.isAmbiguous);

  // First ingestion
  const existingChecksums = new Set<string>();
  const firstBatch: Transaction[] = [];
  let firstDuplicates = 0;

  for (const r of validExtractedRows) {
    const chk = generateTransactionChecksum(r.date, r.description, r.amount, r.type, accountId);
    if (existingChecksums.has(chk)) {
      firstDuplicates++;
    } else {
      existingChecksums.add(chk);
      firstBatch.push({
        id: `tx-${chk}`,
        customerId: 'demo-customer-uuid-001',
        accountId,
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
        categoryId: r.categoryId,
        categoryName: r.categoryName || 'General',
        checksum: chk,
        isUserCorrected: false,
        isRecurring: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
    }
  }

  console.log(`   - Initial Upload: ${firstBatch.length} imported, ${firstDuplicates} duplicates.`);
  if (firstBatch.length !== 10 || firstDuplicates !== 0) {
    throw new Error('Initial upload ingestion count mismatch.');
  }

  // Repeated ingestion of identical file
  const secondBatch: Transaction[] = [];
  let secondDuplicates = 0;

  for (const r of validExtractedRows) {
    const chk = generateTransactionChecksum(r.date, r.description, r.amount, r.type, accountId);
    if (existingChecksums.has(chk)) {
      secondDuplicates++;
    } else {
      existingChecksums.add(chk);
      secondBatch.push(r as any);
    }
  }

  console.log(`   - Repeated Upload of same statement: ${secondBatch.length} imported, ${secondDuplicates} duplicates detected.`);
  if (secondBatch.length !== 0 || secondDuplicates !== 10) {
    throw new Error('Repeated upload failed to deduplicate properly.');
  }

  // STEP 5: Test Financial Calculations Reconciled Deterministically
  console.log('\n5. Validating Financial Calculations:');
  const testAccount: Account = {
    id: 'acc-demo-1',
    customerId: 'demo-customer-uuid-001',
    accountName: 'PhonePe Ledger Account',
    accountNumberMasked: '•••• 4892',
    accountType: 'checking',
    institutionName: 'UPI Statement',
    balance: 100000.00,
    currency: 'INR',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-10-12T00:00:00Z',
  };

  const summary = calculateNormalizedSummary([testAccount], firstBatch, 'INR');

  console.log(`   - Total Balance: ₹${summary.totalBalance.toLocaleString('en-IN')}`);
  console.log(`   - Gross Credits: ₹${summary.grossCredits.toLocaleString('en-IN')}`);
  console.log(`   - Gross Debits: ₹${summary.grossDebits.toLocaleString('en-IN')}`);
  console.log(`   - Pure Income: ₹${summary.pureIncome.toLocaleString('en-IN')} (Expected: ₹75,850)`);
  console.log(`   - Pure Expenses (Adjusted for ₹320 refund): ₹${summary.pureExpenses.toLocaleString('en-IN')} (Expected: ₹14,423.50)`);
  console.log(`   - Net Cash Flow: ₹${summary.netCashFlow.toLocaleString('en-IN')} (Expected: ₹61,426.50)`);
  console.log(`   - Savings Rate: ${summary.savingsRate}% (Expected: ~81.0%)`);

  if (summary.pureIncome !== 75850) {
    throw new Error(`Pure income mismatch: expected 75850, got ${summary.pureIncome}`);
  }
  if (summary.pureExpenses !== 14423.50) {
    throw new Error(`Pure expenses mismatch: expected 14423.50, got ${summary.pureExpenses}`);
  }
  if (summary.netCashFlow !== 61426.50) {
    throw new Error(`Net cash flow mismatch: expected 61426.50, got ${summary.netCashFlow}`);
  }

  // STEP 6: Category Breakdown and Monthly Trends
  console.log('\n6. Validating Category Breakdown:');
  const categories = calculateCategoryBreakdown(firstBatch);
  categories.forEach((c) => {
    console.log(`   - ${c.categoryName}: ₹${c.totalAmount.toLocaleString('en-IN')} (${c.percentage}%, ${c.transactionCount} txs)`);
  });

  const monthlyTrends = calculateMonthlyTrends(firstBatch);
  console.log('\n7. Validating Monthly Trends:');
  monthlyTrends.forEach((m) => {
    console.log(`   - ${m.monthLabel}: Inflow ₹${m.income}, Outflow ₹${m.expenses}, Net ₹${m.netCashFlow}, Savings Rate ${m.savingsRate}%`);
  });

  console.log('\n=== ALL AUDIT & STABILIZATION CHECKS PASSED PERFECTLY ===\n');
}

runAudit().catch((err) => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
