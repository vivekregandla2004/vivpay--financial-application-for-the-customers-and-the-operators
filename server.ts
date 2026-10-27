/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { checkSupabaseConfig } from './src/server/db/supabase.ts';
import { authRouter } from './src/server/routes/authRoutes.ts';
import { customerRouter } from './src/server/routes/customerRoutes.ts';
import { transactionRouter } from './src/server/routes/transactionRoutes.ts';
import { documentRouter } from './src/server/routes/documentRoutes.ts';
import { conversationRouter } from './src/server/routes/conversationRoutes.ts';
import { groupRouter } from './src/server/routes/groupRoutes.ts';
import { operationsRouter } from './src/server/routes/operationsRoutes.ts';
import { adminRouter } from './src/server/routes/adminRoutes.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Health check endpoint with Supabase configuration status
app.get('/api/health', (_req: Request, res: Response) => {
  const supabaseStatus = checkSupabaseConfig();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'VivPay API',
    database: 'Supabase PostgreSQL',
    supabase: {
      isConfigured: supabaseStatus.isConfigured,
      hasUrl: supabaseStatus.hasUrl,
      hasAnonKey: supabaseStatus.hasAnonKey,
      hasServiceRoleKey: supabaseStatus.hasServiceRoleKey,
      missingVariables: supabaseStatus.missingVariables,
      instructions: !supabaseStatus.isConfigured ? supabaseStatus.instructions : undefined,
    },
    environment: isProd ? 'production' : 'development',
  });
});

// Mount Supabase-backed API routes
app.use('/api/auth', authRouter);
app.use('/api/customer', customerRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/documents', documentRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/groups', groupRouter);
app.use('/api/operations', operationsRouter);
app.use('/api/admin', adminRouter);

// 404 handler for unknown API endpoints (prevents Vite middleware from returning HTML for API calls)
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({
    error: 'API endpoint not found',
    code: 'NOT_FOUND',
  });
});

// Global Error Handler for API
app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API error:', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
  });
});

// Configure Vite middleware or static serving
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VivPay Server (Supabase Architecture) is running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VivPay server:', err);
  process.exit(1);
});
