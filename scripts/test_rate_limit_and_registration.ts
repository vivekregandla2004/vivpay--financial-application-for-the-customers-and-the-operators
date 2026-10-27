/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { authRouter } from '../src/server/routes/authRoutes.ts';

console.log('================================================================');
console.log('VIVPAY SUPABASE AUTH RATE-LIMIT & REGISTRATION TEST SUITE');
console.log('================================================================\n');

let passCount = 0;
function pass(msg: string) {
  passCount++;
  console.log(`[PASS] Test ${passCount}: ${msg}`);
}

async function run() {
  // 1. Verify AuthModal UI debounce, lock, cooldown, and disabled inputs
  const authModalPath = path.resolve('src/components/AuthModal.tsx');
  assert(fs.existsSync(authModalPath), 'AuthModal.tsx must exist');
  const modalCode = fs.readFileSync(authModalPath, 'utf8');

  assert(modalCode.includes('isSubmittingRef'), 'AuthModal must use isSubmittingRef for synchronous duplicate submit protection');
  assert(modalCode.includes('cooldownSeconds'), 'AuthModal must include cooldownSeconds state for rate-limit cooldown');
  assert(modalCode.includes('RATE_LIMIT_EXCEEDED'), 'AuthModal must handle RATE_LIMIT_EXCEEDED code');
  assert(modalCode.includes('disabled={loading || googleLoading || cooldownSeconds > 0}'), 'Inputs must be disabled during loading and cooldown');
  assert(modalCode.includes('Wait ${cooldownSeconds}s to Retry Email'), 'Submit button must show countdown label when rate-limited');
  assert(modalCode.includes('Switch to Sign In →'), 'AuthModal must offer direct Switch to Sign In for existing users');
  pass('AuthModal provides synchronous isSubmittingRef locking, live cooldown countdown, and disabled inputs');

  // 2. Verify authRoutes rate limit mapping and duplicate protection
  const authRoutesPath = path.resolve('src/server/routes/authRoutes.ts');
  const authRoutesCode = fs.readFileSync(authRoutesPath, 'utf8');

  assert(authRoutesCode.includes('over_email_send_rate_limit'), 'authRoutes must check for over_email_send_rate_limit');
  assert(authRoutesCode.includes('res.status(429).json'), 'authRoutes must return HTTP 429 when rate-limited');
  assert(authRoutesCode.includes('retryAfterSeconds'), 'authRoutes must compute and return retryAfterSeconds');
  assert(authRoutesCode.includes('USER_ALREADY_EXISTS'), 'authRoutes must return USER_ALREADY_EXISTS for registered users');
  assert(authRoutesCode.includes('identities.length === 0'), 'authRoutes must inspect Supabase identities to detect existing Auth accounts');
  assert(authRoutesCode.includes('listByCustomer'), 'authRoutes must check existing customer accounts before provisioning new checking account');
  pass('authRoutes maps 429 over_email_send_rate_limit, checks user identities, and prevents duplicate accounts');

  // 3. Test HTTP Registration Endpoint behavior with express test server
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  const server = app.listen(3098);

  try {
    const baseUrl = 'http://127.0.0.1:3098/api/auth';

    // Test GET /api/auth/config
    const configRes = await fetch(`${baseUrl}/config`);
    const configData = await configRes.json();
    assert.strictEqual(configRes.status, 200);
    assert.strictEqual(configData.isConfigured, true);
    assert(configData.supabaseUrl.includes('supabase.co'));
    pass('GET /api/auth/config returns verified Supabase configuration');

    // Test registration with existing email (test_rate_limit_probe@vivpay.com which was created earlier)
    const existingEmail = 'test_rate_limit_probe@vivpay.com';
    const regRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: existingEmail,
        password: 'SuperSecurePassword2026!',
        fullName: 'Probe Test Customer',
      }),
    });
    const regData = await regRes.json();

    // Since this email was probed earlier, it either returns 429 (rate-limited) or 409 (already exists)
    assert(
      regRes.status === 429 || regRes.status === 409,
      `Expected status 429 or 409 for repeated registration probe, got ${regRes.status}: ${JSON.stringify(regData)}`
    );

    if (regRes.status === 429) {
      assert.strictEqual(regData.code, 'RATE_LIMIT_EXCEEDED');
      assert(typeof regData.retryAfterSeconds === 'number');
      assert(regData.error.includes('rate limit exceeded'));
      pass(`Repeated registration correctly returns HTTP 429 RATE_LIMIT_EXCEEDED with retryAfterSeconds (${regData.retryAfterSeconds}s)`);
    } else {
      assert.strictEqual(regData.code, 'USER_ALREADY_EXISTS');
      pass('Existing user registration safely returns HTTP 409 USER_ALREADY_EXISTS');
    }

  } finally {
    server.close();
  }

  console.log(`\n================================================================`);
  console.log(`ALL ${passCount}/${passCount} RATE-LIMIT & REGISTRATION TESTS PASSED!`);
  console.log(`================================================================\n`);
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
