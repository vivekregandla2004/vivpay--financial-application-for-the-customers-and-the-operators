/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import * as XLSX from 'xlsx';
import { getDatabase, customerRepo, sessionRepo } from '../src/server/db/database.ts';
import { generateSalt, hashPassword, generateSessionToken, hashToken } from '../src/server/auth/crypto.ts';
import { authRouter } from '../src/server/routes/authRoutes.ts';
import { customerRouter } from '../src/server/routes/customerRoutes.ts';
import { transactionRouter } from '../src/server/routes/transactionRoutes.ts';
import { documentRouter } from '../src/server/routes/documentRoutes.ts';
import { conversationRouter } from '../src/server/routes/conversationRoutes.ts';
import { parseCsvStatement, parseExcelStatement } from '../src/server/documents/parser.ts';

async function runPhase2_2Tests() {
  console.log('====================================================');
  console.log('VIVPAY PHASE 2.2: BACKEND APIS VERIFICATION SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${testName}`);
      throw new Error(`Assertion failed for: ${testName}`);
    }
  }

  // Initialize DB and Express test app
  getDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/customer', customerRouter);
  app.use('/api/transactions', transactionRouter);
  app.use('/api/documents', documentRouter);
  app.use('/api/conversations', conversationRouter);

  const server = app.listen(3100);
  const baseUrl = 'http://127.0.0.1:3100/api';

  try {
    // --------------------------------------------------------------------------
    // Setup Test Users (Alice & Bob)
    // --------------------------------------------------------------------------
    const saltA = generateSalt();
    const aliceUser = customerRepo.create({
      email: `alice_${Date.now()}@vivpay.com`,
      passwordHash: hashPassword('AlicePassword2026!', saltA),
      salt: saltA,
      fullName: 'Alice Walker',
      currency: 'USD',
    });
    const tokenA = generateSessionToken();
    sessionRepo.create(aliceUser.id, hashToken(tokenA), 7);

    const saltB = generateSalt();
    const bobUser = customerRepo.create({
      email: `bob_${Date.now()}@vivpay.com`,
      passwordHash: hashPassword('BobPassword2026!', saltB),
      salt: saltB,
      fullName: 'Bob Davis',
      currency: 'USD',
    });
    const tokenB = generateSessionToken();
    sessionRepo.create(bobUser.id, hashToken(tokenB), 7);

    const authHeadersA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
    const authHeadersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

    // ==========================================================================
    // Phase 2.2A: Customer Profile and Account APIs
    // ==========================================================================
    console.log('\n--- Testing Phase 2.2A: Customer Profile & Accounts ---');

    // 1. Profile retrieval
    const profRes = await fetch(`${baseUrl}/customer/profile`, { headers: authHeadersA });
    const profData = await profRes.json();
    assert(profRes.status === 200 && profData.profile.id === aliceUser.id, 'GET /api/customer/profile returns authenticated profile');

    // 2. Profile update
    const updateProfRes = await fetch(`${baseUrl}/customer/profile`, {
      method: 'PUT',
      headers: authHeadersA,
      body: JSON.stringify({ fullName: 'Alice W. Johnson', phone: '+1 555-4321', currency: 'USD' }),
    });
    const updateProfData = await updateProfRes.json();
    assert(updateProfRes.status === 200 && updateProfData.profile.fullName === 'Alice W. Johnson', 'PUT /api/customer/profile updates profile');

    // 3. Create Account
    const createAccRes = await fetch(`${baseUrl}/customer/accounts`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({
        accountName: 'High Yield Savings',
        accountType: 'savings',
        institutionName: 'Marcus by Goldman Sachs',
        initialBalance: 15000.0,
      }),
    });
    const createAccData = await createAccRes.json();
    assert(createAccRes.status === 201 && createAccData.account.accountName === 'High Yield Savings', 'POST /api/customer/accounts creates new account');
    const savingsAccId = createAccData.account.id;

    // 4. List Accounts
    const listAccRes = await fetch(`${baseUrl}/customer/accounts`, { headers: authHeadersA });
    const listAccData = await listAccRes.json();
    assert(listAccRes.status === 200 && listAccData.accounts.length >= 1, 'GET /api/customer/accounts lists owned accounts');

    // 5. Cross-customer isolation on accounts: Bob tries to read Alice's savings account
    const crossAccRes = await fetch(`${baseUrl}/customer/accounts/${savingsAccId}`, { headers: authHeadersB });
    assert(crossAccRes.status === 404, 'Bob cannot retrieve Alice’s account (returns 404)');

    // 6. Update Account
    const updateAccRes = await fetch(`${baseUrl}/customer/accounts/${savingsAccId}`, {
      method: 'PUT',
      headers: authHeadersA,
      body: JSON.stringify({ accountName: 'Emergency Savings Fund' }),
    });
    const updateAccData = await updateAccRes.json();
    assert(updateAccRes.status === 200 && updateAccData.account.accountName === 'Emergency Savings Fund', 'PUT /api/customer/accounts/:id updates account name');

    // ==========================================================================
    // Phase 2.2B: Transaction APIs & Financial Analytics
    // ==========================================================================
    console.log('\n--- Testing Phase 2.2B: Transactions & Financial Analytics ---');

    // 7. List Categories
    const catRes = await fetch(`${baseUrl}/transactions/categories`, { headers: authHeadersA });
    const catData = await catRes.json();
    assert(catRes.status === 200 && catData.categories.length >= 10, 'GET /api/transactions/categories returns system categories');

    const foodCategory = catData.categories.find((c: any) => c.slug === 'food-dining');
    const incomeCategory = catData.categories.find((c: any) => c.slug === 'income');
    const housingCategory = catData.categories.find((c: any) => c.slug === 'housing');

    // 8. Create Custom Category
    const createCatRes = await fetch(`${baseUrl}/transactions/categories`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({ name: 'Freelance & Side Projects', icon: 'Laptop', color: '#10b981' }),
    });
    const createCatData = await createCatRes.json();
    assert(createCatRes.status === 201 && createCatData.category.name === 'Freelance & Side Projects', 'POST /api/transactions/categories creates custom category');

    // Duplicate custom category rejection
    const dupCatRes = await fetch(`${baseUrl}/transactions/categories`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({ name: 'Freelance & Side Projects' }),
    });
    assert(dupCatRes.status === 409, 'Duplicate category name returns 409 Conflict');

    // 9. Add Transactions for deterministic testing
    // Transaction 1: Income $4,500.00
    const tx1Res = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({
        accountId: savingsAccId,
        date: '2026-10-01',
        description: 'Tech Corp Monthly Payroll Direct Deposit',
        amount: 4500.0,
        type: 'credit',
        categoryId: incomeCategory.id,
      }),
    });
    assert(tx1Res.status === 201, 'POST /api/transactions records income transaction');

    // Transaction 2: Rent $1,800.00
    const tx2Res = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({
        accountId: savingsAccId,
        date: '2026-10-02',
        description: 'Greenfield Apartments Rent',
        amount: 1800.0,
        type: 'debit',
        categoryId: housingCategory.id,
      }),
    });
    assert(tx2Res.status === 201, 'POST /api/transactions records rent expense');
    const rentTxId = (await tx2Res.json()).transaction.id;

    // Transaction 3: Groceries $250.00
    await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({
        accountId: savingsAccId,
        date: '2026-10-05',
        description: 'Whole Foods Market Organic Groceries',
        amount: 250.0,
        type: 'debit',
        categoryId: foodCategory.id,
      }),
    });

    // Transaction 4: Coffee $15.50
    await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({
        accountId: savingsAccId,
        date: '2026-10-06',
        description: 'Blue Bottle Coffee',
        amount: 15.5,
        type: 'debit',
        categoryId: foodCategory.id,
      }),
    });

    // 10. List Transactions & Filtering
    const filterRes = await fetch(`${baseUrl}/transactions?type=debit&minAmount=50`, { headers: authHeadersA });
    const filterData = await filterRes.json();
    assert(
      filterRes.status === 200 &&
      filterData.transactions.length === 2 && // $1,800 and $250
      filterData.transactions.every((t: any) => t.type === 'debit' && t.amount >= 50),
      'GET /api/transactions filters correctly by type and minAmount'
    );

    // Search filter
    const searchRes = await fetch(`${baseUrl}/transactions?search=Coffee`, { headers: authHeadersA });
    const searchData = await searchRes.json();
    assert(searchRes.status === 200 && searchData.transactions.length === 1, 'GET /api/transactions filters by search keyword');

    // 11. Category Correction
    const patchCatRes = await fetch(`${baseUrl}/transactions/${rentTxId}/category`, {
      method: 'PATCH',
      headers: authHeadersA,
      body: JSON.stringify({ categoryId: housingCategory.id, applyToMerchant: true }),
    });
    const patchCatData = await patchCatRes.json();
    assert(patchCatRes.status === 200 && patchCatData.transaction.isUserCorrected === true, 'PATCH /api/transactions/:id/category persists category correction');

    // 12. Deterministic Financial Analytics Summary
    // Expected:
    // Pure Income: 4,500.00
    // Pure Expenses: 1,800 + 250 + 15.50 = 2,065.50
    // Net Cash Flow: 4,500.00 - 2,065.50 = 2,434.50
    // Savings Rate: ((2,434.50 / 4,500.00) * 100) = ~54.1%
    const summaryRes = await fetch(`${baseUrl}/transactions/analytics/summary`, { headers: authHeadersA });
    const summaryData = await summaryRes.json();
    const summary = summaryData.summary;

    assert(summary.pureIncome === 4500.0, `Analytics pureIncome matches expected ($4,500.00, got ${summary.pureIncome})`);
    assert(summary.pureExpenses === 2065.5, `Analytics pureExpenses matches expected ($2,065.50, got ${summary.pureExpenses})`);
    assert(summary.netCashFlow === 2434.5, `Analytics netCashFlow matches expected ($2,434.50, got ${summary.netCashFlow})`);
    assert(summary.savingsRate === 54.1, `Analytics savingsRate matches expected (54.1%, got ${summary.savingsRate}%)`);

    // 13. Monthly Analytics
    const monthlyRes = await fetch(`${baseUrl}/transactions/analytics/monthly`, { headers: authHeadersA });
    const monthlyData = await monthlyRes.json();
    assert(monthlyRes.status === 200 && monthlyData.monthlyTrends.length >= 1, 'GET /api/transactions/analytics/monthly returns monthly aggregations');

    // 14. Top Categories
    const topCatRes = await fetch(`${baseUrl}/transactions/analytics/top-categories`, { headers: authHeadersA });
    const topCatData = await topCatRes.json();
    assert(
      topCatRes.status === 200 &&
      topCatData.topCategories[0].categoryName === 'Housing & Rent' &&
      topCatData.topCategories[0].amount === 1800.0,
      'GET /api/transactions/analytics/top-categories correctly ranks largest expense'
    );

    // 15. Transaction history protection on account deletion
    const deleteAccRes = await fetch(`${baseUrl}/customer/accounts/${savingsAccId}`, {
      method: 'DELETE',
      headers: authHeadersA,
    });
    assert(deleteAccRes.status === 409, 'Account with transactions cannot be deleted (returns 409 Conflict)');

    // ==========================================================================
    // Phase 2.2C: Document & Statement Ingestion Pipeline
    // ==========================================================================
    console.log('\n--- Testing Phase 2.2C: Document & Statement Processing ---');

    // 16. CSV Parsing Engine Verification
    const sampleCsv = `Date,Description,Amount,Type\n2026-10-07,Trader Joe Groceries,78.20,debit\n2026-10-08,Shell Gas Station,45.00,debit\n2026-10-09,Consulting Fee,1200.00,credit`;
    const csvParseResult = await parseCsvStatement(sampleCsv, aliceUser.id);
    assert(csvParseResult.success && csvParseResult.validRowsCount === 3, 'CSV Parser successfully extracts 3 valid transaction rows');

    // 17. Excel Parsing Engine Verification
    const ws = XLSX.utils.aoa_to_sheet([
      ['Date', 'Description', 'Amount', 'Type'],
      ['2026-10-10', 'Best Buy Electronics', 299.99, 'debit'],
      ['2026-10-11', 'Target Home Goods', 62.40, 'debit'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Statements');
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const excelParseResult = await parseExcelStatement(excelBuffer, aliceUser.id);
    assert(excelParseResult.success && excelParseResult.validRowsCount === 2, 'Excel Parser successfully extracts valid transaction rows from XLSX');

    // 18. Multipart Upload to /api/documents/upload
    const boundary = '----WebKitFormBoundaryVivPayTest2026';
    const formBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="accountId"\r\n\r\n${savingsAccId}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test_statement.csv"\r\nContent-Type: text/csv\r\n\r\n${sampleCsv}\r\n`),
      Buffer.from(`--${boundary}--\r\n`),
    ]);

    const uploadRes = await fetch(`${baseUrl}/documents/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: formBody,
    });
    const uploadData = await uploadRes.json();
    assert(uploadRes.status === 201 && uploadData.document.processingStatus === 'uploaded', 'POST /api/documents/upload saves document with status "uploaded"');
    const docId = uploadData.document.id;

    // 19. Process Document (Extraction & Staged Preview)
    const processRes = await fetch(`${baseUrl}/documents/${docId}/process`, {
      method: 'POST',
      headers: authHeadersA,
    });
    const processData = await processRes.json();
    assert(
      processRes.status === 200 &&
      processData.extractedCount === 3 &&
      processData.document.processingStatus === 'completed',
      'POST /api/documents/:id/process extracts rows and updates status to "completed"'
    );

    // 20. Confirm & Import Extracted Transactions
    const importRes = await fetch(`${baseUrl}/documents/${docId}/import`, {
      method: 'POST',
      headers: authHeadersA,
    });
    const importData = await importRes.json();
    assert(
      importRes.status === 200 &&
      importData.importedCount === 3 &&
      importData.duplicateCount === 0,
      'POST /api/documents/:id/import confirms and imports 3 transactions into the ledger'
    );

    // 21. Re-importing identical statement prevents duplicate transactions (Deduplication Checksum)
    const reimportRes = await fetch(`${baseUrl}/documents/${docId}/import`, {
      method: 'POST',
      headers: authHeadersA,
    });
    const reimportData = await reimportRes.json();
    assert(
      reimportRes.status === 200 &&
      reimportData.importedCount === 0 &&
      reimportData.duplicateCount === 3,
      'Re-importing identical statement detects all duplicates (0 imported, 3 skipped)'
    );

    // 22. Cross-customer document isolation
    const crossDocRes = await fetch(`${baseUrl}/documents/${docId}`, { headers: authHeadersB });
    assert(crossDocRes.status === 404, 'Bob cannot access Alice’s document (returns 404)');

    // 23. Delete Document
    const deleteDocRes = await fetch(`${baseUrl}/documents/${docId}`, {
      method: 'DELETE',
      headers: authHeadersA,
    });
    assert(deleteDocRes.status === 200, 'DELETE /api/documents/:id safely removes document');

    // ==========================================================================
    // Phase 2.2D: Conversation Persistence APIs
    // ==========================================================================
    console.log('\n--- Testing Phase 2.2D: Conversation Persistence ---');

    // 24. Create Conversation Thread
    const createThreadRes = await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({ title: 'Monthly Spending Review' }),
    });
    const createThreadData = await createThreadRes.json();
    assert(createThreadRes.status === 201 && createThreadData.thread.title === 'Monthly Spending Review', 'POST /api/conversations creates conversation thread');
    const threadId = createThreadData.thread.id;

    // 25. Add User Message
    const msg1Res = await fetch(`${baseUrl}/conversations/${threadId}/messages`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({
        role: 'user',
        content: 'How much did I spend on groceries this month?',
      }),
    });
    assert(msg1Res.status === 201, 'POST /api/conversations/:id/messages saves user message');

    // 26. Add Assistant Message with Verified Groundings JSON
    const msg2Res = await fetch(`${baseUrl}/conversations/${threadId}/messages`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({
        role: 'assistant',
        content: 'You spent a total of $343.70 on Groceries & Dining across 3 transactions.',
        groundingsJson: JSON.stringify({ category: 'food-dining', total: 343.7, count: 3 }),
      }),
    });
    assert(msg2Res.status === 201, 'POST /api/conversations/:id/messages saves assistant message with groundings');

    // 27. Retrieve Thread with Full Message History
    const getThreadRes = await fetch(`${baseUrl}/conversations/${threadId}`, { headers: authHeadersA });
    const getThreadData = await getThreadRes.json();
    assert(
      getThreadRes.status === 200 &&
      getThreadData.messages.length === 2 &&
      getThreadData.messages[0].role === 'user' &&
      getThreadData.messages[1].role === 'assistant',
      'GET /api/conversations/:id retrieves complete conversation message history'
    );

    // 28. Update Thread Title
    const patchThreadRes = await fetch(`${baseUrl}/conversations/${threadId}`, {
      method: 'PATCH',
      headers: authHeadersA,
      body: JSON.stringify({ title: 'Q4 Groceries Analysis' }),
    });
    const patchThreadData = await patchThreadRes.json();
    assert(patchThreadRes.status === 200 && patchThreadData.thread.title === 'Q4 Groceries Analysis', 'PATCH /api/conversations/:id updates thread title');

    // 29. Cross-customer chat isolation
    const crossThreadRes = await fetch(`${baseUrl}/conversations/${threadId}`, { headers: authHeadersB });
    assert(crossThreadRes.status === 404, 'Bob cannot access Alice’s conversation thread (returns 404)');

    // 30. Delete Conversation Thread
    const deleteThreadRes = await fetch(`${baseUrl}/conversations/${threadId}`, {
      method: 'DELETE',
      headers: authHeadersA,
    });
    assert(deleteThreadRes.status === 200, 'DELETE /api/conversations/:id deletes thread and cascades messages');

    // Verify thread is gone
    const verifyGoneRes = await fetch(`${baseUrl}/conversations/${threadId}`, { headers: authHeadersA });
    assert(verifyGoneRes.status === 404, 'Deleted conversation returns 404');

    console.log('\n====================================================');
    console.log(`ALL ${passedTests}/${totalTests} PHASE 2.2 TESTS PASSED CLEANLY!`);
    console.log('====================================================\n');
  } finally {
    server.close();
  }
}

runPhase2_2Tests().catch((err) => {
  console.error('Phase 2.2 Test Suite Failed:', err);
  process.exit(1);
});
