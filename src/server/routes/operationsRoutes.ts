/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response } from 'express';
import { serverOperationsStore } from '../operations/store.ts';
import { supabaseOperationsRepo, supabaseAuditRepo } from '../db/supabaseRepository.ts';
import { queryOpsKnowledge } from '../../lib/operations/knowledge.ts';
import { requireEmployeeOrAdminAuth, AuthenticatedRequest } from '../auth/middleware.ts';
import { CaseRecord, FraudAlert } from '../../types/operations.ts';

export const operationsRouter = Router();

// Enforce Employee or Admin authorization across operations endpoints
operationsRouter.use(requireEmployeeOrAdminAuth);

// Helper for extracting actor information
function getActorMeta(req: AuthenticatedRequest) {
  const actorEmail = req.customer?.email || req.systemUser?.email || 'staff.ops@vivpay.internal';
  const actorRole = (req.userRole === 'admin' ? 'admin' : 'employee') as 'admin' | 'employee';
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  return { actorEmail, actorRole, ipAddress };
}

// 1. Overview KPIs
operationsRouter.get('/overview', async (_req: AuthenticatedRequest, res: Response) => {
  await supabaseOperationsRepo.seedBaselineOperationsDataIfEmpty();

  let cases = serverOperationsStore.getCases();
  let alerts = serverOperationsStore.getFraudAlerts();
  let investigations = serverOperationsStore.getInvestigations();

  try {
    const dbCases = await supabaseOperationsRepo.getCases();
    if (dbCases && dbCases.length > 0) cases = dbCases;
    const dbAlerts = await supabaseOperationsRepo.getFraudAlerts();
    if (dbAlerts && dbAlerts.length > 0) alerts = dbAlerts;
    const dbInvestigations = await supabaseOperationsRepo.getInvestigations();
    if (dbInvestigations && dbInvestigations.length > 0) investigations = dbInvestigations;
  } catch (e: any) {
    console.warn('Supabase operations overview query note:', e.message);
  }

  const metrics = serverOperationsStore.getStatementMetrics();
  const assignedCases = cases.filter((c) => c.assignedTo && c.assignedTo !== 'Unassigned').length;
  const unassignedCases = cases.filter((c) => !c.assignedTo || c.assignedTo === 'Unassigned').length;
  const pendingCases = cases.filter((c) => c.status === 'open' || c.status === 'investigating').length;
  const escalatedCases = cases.filter((c) => c.status === 'escalated').length;

  res.json({
    activeInquiries: pendingCases,
    criticalAmlAlerts: alerts.filter((a) => a.riskScore >= 75 && a.status === 'flagged').length,
    processedIngestions: metrics.length,
    openInvestigations: investigations.filter((i) => i.status !== 'resolved').length,
    slaPercentage: 99.4,
    assignedCases,
    unassignedCases,
    pendingCases,
    escalatedCases,
    totalCases: cases.length,
    totalAlerts: alerts.length,
  });
});

// 2. Cases
operationsRouter.get('/cases', async (_req: AuthenticatedRequest, res: Response) => {
  await supabaseOperationsRepo.seedBaselineOperationsDataIfEmpty();
  let cases = serverOperationsStore.getCases();
  try {
    const dbCases = await supabaseOperationsRepo.getCases();
    if (dbCases && dbCases.length > 0) cases = dbCases;
  } catch (e: any) {
    console.warn('Supabase cases fetch note:', e.message);
  }
  res.json({ cases, count: cases.length });
});

