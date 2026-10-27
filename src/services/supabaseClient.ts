/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

import { supabase } from '../supabaseClient.js';

/**
 * Returns the singleton browser-side Supabase client with session persistence and auto-refresh.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  return supabase as unknown as SupabaseClient;
}

/**
 * Returns the application origin for email confirmation and auth callbacks.
 * Configured in Supabase Authentication -> URL Configuration -> Redirect URLs.
 */
export function getAppRedirectUrl(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/`;
}

/**
 * Handle OAuth callback from Google / Supabase
 * Safely processes PKCE authorization codes (?code=...), URL hash tokens, or existing sessions.
 */
export async function handleAuthCallback(): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    if (typeof window === 'undefined') return null;

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');

    // 1. Check for PKCE authorization code in query params
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('Supabase exchangeCodeForSession failed:', error);
        throw error;
      }
      return data.session;
    }

    // 2. Check for hash tokens (implicit flow)
    if (window.location.hash && window.location.hash.includes('access_token')) {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Supabase getSession error from hash:', error);
        throw error;
      }
      return data.session;
    }

    // 3. Fall back to existing cached session from storage
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Supabase getSession notice:', error.message);
      return null;
    }
    return data.session;
  } catch (err) {
    console.error('handleAuthCallback error:', err);
    throw err;
  }
}

/**
 * Get current active session from browser Supabase client
 */
export async function getBrowserSession(): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Listen for auth state changes (e.g. SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT, USER_UPDATED)
 */
export function onBrowserAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  return supabase.auth.onAuthStateChange(callback);
}

/**
 * Sign out from browser Supabase Auth
 */
export async function signOutBrowser() {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Error signing out of browser Supabase client:', err);
    }
  }
}
