/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_SUPABASE_URL = 'https://qkuasaeecakwjfeymtwv.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_b2cwolewlLhjdr5TzkJy8g__2q6iM_q';

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL
).trim();

const SUPABASE_ANON_KEY = (
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_SUPABASE_ANON_KEY
).trim();

const SUPABASE_SERVICE_ROLE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  ''
).trim();

export interface SupabaseConfigStatus {
  isConfigured: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  hasServiceRoleKey: boolean;
  missingVariables: string[];
  instructions: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceRoleKey: string;
  };
}

/**
 * Check if the Supabase environment is fully configured
 */
export function checkSupabaseConfig(): SupabaseConfigStatus {
  const missing: string[] = [];
  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
    // using project default
  }
  if (!process.env.SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY) {
    // using project default
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  return {
    isConfigured: Boolean(SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)),
    hasUrl: Boolean(SUPABASE_URL),
    hasAnonKey: Boolean(SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(SUPABASE_SERVICE_ROLE_KEY),
    missingVariables: missing,
    instructions: {
      supabaseUrl: 'Supabase Dashboard -> Project Settings -> API -> Project URL (e.g. https://xyz.supabase.co)',
      supabaseAnonKey: 'Supabase Dashboard -> Project Settings -> API -> Project API Keys -> anon (public)',
      supabaseServiceRoleKey: 'Supabase Dashboard -> Project Settings -> API -> Project API Keys -> service_role (secret)',
    },
  };
}

let adminClientInstance: SupabaseClient | null = null;

/**
 * Get server-side administrative Supabase client
 * Used for backend services to perform verified customer-scoped queries and Auth verification
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClientInstance) {
    return adminClientInstance;
  }

  const status = checkSupabaseConfig();
  if (!status.isConfigured) {
    const errorMsg = `Supabase is not configured. Missing environment variables: ${status.missingVariables.join(', ')}. ` +
      `Please provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Google AI Studio environment settings.`;
    throw new Error(errorMsg);
  }

  const keyToUse = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

  adminClientInstance = createClient(SUPABASE_URL, keyToUse, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClientInstance;
}

/**
 * Get customer-scoped Supabase client with the user's access token
 * Enforces PostgreSQL Row-Level Security (RLS) policies directly
 */
export function getSupabaseUserClient(accessToken: string): SupabaseClient {
  const status = checkSupabaseConfig();
  if (!status.isConfigured) {
    throw new Error('Supabase is not configured.');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
