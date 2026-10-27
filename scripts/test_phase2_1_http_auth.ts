/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { authRouter } from '../src/server/routes/authRoutes.ts';
import { getDatabase } from '../src/server/db/database.ts';

async function runHttpAuthTests() {
  console.log('====================================================');
  console.log('VIVPAY PHASE 2.1: HTTP AUTH API INTEGRATION TESTS');
  console.log('====================================================\n');

  // Initialize DB
  getDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  const server = app.listen(3099);

  try {
    const baseUrl = 'http://127.0.0.1:3099/api/auth';

    const testEmail = `carol_${Date.now()}@vivpay.com`;

    // 1. Test registration
    console.log('[TEST] Registering new customer via POST /api/auth/register...');
    const regRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'CarolSecurePassword2026!',
        fullName: 'Carol Danvers',
        phone: '+1 555-0199',
        currency: 'USD',
      }),
    });
    const regData = await regRes.json();
    if (regRes.status !== 201 || !regData.token || !regData.customer) {
      throw new Error(`Register failed: ${JSON.stringify(regData)}`);
    }
    console.log('[PASS] Customer Carol registered (HTTP 201) with token and profile.');

    const token = regData.token;

    // 2. Duplicate registration should return 409
    console.log('[TEST] Attempting duplicate registration...');
    const dupRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'AnotherPassword2026!',
        fullName: 'Carol Imposter',
      }),
    });
    if (dupRes.status !== 409) {
      throw new Error(`Expected HTTP 409, got ${dupRes.status}`);
    }
    console.log('[PASS] Duplicate registration rejected with HTTP 409 Conflict.');

    // 3. Test GET /api/auth/me without token -> should return 401
    console.log('[TEST] Requesting /api/auth/me without authentication...');
    const unauthRes = await fetch(`${baseUrl}/me`);
    if (unauthRes.status !== 401) {
      throw new Error(`Expected HTTP 401, got ${unauthRes.status}`);
    }
    console.log('[PASS] Unauthenticated request safely rejected with HTTP 401 Unauthorized.');

    // 4. Test GET /api/auth/me with valid token
    console.log('[TEST] Requesting /api/auth/me with Bearer token...');
    const authMeRes = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await authMeRes.json();
    if (authMeRes.status !== 200 || meData.customer.email !== testEmail) {
      throw new Error(`Failed to get authenticated profile: ${JSON.stringify(meData)}`);
    }
    console.log(`[PASS] Authenticated identity verified: ${meData.customer.fullName} (${meData.customer.email}).`);

    // 5. Test login with correct password
    console.log('[TEST] Logging in via POST /api/auth/login...');
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'carol@vivpay.com',
        password: 'CarolSecurePassword2026!',
      }),
    });
    const loginData = await loginRes.json();
    if (loginRes.status !== 200 || !loginData.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    console.log('[PASS] Login successful with fresh session token.');

    // 6. Test login with wrong password -> should return 401
    console.log('[TEST] Logging in with wrong password...');
    const wrongLoginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'carol@vivpay.com',
        password: 'WrongPassword!',
      }),
    });
    if (wrongLoginRes.status !== 401) {
      throw new Error(`Expected HTTP 401, got ${wrongLoginRes.status}`);
    }
    console.log('[PASS] Invalid password rejected with HTTP 401.');

    // 7. Test Logout
    console.log('[TEST] Logging out via POST /api/auth/logout...');
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (logoutRes.status !== 200) {
      throw new Error(`Logout failed: ${logoutRes.status}`);
    }
    console.log('[PASS] Logout successful (session invalidated in database).');

    // 8. Test /me with invalidated token -> should return 401
    const postLogoutRes = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (postLogoutRes.status !== 401) {
      throw new Error(`Expected HTTP 401 after logout, got ${postLogoutRes.status}`);
    }
    console.log('[PASS] Post-logout session token safely rejected with HTTP 401.');

    console.log('\n====================================================');
    console.log('ALL HTTP AUTH INTEGRATION TESTS PASSED CLEANLY!');
    console.log('====================================================\n');
  } finally {
    server.close();
  }
}

runHttpAuthTests().catch((err) => {
  console.error('HTTP Auth Test Failed:', err);
  process.exit(1);
});
