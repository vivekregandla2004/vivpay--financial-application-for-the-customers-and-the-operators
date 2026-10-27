import { Router, Request, Response } from 'express';
import { checkSupabaseConfig, getSupabaseAdmin, getSupabaseUserClient } from '../db/supabase.ts';
import { serverOperationsStore } from '../operations/store.ts';
import { globalVectorStore } from '../../lib/rag/retrieval.ts';
import { supabaseSystemUserRepo, supabaseAuditRepo } from '../db/supabaseRepository.ts';
import { requireAdminAuth, AuthenticatedRequest } from '../auth/middleware.ts';
import {
  INITIAL_DEMO_USERS,
  INITIAL_DEMO_AUDIT_LOGS,
  OPERATIONAL_SOP_DOCS,
} from '../../services/demoData.ts';
import { SystemUser, AuditLogEntry } from '../../types/operations.ts';

export const adminRouter = Router();

// Enforce Administrative authorization across admin endpoints
adminRouter.use(requireAdminAuth);

// Helper to obtain client with the caller's administrative JWT to satisfy Supabase RLS
export function getAdminRequestClient(req: AuthenticatedRequest) {
  return (req as any).supabase || (req.sessionToken ? getSupabaseUserClient(req.sessionToken) : getSupabaseAdmin());
}

// In-memory admin stores for demo session
let systemUsersState: SystemUser[] = [...INITIAL_DEMO_USERS];
let auditLogsState: AuditLogEntry[] = [...INITIAL_DEMO_AUDIT_LOGS];

// Tunable system configuration state (Zero secrets)
let tunableSystemConfig = {
  sessionTimeoutMinutes: 60,
  alertRiskFloorThreshold: 75,
  maxStatementUploadSizeBytes: 25 * 1024 * 1024, // 25 MB
  maintenanceMode: false,
  ragGroundingConfidenceThreshold: 0.38,
};

// 1. Admin Overview KPIs
adminRouter.get('/overview', async (req: AuthenticatedRequest, res: Response) => {
  const cases = serverOperationsStore.getCases();
  const alerts = serverOperationsStore.getFraudAlerts();
  const metrics = serverOperationsStore.getStatementMetrics();
  const totalChunks = globalVectorStore.totalChunksCount();

  let liveUsers = systemUsersState;
  let isLive = false;

  const client = getAdminRequestClient(req);
  try {
    const dbUsers = await supabaseSystemUserRepo.listSystemUsers(client);
    if (dbUsers && dbUsers.length > 0) {
      liveUsers = dbUsers;
      isLive = true;
    }
  } catch (e: any) {
    console.warn('Supabase system users fetch note:', e.message);
  }

  const customerCount = liveUsers.filter((u) => u.role === 'customer').length;
  const employeeCount = liveUsers.filter((u) => u.role === 'employee').length;
  const adminCount = liveUsers.filter((u) => u.role === 'admin').length;

  const activeStaff = liveUsers.filter((u) => (u.role === 'employee' || u.role === 'admin') && u.status === 'active').length;
  const suspendedStaff = liveUsers.filter((u) => (u.role === 'employee' || u.role === 'admin') && u.status === 'suspended').length;
  const pendingStaff = liveUsers.filter((u) => (u.role === 'employee' || u.role === 'admin') && u.status === 'pending').length;

  // Query live cases, alerts, and audit counts from Supabase if live
  let liveCasesCount = cases.length;
  let liveOpenCases = cases.filter((c) => c.status === 'open' || c.status === 'investigating').length;
  let liveCriticalAlerts = alerts.filter((a) => a.riskScore >= 75 && a.status === 'flagged').length;
  let liveAuditCount = auditLogsState.length;

  if (isLive) {
    try {
      const supabase = getSupabaseAdmin();
      const [caseRes, alertRes, auditRes] = await Promise.allSettled([
        supabase.from('operational_cases').select('status'),
        supabase.from('fraud_alerts').select('risk_score, status'),
        supabase.from('audit_logs').select('*', { count: 'exact', head: true }),
      ]);

      if (caseRes.status === 'fulfilled' && caseRes.value.data) {
        const cList = caseRes.value.data;
        liveCasesCount = cList.length;
        liveOpenCases = cList.filter((c: any) => c.status === 'open' || c.status === 'investigating').length;
      }
      if (alertRes.status === 'fulfilled' && alertRes.value.data) {
        const aList = alertRes.value.data;
        liveCriticalAlerts = aList.filter((a: any) => Number(a.risk_score) >= 75 && a.status === 'flagged').length;
      }
      if (auditRes.status === 'fulfilled' && auditRes.value.count !== null) {
        liveAuditCount = auditRes.value.count;
      }
    } catch (metricErr: any) {
      console.warn('Live metrics query note:', metricErr.message);
    }
  }

  res.json({
    totalUsers: liveUsers.length,
    userBreakdown: {
      customers: customerCount,
      employees: employeeCount,
      admins: adminCount,
    },
    staffStatusBreakdown: {
      active: activeStaff,
      suspended: suspendedStaff,
      pending: pendingStaff,
    },
    openCases: liveOpenCases,
    totalCases: liveCasesCount,
    criticalAlerts: liveCriticalAlerts,
    processedDocuments: metrics.length,
    totalAuditEvents: liveAuditCount,
    ragVectorChunks: totalChunks,
    ragServiceStatus: 'ACTIVE',
    apiHealth: {
      status: 'healthy',
      uptimeSeconds: Math.round(process.uptime()),
      databaseConnected: checkSupabaseConfig().isConfigured,
    },
    isLive,
    isDemo: !isLive,
  });
});

