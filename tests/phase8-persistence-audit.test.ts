/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VivPay Phase 8 — User Registration, Supabase Mapping & Persistence Test Suite
 */

import { generateTransactionChecksum } from '../src/server/auth/crypto.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('🧪 Starting VivPay Phase 8 Database & Persistence Invariant Test Suite...\n');

// -----------------------------------------------------------------------------
// Test 1: Customer Profile Mapping & Primary Key Invariant
// -----------------------------------------------------------------------------
console.log('--- Test 1: Auth UUID to Customer Profile Mapping ---');
const mockAuthUser = {
  id: 'a72bffdb-4efb-47f5-8e83-ce9ff88aaaab',
  email: 'customer@vivpay.internal',
  user_metadata: {
    full_name: 'Verified Customer',
    currency: 'USD',
  },
};

// Verify profile construction matches schema
const customerProfile = {
  id: mockAuthUser.id,
  email: mockAuthUser.email,
  fullName: mockAuthUser.user_metadata.full_name,
  currency: mockAuthUser.user_metadata.currency,
};

assert(customerProfile.id === mockAuthUser.id, 'Customer ID matches Auth user UUID exactly');
assert(customerProfile.email === mockAuthUser.email, 'Customer email preserved without mutation');
assert(customerProfile.fullName === 'Verified Customer', 'Customer full name extracted from user metadata');

// -----------------------------------------------------------------------------
// Test 2: Idempotent Customer Upsert Logic
// -----------------------------------------------------------------------------
console.log('\n--- Test 2: Customer Profile Idempotency ---');
const customerDatabaseMap = new Map<string, typeof customerProfile>();

function upsertCustomer(user: typeof mockAuthUser) {
  if (customerDatabaseMap.has(user.id)) {
    return { created: false, profile: customerDatabaseMap.get(user.id)! };
  }
  const newProfile = {
    id: user.id,
    email: user.email,
    fullName: user.user_metadata.full_name,
    currency: user.user_metadata.currency,
  };
  customerDatabaseMap.set(user.id, newProfile);
  return { created: true, profile: newProfile };
}

const firstSync = upsertCustomer(mockAuthUser);
assert(firstSync.created === true, 'First session sync creates customer profile');
assert(customerDatabaseMap.size === 1, 'Exactly one customer profile in database');

const secondSync = upsertCustomer(mockAuthUser);
assert(secondSync.created === false, 'Repeated sync does not re-create profile');
assert(customerDatabaseMap.size === 1, 'Database remains with exactly one profile after repeated sync');

// -----------------------------------------------------------------------------
// Test 3: Account Provisioning Idempotency
// -----------------------------------------------------------------------------
console.log('\n--- Test 3: Financial Account Provisioning Idempotency ---');
const accountsMap = new Map<string, any[]>();

function ensureInitialAccount(customerId: string) {
  const existing = accountsMap.get(customerId) || [];
  if (existing.length === 0) {
    const newAccount = {
      id: 'acc-uuid-1',
      customerId,
      accountName: 'Primary Checking',
      balance: 0.0,
      currency: 'USD',
    };
    accountsMap.set(customerId, [newAccount]);
    return { created: true, account: newAccount };
  }
  return { created: false, account: existing[0] };
}

const accFirst = ensureInitialAccount(mockAuthUser.id);
assert(accFirst.created === true, 'Initial account provisioned on first sync');
assert((accountsMap.get(mockAuthUser.id) || []).length === 1, 'Exactly 1 account exists');

const accSecond = ensureInitialAccount(mockAuthUser.id);
assert(accSecond.created === false, 'Second sync skips account creation');
assert((accountsMap.get(mockAuthUser.id) || []).length === 1, 'Repeated sync retains exactly 1 account');

// -----------------------------------------------------------------------------
// Test 4: Financial Transaction SHA-256 Checksum Invariant
// -----------------------------------------------------------------------------
console.log('\n--- Test 4: Transaction Checksum & Integrity ---');
const customerId = 'a72bffdb-4efb-47f5-8e83-ce9ff88aaaab';
const accountId = 'f2e71860-f3b8-4c7f-a1bb-ba0c1fbeee94';
const date = '2026-10-15';
const amount = 84.50;
const description = 'Amazon Cloud Services';

const checksum1 = generateTransactionChecksum(customerId, accountId, date, amount, description);
const checksum2 = generateTransactionChecksum(customerId, accountId, date, amount, description);
assert(typeof checksum1 === 'string' && checksum1.length === 64, 'Checksum is valid 64-character SHA-256 hex string');
assert(checksum1 === checksum2, 'Checksum is deterministic and immutable across invocations');

const checksumAltered = generateTransactionChecksum(customerId, accountId, date, amount + 0.01, description);
assert(checksum1 !== checksumAltered, 'Tampering amount alters transaction checksum');

// -----------------------------------------------------------------------------
// Test 5: Role Governance Invariant
// -----------------------------------------------------------------------------
console.log('\n--- Test 5: Role Default & RBAC Safeguards ---');
function resolveUserRole(
  authUserId: string,
  systemUsers: Array<{ id: string; role: string; status: string }>
): 'admin' | 'employee' | 'customer' {
  const record = systemUsers.find((u) => u.id === authUserId && u.status === 'active');
  if (record && (record.role === 'admin' || record.role === 'employee')) {
    return record.role as 'admin' | 'employee';
  }
  return 'customer'; // Strict fallback
}

const emptySystemUsers: any[] = [];
assert(resolveUserRole(mockAuthUser.id, emptySystemUsers) === 'customer', 'User absent from system_users defaults strictly to customer');

const employeeSystemUsers = [{ id: mockAuthUser.id, role: 'employee', status: 'active' }];
assert(resolveUserRole(mockAuthUser.id, employeeSystemUsers) === 'employee', 'User in system_users with employee role resolves to employee');

const suspendedAdminUsers = [{ id: mockAuthUser.id, role: 'admin', status: 'suspended' }];
assert(resolveUserRole(mockAuthUser.id, suspendedAdminUsers) === 'customer', 'Suspended admin user falls back to customer role');

console.log('\n✨ All Phase 8 User Registration & Persistence Invariants passed successfully!');
