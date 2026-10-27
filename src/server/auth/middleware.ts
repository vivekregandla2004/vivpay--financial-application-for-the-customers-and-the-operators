/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import { CustomerProfile } from '../../types/database.ts';
import { UserRole, SystemUser } from '../../types/operations.ts';
import { requireSupabaseAuth } from './supabaseAuth.ts';

export interface AuthenticatedRequest extends Request {
  customer?: CustomerProfile;
  userRole?: UserRole;
  systemUser?: SystemUser | null;
  sessionToken?: string;
  supabase?: any;
}

/**
 * Server middleware enforcing authenticated customer identity via Supabase Auth.
 * Rejects requests without valid, unexpired sessions with HTTP 401.
 * Enforces customer role: Admin and Employee accounts cannot access customer-only routes unless explicitly authorized.
 * Never trusts customerId sent from client request body/query.
 */
export async function requireCustomerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return requireSupabaseAuth(req, res, () => {
    if (req.systemUser && req.systemUser.status !== 'active') {
      const isSuspended = req.systemUser.status === 'suspended';
      return res.status(403).json({
        error: isSuspended
          ? 'Forbidden: Account has been suspended by an administrator.'
          : `Forbidden: Account status is '${req.systemUser.status}'. Account activation required.`,
        code: isSuspended ? 'FORBIDDEN_ACCOUNT_SUSPENDED' : 'FORBIDDEN_ACCOUNT_NOT_ACTIVE',
      });
    }

    // Role boundary: Only customer role has access to customer financial data unless explicitly authorized
    const hasExplicitCustomerAuth = req.headers['x-explicit-customer-access'] === 'authorized';
    if (req.userRole !== 'customer' && !hasExplicitCustomerAuth) {
      return res.status(403).json({
        error: `Forbidden: Access to Customer financial workspace requires customer role. Authenticated role is '${req.userRole}'.`,
        code: 'FORBIDDEN_CUSTOMER_ROLE_REQUIRED',
        currentRole: req.userRole || 'unassigned',
        requiredRole: 'customer',
      });
    }

    next();
  });
}

/**
 * Server middleware enforcing Employee privileges for the Operations Workspace.
 * Rejects unauthenticated requests with HTTP 401 and ordinary customers with HTTP 403.
 * Admin users cannot access Employee-only routes without explicit permission.
 */
export async function requireEmployeeAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return requireSupabaseAuth(req, res, () => {
    if (req.systemUser && req.systemUser.status !== 'active') {
      const isSuspended = req.systemUser.status === 'suspended';
      return res.status(403).json({
        error: isSuspended
          ? 'Forbidden: Staff member account has been suspended by an administrator.'
          : `Forbidden: Staff member account status is '${req.systemUser.status}'. Account activation required.`,
        code: isSuspended ? 'FORBIDDEN_ACCOUNT_SUSPENDED' : 'FORBIDDEN_ACCOUNT_NOT_ACTIVE',
      });
    }

    // Scenario 1: Admin cannot access Employee-only routes without explicit permission.
    const hasExplicitPermission = req.headers['x-admin-operations-permission'] === 'granted' || req.query.allowAdminOverride === 'true';
    if (req.userRole !== 'employee' && !(req.userRole === 'admin' && hasExplicitPermission)) {
      return res.status(403).json({
        error: req.userRole === 'admin'
          ? 'Forbidden: Administrator cannot access Employee-only operations routes without explicit permission.'
          : 'Forbidden: Operations workspace requires employee privileges.',
        code: req.userRole === 'admin' ? 'FORBIDDEN_ADMIN_REQUIRES_EXPLICIT_PERMISSION' : 'FORBIDDEN_EMPLOYEE_ROLE_REQUIRED',
        currentRole: req.userRole || 'customer',
        requiredRole: 'employee',
      });
    }

    next();
  });
}

/**
 * Backwards-compatible alias for operations routes permitting both Employee and Admin
 */
export const requireEmployeeOrAdminAuth = requireEmployeeAuth;

/**
 * Server middleware enforcing Admin privileges for the Admin Governance Workspace.
 * Rejects unauthenticated requests with HTTP 401 and unauthorized users with HTTP 403.
 */
export async function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return requireSupabaseAuth(req, res, () => {
    if (req.systemUser && req.systemUser.status !== 'active') {
      const isSuspended = req.systemUser.status === 'suspended';
      return res.status(403).json({
        error: isSuspended
          ? 'Forbidden: Staff member account has been suspended by an administrator.'
          : `Forbidden: Staff member account status is '${req.systemUser.status}'. Account activation required.`,
        code: isSuspended ? 'FORBIDDEN_ACCOUNT_SUSPENDED' : 'FORBIDDEN_ACCOUNT_NOT_ACTIVE',
      });
    }
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden: Admin workspace requires administrator privileges.',
        code: 'FORBIDDEN_ADMIN_ROLE_REQUIRED',
        currentRole: req.userRole || 'customer',
        requiredRole: 'admin',
      });
    }
    next();
  });
}

/**
 * Helper to enforce that requested resource belongs strictly to the authenticated customer.
 */
export function assertCustomerOwnership(
  resourceCustomerId: string,
  authenticatedCustomerId: string,
  resourceName: string = 'Resource'
) {
  if (resourceCustomerId !== authenticatedCustomerId) {
    const error: any = new Error(`Forbidden: Access denied to ${resourceName}.`);
    error.statusCode = 403;
    error.code = 'FORBIDDEN_RESOURCE_ACCESS';
    throw error;
  }
}