// 2. User & Role Management
adminRouter.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  const client = getAdminRequestClient(req);
  let users = systemUsersState;
  try {
    const dbUsers = await supabaseSystemUserRepo.listSystemUsers(client);
    if (dbUsers && dbUsers.length > 0) {
      users = dbUsers;
      systemUsersState = dbUsers;
    }
  } catch (e: any) {
    console.warn('Supabase system users fetch note:', e.message);
  }
  res.json({ users, count: users.length });
});

// List registered candidates from auth.users/customers who can be provisioned
adminRouter.get('/users/eligible-candidates', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supabase = getAdminRequestClient(req);
    // 1. Get existing system user IDs
    const systemUsers = await supabaseSystemUserRepo.listSystemUsers(supabase);
    const existingSystemIds = new Set(systemUsers.map((u) => u.id));
    const existingSystemEmails = new Set(systemUsers.map((u) => u.email.toLowerCase()));

    // 2. Query registered customers
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('id, email, full_name, created_at')
      .order('created_at', { ascending: false });

    if (custError) {
      console.warn('Customer candidates fetch warning:', custError.message);
    }

    const eligible = (customers || [])
      .filter((c) => !existingSystemIds.has(c.id) && !existingSystemEmails.has((c.email || '').toLowerCase()))
      .map((c) => ({
        id: c.id,
        email: c.email,
        name: c.full_name || 'Registered Customer',
        createdAt: c.created_at,
        currentRole: 'customer',
      }));

    res.json({ candidates: eligible, count: eligible.length });
  } catch (err: any) {
    console.error('Eligible candidates fetch error:', err);
    res.status(500).json({ error: err.message || 'Failed to list candidates.' });
  }
});

