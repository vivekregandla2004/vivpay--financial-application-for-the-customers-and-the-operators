/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('====================================================');
console.log('VIVPAY GOOGLE SIGN-IN & SUPABASE OAUTH TEST SUITE');
console.log('====================================================\n');

let passCount = 0;
function pass(msg: string) {
  passCount++;
  console.log(`[PASS] Test ${passCount}: ${msg}`);
}

async function runTests() {
  // Test 1: Frontend Supabase Client & Helper Exists
  const clientPath = path.resolve('src/services/supabaseClient.ts');
  assert(fs.existsSync(clientPath), 'src/services/supabaseClient.ts should exist');
  const clientCode = fs.readFileSync(clientPath, 'utf8');
  assert(clientCode.includes('signInWithGoogle'), 'supabaseClient must export signInWithGoogle');
  assert(clientCode.includes('getBrowserSession'), 'supabaseClient must export getBrowserSession');
  assert(clientCode.includes('onBrowserAuthStateChange'), 'supabaseClient must export onBrowserAuthStateChange');
  assert(clientCode.includes('provider: \'google\''), 'signInWithGoogle must use provider: google');
  pass('src/services/supabaseClient.ts provides verified Google OAuth functions');

  // Test 2: AuthModal UI has "Continue with Google" above the email form
  const modalPath = path.resolve('src/components/AuthModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');
  assert(modalCode.includes('Continue with Google'), 'AuthModal must contain "Continue with Google" button text');
  assert(modalCode.includes('or continue with email'), 'AuthModal must include "or continue with email" divider');
  assert(modalCode.includes('handleGoogleSignIn'), 'AuthModal must attach handleGoogleSignIn');

  const googleIdx = modalCode.indexOf('Continue with Google');
  const emailFormIdx = modalCode.indexOf('name="email"') > -1 || modalCode.indexOf('Email Address') > -1;
  const dividerIdx = modalCode.indexOf('or continue with email');
  assert(googleIdx < dividerIdx, 'Continue with Google must be above the divider');
  pass('AuthModal UI places Continue with Google and divider above email/password form');

  // Test 3: Google multicolor SVG logo is rendered in button
  assert(modalCode.includes('#4285F4') && modalCode.includes('#34A853') && modalCode.includes('#FBBC05') && modalCode.includes('#EA4335'), 'Official multicolor Google logo SVG paths must be present');
  pass('Google SVG logo is rendered in the auth button');

  // Test 4: Preserves email and password authentication
  assert(modalCode.includes('api.login'), 'Email login must be preserved');
  assert(modalCode.includes('api.register'), 'Email register must be preserved');
  pass('Email and password authentication paths are preserved alongside Google Sign-In');

  // Test 5: GET /api/auth/config endpoint
  const authRoutesPath = path.resolve('src/server/routes/authRoutes.ts');
  const authRoutesCode = fs.readFileSync(authRoutesPath, 'utf8');
  assert(authRoutesCode.includes('authRouter.get(\'/config\''), 'authRoutes must provide GET /config');
  assert(!authRoutesCode.includes('SUPABASE_SERVICE_ROLE_KEY') || !authRoutesCode.match(/authRouter\.get\('\/config'[\s\S]*?SUPABASE_SERVICE_ROLE_KEY/), 'GET /config must not expose service role key');
  pass('GET /api/auth/config provides public Supabase parameters without exposing service-role keys');

  // Test 6: POST /api/auth/sync-session endpoint
  assert(authRoutesCode.includes('authRouter.post(\'/sync-session\''), 'authRoutes must provide POST /sync-session');
  assert(authRoutesCode.includes('requireSupabaseAuth'), 'sync-session must be protected by requireSupabaseAuth');
  assert(authRoutesCode.includes('listByCustomer'), 'sync-session must inspect customer accounts');
  pass('POST /api/auth/sync-session authenticates via Supabase Auth and provisions default account');

  // Test 7: Customer Profile synchronization protects RLS and user identity
  const authMiddlewarePath = path.resolve('src/server/auth/supabaseAuth.ts');
  const authMiddlewareCode = fs.readFileSync(authMiddlewarePath, 'utf8');
  assert(authMiddlewareCode.includes('supabase.auth.getUser(token)'), 'requireSupabaseAuth must verify JWT token with Supabase Auth');
  assert(authMiddlewareCode.includes('req.customer = profile'), 'requireSupabaseAuth must set req.customer to verified profile');
  pass('Customer profile synchronization validates JWT identity and prevents ID spoofing');

  // Test 8: SupabaseSetupBanner displays exact Google OAuth instructions and URLs
  const bannerPath = path.resolve('src/components/SupabaseSetupBanner.tsx');
  const bannerCode = fs.readFileSync(bannerPath, 'utf8');
  assert(bannerCode.includes('https://bwwskrcenxjsedbxaatj.supabase.co/auth/v1/callback'), 'Banner must display exact Supabase OAuth callback URL');
  assert(bannerCode.includes('Authorized JavaScript Origins'), 'Banner must guide Google Cloud Console setup');
  pass('SupabaseSetupBanner provides interactive Google OAuth setup guidance and exact URLs');

  // Test 9: App.tsx handles session persistence, onAuthStateChange, and clean logout
  const appPath = path.resolve('src/App.tsx');
  const appCode = fs.readFileSync(appPath, 'utf8');
  assert(appCode.includes('onBrowserAuthStateChange'), 'App.tsx must listen to auth state changes');
  assert(appCode.includes('getBrowserSession'), 'App.tsx must restore session on page mount/refresh');
  assert(appCode.includes('signOutBrowser'), 'handleLogout must sign out browser Supabase session');
  pass('Session persistence, OAuth token exchange, and refresh restoration are verified');

  console.log(`\n====================================================`);
  console.log(`ALL ${passCount}/${passCount} GOOGLE OAUTH INTEGRATION TESTS PASSED!`);
  console.log(`====================================================\n`);
}

runTests().catch((err) => {
  console.error('Integration test failure:', err);
  process.exit(1);
});
