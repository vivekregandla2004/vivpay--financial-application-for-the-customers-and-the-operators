/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Response, NextFunction } from 'express';
import { getSupabaseAdmin, getSupabaseUserClient, checkSupabaseConfig } from '../db/supabase.ts';
import { AuthenticatedRequest } from './middleware.ts';
import { CustomerProfile } from '../../types/database.ts';
import { UserRole, SystemUser } from '../../types/operations.ts';

/**
 * Server middleware to enforce Supabase Auth authentication.
 * Verifies JWT token with Supabase Auth server, retrieves authenticated user,
 * loads customer profile, checks authoritative role in public.system_users,
 * and sets req.customer, req.userRole, req.systemUser, and req.supabaseClient.
 */
export async function requireSupabaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const config = checkSupabaseConfig();
  if (!config.isConfigured) {
    return res.status(503).json({
      error: 'Supabase configuration is pending. Please configure SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.',
      code: 'SUPABASE_NOT_CONFIGURED',
      missing: config.missingVariables,
      instructions: config.instructions,
    });
  }

  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-session-token']) {
    token = String(req.headers['x-session-token']).trim();
  }

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Bearer token is required.',
      code: 'AUTH_TOKEN_MISSING',
    });
  }

  try {
    const supabase = getSupabaseAdmin();

    // 1. Validate JWT with Supabase Auth server
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData?.user) {
      return res.status(401).json({
        error: 'Unauthorized: Invalid or expired Supabase authentication session.',
        code: 'AUTH_SESSION_INVALID',
        details: authError?.message,
      });
    }

    const user = authData.user;

    // 2. Fetch or sync customer profile in public.customers
    let profile: CustomerProfile;
    try {
      const { data: customerRow, error: profileError } = await supabase
        .from('customers')
        .select('id, email, full_name, phone, currency, created_at, updated_at')
        .eq('id', user.id)
        .maybeSingle();

      if (customerRow && !profileError) {
        profile = {
          id: customerRow.id,
          email: customerRow.email,
          fullName: customerRow.full_name,
          phone: customerRow.phone,
          currency: customerRow.currency,
          createdAt: customerRow.created_at,
          updatedAt: customerRow.updated_at,
        };
      } else {
        // Sync initial profile from Supabase Auth metadata
        const initialName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'VivPay Customer';
        const initialCurrency = user.user_metadata?.currency || 'USD';

        const { data: inserted, error: insertError } = await supabase
          .from('customers')
          .upsert({
            id: user.id,
            email: user.email!,
            full_name: initialName,
            currency: initialCurrency,
          })
          .select()
          .single();

        if (insertError) {
          console.warn('Notice: Could not persist customer to public.customers (using auth session profile):', insertError.message);
          profile = {
            id: user.id,
            email: user.email!,
            fullName: initialName,
            currency: initialCurrency,
            createdAt: user.created_at || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        } else {
          profile = {
            id: inserted.id,
            email: inserted.email,
            fullName: inserted.full_name,
            phone: inserted.phone,
            currency: inserted.currency,
            createdAt: inserted.created_at,
            updatedAt: inserted.updated_at,
          };
        }
      }
    } catch (custErr: any) {
      console.warn('Profile sync fallback note:', custErr.message);
      profile = {
        id: user.id,
        email: user.email || '',
        fullName: user.user_metadata?.full_name || 'VivPay Customer',
        currency: 'USD',
        createdAt: user.created_at || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // 3. Query authoritative role from public.system_users (Admin & Employee Workspace RBAC)
    let userRole: UserRole = 'customer';
    let systemUserRecord: SystemUser | null = null;

    try {
      // First check by auth UUID in system_users
      const { data: sysUserById, error: sysIdError } = await supabase
        .from('system_users')
        .select('id, email, name, role, department, status, last_active, created_at')
        .eq('id', user.id)
        .maybeSingle();

      if (sysUserById && !sysIdError) {
        if (sysUserById.status === 'active' && ['admin', 'employee', 'customer'].includes(sysUserById.role)) {
          userRole = sysUserById.role as UserRole;
        }
        systemUserRecord = {
          id: sysUserById.id,
          email: sysUserById.email,
          name: sysUserById.name,
          role: sysUserById.role,
          department: sysUserById.department,
          status: sysUserById.status,
          lastActive: sysUserById.last_active,
          createdAt: sysUserById.created_at,
        };
      } else {
        // Fallback: Check if pre-provisioned by email in system_users
        const normalizedEmail = (user.email || '').toLowerCase().trim();
        if (normalizedEmail) {
          const { data: sysUserByEmail, error: sysEmailError } = await supabase
            .from('system_users')
            .select('id, email, name, role, department, status, last_active, created_at')
            .eq('email', normalizedEmail)
            .maybeSingle();

          if (sysUserByEmail && !sysEmailError) {
            if (sysUserByEmail.status === 'active' && ['admin', 'employee', 'customer'].includes(sysUserByEmail.role)) {
              userRole = sysUserByEmail.role as UserRole;
            }
            systemUserRecord = {
              id: sysUserByEmail.id,
              email: sysUserByEmail.email,
              name: sysUserByEmail.name,
              role: sysUserByEmail.role,
              department: sysUserByEmail.department,
              status: sysUserByEmail.status,
              lastActive: sysUserByEmail.last_active,
              createdAt: sysUserByEmail.created_at,
            };

            // Link system_users ID to auth user UUID if not already linked
            if (sysUserByEmail.id !== user.id) {
              await supabase
                .from('system_users')
                .update({ id: user.id, last_active: new Date().toISOString() })
                .eq('email', normalizedEmail);
            }
          }
        }
      }
    } catch (roleErr: any) {
      console.warn('Notice: system_users lookup query (defaulting to customer role):', roleErr.message);
    }

    // Attach verified customer profile, authoritative role, and scoped client
    req.customer = profile;
    req.userRole = userRole;
    req.systemUser = systemUserRecord;
    req.sessionToken = token;
    (req as any).supabase = getSupabaseUserClient(token);

    next();
  } catch (err: any) {
    console.error('Supabase authentication middleware error:', err);
    return res.status(500).json({
      error: 'Authentication verification failure.',
      code: 'AUTH_VERIFICATION_ERROR',
    });
  }
}
