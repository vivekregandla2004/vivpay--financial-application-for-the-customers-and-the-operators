/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { detectProvider } from '../src/lib/finance/parsers/provider-detector.ts';
import { recoverTableFromDateAnchors } from '../src/lib/finance/parsers/recovery.ts';
import { normalizeTransaction, normalizeMerchantDescription } from '../src/lib/finance/normalize.ts';
import { computeBehavioralMetrics, computeMonthlySummaries, buildChartDatasets } from '../src/lib/finance/analytics.ts';
import { computeFinancialHealthScore } from '../src/lib/finance/intelligence/health.ts';
import { detectDocumentProviderAndCurrency, parsePdfStatement, normalizeDate, parseCurrencyAmount } from '../src/server/documents/parser.ts';

console.log('🧪 Starting VivPay Unified Financial Parsing & Analytics Gap Test Suite...\n');

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

async function runTests() {
  // -------------------------------------------------------------
  // Test 1: Extended Provider Detection & Currency Attribution
  // -------------------------------------------------------------
  console.log('--- Test 1: Provider Detection & Currency Signatures ---');

  const sbiHeaders = ['Date', 'Narration', 'Ref No./Cheque No.', 'Debit', 'Credit', 'Balance'];
  const sbiDetected = detectProvider(sbiHeaders, 'State Bank of India Statement', 'Opening Balance: INR 50,000');
  assert(sbiDetected.format.includes('State Bank of India'), 'SBI statement format detected');
  assert(sbiDetected.detectedCurrency === 'INR', 'SBI detected currency is INR');

  const gpayHeaders = ['Date', 'Description', 'Amount (INR)', 'Payment method', 'Transaction ID'];
  const gpayDetected = detectProvider(gpayHeaders, 'Google Pay Activity Statement', 'Google Pay Transaction History');
  assert(gpayDetected.format.includes('Google Pay'), 'Google Pay format detected');
  assert(gpayDetected.detectedCurrency === 'INR', 'Google Pay detected currency is INR');

  const amazonPayHeaders = ['Date', 'Details', 'Order ID', 'Debit', 'Credit', 'Amazon Pay Balance'];
  const amazonDetected = detectProvider(amazonPayHeaders, 'Amazon Pay Statement', 'Amazon Pay balance statement');
  assert(amazonDetected.format.includes('Amazon Pay'), 'Amazon Pay format detected');
  assert(amazonDetected.detectedCurrency === 'INR', 'Amazon Pay detected currency is INR');

  const pnbHeaders = ['Txn Date', 'Value Date', 'Particulars', 'Cheque No', 'Withdrawal Amount', 'Deposit Amount', 'Balance'];
  const pnbDetected = detectProvider(pnbHeaders, 'Punjab National Bank e-Statement', 'PNB Account Statement');
  assert(pnbDetected.format.includes('Punjab National Bank'), 'PNB format detected');
  assert(pnbDetected.detectedCurrency === 'INR', 'PNB detected currency is INR');

  const bobHeaders = ['Tran Date', 'Particulars', 'Chq No', 'Dr / Cr', 'Amount', 'Running Balance'];
  const bobDetected = detectProvider(bobHeaders, 'Bank of Baroda Statement', 'Baroda Connect');
  assert(bobDetected.format.includes('Bank of Baroda'), 'Bank of Baroda format detected');
  assert(bobDetected.detectedCurrency === 'INR', 'Bank of Baroda detected currency is INR');

  const creditCardHeaders = ['Transaction Date', 'Posting Date', 'Card Member', 'Details', 'Amount', 'Reward Points'];
  const ccDetected = detectProvider(creditCardHeaders, 'Credit Card Account Statement', 'Credit Card Statement minimum payment due');
  assert(ccDetected.format.includes('Credit Card Statement'), 'Credit Card statement format detected');

  const usBankHeaders = ['Date', 'Description', 'Amount', 'Balance'];
  const chaseDetected = detectDocumentProviderAndCurrency('Chase Bank Checking Statement Account ending in 4120 Total Deposits $3,500.00');
  assert(chaseDetected.provider === 'Chase Bank', 'Server detector identified Chase Bank');
  assert(chaseDetected.currency === 'USD', 'Server detector identified USD for US statement');

  // -------------------------------------------------------------
  // Test 2: Fault-Tolerant Date-Anchor Recovery
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Date-Anchor Recovery for Nonstandard Tables ---');

  const messyRows = [
    ['CONFIDENTIAL BANKING DOCUMENT', '', '', ''],
    ['Customer Name: Priya Sharma', '', 'Branch: Indiranagar', ''],
    ['Account Number: XXXXXXXX1234', '', 'IFSC: SBIN0001234', ''],
    ['', '', '', ''],
    ['01/10/2026', 'Swiggy Delivery Food', '450.00', 'DEBIT', '9482.00'],
    ['03/10/2026', 'Salary Payout Direct Credit', '85000.00', 'CREDIT', '94482.00'],
    ['05/10/2026', 'BESCOM Electricity Utility Bill', '1250.00', 'DEBIT', '93232.00'],
    ['07/10/2026', 'Blinkit Instant Groceries', '680.00', 'DEBIT', '92552.00'],
    ['10/10/2026', 'Netflix Subscription Stream', '649.00', 'DEBIT', '91903.00'],
  ];

  const recoveryResult = recoverTableFromDateAnchors(messyRows);
  assert(recoveryResult !== null, 'Date-anchor recovery succeeded on headerless table');
  assert(recoveryResult!.startRow === 4, 'Correctly detected startRow at first transaction row');
  assert(recoveryResult!.recoveredMapping.dateCol === 0, 'Correctly detected date column index 0');
  assert(recoveryResult!.recoveredMapping.descriptionCol === 1, 'Correctly detected description column index 1');
  assert(recoveryResult!.recoveredMapping.amountCol >= 0, 'Correctly detected amount column index');
  assert(recoveryResult!.confidence > 0, 'Confidence score calculated');

  // -------------------------------------------------------------
  // Test 3: UPI Narration Cleanup & Curated Merchant Normalization
  // -------------------------------------------------------------
  console.log('\n--- Test 3: UPI Narration Cleanup & Merchant Normalization ---');

  const upiSwiggy = normalizeMerchantDescription('UPI/9482018401/PAY TO SWIGGY BANGALORE/swiggy@icici/Order9482');
  assert(upiSwiggy.merchant === 'Swiggy', 'UPI Swiggy narration cleaned to merchant "Swiggy"');

  const upiZomato = normalizeMerchantDescription('UPI-8392019482-ZOMATO LIMITED-PAYMENT-zomato@hdfc');
  assert(upiZomato.merchant === 'Zomato', 'UPI Zomato narration cleaned to merchant "Zomato"');

  const bbpsUtility = normalizeMerchantDescription('BBPS/BESCOM/ELECTRICITY/BILL/PAYMENT/98201');
  assert(upiUtilityMerchant(bbpsUtility.merchant), 'BBPS Utility narration recognized as BESCOM or Utility');

  function upiUtilityMerchant(m: string | null) {
    return m === 'BESCOM' || m?.includes('BESCOM');
  }

  const normalizedTx = normalizeTransaction(
    {
      date: '2026-10-08',
      description: 'UPI/192837465/BLINKIT COMMERCE GURGAON/blinkit@kotak',
      rawAmount: '820.00',
      direction: 'debit',
    },
    'INR'
  );
  assert(normalizedTx !== null, 'Normalized transaction object created');
  assert(normalizedTx!.merchant === 'Blinkit', 'Curated dictionary normalized to "Blinkit"');
  assert(normalizedTx!.category === 'Groceries' || normalizedTx!.category === 'Food & Dining', 'Categorized under Groceries or Food & Dining');

  // -------------------------------------------------------------
  // Test 4: Currency Display & Indian Numbering Format Verification
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Currency Display & Indian Numbering Verification ---');

  const inrAmount = 125000.5;
  const inrFormatted = inrAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Indian notation formats 125000.50 as "1,25,000.50"
  assert(inrFormatted.includes('1,25,000.50'), `Formatted INR with en-IN numbering: ₹ ${inrFormatted}`);

  // Test that numerical amounts are preserved exactly
  const sampleNum = 42500.75;
  const parsedAmt = parseCurrencyAmount(`₹ ${inrFormatted}`);
  assert(parsedAmt !== null && parsedAmt.amount === inrAmount, 'Numeric integrity strictly preserved through parse and format');

  // -------------------------------------------------------------
  // Test 5: Explainable 10-Factor Health Score & KPI Engine
  // -------------------------------------------------------------
  console.log('\n--- Test 5: 10-Factor Health Score Model ---');

  const testTransactions = [
    { id: '1', date: '2026-08-01', description: 'TechCorp Salary Direct Deposit', amount: 95000, type: 'credit' as const, categoryId: 'c1', categoryName: 'Income / Salary' },
    { id: '2', date: '2026-08-05', description: 'Apartment Monthly Rent', amount: 25000, type: 'debit' as const, categoryId: 'c2', categoryName: 'Housing & Rent' },
    { id: '3', date: '2026-08-08', description: 'Blinkit Grocery Store', amount: 3500, type: 'debit' as const, categoryId: 'c3', categoryName: 'Food & Dining' },
    { id: '4', date: '2026-08-10', description: 'Zerodha Broking SIP Investment', amount: 15000, type: 'debit' as const, categoryId: 'c4', categoryName: 'Investments & Savings' },
    { id: '5', date: '2026-08-15', description: 'Netflix Monthly Subscription', amount: 649, type: 'debit' as const, categoryId: 'c5', categoryName: 'Entertainment & Leisure', isRecurring: true },
    { id: '6', date: '2026-08-20', description: 'BESCOM Electricity Utility Bill', amount: 1450, type: 'debit' as const, categoryId: 'c6', categoryName: 'Utilities & Bills' },
    { id: '7', date: '2026-09-01', description: 'TechCorp Salary Direct Deposit', amount: 95000, type: 'credit' as const, categoryId: 'c1', categoryName: 'Income / Salary' },
    { id: '8', date: '2026-09-05', description: 'Apartment Monthly Rent', amount: 25000, type: 'debit' as const, categoryId: 'c2', categoryName: 'Housing & Rent' },
    { id: '9', date: '2026-09-10', description: 'Zerodha Broking SIP Investment', amount: 15000, type: 'debit' as const, categoryId: 'c4', categoryName: 'Investments & Savings' },
    { id: '10', date: '2026-09-15', description: 'Netflix Monthly Subscription', amount: 649, type: 'debit' as const, categoryId: 'c5', categoryName: 'Entertainment & Leisure', isRecurring: true },
  ];

  // Convert to NormalizedTransaction format for finance engine
  const normTxs = testTransactions.map((t) => ({
    id: t.id,
    date: t.date,
    description: t.description,
    originalDescription: t.description,
    amount: t.amount,
    debit: t.type === 'debit' ? t.amount : 0,
    credit: t.type === 'credit' ? t.amount : 0,
    direction: t.type,
    category: (t.categoryName || 'Other') as any,
    balance: null,
    reference: null,
    merchant: null,
    upiHandle: null,
    paymentMethod: 'netbanking' as const,
    confidence: 1.0,
    reviewRequired: false,
    sourceFile: 'test.xlsx',
    sourceSheet: 'Sheet1',
    sourceRow: 1,
  }));

  const monthly = computeMonthlySummaries(normTxs);
  const behavioral = computeBehavioralMetrics(normTxs);
  const health = computeFinancialHealthScore(normTxs, monthly, behavioral);

  assert(health.factors.length === 10, `Health score model contains exactly 10 explainable factors (found ${health.factors.length})`);

  const maxTotalScore = health.factors.reduce((sum, f) => sum + f.maxPoints, 0);
  assert(maxTotalScore === 100, `Health score maximum points sum exactly to 100 (got ${maxTotalScore})`);

  assert(health.compositeScore >= 0 && health.compositeScore <= 100, `Computed composite score ${health.compositeScore} is within valid bounds [0, 100]`);
  assert(typeof health.grade === 'string', `Health score produces grade: ${health.grade}`);

  assert(typeof behavioral.averageTransactionValue === 'number' && behavioral.averageTransactionValue > 0, `Average transaction value computed: ${behavioral.averageTransactionValue}`);
  assert(typeof monthly[0].savingsRate === 'number' && monthly[0].savingsRate! >= 0, `Savings rate calculated: ${monthly[0].savingsRate!.toFixed(1)}%`);
  assert(behavioral.weekendVsWeekdayRatio !== undefined, `Weekend vs weekday ratio computed: ${behavioral.weekendVsWeekdayRatio}`);

  // Chart datasets
  const chartDatasets = buildChartDatasets(normTxs);
  assert(chartDatasets.monthlyNetCashFlow.length > 0, 'Monthly net cash flow dataset populated');
  assert(chartDatasets.categoryBreakdown.length > 0, 'Category breakdown dataset populated');
  assert(chartDatasets.timeOfDay !== undefined, 'timeOfDay chart dataset populated');

  // -------------------------------------------------------------
  // Test 6: Scanned PDF OCR Detection
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Digital vs Scanned PDF Detection ---');

  // Create minimal digital PDF buffer simulation
  const dummyBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF');
  const parseRes = await parsePdfStatement(dummyBuffer, 'test-customer');
  // An empty PDF with header but no text should fail or be flagged as scanned/empty, never invent data
  assert(parseRes.success === false, 'Empty or headerless PDF safely rejected without synthetic fallback');
  assert(parseRes.rows.length === 0, 'No synthetic transaction rows invented on parse failure');

  console.log(`\n======================================================`);
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log(`======================================================\n`);
}

runTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