// Secure provisioning endpoint for Employee or Admin roles
adminRouter.post('/users/provision', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { authUserId, email, name, role, department } = req.body;

    // Role validation: Admin or Employee only
    if (!role || !['admin', 'employee'].includes(role)) {
      return res.status(400).json({
        error: "Invalid role. Only 'employee' or 'admin' roles can be provisioned through administrative authorization.",
        code: 'INVALID_ROLE',
      });
    }

    if (!authUserId && !email) {
      return res.status(400).json({
        error: 'Either authUserId (Supabase Auth UUID) or email is required.',
        code: 'MISSING_USER_IDENTIFIER',
      });
    }

    const supabase = getSupabaseAdmin();
    let targetAuthUser: any = null;

    if (authUserId) {
      // Look up user by Auth UUID in auth.users
      const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(authUserId);
      if (authErr || !authData?.user) {
        return res.status(404).json({
          error: `Authenticated user with UUID '${authUserId}' not found in Supabase Auth. Staff provisioning requires an existing registered account.`,
          code: 'AUTH_USER_NOT_FOUND',
        });
      }
      targetAuthUser = authData.user;

      // Verify Auth UUID and email belong to the same account if both are supplied
      if (email) {
        const normalizedProvidedEmail = email.toLowerCase().trim();
        const targetEmail = (targetAuthUser.email || '').toLowerCase().trim();
        if (targetEmail && targetEmail !== normalizedProvidedEmail) {
          return res.status(400).json({
            error: `Auth UUID '${authUserId}' belongs to '${targetEmail}', which does not match the provided email '${email}'. Target Auth UUID and email must correspond to the same Supabase Auth account.`,
            code: 'AUTH_USER_EMAIL_MISMATCH',
          });
        }
      }
    } else if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      // Look up in customers table first
      const { data: cust } = await supabase
        .from('customers')
        .select('id, email, full_name')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (cust) {
        targetAuthUser = {
          id: cust.id,
          email: cust.email,
          user_metadata: { full_name: cust.full_name },
        };
      } else {
        // Query auth.admin.listUsers() to locate user
        const { data: listData } = await (supabase.auth.admin as any).listUsers();
        const usersList: any[] = listData?.users || [];
        const found = usersList.find(
          (u: any) => (u.email || '').toLowerCase().trim() === normalizedEmail
        );
        if (!found) {
          return res.status(404).json({
            error: `User with email '${email}' not found in registered Supabase Auth users. The user must register with Supabase Auth first before being provisioned with staff privileges.`,
            code: 'AUTH_USER_NOT_FOUND',
          });
        }
        targetAuthUser = found;
      }
    }

    const resolvedName =
      (name && name.trim()) ||
      targetAuthUser.user_metadata?.full_name ||
      'VivPay Staff Member';
    const resolvedEmail = (targetAuthUser.email || email).toLowerCase().trim();
    const resolvedDepartment =
      (department && department.trim()) ||
      (role === 'admin' ? 'Executive Governance & Administration' : 'Operations & Customer Support');

    // Provision record in public.system_users via server-side trusted repository
    const client = getAdminRequestClient(req);
    const provisioned = await supabaseSystemUserRepo.provisionSystemUser({
      id: targetAuthUser.id,
      email: resolvedEmail,
      name: resolvedName,
      role,
      department: resolvedDepartment,
      status: 'active',
    }, client);

    // Update in-memory state if user exists there or prepend
    const existingIndex = systemUsersState.findIndex((u) => u.id === provisioned.id);
    if (existingIndex >= 0) {
      systemUsersState[existingIndex] = provisioned;
    } else {
      systemUsersState.unshift(provisioned);
    }

    // Record immutable audit event
    const auditEntry: AuditLogEntry = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorEmail: req.customer?.email || 'marcus.vance@admin.vivpay.internal',
      actorRole: 'admin',
      action: 'USER_ROLE_ASSIGNMENT',
      resource: `${resolvedEmail} -> ${role.toUpperCase()} (${resolvedDepartment})`,
      ipAddress: (req.ip || '10.240.0.12').replace('::ffff:', ''),
      status: 'SUCCESS',
    };
    auditLogsState.unshift(auditEntry);

    try {
      await supabaseAuditRepo.recordAuditEvent(auditEntry);
    } catch (auditErr: any) {
      console.warn('Supabase audit log record note:', auditErr.message);
    }

    return res.status(201).json({
      user: provisioned,
      message: `User '${resolvedEmail}' successfully provisioned with role '${role}'.`,
    });
  } catch (err: any) {
    console.error('Provision user error:', err);
    return res.status(500).json({ error: err.message || 'Failed to provision system user.' });
  }
});

