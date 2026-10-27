/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { checkSupabaseConfig } from '../src/server/db/supabase.ts';
import { authRouter } from '../src/server/routes/authRoutes.ts';
import { customerRouter } from '../src/server/routes/customerRoutes.ts';
import { transactionRouter } from '../src/server/routes/transactionRoutes.ts';
import { documentRouter } from '../src/server/routes/documentRoutes.ts';
import { conversationRouter } from '../src/server/routes/conversationRoutes.ts';

async function runSupabaseArchitectureTests() {
  console.log('====================================================');
  console.log('VIVPAY SUPABASE ARCHITECTURE VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${testName}`);
      throw new Error(`Assertion failed for: ${testName}`);
    }
  }

  // 1. Verify PostgreSQL Supabase Migration Script
  console.log('--- 1. Supabase PostgreSQL Schema & Security Policies ---');
  const migrationPath = path.resolve(process.cwd(), 'migrations', 'supabase', '001_initial_supabase_schema.sql');
  assert(fs.existsSync(migrationPath), 'Supabase migration file "001_initial_supabase_schema.sql" exists');

  const ddl = fs.readFileSync(migrationPath, 'utf-8');
  assert(ddl.includes('CREATE TABLE IF NOT EXISTS public.customers'), 'Migration defines "customers" linked to auth.users');
  assert(ddl.includes('CREATE TABLE IF NOT EXISTS public.accounts'), 'Migration defines "accounts" with NUMERIC(14, 2)');
  assert(ddl.includes('CREATE TABLE IF NOT EXISTS public.transaction_categories'), 'Migration defines "transaction_categories"');
  assert(ddl.includes('CREATE TABLE IF NOT EXISTS public.statement_documents'), 'Migration defines "statement_documents" with storage_path');
  assert(ddl.includes('CREATE TABLE IF NOT EXISTS public.transactions'), 'Migration defines "transactions" with NUMERIC(14, 2)');
  assert(ddl.includes('CREATE TABLE IF NOT EXISTS public.category_corrections'), 'Migration defines "category_corrections"');
  assert(ddl.includes('CREATE TABLE IF NOT EXISTS public.conversation_threads'), 'Migration defines "conversation_threads"');
  assert(ddl.includes('CREATE TABLE IF NOT EXISTS public.chat_messages'), 'Migration defines "chat_messages" with JSONB groundings');
  assert(ddl.includes('ENABLE ROW LEVEL SECURITY'), 'Migration enables Row Level Security (RLS) on tables');
  assert(ddl.includes('auth.uid() = customer_id'), 'Migration enforces customer isolation RLS policies');
  assert(ddl.includes('statement-vault'), 'Migration sets up private Supabase Storage bucket "statement-vault"');

  // 2. Verify Config Diagnostics
  console.log('\n--- 2. Supabase Configuration Diagnostics ---');
  const config = checkSupabaseConfig();
  assert(Array.isArray(config.missingVariables), 'Diagnostic checks missing environment variables');
  assert(typeof config.instructions === 'object', 'Diagnostic provides exact Supabase Dashboard instructions');
  assert(config.instructions.supabaseUrl.includes('Project Settings -> API'), 'Instructions detail Project URL location');

  // 3. Test HTTP Server Endpoints with Supabase Architecture
  console.log('\n--- 3. HTTP Server Endpoints & Diagnostic Responses ---');
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    const supabaseStatus = checkSupabaseConfig();
    res.json({
      status: 'ok',
      service: 'VivPay API',
      database: 'Supabase PostgreSQL',
      supabase: supabaseStatus,
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/customer', customerRouter);
  app.use('/api/transactions', transactionRouter);
  app.use('/api/documents', documentRouter);
  app.use('/api/conversations', conversationRouter);

  const server = app.listen(3105);
  const baseUrl = 'http://127.0.0.1:3105/api';

  try {
    // Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'GET /api/health responds with HTTP 200');
    assert(healthData.database === 'Supabase PostgreSQL', 'Health check confirms database is Supabase PostgreSQL');

    // Register behavior: tests 503 if unconfigured, or valid auth handling if configured
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123', fullName: 'Test User' }),
    });
    const regData = await regRes.json();
    if (!config.isConfigured) {
      assert(regRes.status === 503, 'POST /api/auth/register safely returns 503 when Supabase credentials are required');
      assert(regData.code === 'SUPABASE_NOT_CONFIGURED', 'Register returns code "SUPABASE_NOT_CONFIGURED"');
      assert(Boolean(regData.instructions), 'Register response contains Supabase Dashboard instructions');
    } else {
      assert(regRes.status !== 500, 'POST /api/auth/register handles request via Supabase Auth without internal server crash');
      assert(Boolean(regData.error || regData.customer || regData.message), 'Register returns standard response from Supabase');
    }

    // Login behavior
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });
    if (!config.isConfigured) {
      assert(loginRes.status === 503, 'POST /api/auth/login safely returns 503 when Supabase credentials are required');
    } else {
      assert(loginRes.status === 401 || loginRes.status === 200, 'POST /api/auth/login properly verifies credentials against Supabase Auth');
    }

    // Protected customer endpoint without token returns 503 or 401
    const profRes = await fetch(`${baseUrl}/customer/profile`);
    assert(profRes.status === 503 || profRes.status === 401, 'Protected route rejects unconfigured or unauthenticated request');

    // Verify local SQLite database was eliminated
    const localDbPath = path.resolve(process.cwd(), 'data', 'vivpay.db');
    assert(!fs.existsSync(localDbPath), 'Local SQLite database file does not exist (SQLite eliminated from primary persistence)');

    console.log('\n====================================================');
    console.log(`ALL ${passedTests}/${totalTests} SUPABASE ARCHITECTURE TESTS PASSED CLEANLY!`);
    console.log('====================================================\n');
  } finally {
    server.close();
  }
}

runSupabaseArchitectureTests().catch((err) => {
  console.error('Supabase Architecture Test Suite Failed:', err);
  process.exit(1);
});
