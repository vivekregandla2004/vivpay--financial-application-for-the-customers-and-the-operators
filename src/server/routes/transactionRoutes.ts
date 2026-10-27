/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Response } from 'express';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { requireCustomerAuth, AuthenticatedRequest } from '../auth/middleware.ts';
import { supabaseTransactionRepo, supabaseCategoryRepo, supabaseAccountRepo } from '../db/supabaseRepository.ts';

export const transactionRouter = Router();

// Protect all transaction routes with authentication
transactionRouter.use(requireCustomerAuth);

/**
 * GET /api/transactions/categories
 * List available categories (system defaults + customer custom categories from Supabase)
 */
transactionRouter.get('/categories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = await supabaseCategoryRepo.list(req.customer!.id);
    return res.json({
      categories,
      count: categories.length,
    });
  } catch (error: any) {
    console.error('Error fetching categories from Supabase:', error);
    return res.status(500).json({ error: 'Failed to retrieve categories.' });
  }
});

/**
 * POST /api/transactions/categories
 * Create a custom category for the customer in Supabase
 */
transactionRouter.post('/categories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, icon, color } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Category name is required.' });
    }

    const category = await supabaseCategoryRepo.createCustom(req.customer!.id, {
      name: name.trim(),
      icon: icon ? String(icon).trim() : 'Tag',
      color: color ? String(color).trim() : '#6366f1',
    });

    return res.status(201).json({
      message: 'Category created successfully in Supabase.',
      category,
    });
  } catch (error: any) {
    if (error.code === 'CATEGORY_DUPLICATE') {
      return res.status(409).json({ error: error.message });
    }
    console.error('Error creating category in Supabase:', error);
    return res.status(500).json({ error: 'Failed to create category.' });
  }
});

/**
 * GET /api/transactions/analytics/summary
 * Return deterministic financial summary metrics computed from Supabase
 */
transactionRouter.get('/analytics/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountId, startDate, endDate } = req.query as Record<string, string | undefined>;

    if (accountId) {
      const acc = await supabaseAccountRepo.findById(accountId, req.customer!.id);
      if (!acc) {
        return res.status(404).json({ error: 'Account not found or access denied.' });
      }
    }

    const summary = await supabaseTransactionRepo.getAnalyticsSummary(req.customer!.id, {
      accountId,
      startDate,
      endDate,
    });

    return res.json({ summary });
  } catch (error: any) {
    console.error('Error computing summary analytics from Supabase:', error);
    return res.status(500).json({ error: 'Failed to compute financial summary.' });
  }
});

/**
 * GET /api/transactions/analytics/monthly
 * Return monthly income, expenditure, and cash-flow trends from Supabase
 */
transactionRouter.get('/analytics/monthly', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountId, months } = req.query as Record<string, string | undefined>;
    const monthCount = months ? parseInt(months, 10) : 12;

    const monthlyTrends = await supabaseTransactionRepo.getMonthlyAnalytics(req.customer!.id, {
      accountId,
      months: isNaN(monthCount) ? 12 : monthCount,
    });

    return res.json({ monthlyTrends });
  } catch (error: any) {
    console.error('Error computing monthly trends from Supabase:', error);
    return res.status(500).json({ error: 'Failed to compute monthly trends.' });
  }
});

/**
 * GET /api/transactions/analytics/categories
 * Return spending grouped by category from Supabase
 */
transactionRouter.get('/analytics/categories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountId, startDate, endDate } = req.query as Record<string, string | undefined>;

    const categoryBreakdown = await supabaseTransactionRepo.getCategoryAnalytics(req.customer!.id, {
      accountId,
      startDate,
      endDate,
    });

    return res.json({ categoryBreakdown });
  } catch (error: any) {
    console.error('Error computing category analytics from Supabase:', error);
    return res.status(500).json({ error: 'Failed to compute category breakdown.' });
  }
});

/**
 * GET /api/transactions/analytics/top-categories
 * Return largest spending categories from Supabase
 */
