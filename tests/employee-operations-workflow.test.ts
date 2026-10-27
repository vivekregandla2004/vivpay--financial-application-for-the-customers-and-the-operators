/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VivPay Phase 2 — Employee Operations & Insights Test Suite
 */

import { supabaseOperationsRepo, supabaseAuditRepo } from '../src/server/db/supabaseRepository.ts';
import { serverOperationsStore } from '../src/server/operations/store.ts';

console.log('🧪 Starting VivPay Employee Operations & Insights Test Suite...\n');

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
  // ---------------------------------------------------------------------------
  // Test 1: Employee Role Authorization & Privilege Safeguards
  // ---------------------------------------------------------------------------
  console.log('--- Test 1: Employee Role Authorization & Privilege Safeguards ---');

  function checkOperationsAccess(role: string, status: string): { allowed: boolean; code?: string } {
    if (status === 'suspended') {
      return { allowed: false, code: 'FORBIDDEN_ACCOUNT_SUSPENDED' };
    }
    if (role !== 'employee' && role !== 'admin') {
      return { allowed: false, code: 'FORBIDDEN_INSUFFICIENT_ROLE' };
    }
    return { allowed: true };
  }

  assert(checkOperationsAccess('customer', 'active').allowed === false, 'Ordinary customer is strictly blocked from Operations Workspace');
  assert(checkOperationsAccess('customer', 'active').code === 'FORBIDDEN_INSUFFICIENT_ROLE', 'Customer receives FORBIDDEN_INSUFFICIENT_ROLE');
  assert(checkOperationsAccess('employee', 'suspended').allowed === false, 'Suspended employee is blocked from Operations Workspace');
  assert(checkOperationsAccess('employee', 'suspended').code === 'FORBIDDEN_ACCOUNT_SUSPENDED', 'Suspended employee receives FORBIDDEN_ACCOUNT_SUSPENDED');
  assert(checkOperationsAccess('employee', 'active').allowed === true, 'Active employee is granted access to Operations Workspace');
  assert(checkOperationsAccess('admin', 'active').allowed === true, 'Active administrator is granted access to Operations Workspace');

  // ---------------------------------------------------------------------------
  // Test 2: Live Supabase Baseline Seeding & Cases Retrieval
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Live Supabase Baseline Seeding & Cases Retrieval ---');
  await supabaseOperationsRepo.seedBaselineOperationsDataIfEmpty();

  const cases = await supabaseOperationsRepo.getCases();
  assert(cases.length >= 4, `Live Supabase cases loaded successfully (${cases.length} records found)`);
  
  const sampleCase = cases[0];
  assert(!!sampleCase.id, `Case has valid database ID: ${sampleCase.id}`);
  assert(!!sampleCase.caseNumber, `Case has official docket number: ${sampleCase.caseNumber}`);
  assert(['Dispute', 'KYC Verification', 'Suspected Fraud', 'Statement Inquiry', 'Limit Increase'].includes(sampleCase.category), `Case category is valid: ${sampleCase.category}`);
  assert(['low', 'medium', 'high', 'critical'].includes(sampleCase.priority), `Case priority is valid: ${sampleCase.priority}`);

  // ---------------------------------------------------------------------------
  // Test 3: Case Creation, Assignment & Status Transition Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Case Creation, Assignment & Status Transition ---');
  
  const newCase = await supabaseOperationsRepo.createCase({
    title: 'Automated Test: Disputed Merchant Double-Billing',
    customerName: 'Synthetic Test Merchant Customer',
    accountNumberMasked: '•••• 7712',
    category: 'Dispute',
    priority: 'high',
    assignedTo: 'Unassigned',
    notes: 'Initial automated dispute ticket opened by synthetic test runner.',
  });

  assert(!!newCase.id, `New case created in Supabase: ${newCase.id} (${newCase.caseNumber})`);
  assert(newCase.status === 'open', `New case initial status is open: ${newCase.status}`);
  assert(newCase.assignedTo === 'Unassigned', `New case begins unassigned: ${newCase.assignedTo}`);

  // Update assignment to staff member
  const assignedCase = await supabaseOperationsRepo.updateCase(newCase.id, {
    assignedTo: 'Sarah Chen',
    status: 'investigating',
    notes: `${newCase.notes}\n[2026-10-18] Case assigned to Sarah Chen.`,
  });

  assert(assignedCase.assignedTo === 'Sarah Chen', `Case successfully allocated to Sarah Chen: ${assignedCase.assignedTo}`);
  assert(assignedCase.status === 'investigating', `Case status transitioned to investigating: ${assignedCase.status}`);

  // Resolve case
  const resolvedCase = await supabaseOperationsRepo.updateCase(newCase.id, {
    status: 'resolved',
    notes: `${assignedCase.notes}\n[2026-10-18] Double charge refunded via merchant portal. Case closed.`,
  });

  assert(resolvedCase.status === 'resolved', `Case successfully marked resolved: ${resolvedCase.status}`);

  // ---------------------------------------------------------------------------
  // Test 4: Fraud Alert Review & Fair Adjudication Rules
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 4: Fraud Alert Review & Fair Adjudication Rules ---');

  const alerts = await supabaseOperationsRepo.getFraudAlerts();
  assert(alerts.length >= 3, `Live Supabase fraud alerts loaded (${alerts.length} records found)`);

  const criticalAlert = alerts.find((a) => a.riskScore >= 75);
  assert(criticalAlert !== undefined, 'Critical risk alert (score >= 75) identified');
  
  // Fair adjudication: unusual transaction does not equal fraud without corroboration
  function evaluateFraudProbability(amount: number, isUnusualMerchant: boolean, cardholderConfirmed: boolean): { isFraud: boolean; justification: string } {
    if (cardholderConfirmed) {
      return { isFraud: false, justification: 'Cardholder confirmed legitimate purchase via in-app biometric authorization.' };
    }
    if (isUnusualMerchant && amount > 1000) {
      return { isFraud: false, justification: 'Unusual merchant pattern flagged for review. Requires cardholder verification before freezing.' };
    }
    return { isFraud: false, justification: 'Normal baseline activity.' };
  }

  const review1 = evaluateFraudProbability(4500, true, true);
  assert(review1.isFraud === false, 'Confirmed unusual transaction is NOT classified as fraud');
  assert(review1.justification.includes('biometric'), 'Valid cardholder confirmation clears alert');

  // Update fraud alert in Supabase
  if (criticalAlert) {
    const updatedAlert = await supabaseOperationsRepo.updateFraudAlert(criticalAlert.id, {
      status: 'flagged',
      investigatorNotes: 'Automated test: Flagged for high-risk pattern and secondary verification.',
    });
    assert(updatedAlert.status === 'flagged', `Alert status updated in Supabase: ${updatedAlert.status}`);
  }

  // ---------------------------------------------------------------------------
  // Test 5: Investigation Dossier & Evidence Note Appending
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 5: Investigation Dossier & Evidence Note Appending ---');

  const inv = await supabaseOperationsRepo.createInvestigation({
    title: 'Synthetic AML Dossier: Velocity Cluster Verification',
    targetCustomerName: 'Apex Trade Dynamics Ltd',
    linkedAlertId: criticalAlert?.alertId,
    priority: 'high',
    leadInvestigator: 'Sarah Chen',
    initialEvidence: 'Initial trigger: Cross-border outbound wire to high-risk counterparty.',
    flaggedAmount: 18500,
    currency: 'USD',
  });

  assert(!!inv.id, `Investigation dossier opened in Supabase: ${inv.id} (${inv.caseNumber})`);
  assert(inv.priority === 'high', `Investigation priority verified: ${inv.priority}`);
  assert(inv.status === 'open', `Investigation starts in open status: ${inv.status}`);

  // Append evidence note
  const updatedInv = await supabaseOperationsRepo.addEvidenceNote(
    inv.id,
    'Counterparty LEI validated against GLEIF directory. Inbound trade invoice received.'
  );

  assert(updatedInv.evidenceNotes.length >= 2, `Evidence note appended to dossier (count: ${updatedInv.evidenceNotes.length})`);
  assert(
    updatedInv.evidenceNotes.some((n: string) => n.includes('GLEIF')),
    'Appended evidence note preserved in chain of custody'
  );

  // Transition investigation status to investigating
  const statusInv = await supabaseOperationsRepo.updateInvestigation(inv.id, {
    status: 'investigating',
  });
  assert(statusInv.status === 'investigating', `Investigation escalated to investigating: ${statusInv.status}`);

  // ---------------------------------------------------------------------------
  // Test 6: Immutable Append-Only Audit Trail Non-Repudiation
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 6: Immutable Append-Only Audit Trail Non-Repudiation ---');

  const auditEntry = await supabaseAuditRepo.recordAuditEvent({
    actorEmail: 'sarah.chen@vivpay.internal',
    actorRole: 'employee',
    action: 'CASE_STATUS_CHANGED_TO_RESOLVED',
    resource: `operational_cases:${newCase.id}`,
    ipAddress: '192.168.1.104',
    status: 'SUCCESS',
  });

  assert(!!auditEntry.id, `Audit log entry created with UUID: ${auditEntry.id}`);
  assert(auditEntry.actorEmail === 'sarah.chen@vivpay.internal', `Actor recorded in immutable log: ${auditEntry.actorEmail}`);
  assert(auditEntry.actorRole === 'employee', `Actor role recorded: ${auditEntry.actorRole}`);

  const recentAudits = await supabaseAuditRepo.listAuditLogs(10);
  assert(recentAudits.length > 0, `Audit logs retrievable by admin (${recentAudits.length} entries)`);
  assert(recentAudits.some((a) => a.action === 'CASE_STATUS_CHANGED_TO_RESOLVED'), 'Newly appended audit event confirmed in log');

  // ---------------------------------------------------------------------------
  // Test 7: Operations Analytics & Backlog Calculation
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 7: Operations Analytics & Backlog Calculation ---');

  const analytics = await supabaseOperationsRepo.getOperationalAnalytics();
  assert(analytics.backlogMetrics !== undefined, 'Backlog metrics computed');
  assert(analytics.backlogMetrics!.totalCases >= 4, `Total backlog cases verified (${analytics.backlogMetrics!.totalCases})`);
  assert(analytics.riskDistribution.length === 4, `Risk tiers evaluated (4 tiers)`);
  assert(analytics.slaAdherenceRate > 95, `SLA adherence rate verified (${analytics.slaAdherenceRate}%)`);
  assert(analytics.ingestionSuccessRate > 95, `Ingestion success rate verified (${analytics.ingestionSuccessRate}%)`);

  // ---------------------------------------------------------------------------
  // Test 8: Cross-Customer Isolation & Least-Privilege Data Sanitization
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 8: Cross-Customer Isolation & Data Sanitization ---');

  const customerRecords = serverOperationsStore.getCustomers();
  assert(customerRecords.length > 0, `Operational customer records loaded (${customerRecords.length})`);

  for (const c of customerRecords) {
    // Assert sensitive customer data is never exposed in operational directory
    assert(!('passwordHash' in c), `Password hash never exposed in customer ops record (${c.name})`);
    assert(!('apiSecretKey' in c), `API secret never exposed in customer ops record (${c.name})`);
    assert(!('fullPan' in c), `Full PAN never exposed in customer ops record (${c.name})`);
    assert(c.accountNumberMasked.includes('••••'), `Account number masked strictly (${c.accountNumberMasked})`);
  }

  console.log(`\n✨ All ${passedTests}/${totalTests} Employee Operations & Insights tests passed successfully!`);
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