operationsRouter.post('/cases', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, customerId, customerName, accountNumberMasked, category, priority, assignedTo, notes } = req.body;
    if (!title || !customerName || !accountNumberMasked || !category || !priority) {
      return res.status(400).json({ error: 'Missing required case fields: title, customerName, accountNumberMasked, category, priority' });
    }

    const { actorEmail, actorRole, ipAddress } = getActorMeta(req);

    let created: CaseRecord;
    try {
      created = await supabaseOperationsRepo.createCase({
        title,
        customerId,
        customerName,
        accountNumberMasked,
        category,
        priority,
        assignedTo: assignedTo || 'Unassigned',
        notes: notes || '',
      });
    } catch {
      // Fallback in-memory
      const newCase: CaseRecord = {
        id: `case-${Date.now()}`,
        caseNumber: `CAS-2026-${String(Date.now()).slice(-4)}`,
        title,
        customerId: customerId || '',
        customerName,
        accountNumberMasked,
        category,
        priority,
        status: 'open',
        assignedTo: assignedTo || 'Unassigned',
        notes: notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      serverOperationsStore.getCases().unshift(newCase);
      created = newCase;
    }

    // Record immutable audit log
    await supabaseAuditRepo.recordAuditEvent({
      actorEmail,
      actorRole,
      action: 'OPERATIONAL_CASE_CREATED',
      resource: `operational_cases:${created.id} (${created.caseNumber})`,
      ipAddress,
      status: 'SUCCESS',
    }).catch((e) => console.warn('Audit log write error:', e.message));

    res.status(201).json({ case: created, message: 'Operational case created successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

operationsRouter.patch('/cases/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedTo, notes } = req.body;
    const { actorEmail, actorRole, ipAddress } = getActorMeta(req);

    // Validate status transitions if provided
    const validStatuses = ['open', 'investigating', 'escalated', 'resolved', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    let updated: CaseRecord | null = null;

    // Try Supabase first
    try {
      updated = await supabaseOperationsRepo.updateCase(id, {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(assignedTo !== undefined && { assignedTo }),
        ...(notes !== undefined && { notes }),
      });
    } catch (e: any) {
      console.warn('Supabase case update note:', e.message);
    }

    // If not in Supabase, update in store
    if (!updated) {
      try {
        updated = serverOperationsStore.updateCase(id, {
          ...(status && { status }),
          ...(priority && { priority }),
          ...(assignedTo !== undefined && { assignedTo }),
          ...(notes !== undefined && { notes }),
        });
      } catch (storeErr: any) {
        if (!updated) {
          return res.status(404).json({ error: storeErr.message });
        }
      }
    }

    // Record immutable audit event
    const actionType = status ? `CASE_STATUS_CHANGED_TO_${String(status).toUpperCase()}` : 'CASE_ASSIGNMENT_UPDATED';
    await supabaseAuditRepo.recordAuditEvent({
      actorEmail,
      actorRole,
      action: actionType,
      resource: `operational_cases:${id}`,
      ipAddress,
      status: 'SUCCESS',
    }).catch((e) => console.warn('Audit log write note:', e.message));

    res.json({ case: updated, message: 'Case updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Fraud Alerts
operationsRouter.get('/fraud-alerts', async (_req: AuthenticatedRequest, res: Response) => {
  await supabaseOperationsRepo.seedBaselineOperationsDataIfEmpty();
  let alerts = serverOperationsStore.getFraudAlerts();
  try {
    const dbAlerts = await supabaseOperationsRepo.getFraudAlerts();
    if (dbAlerts && dbAlerts.length > 0) alerts = dbAlerts;
  } catch (e: any) {
    console.warn('Supabase fraud alerts fetch note:', e.message);
  }
  res.json({ alerts, count: alerts.length });
});

operationsRouter.patch('/fraud-alerts/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, investigatorNotes } = req.body;
    const { actorEmail, actorRole, ipAddress } = getActorMeta(req);

    const validStatuses = ['pending_review', 'flagged', 'cleared', 'blocked'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    let updated: FraudAlert | null = null;
    try {
      updated = await supabaseOperationsRepo.updateFraudAlert(id, {
        ...(status && { status }),
        ...(investigatorNotes !== undefined && { investigatorNotes }),
      });
    } catch (e: any) {
      console.warn('Supabase fraud alert update note:', e.message);
    }

    if (!updated) {
      try {
        updated = serverOperationsStore.updateFraudAlert(id, {
          ...(status && { status }),
          ...(investigatorNotes !== undefined && { investigatorNotes }),
        });
      } catch (storeErr: any) {
        if (!updated) return res.status(404).json({ error: storeErr.message });
      }
    }

    // Record audit event
    await supabaseAuditRepo.recordAuditEvent({
      actorEmail,
      actorRole,
      action: `FRAUD_ALERT_TRIAGE_${String(status).toUpperCase()}`,
      resource: `fraud_alerts:${id}`,
      ipAddress,
      status: 'SUCCESS',
    }).catch((e) => console.warn('Audit log write note:', e.message));

    res.json({ alert: updated, message: 'Fraud alert updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Investigations
operationsRouter.get('/investigations', async (_req: AuthenticatedRequest, res: Response) => {
  await supabaseOperationsRepo.seedBaselineOperationsDataIfEmpty();
  let investigations = serverOperationsStore.getInvestigations();
  try {
    const dbInvs = await supabaseOperationsRepo.getInvestigations();
    if (dbInvs && dbInvs.length > 0) investigations = dbInvs;
  } catch (e: any) {
    console.warn('Supabase investigations fetch note:', e.message);
  }
  res.json({ investigations, count: investigations.length });
});

operationsRouter.post('/investigations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      title,
      targetCustomerId,
      targetCustomerName,
      linkedAlertId,
      priority,
      leadInvestigator,
      initialEvidence,
      flaggedAmount,
      currency,
    } = req.body;

    if (!title || !targetCustomerName) {
      return res.status(400).json({ error: 'Title and customer name are required.' });
    }

    const { actorEmail, actorRole, ipAddress } = getActorMeta(req);

    let created: any = null;
    try {
      created = await supabaseOperationsRepo.createInvestigation({
        title,
        targetCustomerId: targetCustomerId || null,
        targetCustomerName,
        linkedAlertId,
        priority: priority || 'high',
        leadInvestigator: leadInvestigator || req.customer?.fullName || 'Sarah Chen',
        initialEvidence,
        flaggedAmount: Number(flaggedAmount) || 0,
        currency: currency || 'USD',
      });
    } catch (e: any) {
      console.warn('Supabase create investigation note:', e.message);
    }

    if (!created) {
      created = serverOperationsStore.createInvestigation({
        title,
        targetCustomerId: targetCustomerId || 'cust-generic',
        targetCustomerName,
        linkedAlertId,
        priority: priority || 'high',
        leadInvestigator: leadInvestigator || 'Sarah Chen',
        initialEvidence,
        flaggedAmount: Number(flaggedAmount) || 0,
        currency: currency || 'USD',
      });
    }

    // Record audit event
    await supabaseAuditRepo.recordAuditEvent({
      actorEmail,
      actorRole,
      action: 'INVESTIGATION_DOSSIER_OPENED',
      resource: `investigations:${created.id} (${created.caseNumber})`,
      ipAddress,
      status: 'SUCCESS',
    }).catch((e) => console.warn('Audit log write note:', e.message));

    res.status(201).json({ investigation: created, message: 'Investigation initiated.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

operationsRouter.patch('/investigations/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, priority, leadInvestigator } = req.body;
    const { actorEmail, actorRole, ipAddress } = getActorMeta(req);

    let updated: any = null;
    try {
      updated = await supabaseOperationsRepo.updateInvestigation(id, {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(leadInvestigator && { leadInvestigator }),
      });
    } catch (e: any) {
      console.warn('Supabase update investigation note:', e.message);
    }

    if (!updated) {
      try {
        updated = serverOperationsStore.updateInvestigation(id, {
          ...(status && { status }),
          ...(priority && { priority }),
          ...(leadInvestigator && { leadInvestigator }),
        });
      } catch (storeErr: any) {
        if (!updated) return res.status(404).json({ error: storeErr.message });
      }
    }

    await supabaseAuditRepo.recordAuditEvent({
      actorEmail,
      actorRole,
      action: `INVESTIGATION_STATUS_CHANGED_TO_${String(status).toUpperCase()}`,
      resource: `investigations:${id}`,
      ipAddress,
      status: 'SUCCESS',
    }).catch((e) => console.warn('Audit log write note:', e.message));

    res.json({ investigation: updated, message: 'Investigation updated.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

operationsRouter.post('/investigations/:id/evidence', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const { actorEmail, actorRole, ipAddress } = getActorMeta(req);

    if (!note || typeof note !== 'string') {
      return res.status(400).json({ error: 'Evidence note string is required.' });
    }

    let updated: any = null;
    try {
      updated = await supabaseOperationsRepo.addEvidenceNote(id, note);
    } catch (e: any) {
      console.warn('Supabase addEvidenceNote note:', e.message);
    }

    if (!updated) {
      try {
        updated = serverOperationsStore.addEvidenceNote(id, note);
      } catch (storeErr: any) {
        if (!updated) return res.status(404).json({ error: storeErr.message });
      }
    }

    await supabaseAuditRepo.recordAuditEvent({
      actorEmail,
      actorRole,
      action: 'INVESTIGATION_EVIDENCE_RECORDED',
      resource: `investigations:${id}`,
      ipAddress,
      status: 'SUCCESS',
    }).catch((e) => console.warn('Audit log write note:', e.message));

    res.json({ investigation: updated, message: 'Evidence note recorded.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Customers (Operational View)
operationsRouter.get('/customers', (_req: AuthenticatedRequest, res: Response) => {
  const customers = serverOperationsStore.getCustomers();
  res.json({ customers, count: customers.length });
});

// 6. Statement Processing Metrics
operationsRouter.get('/statements/metrics', (_req: AuthenticatedRequest, res: Response) => {
  const metrics = serverOperationsStore.getStatementMetrics();
  res.json({ metrics, count: metrics.length });
});

// 7. Monitored Transactions
operationsRouter.get('/transactions', (req: AuthenticatedRequest, res: Response) => {
  let txs = serverOperationsStore.getMonitoredTransactions();
  const { status, riskLevel, type } = req.query;

  if (status && typeof status === 'string' && status !== 'all') {
    txs = txs.filter((t) => t.status === status);
  }
  if (type && typeof type === 'string' && type !== 'all') {
    txs = txs.filter((t) => t.type === type);
  }
  if (riskLevel && typeof riskLevel === 'string') {
    if (riskLevel === 'high') txs = txs.filter((t) => t.riskScore >= 75);
    else if (riskLevel === 'medium') txs = txs.filter((t) => t.riskScore >= 40 && t.riskScore < 75);
    else if (riskLevel === 'low') txs = txs.filter((t) => t.riskScore < 40);
  }

  res.json({ transactions: txs, count: txs.length });
});

operationsRouter.patch('/transactions/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { actorEmail, actorRole, ipAddress } = getActorMeta(req);

    const updated = serverOperationsStore.updateMonitoredTransactionStatus(id, status);

    await supabaseAuditRepo.recordAuditEvent({
      actorEmail,
      actorRole,
      action: `TRANSACTION_SURVEILLANCE_STATUS_${String(status).toUpperCase()}`,
      resource: `monitored_transactions:${id}`,
      ipAddress,
      status: 'SUCCESS',
    }).catch((e) => console.warn('Audit log write note:', e.message));

    res.json({ transaction: updated, message: 'Transaction status updated.' });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 8. Operational Analytics
operationsRouter.get('/analytics', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const analytics = await supabaseOperationsRepo.getOperationalAnalytics();
    res.json({ analytics });
  } catch (err: any) {
    console.warn('Analytics calc fallback note:', err.message);
    const fallback = serverOperationsStore.getAnalytics();
    res.json({ analytics: fallback });
  }
});

// 9. Operations Knowledge Assistant (RAG Pipeline)
operationsRouter.post('/knowledge/ask', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query text is required.' });
    }

    const answer = queryOpsKnowledge(query.trim());
    res.json({ answer });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
