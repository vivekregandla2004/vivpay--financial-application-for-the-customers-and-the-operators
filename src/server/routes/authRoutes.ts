/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response } from 'express';
import { getSupabaseAdmin, checkSupabaseConfig } from '../db/supabase.ts';
import { requireSupabaseAuth } from '../auth/supabaseAuth.ts';
import { supabaseAccountRepo } from '../db/supabaseRepository.ts';
import { AuthenticatedRequest } from '../auth/middleware.ts';

export const authRouter = Router();

const accountProvisioningMutex = new Map<string, Promise<void>>();

async function ensureCustomerAccount(customerId: string, currency: string = 'USD') {
  if (accountProvisioningMutex.has(customerId)) {
    await accountProvisioningMutex.get(customerId);
    return;
  }

  const promise = (async () => {
    try {
      const existingAccounts = await supabaseAccountRepo.listByCustomer(customerId);
      if (!existingAccounts || existingAccounts.length === 0) {
        await supabaseAccountRepo.create(customerId, {
          accountName: 'Primary Checking',
          accountNumberMasked: `•••• ${Math.floor(1000 + Math.random() * 9000)}`,
          accountType: 'checking',
          institutionName: 'VivPay Premier Bank',
          initialBalance: 0.0,
          currency: currency || 'USD',
        });
      }
    } finally {
      accountProvisioningMutex.delete(customerId);
    }
  })();

  accountProvisioningMutex.set(customerId, promise);
  await promise;
}

/**
 * Register a new customer via Supabase Auth
 * POST /api/auth/register
 */
authRouter.post('/register', async (req, res: Response) => {
  const config = checkSupabaseConfig();
  if (!config.isConfigured) {
    return res.status(503).json({
      error: 'Supabase configuration is required to register accounts.',
      code: 'SUPABASE_NOT_CONFIGURED',
      missing: config.missingVariables,
      instructions: config.instructions,
    });
  }

  try {
    const { email, password, fullName, phone, currency, role, is_admin, isAdmin } = req.body;

    // Privilege escalation prevention: self-provisioning of staff roles is prohibited
    if ((role && role !== 'customer') || is_admin || isAdmin) {
      return res.status(403).json({
        error: 'Forbidden: Self-provisioning of administrative or employee roles during registration is strictly prohibited.',
        code: 'FORBIDDEN_PRIVILEGE_ESCALATION',
      });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabase = getSupabaseAdmin();

    // 1. Check whether a customer profile already exists with this email
    try {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, email, full_name')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existingCustomer) {
        return res.status(409).json({
          error: 'An account with this email address already exists. Please sign in instead or use Continue with Google.',
          code: 'USER_ALREADY_EXISTS',
        });
      }
    } catch (err) {
      // Proceed if query fails
    }

    // 2. Sign up user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone ? String(phone).trim() : null,
          currency: currency || 'USD',
        },
      },
    });

    if (authError || !authData?.user) {
      const errorMsg = authError?.message || '';
      const errorCode = (authError as any)?.code || '';
      const isRateLimited =
        authError?.status === 429 ||
        errorCode === 'over_email_send_rate_limit' ||
        errorMsg.toLowerCase().includes('rate limit') ||
        errorMsg.toLowerCase().includes('security purposes');

      if (isRateLimited) {
        // Extract wait seconds if present (e.g. "after 48 seconds")
        const match = errorMsg.match(/after (\d+) seconds/i);
        const retryAfterSeconds = match ? parseInt(match[1], 10) : 60;

        return res.status(429).json({
          error: `Email sign-in rate limit exceeded. Please wait ${retryAfterSeconds} seconds before requesting another confirmation email, or use Continue with Google above.`,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfterSeconds,
        });
      }

      const isDuplicate =
        errorMsg.toLowerCase().includes('already registered') ||
        errorMsg.toLowerCase().includes('user already exists') ||
        authError?.status === 422;

      return res.status(isDuplicate ? 409 : 400).json({
        error: isDuplicate
          ? 'An account with this email address already exists. Please sign in instead.'
          : errorMsg || 'Failed to register account with Supabase Auth.',
        code: isDuplicate ? 'USER_ALREADY_EXISTS' : 'AUTH_SIGNUP_ERROR',
      });
    }

    const user = authData.user;

    // Supabase Auth returns identities: [] if the user already exists in Auth
    if (user.identities && user.identities.length === 0) {
      return res.status(409).json({
        error: 'An account with this email address already exists in Supabase Auth. Please sign in instead.',
        code: 'USER_ALREADY_EXISTS',
      });
    }

    // 3. Insert or ensure customer profile in public.customers
    let customerProfile: any = null;
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('customers')
        .upsert({
          id: user.id,
          email: normalizedEmail,
          full_name: fullName.trim(),
          phone: phone ? String(phone).trim() : null,
          currency: currency || 'USD',
        })
        .select()
        .single();

      if (profileError) {
        console.error('Error creating customer profile in Supabase:', profileError);
        if (profileError.code === 'PGRST205' || profileError.message.includes('schema cache')) {
          return res.status(503).json({
            error: "Database table 'public.customers' is missing from the Supabase schema cache. Please apply the database migration in Supabase SQL Editor.",
            code: 'DATABASE_TABLES_MISSING',
            details: profileError.message,
          });
        }
      } else {
        customerProfile = profileData;
      }
    } catch (profileErr: any) {
      console.error('Customer profile upsert exception:', profileErr);
    }

    // 4. Provision initial checking account idempotently
    try {
      await ensureCustomerAccount(user.id, currency || 'USD');
    } catch (accErr: any) {
      console.error('Initial account provisioning error:', accErr);
      if (accErr.message?.includes('schema cache') || accErr.message?.includes('PGRST205')) {
        return res.status(503).json({
          error: "Database table 'public.accounts' is missing from the Supabase schema cache. Please apply the canonical migration in Supabase SQL Editor.",
          code: 'DATABASE_TABLES_MISSING',
          details: accErr.message,
        });
      }
    }

    const token = authData.session?.access_token || '';

    return res.status(201).json({
      message: 'Account registered successfully with Supabase Auth.',
      customer: customerProfile || {
        id: user.id,
        email: user.email,
        fullName: fullName.trim(),
        currency: currency || 'USD',
      },
      token,
    });
  } catch (error: any) {
    console.error('Supabase registration error:', error);
    return res.status(500).json({ error: error.message || 'Failed to complete registration.' });
  }
});

