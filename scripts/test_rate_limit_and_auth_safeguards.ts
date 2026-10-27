/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { authRouter } from '../src/server/routes/authRoutes.ts';

async function testAuthSafeguards() {
  console.log('--- Testing VivPay Auth Rate Limit & Safeguards ---');

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  const server = app.listen(3105);

  try {
    const baseUrl = 'http://127.0.0.1:3105/api/auth';

    // 1. Test missing fields validation
    console.log('[Test 1] Missing fields validation...');
    const invalidRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad' }),
    });
    if (invalidRes.status !== 400) {
      throw new Error(`Expected 400 for invalid body, got ${invalidRes.status}`);
    }
    console.log('✓ Validation correctly returned 400 for invalid payload.');

    // 2. Test registration request to live Supabase backend
    console.log('[Test 2] Submitting registration request to live endpoint...');
    const regRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test_safeguard@vivpay.com',
        password: 'Password123!',
        fullName: 'Test Safeguard',
      }),
    });
    const regData = await regRes.json();
    console.log(`Registration status: ${regRes.status}`, regData);

    if (regRes.status === 429) {
      console.log('✓ HTTP 429 Rate Limit handled cleanly by backend:');
      console.log(`  - Code: ${regData.code}`);
      console.log(`  - Message: ${regData.error}`);
      console.log(`  - retryAfterSeconds: ${regData.retryAfterSeconds}`);
      if (!regData.retryAfterSeconds || regData.code !== 'RATE_LIMIT_EXCEEDED') {
        throw new Error('429 response missing standard rate limit contract!');
      }
    } else if (regRes.status === 201) {
      console.log('✓ Successfully registered customer:', regData.customer?.email);
    } else if (regRes.status === 409) {
      console.log('✓ Existing customer prevented duplicate record (409):', regData.error);
    } else {
      console.log(`Received status ${regRes.status}:`, regData);
    }

    // 3. Test config endpoint fallback
    console.log('[Test 3] Testing /config endpoint...');
    const configRes = await fetch(`${baseUrl}/config`);
    const configData = await configRes.json();
    console.log('Config status:', configRes.status, configData);
    if (!configData.isConfigured || !configData.supabaseUrl) {
      throw new Error('Expected Supabase to be configured with URL in /config');
    }
    console.log('✓ /config returned verified Supabase configuration.');

    console.log('\n--- All Auth Safeguard Checks Completed Successfully ---');
  } finally {
    server.close();
  }
}

testAuthSafeguards().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