transactionRouter.get('/analytics/top-categories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountId, limit, startDate, endDate } = req.query as Record<string, string | undefined>;
    const limitNum = limit ? parseInt(limit, 10) : 5;

    const topCategories = await supabaseTransactionRepo.getTopCategories(req.customer!.id, {
      accountId,
      limit: isNaN(limitNum) ? 5 : limitNum,
      startDate,
      endDate,
    });

    return res.json({ topCategories });
  } catch (error: any) {
    console.error('Error computing top categories from Supabase:', error);
    return res.status(500).json({ error: 'Failed to compute top categories.' });
  }
});

/**
 * GET /api/transactions/all
 * Retrieve all transactions for customer (paginated behind the scenes from Supabase) for analytics and twin
 */
transactionRouter.get('/all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountId, startDate, endDate } = req.query as Record<string, string | undefined>;

    if (accountId) {
      const acc = await supabaseAccountRepo.findById(accountId, req.customer!.id);
      if (!acc) {
        return res.status(404).json({ error: 'Account not found or access denied.' });
      }
    }

    const transactions = await supabaseTransactionRepo.listAllForCustomer(req.customer!.id, {
      accountId,
      startDate,
      endDate,
    });

    return res.json({
      transactions,
      count: transactions.length,
    });
  } catch (error: any) {
    console.error('Error fetching all customer transactions from Supabase:', error);
    return res.status(500).json({ error: 'Failed to retrieve transactions for analytics.' });
  }
});

/**
 * GET /api/transactions
 * List transactions with pagination and extensive filtering from Supabase
 */
transactionRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      accountId,
      categoryId,
      type,
      startDate,
      endDate,
      search,
      minAmount,
      maxAmount,
      sortBy,
      sortOrder,
      page,
      limit,
    } = req.query as Record<string, string | undefined>;

    if (type && type !== 'debit' && type !== 'credit') {
      return res.status(400).json({ error: 'Transaction type filter must be either "debit" or "credit".' });
    }

    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNum = limit ? Math.min(200, Math.max(1, parseInt(limit, 10))) : 50;
    const offset = (pageNum - 1) * limitNum;

    const minAmt = minAmount !== undefined && minAmount !== '' ? parseFloat(minAmount) : undefined;
    const maxAmt = maxAmount !== undefined && maxAmount !== '' ? parseFloat(maxAmount) : undefined;

    const { transactions, totalCount } = await supabaseTransactionRepo.listByCustomer(req.customer!.id, {
      accountId,
      categoryId,
      type: type as any,
      startDate,
      endDate,
      search,
      minAmount: !isNaN(minAmt as number) ? minAmt : undefined,
      maxAmount: !isNaN(maxAmt as number) ? maxAmt : undefined,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      limit: limitNum,
      offset,
    });

    return res.json({
      transactions,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error listing transactions from Supabase:', error);
    return res.status(500).json({ error: 'Failed to retrieve transactions.' });
  }
});

/**
 * POST /api/transactions
 * Manually record a transaction in Supabase
 */
transactionRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountId, date, description, amount, type, categoryId, isRecurring, balanceAfter } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required.' });
    }
    const account = await supabaseAccountRepo.findById(accountId, req.customer!.id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found or access denied.' });
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date must be formatted as YYYY-MM-DD.' });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ error: 'Description is required.' });
    }

    const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number.' });
    }

    if (type !== 'debit' && type !== 'credit') {
      return res.status(400).json({ error: 'Type must be either "debit" or "credit".' });
    }

    let finalCategoryId = categoryId;
    if (!finalCategoryId) {
      const categories = await supabaseCategoryRepo.list(req.customer!.id);
      const otherCat = categories.find((c) => c.slug === 'other') || categories[0];
      finalCategoryId = otherCat ? otherCat.id : 'other';
    }

    const transaction = await supabaseTransactionRepo.create({
      customerId: req.customer!.id,
      accountId,
      date,
      description: description.trim(),
      amount: parsedAmount,
      type,
      categoryId: finalCategoryId,
      isRecurring: Boolean(isRecurring),
      balanceAfter: typeof balanceAfter === 'number' ? balanceAfter : undefined,
    });

    return res.status(201).json({
      message: 'Transaction created successfully in Supabase.',
      transaction,
    });
  } catch (error: any) {
    console.error('Error creating transaction in Supabase:', error);
    return res.status(500).json({ error: error.message || 'Failed to create transaction.' });
  }
});

/**
 * GET /api/transactions/:transactionId
 * Retrieve an owned transaction from Supabase
 */