/**
 * Login customer via Supabase Auth
 * POST /api/auth/login
 */
authRouter.post('/login', async (req, res: Response) => {
  const config = checkSupabaseConfig();
  if (!config.isConfigured) {
    return res.status(503).json({
      error: 'Supabase configuration is required to log in.',
      code: 'SUPABASE_NOT_CONFIGURED',
      missing: config.missingVariables,
      instructions: config.instructions,
    });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const supabase = getSupabaseAdmin();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });

    if (authError || !authData.session) {
      return res.status(401).json({
        error: 'Invalid email or password.',
        details: authError?.message,
      });
    }

    const user = authData.user;

    // Load customer profile
    const { data: customerRow } = await supabase
      .from('customers')
      .select('*')
      .eq('id', user.id)
      .single();

    return res.json({
      message: 'Login successful via Supabase Auth.',
      customer: customerRow || {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name || 'VivPay Customer',
        currency: user.user_metadata?.currency || 'USD',
      },
      token: authData.session.access_token,
    });
  } catch (error: any) {
    console.error('Supabase login error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during login.' });
  }
});

/**
 * Public Supabase configuration for client-side Auth and OAuth
 * GET /api/auth/config
 */
authRouter.get('/config', (_req, res: Response) => {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://qkuasaeecakwjfeymtwv.supabase.co';
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_b2cwolewlLhjdr5TzkJy8g__2q6iM_q';
  const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

  return res.json({
    isConfigured,
    supabaseUrl,
    supabaseAnonKey,
  });
});

/**
 * Synchronize OAuth or existing Supabase session and ensure customer profile & initial account exist
 * POST /api/auth/sync-session
 */
authRouter.post('/sync-session', requireSupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customer = req.customer!;

    // Ensure customer has at least one account provisioned idempotently
    try {
      await ensureCustomerAccount(customer.id, customer.currency || 'USD');
    } catch (accErr: any) {
      console.warn('Account provisioning notice in sync-session:', accErr.message);
    }

    return res.json({
      message: 'Session synchronized successfully.',
      customer,
      role: req.userRole || 'customer',
      token: req.sessionToken,
    });
  } catch (err: any) {
    console.error('Session sync error:', err);
    return res.status(500).json({ error: err.message || 'Failed to sync session.' });
  }
});

/**
 * Get current authenticated customer profile and role via Supabase Auth
 * GET /api/auth/me
 */
authRouter.get('/me', requireSupabaseAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    customer: req.customer,
    role: req.userRole || 'customer',
  });
});

/**
 * Logout customer
 * POST /api/auth/logout
 */
authRouter.post('/logout', requireSupabaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.sessionToken) {
      const supabase = getSupabaseAdmin();
      await supabase.auth.admin.signOut(req.sessionToken);
    }
    return res.json({ success: true, message: 'Logged out successfully from Supabase Auth.' });
  } catch (error: any) {
    console.error('Supabase logout error:', error);
    return res.status(500).json({ error: 'Failed to logout cleanly.' });
  }
});
