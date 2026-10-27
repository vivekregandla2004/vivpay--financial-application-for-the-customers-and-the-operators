/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { analyzeFile } from '../src/lib/finance/services.ts';
import { normalizeTransactions } from '../src/lib/finance/normalize.ts';
import { generateTransactionChecksum } from '../src/lib/analytics/financialEngine.ts';

async function runAxisBankStatementAudit() {
  console.log('================================================================');
  console.log('       VIVPAY AXIS BANK STATEMENT AUDIT & VALIDATION TEST       ');
  console.log('================================================================\n');

  // STEP 1: Construct realistic Axis Bank Statement Workbook with multi-sheet layout,
  // pre-header metadata, opening balance row, and trailing totals.
  const wb = XLSX.utils.book_new();

  // Sheet 1: Terms & Conditions (Should be penalized and skipped by Sheet Inspector)
  const termsData = [
    ['AXIS BANK - GENERAL TERMS & INSTRUCTIONS'],
    ['1. This statement is confidential and intended for the account holder.'],
    ['2. Report any discrepancies within 14 days of statement generation.'],
    ['3. For queries, contact branch manager or call toll-free 1800-419-5959.'],
    ['4. Visit www.axisbank.com for online grievance redressal.'],
  ];
  const wsTerms = XLSX.utils.aoa_to_sheet(termsData);
  XLSX.utils.book_append_sheet(wb, wsTerms, 'Terms & Conditions');

  // Sheet 2: Statement with transactions (Target sheet)
  const statementSheetData = [
    ['AXIS BANK LIMITED'],
    ['Statement of Account for Savings Bank Account'],
    ['Account Number: 918010048291034', 'Currency: INR'],
    ['Customer Name: Priya Sharma', 'Customer ID: 84920194'],
    ['Branch: INDIRANAGAR BANGALORE [IFSC: UTIB0000123]'],
    ['Statement Period: 01-10-2026 to 12-10-2026'],
    ['Nominee Registered: YES'],
    [],
    // Row Index 8: Real Axis Bank Table Headers
    ['Tran Date', 'CHQ NO', 'PARTICULARS', 'DR', 'CR', 'BAL', 'INIT. BR'],
    // Row Index 9: Opening balance row (must be excluded from transactions)
    ['01-10-2026', '', 'OPENING BALANCE', '', '', '50000.00', '0123'],
    // Row Index 10-19: 10 authentic transactions
    ['01-10-2026', '', 'UPI/swiggy@kotak/Payment to Swiggy Bangalore/329482910', '450.00', '', '49550.00', '0123'],
    ['02-10-2026', '', 'NETFLIX ENTERTAINMENT SERVICES MUMBAI IN', '649.00', '', '48901.00', '0123'],
    ['03-10-2026', '', 'ACH/ZERODHA BROKING/SIP-EQUITY-102938', '10000.00', '', '38901.00', '0123'],
    ['04-10-2026', '', 'UPI/rahul@oksbi/Received from Rahul - Rent split', '', '850.00', '39751.00', '0123'],
    ['05-10-2026', '', 'BIL/ONL/000928109/BESCOM Bangalore Electricity', '1250.00', '', '38501.00', '0123'],
    ['07-10-2026', '', 'ECOM/Flipkart Internet Pvt Ltd/Bangalore', '1499.00', '', '37002.00', '0123'],
    ['08-10-2026', '', 'UPI/blinkit@icici/Blinkit Grocery Store', '640.00', '', '36362.00', '0123'],
    ['10-10-2026', '', 'NEFT/TECHCORP GLOBAL PAYOUT/SALARY OCT 2026', '', '75000.00', '111362.00', '0123'],
    ['11-10-2026', '', 'POS/UBER TRIP MUMBAI/10293847', '285.50', '', '111076.50', '0123'],
    ['12-10-2026', '', 'UPI/starbucks@hdfcbank/Starbucks Coffee Mumbai', '380.00', '', '110696.50', '0123'],
    // Row Index 20: Blank line
    [],
    // Row Index 21: Invalid row (0.00 amount, missing particulars/date)
    ['', '', 'Invalid record with no date or amount', '0.00', '', '', ''],
    // Row Index 22-25: Trailing totals and summary (must be excluded)
    ['', '', 'TOTAL DEBIT:', '15153.50', '', '', ''],
    ['', '', 'TOTAL CREDIT:', '', '75850.00', '', ''],
    ['', '', 'CLOSING BALANCE:', '', '', '110696.50', ''],
    ['*** END OF STATEMENT ***'],
    ['This is a computer generated statement from Axis Bank Ltd and does not require signature.'],
  ];

  const wsStatement = XLSX.utils.aoa_to_sheet(statementSheetData);
  XLSX.utils.book_append_sheet(wb, wsStatement, 'Statement_918010048291034');

  const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const fileName = 'Axis_Bank_Statement_Oct2026.xlsx';
  const testFile = new File([fileBuffer], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  console.log(`[1] Created Test Workbook: ${fileName} (${fileBuffer.length} bytes)`);
  console.log(`    - Sheets: ["Terms & Conditions", "Statement_918010048291034"]`);
  console.log(`    - Source raw rows in statement sheet: ${statementSheetData.length}`);
  console.log(`    - Source expected valid transactions: 10`);
  console.log(`    - Expected Opening Balance: ₹50,000.00 (Must be excluded from tx rows)`);
  console.log(`    - Expected Gross Credits: ₹75,850.00`);
  console.log(`    - Expected Gross Debits: ₹15,153.50`);
  console.log(`    - Expected Net Cash Flow: ₹60,696.50\n`);

  // STEP 2: Execute client-side analyzeFile engine
  console.log('[2] Running analyzeFile(file) through financial services engine...');
  const result = await analyzeFile(testFile);

  console.log(`\n--- INGESTION & PARSING VERIFICATION ---`);
  console.log(`- Success status: ${result.success}`);
  console.log(`- Detected Provider: ${result.provider.name} (${Math.round(result.provider.confidence * 100)}% confidence)`);
  console.log(`- Detected Format: ${result.provider.format}`);
  console.log(`- Masked Account: ${result.provider.accountNumberMasked || 'N/A'}`);
  console.log(`- Selected Worksheet: "${result.selectedSheet}"`);
  console.log(`- Selection Reason: ${result.diagnostics.sheetSelectionReason}`);

  if (result.selectedSheet !== 'Statement_918010048291034') {
    throw new Error(`Sheet Inspector chose wrong sheet: "${result.selectedSheet}"`);
  }
  if (result.provider.name !== 'Axis') {
    throw new Error(`Provider detection failed: expected "Axis", got "${result.provider.name}"`);
  }

  // STEP 3: Transaction Counts and Exclusions
  console.log(`\n--- TRANSACTION RECONCILIATION ---`);
  console.log(`- Total valid parsed transactions: ${result.transactions.length} (Expected: 10)`);
  console.log(`- Invalid / discarded rows: ${result.diagnostics.invalidRowCount}`);
  console.log(`- Date range: ${result.diagnostics.dateRange.from} to ${result.diagnostics.dateRange.to}`);

  if (result.transactions.length !== 10) {
    throw new Error(`Transaction count mismatch: expected 10, got ${result.transactions.length}`);
  }

  // Verify Opening Balance row was excluded
  const hasOpeningBal = result.transactions.some(
    (t) => t.originalDescription.toLowerCase().includes('opening balance') || t.description.toLowerCase().includes('opening balance')
  );
  console.log(`- Opening Balance properly excluded: ${!hasOpeningBal}`);
  if (hasOpeningBal) {
    throw new Error('Opening Balance row was incorrectly included in transactions!');
  }

  // Verify Summary totals rows were excluded
  const hasTotalRows = result.transactions.some(
    (t) => t.originalDescription.toLowerCase().startsWith('total') || t.originalDescription.toLowerCase().includes('end of statement')
  );
  console.log(`- Summary total and disclaimer rows excluded: ${!hasTotalRows}`);
  if (hasTotalRows) {
    throw new Error('Summary / footer rows were incorrectly included in transactions!');
  }

  // STEP 4: Preservation of originalDescription and date formatting
  console.log(`\n--- ORIGINAL DESCRIPTION & CHRONOLOGICAL INTEGRITY ---`);
  let descriptionPreservedCount = 0;
  for (let i = 0; i < result.transactions.length; i++) {
    const t = result.transactions[i];
    const sourceParticulars = statementSheetData[10 + i][2];
    const matchesSource = t.originalDescription === sourceParticulars;
    if (matchesSource) descriptionPreservedCount++;

    console.log(`  [${i + 1}] Date: ${t.date} | Dir: ${t.direction.padEnd(6)} | Amt: ₹${t.amount.toFixed(2).padStart(9)} | Cat: ${t.category.padEnd(14)} | Orig: "${t.originalDescription.slice(0, 38)}..."`);
  }

  console.log(`- Exact originalDescription preservation: ${descriptionPreservedCount}/10 matches`);
  if (descriptionPreservedCount !== 10) {
    throw new Error(`originalDescription was not preserved verbatim!`);
  }

  // STEP 5: Financial Calculations & Reconciled Totals
  console.log(`\n--- FINANCIAL CALCULATIONS RECONCILIATION ---`);
  const calcCredits = result.transactions
    .filter((t) => t.direction === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const calcDebits = result.transactions
    .filter((t) => t.direction === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  const calcNetFlow = calcCredits - calcDebits;
  const latestClosingBalance = result.transactions[result.transactions.length - 1].balance;

  console.log(`- Source Gross Credits: ₹75,850.00 | Calculated: ₹${calcCredits.toFixed(2)}`);
  console.log(`- Source Gross Debits:  ₹15,153.50 | Calculated: ₹${calcDebits.toFixed(2)}`);
  console.log(`- Source Net Cash Flow:  ₹60,696.50 | Calculated: ₹${calcNetFlow.toFixed(2)}`);
  console.log(`- Ending Closing Balance: ₹1,10,696.50 | Parsed Balance: ₹${Number(latestClosingBalance).toFixed(2)}`);

  if (Math.abs(calcCredits - 75850.00) > 0.01) {
    throw new Error(`Credit total mismatch: expected 75850, got ${calcCredits}`);
  }
  if (Math.abs(calcDebits - 15153.50) > 0.01) {
    throw new Error(`Debit total mismatch: expected 15153.50, got ${calcDebits}`);
  }
  if (Math.abs(calcNetFlow - 60696.50) > 0.01) {
    throw new Error(`Net flow mismatch: expected 60696.50, got ${calcNetFlow}`);
  }

  // STEP 6: Monthly Summaries & Recurring Detection
  console.log(`\n--- MONTHLY SUMMARIES & RECURRING CANDIDATES ---`);
  console.log(`- Monthly Summaries count: ${result.monthlySummaries.length}`);
  result.monthlySummaries.forEach((m) => {
    console.log(`    Month: ${m.monthLabel} | Inflow: ₹${m.income} | Outflow: ₹${m.expenses} | Net: ₹${m.netCashFlow} | Savings Rate: ${m.savingsRate}%`);
  });

  console.log(`- Recurring Subscriptions count: ${result.recurringCandidates.length}`);
  result.recurringCandidates.forEach((r) => {
    console.log(`    Merchant: ${r.merchant} | Freq: ${r.detectedFrequency} | Monthly: ₹${r.estimatedMonthlyCost} | Conf: ${r.confidence} | Tx IDs: ${r.supportingTransactionIds.length}`);
  });

  // STEP 7: Ten-Factor Financial Health Score Verification
  console.log(`\n--- TEN-FACTOR FINANCIAL HEALTH SCORE AUDIT ---`);
  console.log(`- Composite Health Score: ${result.health.compositeScore} / 100`);
  console.log(`- Health Grade: ${result.health.grade}`);
  console.log(`- Total Evaluated Factors: ${result.health.factors.length} / 10`);

  if (result.health.factors.length !== 10) {
    throw new Error(`Expected exactly 10 health factors, got ${result.health.factors.length}`);
  }

  let sumMaxPoints = 0;
  result.health.factors.forEach((f, idx) => {
    sumMaxPoints += f.maxPoints;
    console.log(`  [Factor ${idx + 1}] ${f.name.padEnd(30)}: ${String(f.awardedPoints).padStart(2)} / ${f.maxPoints} pts | Sufficiency: ${f.dataSufficiency.padEnd(10)} | Value: ${f.measuredValue}`);
  });

  console.log(`- Total Max Points across 10 factors: ${sumMaxPoints} (Expected: 100)`);
  if (sumMaxPoints !== 100) {
    throw new Error(`Total max points across 10 factors is ${sumMaxPoints}, expected exactly 100!`);
  }

  // STEP 8: Deterministic Deduplication Check
  console.log(`\n--- REPEATED UPLOAD DEDUPLICATION AUDIT ---`);
  const accountId = 'acc-axis-001';
  const seenHashes = new Set<string>();

  // Pass 1
  let pass1Imported = 0;
  let pass1Duplicates = 0;
  for (const t of result.transactions) {
    const ck = generateTransactionChecksum(t.date, t.originalDescription, t.amount, t.direction, accountId);
    if (seenHashes.has(ck)) {
      pass1Duplicates++;
    } else {
      seenHashes.add(ck);
      pass1Imported++;
    }
  }

  // Pass 2 (Repeated upload of identical file)
  let pass2Imported = 0;
  let pass2Duplicates = 0;
  for (const t of result.transactions) {
    const ck = generateTransactionChecksum(t.date, t.originalDescription, t.amount, t.direction, accountId);
    if (seenHashes.has(ck)) {
      pass2Duplicates++;
    } else {
      seenHashes.add(ck);
      pass2Imported++;
    }
  }

  console.log(`- Pass 1 (Initial Statement): ${pass1Imported} imported, ${pass1Duplicates} duplicates`);
  console.log(`- Pass 2 (Repeated Statement): ${pass2Imported} imported, ${pass2Duplicates} duplicates`);

  if (pass1Imported !== 10 || pass2Imported !== 0 || pass2Duplicates !== 10) {
    throw new Error('Deduplication failed: repeated upload did not block 100% of duplicates!');
  }

  console.log('\n================================================================');
  console.log('    AUDIT SUCCESS: ALL CHECKS RECONCILED WITH ZERO ANOMALIES     ');
  console.log('================================================================\n');
}

runAxisBankStatementAudit().catch((err) => {
  console.error('\nAUDIT FAILED WITH ERROR:\n', err);
  process.exit(1);
});