transactionRouter.get('/:transactionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { transactionId } = req.params;
    const transaction = await supabaseTransactionRepo.findById(transactionId, req.customer!.id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found or access denied.' });
    }

    return res.json({ transaction });
  } catch (error: any) {
    console.error('Error retrieving transaction from Supabase:', error);
    return res.status(500).json({ error: 'Failed to retrieve transaction.' });
  }
});

/**
 * PATCH /api/transactions/:transactionId/category
 * Correct transaction category in Supabase
 */
transactionRouter.patch('/:transactionId/category', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { transactionId } = req.params;
    const { categoryId, applyToMerchant } = req.body;

    if (!categoryId) {
      return res.status(400).json({ error: 'New category ID is required.' });
    }

    const category = await supabaseCategoryRepo.getById(categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const success = await supabaseTransactionRepo.updateCategory(
      transactionId,
      req.customer!.id,
      categoryId,
      Boolean(applyToMerchant)
    );

    if (!success) {
      return res.status(404).json({ error: 'Transaction not found or access denied.' });
    }

    const updated = await supabaseTransactionRepo.findById(transactionId, req.customer!.id);

    return res.json({
      message: 'Transaction category updated successfully in Supabase.',
      transaction: updated,
      appliedToMerchant: Boolean(applyToMerchant),
    });
  } catch (error: any) {
    console.error('Error updating category in Supabase:', error);
    return res.status(500).json({ error: 'Failed to update transaction category.' });
  }
});

/**
 * DELETE /api/transactions/:transactionId
 * Delete a single transaction in Supabase and revert balance
 */
transactionRouter.delete('/:transactionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { transactionId } = req.params;
    const success = await supabaseTransactionRepo.delete(transactionId, req.customer!.id);

    if (!success) {
      return res.status(404).json({ error: 'Transaction not found or access denied.' });
    }

    return res.json({
      success: true,
      message: 'Transaction deleted and balance adjusted in Supabase.',
    });
  } catch (error: any) {
    console.error('Error deleting transaction in Supabase:', error);
    return res.status(500).json({ error: 'Failed to delete transaction.' });
  }
});

/**
 * POST /api/transactions/analytics/python
 * Execute the real Python 3 analytics engine (scripts/python_analytics.py)
 * on authenticated customer ledger records or provided dataset.
 */
transactionRouter.post('/analytics/python', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.customer!.id;
    let transactions = req.body?.transactions;
    let startingBalance = Number(req.body?.startingBalance);
    if (!Number.isFinite(startingBalance)) {
      startingBalance = 0;
    }

    // If transactions parameter is undefined, pull real ledger from Supabase
    if (transactions === undefined || (!Array.isArray(transactions) && transactions !== null)) {
      transactions = await supabaseTransactionRepo.listAllForCustomer(customerId);
      const accounts = await supabaseAccountRepo.listByCustomer(customerId);
      startingBalance = accounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
    }

    const scriptPath = path.resolve(process.cwd(), 'scripts', 'python_analytics.py');
    const pythonProc = spawn('python3', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdoutData = '';
    let stderrData = '';

    pythonProc.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProc.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProc.on('close', (code) => {
      if (code !== 0) {
        console.error('Python analytics process exited with code', code);
        return res.status(500).json({
          error: 'Python analytics engine execution failed.',
          status: 'error',
        });
      }

      try {
        const parsed = JSON.parse(stdoutData);
        return res.json({
          ...parsed,
          executionMode: 'native_python_3',
        });
      } catch (parseErr: any) {
        return res.status(500).json({
          error: 'Failed to parse Python analytics JSON response.',
          raw: stdoutData,
        });
      }
    });

    pythonProc.on('error', (err) => {
      console.error('Failed to spawn Python process:', err);
      return res.status(500).json({
        error: 'Unable to launch Python analytics process.',
        message: err.message,
      });
    });

    // Write input payload to stdin and end
    pythonProc.stdin.write(JSON.stringify({ transactions, startingBalance }));
    pythonProc.stdin.end();
  } catch (error: any) {
    console.error('Error invoking Python analytics engine:', error);
    return res.status(500).json({ error: error.message || 'Internal server error in Python analytics route.' });
  }
});

