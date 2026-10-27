/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDatabase, customerRepo, sessionRepo, accountRepo, statementRepo, categoryRepo, transactionRepo, chatRepo } from '../src/server/db/database.ts';
import { generateSalt, hashPassword, verifyPassword, generateSessionToken, hashToken, generateTransactionChecksum } from '../src/server/auth/crypto.ts';

async function runFoundationTests() {
  console.log('====================================================');
  console.log('VIVPAY PHASE 2.1: FOUNDATION VERIFICATION TEST SUITE');
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

  // 1. Database & Migrations
  const db = getDatabase();
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name;
  `).all() as { name: string }[];

  const tableNames = tables.map(t => t.name);
  console.log('Tables created in database:', tableNames.join(', '));

  assert(tableNames.includes('customers'), 'Table "customers" exists');
  assert(tableNames.includes('sessions'), 'Table "sessions" exists');
  assert(tableNames.includes('accounts'), 'Table "accounts" exists');
  assert(tableNames.includes('statement_documents'), 'Table "statement_documents" exists');
  assert(tableNames.includes('transactions'), 'Table "transactions" exists');
  assert(tableNames.includes('transaction_categories'), 'Table "transaction_categories" exists');
  assert(tableNames.includes('conversation_threads'), 'Table "conversation_threads" exists');
  assert(tableNames.includes('chat_messages'), 'Table "chat_messages" exists');

  // 2. System categories seeded
  const categories = categoryRepo.list();
  assert(categories.length >= 10, `System categories seeded (found ${categories.length})`);
  assert(categories.some(c => c.slug === 'income'), 'Category "income" exists');

  // 3. User Registration & Password Hashing
  const saltA = generateSalt();
  const hashA = hashPassword('AliceStrongPassword!2026', saltA);
  assert(verifyPassword('AliceStrongPassword!2026', saltA, hashA), 'Password verification succeeds for correct password');
  assert(!verifyPassword('WrongPassword123', saltA, hashA), 'Password verification fails for wrong password');

  const testId = Date.now();
  const aliceEmail = `alice_${testId}@vivpay.com`;
  const bobEmail = `bob_${testId}@vivpay.com`;

  const alice = customerRepo.create({
    email: aliceEmail,
    passwordHash: hashA,
    salt: saltA,
    fullName: 'Alice Johnson',
    currency: 'USD',
  });
  assert(alice.email === aliceEmail, 'Alice registered successfully');

  // 4. Duplicate Registration Prevention
  let duplicatePrevented = false;
  try {
    customerRepo.create({
      email: aliceEmail,
      passwordHash: 'dummy',
      salt: 'dummy',
      fullName: 'Alice Duplicate',
    });
  } catch (err) {
    duplicatePrevented = true;
  }
  assert(duplicatePrevented, 'Duplicate email registration rejected by database UNIQUE constraint');

  // Register Bob
  const saltB = generateSalt();
  const hashB = hashPassword('BobStrongPassword!2026', saltB);
  const bob = customerRepo.create({
    email: bobEmail,
    passwordHash: hashB,
    salt: saltB,
    fullName: 'Bob Smith',
    currency: 'USD',
  });
  assert(bob.email === bobEmail, 'Bob registered successfully');

  // 5. Session Token Lifecycle
  const aliceToken = generateSessionToken();
  const aliceTokenHash = hashToken(aliceToken);
  const aliceSession = sessionRepo.create(alice.id, aliceTokenHash, 7, 'TestBrowser/1.0');
  assert(aliceSession.customerId === alice.id, 'Alice session created');

  const retrievedSession = sessionRepo.findByTokenHash(aliceTokenHash);
  assert(retrievedSession !== null && retrievedSession.customerId === alice.id, 'Session lookup by token hash succeeds');

  const invalidSession = sessionRepo.findByTokenHash('non_existent_hash');
  assert(invalidSession === null, 'Lookup of non-existent token hash returns null');

  // 6. Foreign Key Constraint Enforcement
  let fkBlocked = false;
  try {
    accountRepo.create('non_existent_customer_id_9999', {
      accountName: 'Ghost Account',
      accountNumberMasked: '•••• 0000',
      accountType: 'checking',
      institutionName: 'Ghost Bank',
    });
  } catch (err) {
    fkBlocked = true;
  }
  assert(fkBlocked, 'Foreign key constraint prevents creating account for non-existent customer');

  // 7. Customer Data Isolation
  const aliceAccount = accountRepo.create(alice.id, {
    accountName: "Alice Primary Checking",
    accountNumberMasked: '•••• 1234',
    accountType: 'checking',
    institutionName: 'JPMorgan Chase',
    initialBalance: 5400.0,
  });

  const bobAccount = accountRepo.create(bob.id, {
    accountName: "Bob Business Checking",
    accountNumberMasked: '•••• 9876',
    accountType: 'checking',
    institutionName: 'Bank of America',
    initialBalance: 12000.0,
  });

  const aliceAccounts = accountRepo.listByCustomer(alice.id);
  assert(aliceAccounts.length === 1 && aliceAccounts[0].id === aliceAccount.id, "Alice can list her own accounts");

  const bobAccounts = accountRepo.listByCustomer(bob.id);
  assert(bobAccounts.length === 1 && bobAccounts[0].id === bobAccount.id, "Bob can list his own accounts");

  // Bob attempts to query Alice's account directly
  const crossCustomerRead = accountRepo.findByIdAndCustomer(aliceAccount.id, bob.id);
  assert(crossCustomerRead === null, "Bob cannot read Alice's account (isolated customer boundary)");

  // Bob attempts to delete Alice's account
  const crossCustomerDelete = accountRepo.delete(aliceAccount.id, bob.id);
  assert(crossCustomerDelete === false, "Bob cannot delete Alice's account");

  // 8. Statement Document & Transaction Deduplication Checksum Logic
  const statement = statementRepo.create(alice.id, {
    accountId: aliceAccount.id,
    fileName: 'statement_oct_2026.csv',
    originalName: 'Chase_October_2026.csv',
    fileSizeBytes: 2048,
    mimeType: 'text/csv',
    checksum: 'mock_sha256_checksum_oct_2026',
    rawTextPreview: 'Date,Description,Amount,Type\n2026-10-01,Starbucks,6.75,debit',
  });
  assert(statement.processingStatus === 'uploaded', 'Statement document created with status "uploaded"');

  const otherCategoryId = categoryRepo.getDefaultCategoryId();
  const tx1 = transactionRepo.create({
    customerId: alice.id,
    accountId: aliceAccount.id,
    statementId: statement.id,
    date: '2026-10-01',
    description: 'Starbucks Coffee Downtown',
    amount: 6.75,
    type: 'debit',
    categoryId: otherCategoryId,
  });
  assert(tx1.amount === 6.75, "Transaction created for Alice");

  // Import batch with identical transaction (deduplication test)
  const batchResult = transactionRepo.createManyWithDeduplication(alice.id, aliceAccount.id, statement.id, [
    {
      date: '2026-10-01',
      description: 'Starbucks Coffee Downtown',
      amount: 6.75,
      type: 'debit',
      categoryId: otherCategoryId,
    },
    {
      date: '2026-10-02',
      description: 'Whole Foods Market',
      amount: 84.50,
      type: 'debit',
      categoryId: otherCategoryId,
    },
  ]);

  assert(batchResult.imported === 1, "Only non-duplicate transaction was imported");
  assert(batchResult.duplicates === 1, "Duplicate transaction was detected and skipped");

  // Verify Alice has 2 transactions total and Bob has 0
  const aliceTxList = transactionRepo.listByCustomer(alice.id);
  const bobTxList = transactionRepo.listByCustomer(bob.id);
  assert(aliceTxList.totalCount === 2, "Alice has exactly 2 transactions");
  assert(bobTxList.totalCount === 0, "Bob has 0 transactions (strict customer isolation)");

  // 9. Chat Thread & Message Customer Isolation
  const thread = chatRepo.createThread(alice.id, 'Budget Consultation');
  chatRepo.addMessage(alice.id, thread.id, 'user', 'What was my Starbucks spend?');
  chatRepo.addMessage(alice.id, thread.id, 'assistant', 'You spent $6.75 at Starbucks on October 1st.');

  const aliceMessages = chatRepo.listMessagesByThread(thread.id, alice.id);
  assert(aliceMessages.length === 2, "Alice can access her chat conversation history");

  const bobMessages = chatRepo.listMessagesByThread(thread.id, bob.id);
  assert(bobMessages.length === 0, "Bob cannot access Alice's chat messages");

  console.log('\n====================================================');
  console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runFoundationTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