adminRouter.patch('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, role, department } = req.body;

    // Validate inputs
    const VALID_ROLES = ['customer', 'employee', 'admin'];
    const VALID_STATUSES = ['active', 'suspended', 'pending'];
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role '${role}'. Must be one of: ${VALID_ROLES.join(', ')}`,
        code: 'INVALID_ROLE',
      });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(', ')}`,
        code: 'INVALID_STATUS',
      });
    }

    // Safeguard: Protect the last active Admin account against accidental lockout
    const client = getAdminRequestClient(req);
    if (status === 'suspended' || (role && role !== 'admin')) {
      let targetUser = await supabaseSystemUserRepo.getSystemUserById(id, client).catch(() => null);
      if (!targetUser) targetUser = systemUsersState.find((u) => u.id === id) || null;
      if (targetUser && targetUser.role === 'admin' && targetUser.status === 'active') {
        let activeAdminCount = 0;
        try {
          activeAdminCount = await supabaseSystemUserRepo.countActiveAdmins(client);
        } catch {
          activeAdminCount = systemUsersState.filter((u) => u.role === 'admin' && u.status === 'active').length;
        }

        if (activeAdminCount <= 1) {
          return res.status(400).json({
            error: 'Operation rejected: Cannot suspend or demote the last active Administrator account. Promote another active administrator first to prevent system lockout.',
            code: 'CANNOT_LOCKOUT_LAST_ADMIN',
          });
        }
      }
    }

    const idx = systemUsersState.findIndex((u) => u.id === id);
    if (idx !== -1) {
      systemUsersState[idx] = {
        ...systemUsersState[idx],
        ...(status && { status }),
        ...(role && { role }),
        ...(department !== undefined && { department }),
      };
    }

    // Update in Supabase PostgreSQL
    let updatedUser: SystemUser;
    try {
      updatedUser = await supabaseSystemUserRepo.updateUser(id, { status, role, department }, client);
      if (idx !== -1) systemUsersState[idx] = updatedUser;
    } catch (dbErr: any) {
      if (dbErr.code === 'CANNOT_LOCKOUT_LAST_ADMIN') {
        return res.status(400).json({ error: dbErr.message, code: dbErr.code });
      }
      if (idx !== -1) {
        updatedUser = systemUsersState[idx];
      } else {
        throw dbErr;
      }
    }

    // Record audit event
    const auditEntry: AuditLogEntry = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorEmail: req.customer?.email || 'marcus.vance@admin.vivpay.internal',
      actorRole: 'admin',
      action: status ? 'USER_STATUS_CHANGE' : 'USER_ROLE_ASSIGNMENT',
      resource: `${updatedUser.email} (${updatedUser.role} / ${updatedUser.status})`,
      ipAddress: (req.ip || '10.240.0.12').replace('::ffff:', ''),
      status: 'SUCCESS',
    };
    auditLogsState.unshift(auditEntry);

    try {
      await supabaseAuditRepo.recordAuditEvent(auditEntry);
    } catch (e: any) {
      console.warn('Supabase admin update sync note:', e.message);
    }

    res.json({ user: updatedUser, message: 'User updated successfully in registry.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Audit Activity (Strictly Append-Only: No Delete or Update Routes)
adminRouter.get('/audit-logs', async (req: Request, res: Response) => {
  const { limit = '50', offset = '0', actorEmail, actorRole, action, status, search } = req.query;
  const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 200);
  const parsedOffset = Math.max(parseInt(String(offset), 10) || 0, 0);

  let logs = auditLogsState;
  try {
    const dbLogs = await supabaseAuditRepo.listAuditLogs({
      limit: parsedLimit,
      offset: parsedOffset,
      actorEmail: actorEmail ? String(actorEmail) : undefined,
      actorRole: actorRole ? String(actorRole) : undefined,
      action: action ? String(action) : undefined,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
    });
    if (dbLogs && dbLogs.length > 0) logs = dbLogs;
  } catch (e: any) {
    console.warn('Supabase audit logs fetch note:', e.message);
  }

  // Filter in-memory fallback logs if needed
  if (logs === auditLogsState) {
    let filtered = [...logs];
    if (actorRole && actorRole !== 'all') filtered = filtered.filter((l) => l.actorRole === actorRole);
    if (action && action !== 'all') filtered = filtered.filter((l) => l.action === action);
    if (status && status !== 'all') filtered = filtered.filter((l) => l.status === status);
    if (search) {
      const q = String(search).toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.actorEmail.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.resource.toLowerCase().includes(q)
      );
    }
    logs = filtered.slice(parsedOffset, parsedOffset + parsedLimit);
  }

  res.json({
    auditLogs: logs,
    count: logs.length,
    limit: parsedLimit,
    offset: parsedOffset,
    page: Math.floor(parsedOffset / parsedLimit) + 1,
  });
});

