/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import { groupsStore } from '../src/lib/groups/store.ts';
import {
  sanitizeMemberSnapshot,
  buildPrivacyPreservingGroupAIPromptContext,
  RawMemberFinancialData,
} from '../src/lib/groups/privacy.ts';
import { calculateGroupSettlements } from '../src/lib/groups/settlement.ts';
import { GroupMember, SharedExpense } from '../src/lib/groups/types.ts';

async function runGroupsPrivacySettlementsAudit() {
  console.log('================================================================');
  console.log('    PHASE 4 AUDIT: GROUPS, PRIVACY & SETTLEMENTS VERIFICATION   ');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Verification of All 4 Visibility Tiers & Privacy Firewall
  // --------------------------------------------------------------------------
  console.log('[TEST 1] Verifying Strict Visibility Tiers Enforcement (Full, Category-Only, Total-Only, Hidden)...');

  const rawTestData: RawMemberFinancialData = {
    monthlyTotalSpending: 45000,
    monthlyIncome: 120000,
    savingsRate: 62.5,
    categoryBreakdown: [
      { category: 'Food & Dining', amount: 12000, percentage: 26.7 },
      { category: 'Utilities', amount: 5000, percentage: 11.1 },
      { category: 'Shopping', amount: 28000, percentage: 62.2 },
    ],
    transactions: [
      {
        id: 'tx-secret-1',
        date: '2026-10-02',
        description: 'Discreet Medical Purchase Clinic',
        originalDescription: 'POS/DR_SECRET_CLINIC/MUMBAI',
        amount: 3500,
        debit: 3500,
        credit: 0,
        balance: null,
        reference: 'UTR998877',
        merchant: 'Private Clinic',
        upiHandle: null,
        paymentMethod: 'card',
        category: 'Medical',
        direction: 'debit',
        confidence: 1.0,
        reviewRequired: false,
        sourceFile: 'private.xlsx',
        sourceSheet: 'Sheet1',
        sourceRow: 1,
      },
    ],
  };

  const memberBase: GroupMember = {
    customerId: 'user-charlie-003',
    fullName: 'Charlie Davis',
    email: 'charlie@example.com',
    role: 'member',
    visibility: 'hidden',
    joinedAt: '2026-10-01T00:00:00Z',
  };

  const requestingPeerId = 'user-alice-peer-001';

  // Tier 1: 'hidden'
  const snapHidden = sanitizeMemberSnapshot(
    { ...memberBase, visibility: 'hidden' },
    rawTestData,
    requestingPeerId
  );
  console.log(`  [Tier: HIDDEN] -> Total: ${snapHidden.monthlyTotalSpending}, Cats: ${snapHidden.categoryBreakdown}, Txs: ${snapHidden.transactions}`);
  assert.strictEqual(snapHidden.monthlyTotalSpending, null, 'Hidden tier must mask total spend');
  assert.strictEqual(snapHidden.categoryBreakdown, null, 'Hidden tier must mask category breakdown');
  assert.strictEqual(snapHidden.transactions, null, 'Hidden tier must mask transactions');
  assert.strictEqual(snapHidden.isMasked, true, 'Hidden tier isMasked must be true');

  // Tier 2: 'total_only'
  const snapTotalOnly = sanitizeMemberSnapshot(
    { ...memberBase, visibility: 'total_only' },
    rawTestData,
    requestingPeerId
  );
  console.log(`  [Tier: TOTAL_ONLY] -> Total: ₹${snapTotalOnly.monthlyTotalSpending}, Cats: ${snapTotalOnly.categoryBreakdown}, Txs: ${snapTotalOnly.transactions}`);
  assert.strictEqual(snapTotalOnly.monthlyTotalSpending, 45000, 'Total-only tier must reveal total spend');
  assert.strictEqual(snapTotalOnly.categoryBreakdown, null, 'Total-only tier must mask categories');
  assert.strictEqual(snapTotalOnly.transactions, null, 'Total-only tier must mask transactions');

  // Tier 3: 'category_only'
  const snapCategoryOnly = sanitizeMemberSnapshot(
    { ...memberBase, visibility: 'category_only' },
    rawTestData,
    requestingPeerId
  );
  console.log(`  [Tier: CATEGORY_ONLY] -> Total: ₹${snapCategoryOnly.monthlyTotalSpending}, Cats Count: ${snapCategoryOnly.categoryBreakdown?.length}, Txs: ${snapCategoryOnly.transactions}`);
  assert.strictEqual(snapCategoryOnly.monthlyTotalSpending, 45000, 'Category-only must reveal total spend');
  assert(snapCategoryOnly.categoryBreakdown && snapCategoryOnly.categoryBreakdown.length === 3, 'Category-only must reveal categories');
  assert.strictEqual(snapCategoryOnly.transactions, null, 'Category-only tier must STRICTLY mask individual transactions and descriptions');

  // Tier 4: 'full'
  const snapFull = sanitizeMemberSnapshot(
    { ...memberBase, visibility: 'full' },
    rawTestData,
    requestingPeerId
  );
  console.log(`  [Tier: FULL] -> Total: ₹${snapFull.monthlyTotalSpending}, Cats Count: ${snapFull.categoryBreakdown?.length}, Txs Count: ${snapFull.transactions?.length}`);
  assert.strictEqual(snapFull.monthlyTotalSpending, 45000);
  assert(snapFull.categoryBreakdown !== null);
  assert(snapFull.transactions !== null && snapFull.transactions.length === 1);

  // Self-view exception: Charlie looking at Charlie's own snapshot
  const snapSelf = sanitizeMemberSnapshot(
    { ...memberBase, visibility: 'hidden' }, // Even if Charlie set visibility to hidden for peers
    rawTestData,
    memberBase.customerId // Charlie himself
  );
  assert.strictEqual(snapSelf.monthlyTotalSpending, 45000, 'User viewing their own data must never be redacted');
  assert(snapSelf.transactions !== null, 'User viewing their own data sees full transactions');

  // AI Prompt Context Sanitization
  const aiPrompt = buildPrivacyPreservingGroupAIPromptContext([snapHidden, snapTotalOnly, snapCategoryOnly]);
  assert(!aiPrompt.includes('Discreet Medical Purchase'), 'AI Prompt MUST NOT contain private transaction description of hidden/masked members');
  assert(!aiPrompt.includes('UTR998877'), 'AI Prompt MUST NOT leak reference numbers or UTRs');
  console.log('  -> PASS: All 4 visibility tiers strictly enforced before snapshots, server responses, and AI prompts.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Authorization, Member Removal, and Unauthorized Group Access
  // --------------------------------------------------------------------------
  console.log('[TEST 2] Verifying Server-Side Authorization & Member Removal...');
  const adminId = 'user-admin-001';
  const newGroup = groupsStore.createGroup(
    adminId,
    'Admin User',
    'admin@example.com',
    'Goa Trip 2026',
    'Shared villa and vehicle expenses'
  );

  // Add member Dave
  const daveId = 'user-dave-004';
  groupsStore.addMember(newGroup.id, adminId, {
    customerId: daveId,
    fullName: 'Dave Miller',
    email: 'dave@example.com',
    visibility: 'category_only',
  });

  // Verify Dave can access snapshot
  const daveSnap = groupsStore.getGroupSnapshot(newGroup.id, daveId);
  assert.strictEqual(daveSnap.groupId, newGroup.id, 'Dave as an active member can view snapshot');

  // Verify non-member Eve is strictly rejected
  const eveId = 'user-eve-intruder-009';
  assert.throws(
    () => {
      groupsStore.getGroupSnapshot(newGroup.id, eveId);
    },
    /Forbidden|not authorized/,
    'Unauthorized non-member Eve MUST be rejected with Forbidden'
  );
  console.log('  - Unauthorized non-member access: Correctly blocked with 403 Forbidden.');

  // Remove Dave
  groupsStore.removeMember(newGroup.id, adminId, daveId);
  // Verify Dave is now blocked immediately
  assert.throws(
    () => {
      groupsStore.getGroupSnapshot(newGroup.id, daveId);
    },
    /Forbidden|not authorized/,
    'Removed member Dave MUST immediately lose access to group snapshot'
  );
  console.log('  - Removed member access: Correctly revoked immediately.');
  console.log('  -> PASS: Authorization and access revocation verified.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Settlement Calculations & Mathematical Conservation Invariant
  // --------------------------------------------------------------------------
  console.log('[TEST 3] Verifying Debt Minimization Settlement Calculations & Conservation Invariant...');
  const members: GroupMember[] = [
    { customerId: 'p1', fullName: 'Alice', email: 'alice@test.com', role: 'admin', visibility: 'full', joinedAt: '' },
    { customerId: 'p2', fullName: 'Bob', email: 'bob@test.com', role: 'member', visibility: 'full', joinedAt: '' },
    { customerId: 'p3', fullName: 'Charlie', email: 'charlie@test.com', role: 'member', visibility: 'full', joinedAt: '' },
  ];

  // Shared expenses:
  // 1. Alice pays ₹6,000 for Villa (Split equal: ₹2,000 each)
  // 2. Bob pays ₹3,000 for Groceries (Split equal: ₹1,000 each)
  // 3. Charlie pays ₹900 for Tolls (Split equal: ₹300 each)
  // Expected Net Balances:
  // Alice: Paid ₹6,000, Owed (2000 + 1000 + 300 = ₹3,300) -> Net: +₹2,700 (Creditor)
  // Bob:   Paid ₹3,000, Owed (2000 + 1000 + 300 = ₹3,300) -> Net: -₹300   (Debtor)
  // Charlie: Paid ₹900, Owed (2000 + 1000 + 300 = ₹3,300) -> Net: -₹2,400 (Debtor)
  // Zero-Sum: +2700 - 300 - 2400 === 0.00!
  // Minimal Transfers:
  // Bob pays Alice ₹300.
  // Charlie pays Alice ₹2,400.
  // Total transferred: ₹2,700 === total positive credit (+₹2,700). Zero double counting.
  const expenses: SharedExpense[] = [
    {
      id: 'e1',
      groupId: 'g-test',
      title: 'Villa Stay',
      amount: 6000,
      paidBy: 'p1',
      splitType: 'equal',
      splits: [
        { customerId: 'p1', amount: 2000 },
        { customerId: 'p2', amount: 2000 },
        { customerId: 'p3', amount: 2000 },
      ],
      date: '2026-10-01',
      category: 'Housing',
      isSettled: false,
      createdAt: '',
    },
    {
      id: 'e2',
      groupId: 'g-test',
      title: 'Groceries',
      amount: 3000,
      paidBy: 'p2',
      splitType: 'equal',
      splits: [
        { customerId: 'p1', amount: 1000 },
        { customerId: 'p2', amount: 1000 },
        { customerId: 'p3', amount: 1000 },
      ],
      date: '2026-10-02',
      category: 'Groceries',
      isSettled: false,
      createdAt: '',
    },
    {
      id: 'e3',
      groupId: 'g-test',
      title: 'Tolls',
      amount: 900,
      paidBy: 'p3',
      splitType: 'equal',
      splits: [
        { customerId: 'p1', amount: 300 },
        { customerId: 'p2', amount: 300 },
        { customerId: 'p3', amount: 300 },
      ],
      date: '2026-10-03',
      category: 'Transport',
      isSettled: false,
      createdAt: '',
    },
  ];

  const settlement = calculateGroupSettlements(expenses, members);

  console.log(`  - Total Shared Expenses: ₹${settlement.totalGroupSpend}`);
  console.log(`  - Net Balances:`, settlement.netBalances);
  console.log(`  - Transfers:`, settlement.transfers);
  console.log(`  - Total Transferred Amount: ₹${settlement.totalTransferredAmount}`);
  console.log(`  - Invariant Conserved: ${settlement.isConserved}`);

  assert.strictEqual(settlement.netBalances['p1'], 2700, 'Alice net balance must be +₹2,700');
  assert.strictEqual(settlement.netBalances['p2'], -300, 'Bob net balance must be -₹300');
  assert.strictEqual(settlement.netBalances['p3'], -2400, 'Charlie net balance must be -₹2,400');

  assert.strictEqual(settlement.transfers.length, 2, 'Debt minimization must generate exactly 2 transfers');
  assert.strictEqual(settlement.totalTransferredAmount, 2700, 'Transferred amount must conserve exact credit of ₹2,700');
  assert.strictEqual(settlement.isConserved, true, 'Conservation invariant must be true');
  console.log('  -> PASS: Mathematical zero-sum balance and debt minimization verified.\n');

  console.log('================================================================');
  console.log(' ALL GROUPS, PRIVACY & SETTLEMENTS VERIFICATION CHECKS PASSED   ');
  console.log('================================================================');
}

runGroupsPrivacySettlementsAudit().catch((err) => {
  console.error('Groups Audit failed with error:', err);
  process.exit(1);
});