adminRouter.post('/audit-logs', async (req: Request, res: Response) => {
  try {
    const { action, resource, actorEmail, actorRole, status } = req.body;
    const auditEntry: AuditLogEntry = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorEmail: actorEmail || 'system.service@vivpay.internal',
      actorRole: actorRole || 'admin',
      action: action || 'SECURITY_AUDIT',
      resource: resource || 'system',
      ipAddress: '10.240.0.12',
      status: status || 'SUCCESS',
    };
    auditLogsState.unshift(auditEntry);

    try {
      await supabaseAuditRepo.recordAuditEvent(auditEntry);
    } catch (e: any) {
      console.warn('Supabase audit log record note:', e.message);
    }

    res.status(201).json({ auditLog: auditEntry, message: 'Audit event recorded.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// 4. System Configuration (CRITICAL: ZERO SECRETS DISPLAYED)
adminRouter.get('/system-config', (_req: Request, res: Response) => {
  const supabase = checkSupabaseConfig();

  res.json({
    timestamp: new Date().toISOString(),
    service: 'VivPay Enterprise Core',
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      uptimeSeconds: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
    },
    database: {
      provider: 'Supabase PostgreSQL',
      isConfigured: supabase.isConfigured,
      hasUrl: supabase.hasUrl,
      hasAnonKey: supabase.hasAnonKey,
      hasServiceRoleKey: supabase.hasServiceRoleKey,
      urlHost: process.env.SUPABASE_URL || 'https://qkuasaeecakwjfeymtwv.supabase.co',
      rlsEnforced: true,
      canonicalSchema: '001_initial_supabase_schema.sql (8 tables active)',
    },
    tunable: tunableSystemConfig,
    aiIntelligence: {
      textModel: 'gemini-2.5-flash',
      embeddingModel: 'text-embedding-004',
      embeddingDimension: 768,
      groundingThreshold: tunableSystemConfig.ragGroundingConfidenceThreshold,
      vectorStoreProvider: 'In-Memory Tenant-Isolated Vector Store',
    },
    security: {
      zeroKnowledgeCredentials: true,
      accountMasking: '•••• XXXX',
      roleBasedAccessControl: 'Enforced',
      sessionIsolation: 'UUID Scoped',
    },
  });
});

adminRouter.patch('/system-config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      sessionTimeoutMinutes,
      alertRiskFloorThreshold,
      maxStatementUploadSizeBytes,
      maintenanceMode,
      ragGroundingConfidenceThreshold,
    } = req.body;

    const updates: Partial<typeof tunableSystemConfig> = {};

    if (sessionTimeoutMinutes !== undefined) {
      const val = Number(sessionTimeoutMinutes);
      if (isNaN(val) || val < 5 || val > 1440) {
        return res.status(400).json({ error: 'Session timeout must be between 5 and 1440 minutes.' });
      }
      updates.sessionTimeoutMinutes = val;
    }

    if (alertRiskFloorThreshold !== undefined) {
      const val = Number(alertRiskFloorThreshold);
      if (isNaN(val) || val < 1 || val > 100) {
        return res.status(400).json({ error: 'Alert risk floor threshold must be between 1 and 100.' });
      }
      updates.alertRiskFloorThreshold = val;
    }

    if (maxStatementUploadSizeBytes !== undefined) {
      const val = Number(maxStatementUploadSizeBytes);
      if (isNaN(val) || val < 1024 * 1024 || val > 50 * 1024 * 1024) {
        return res.status(400).json({ error: 'Max statement upload size must be between 1 MB and 50 MB.' });
      }
      updates.maxStatementUploadSizeBytes = val;
    }

    if (maintenanceMode !== undefined) {
      updates.maintenanceMode = Boolean(maintenanceMode);
    }

    if (ragGroundingConfidenceThreshold !== undefined) {
      const val = Number(ragGroundingConfidenceThreshold);
      if (isNaN(val) || val < 0.1 || val > 0.95) {
        return res.status(400).json({ error: 'RAG grounding confidence threshold must be between 0.1 and 0.95.' });
      }
      updates.ragGroundingConfidenceThreshold = val;
    }

    tunableSystemConfig = { ...tunableSystemConfig, ...updates };

    // Record immutable audit event
    const auditEntry: AuditLogEntry = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actorEmail: req.customer?.email || 'admin@vivpay.internal',
      actorRole: 'admin',
      action: 'SYSTEM_CONFIGURATION_UPDATED',
      resource: `Tunable parameters: ${JSON.stringify(updates)}`,
      ipAddress: (req.ip || '10.240.0.12').replace('::ffff:', ''),
      status: 'SUCCESS',
    };
    auditLogsState.unshift(auditEntry);
    await supabaseAuditRepo.recordAuditEvent(auditEntry).catch((e) => console.warn('Audit record note:', e.message));

    res.json({
      success: true,
      config: tunableSystemConfig,
      message: 'System configuration updated and audited successfully.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Knowledge & Document Management
adminRouter.get('/knowledge-docs', (_req: Request, res: Response) => {
  const totalChunks = globalVectorStore.totalChunksCount();
  const statementDocs = serverOperationsStore.getStatementMetrics();

  // Aggregate knowledge documents metadata
  const docs = [
    ...OPERATIONAL_SOP_DOCS.map((doc) => ({
      id: doc.id,
      title: doc.title,
      category: doc.category,
      type: 'Operations SOP',
      tenantId: 'ops-knowledge-base',
      lastUpdated: doc.lastUpdated,
      status: 'Indexed & Searchable',
      chunkCount: 2, // Standard sections split
      vectorDimensions: 768,
    })),
    ...statementDocs.map((s) => ({
      id: s.id,
      title: s.documentName,
      category: 'Customer Statement',
      type: s.format,
      tenantId: s.uploadedBy,
      lastUpdated: s.timestamp.substring(0, 10),
      status: 'Parsed & Normalized',
      chunkCount: Math.ceil(s.importedCount / 4) + 2,
      vectorDimensions: 768,
    })),
  ];

  res.json({
    documents: docs,
    totalIndexedChunks: totalChunks,
    embeddingDimension: 768,
    vectorNormUnit: 1.0,
  });
});
