/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Transaction, FinancialSummary, Account } from '../types/database.ts';
import {
  PieChart,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles,
  Calendar,
  Repeat,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  Smartphone,
  CreditCard,
  Building,
  Filter,
  ChevronRight,
  ChevronDown,
  X,
  Search,
  ExternalLink,
  Wallet,
  BarChart3,
  Percent,
  Receipt,
  ChevronLeft,
  Plus,
  MoreVertical,
  Edit3,
  Trash2,
  Archive,
  Eye,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import { api } from '../services/api.ts';
import {
  AnalysisResult,
  CanonicalTransaction,
} from '../lib/finance/types.ts';
import {
  computeMonthlySummaries,
  detectRecurringSubscriptions,
  computeBehavioralMetrics,
  buildChartDatasets,
  generateAutomatedInsights,
} from '../lib/finance/analytics.ts';
import { computeFinancialHealthScore } from '../lib/finance/intelligence/health.ts';
import {
  classifyTransactionType,
  calculateMonthlyTrends,
  calculateCategoryBreakdown,
  calculateTopMerchants,
} from '../lib/analytics/financialEngine.ts';
import { extractMerchantAndMethod } from '../lib/finance/normalize.ts';
import { computeSpendingPredictions, SpendingPrediction } from '../lib/finance/intelligence/prediction.ts';
import { FinancialInsightsSection } from './FinancialInsightsSection.tsx';

export type AnalyticsViewTab =
  | 'overview'
  | 'trends'
  | 'categories'
  | 'cashflow'
  | 'accounts'
  | 'transactions'
  | 'recurring'
  | 'health'
  | 'insights';

export type DateRangePreset = 'all' | 'all_time' | 'this_month' | '30d' | '90d' | 'ytd' | 'custom';

interface SpendingAnalyticsProps {
  selectedAccountId: string | 'all';
  onSelectAccount?: (id: string | 'all') => void;
  currency?: string;
  refreshTrigger?: number;
  transactions?: (Transaction & { categoryName?: string; categoryColor?: string; reference?: string; originalDescription?: string })[];
  accounts?: Account[];
  summary?: FinancialSummary | null;
  isDemo?: boolean;
  analysis?: AnalysisResult | null;
  onNavigateToLedger?: (filter?: { categoryId?: string; search?: string }) => void;
  onRefreshAccounts?: () => void | Promise<void>;
  onAccountCreated?: (account: Account) => void;
  onAccountUpdated?: (account: Account) => void;
  onAccountDeleted?: (accountId: string) => void;
}

export const SpendingAnalytics: React.FC<SpendingAnalyticsProps> = ({
  selectedAccountId,
  onSelectAccount,
  currency = 'INR',
  transactions = [],
  accounts = [],
  summary: propSummary,
  isDemo = false,
  analysis: propAnalysis,
  onNavigateToLedger,
  onRefreshAccounts,
  onAccountCreated,
  onAccountUpdated,
  onAccountDeleted,
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<AnalyticsViewTab>('overview');

  // Time filters - default to 'this_month' so empty-period banner appears if statement is outside current month
  const [datePreset, setDatePreset] = useState<DateRangePreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Trends grouping: monthly or weekly
  const [trendsGrouping, setTrendsGrouping] = useState<'monthly' | 'weekly'>('monthly');

  // Category drill-down state
  const [drillDownCategory, setDrillDownCategory] = useState<string | null>(null);

  // Transaction history interactive view state
  const [txSearch, setTxSearch] = useState<string>('');
  const [txCategoryFilter, setTxCategoryFilter] = useState<string>('all');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'debit' | 'credit'>('all');
  const [txSortBy, setTxSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [txPage, setTxPage] = useState<number>(1);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  // Account CRUD modal and action states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [detailsAccount, setDetailsAccount] = useState<Account | null>(null);
  const [openDropdownAccountId, setOpenDropdownAccountId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [addForm, setAddForm] = useState({
    accountName: '',
    accountType: 'checking',
    institutionName: '',
    accountNumber: '',
    initialBalance: '0',
    currency: currency || 'INR',
  });

  const [editForm, setEditForm] = useState({
    accountName: '',
    accountType: 'checking',
    institutionName: '',
  });

  // Close 3-dot dropdown menu on outside click
  React.useEffect(() => {
    const handleClickOutside = () => setOpenDropdownAccountId(null);
    if (openDropdownAccountId) {
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdownAccountId]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.accountName.trim()) {
      setActionFeedback({ type: 'error', message: 'Account display name is required.' });
      return;
    }
    if (!addForm.institutionName.trim()) {
      setActionFeedback({ type: 'error', message: 'Financial institution name is required.' });
      return;
    }

    const initBal = Number(addForm.initialBalance);
    if (!Number.isFinite(initBal) || initBal < 0) {
      setActionFeedback({ type: 'error', message: 'Initial balance must be a non-negative number.' });
      return;
    }

    setIsSubmitting(true);
    setActionFeedback(null);
    try {
      if (isDemo) {
        const last4 = addForm.accountNumber.replace(/\D/g, '').slice(-4) || `${Math.floor(1000 + Math.random() * 9000)}`;
        const demoAccount: Account = {
          id: `demo-acc-${Date.now()}`,
          customerId: 'demo-customer',
          accountName: addForm.accountName.trim(),
          accountNumberMasked: `•••• ${last4}`,
          accountType: addForm.accountType as any,
          institutionName: addForm.institutionName.trim(),
          balance: initBal,
          currency: (addForm.currency.trim().toUpperCase() || currency || 'INR'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (onAccountCreated) {
          onAccountCreated(demoAccount);
        }
        setActionFeedback({
          type: 'success',
          message: `Account "${addForm.accountName}" created successfully!`,
        });
        setIsAddModalOpen(false);
        setAddForm({
          accountName: '',
          accountType: 'checking',
          institutionName: '',
          accountNumber: '',
          initialBalance: '0',
          currency: currency || 'INR',
        });
        if (onRefreshAccounts) {
          await onRefreshAccounts();
        }
        return;
      }

      const res = await api.createAccount({
        accountName: addForm.accountName.trim(),
        accountType: addForm.accountType,
        institutionName: addForm.institutionName.trim(),
        accountNumber: addForm.accountNumber.trim(),
        initialBalance: initBal,
        currency: addForm.currency.trim().toUpperCase() || currency || 'INR',
      });

      setActionFeedback({
        type: 'success',
        message: res.message || `Account "${addForm.accountName}" created successfully!`,
      });
      setIsAddModalOpen(false);
      setAddForm({
        accountName: '',
        accountType: 'checking',
        institutionName: '',
        accountNumber: '',
        initialBalance: '0',
        currency: currency || 'INR',
      });
      if (onRefreshAccounts) {
        await onRefreshAccounts();
      }
    } catch (err: any) {
      console.error('Account creation error:', err);
      setActionFeedback({
        type: 'error',
        message: err.data?.error || err.message || 'Failed to create account.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    if (!editForm.accountName.trim()) {
      setActionFeedback({ type: 'error', message: 'Account name cannot be empty.' });
      return;
    }
    if (!editForm.institutionName.trim()) {
      setActionFeedback({ type: 'error', message: 'Institution name cannot be empty.' });
      return;
    }

    setIsSubmitting(true);
    setActionFeedback(null);
    try {
      if (isDemo) {
        const updated: Account = {
          ...editingAccount,
          accountName: editForm.accountName.trim(),
          institutionName: editForm.institutionName.trim(),
          accountType: editForm.accountType as any,
          updatedAt: new Date().toISOString(),
        };
        if (onAccountUpdated) {
          onAccountUpdated(updated);
        }
        setActionFeedback({
          type: 'success',
          message: `Account "${editForm.accountName}" updated successfully!`,
        });
        setEditingAccount(null);
        if (onRefreshAccounts) {
          await onRefreshAccounts();
        }
        return;
      }

      const res = await api.updateAccount(editingAccount.id, {
        accountName: editForm.accountName.trim(),
        institutionName: editForm.institutionName.trim(),
        accountType: editForm.accountType,
      });

      setActionFeedback({
        type: 'success',
        message: res.message || `Account "${editForm.accountName}" updated successfully!`,
      });
      setEditingAccount(null);
      if (onRefreshAccounts) {
        await onRefreshAccounts();
      }
    } catch (err: any) {
      console.error('Account update error:', err);
      setActionFeedback({
        type: 'error',
        message: err.data?.error || err.message || 'Failed to update account.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletingAccount) return;
    setIsSubmitting(true);
    setActionFeedback(null);
    try {
      if (isDemo) {
        const hasTransactions = transactions.some((t) => t.accountId === deletingAccount.id);
        if (hasTransactions) {
          setActionFeedback({
            type: 'error',
            message: 'This account has linked ledger transactions. Financial accounting standards prohibit deleting active ledger accounts. Please use "Archive Safe" instead to deactivate without deleting transaction history.',
          });
          return;
        }
        if (accounts.length <= 1) {
          setActionFeedback({
            type: 'error',
            message: "Cannot delete the customer's only remaining account. At least one account is required to maintain your financial profile.",
          });
          return;
        }
        if (onAccountDeleted) {
          onAccountDeleted(deletingAccount.id);
        }
        setActionFeedback({
          type: 'success',
          message: `Account "${deletingAccount.accountName}" deleted successfully.`,
        });
        if (selectedAccountId === deletingAccount.id && onSelectAccount) {
          onSelectAccount('all');
        }
        setDeletingAccount(null);
        if (onRefreshAccounts) {
          await onRefreshAccounts();
        }
        return;
      }

      const res = await api.deleteAccount(deletingAccount.id);
      setActionFeedback({
        type: 'success',
        message: res.message || `Account "${deletingAccount.accountName}" deleted successfully.`,
      });
      if (selectedAccountId === deletingAccount.id && onSelectAccount) {
        onSelectAccount('all');
      }
      setDeletingAccount(null);
      if (onRefreshAccounts) {
        await onRefreshAccounts();
      }
    } catch (err: any) {
      console.error('Account deletion error:', err);
      setActionFeedback({
        type: 'error',
        message: err.data?.error || err.message || 'Failed to delete account.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveAccount = async () => {
    if (!deletingAccount) return;
    setIsSubmitting(true);
    setActionFeedback(null);
    try {
      const archivedName = deletingAccount.accountName.includes('[Archived]')
        ? deletingAccount.accountName
        : `${deletingAccount.accountName} [Archived]`;

      if (isDemo) {
        const archivedAcc: Account = {
          ...deletingAccount,
          accountName: archivedName,
          updatedAt: new Date().toISOString(),
        };
        if (onAccountUpdated) {
          onAccountUpdated(archivedAcc);
        }
        setActionFeedback({
          type: 'success',
          message: `Account "${deletingAccount.accountName}" archived successfully. Financial ledger and transactions preserved.`,
        });
        setDeletingAccount(null);
        if (onRefreshAccounts) {
          await onRefreshAccounts();
        }
        return;
      }

      const res = await api.updateAccount(deletingAccount.id, {
        accountName: archivedName,
      });

      setActionFeedback({
        type: 'success',
        message: `Account "${deletingAccount.accountName}" archived successfully. Financial ledger and transactions preserved.`,
      });
      setDeletingAccount(null);
      if (onRefreshAccounts) {
        await onRefreshAccounts();
      }
    } catch (err: any) {
      console.error('Account archive error:', err);
      setActionFeedback({
        type: 'error',
        message: err.data?.error || err.message || 'Failed to archive account.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currencySymbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';

  const formatMoney = (amount: number) => {
    const locale = currency === 'INR' ? 'en-IN' : 'en-US';
    return `${currencySymbol}${Math.abs(amount).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // 1. Account Filtering
  const accountFilteredTransactions = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    if (selectedAccountId === 'all') return transactions;
    return transactions.filter((t) => t.accountId === selectedAccountId);
  }, [transactions, selectedAccountId]);

  // Determine date bounds of the dataset
  const datasetDateBounds = useMemo(() => {
    if (accountFilteredTransactions.length === 0) return { min: '', max: '' };
    const dates = accountFilteredTransactions.map((t) => t.date).sort();
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [accountFilteredTransactions]);

  // Compute active date boundaries based on preset or custom range
  const activeDateRange = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    if (datePreset === 'all' || datePreset === 'all_time') {
      return { start: '', end: '' };
    }
    if (datePreset === 'this_month') {
      const start = `${y}-${m}-01`;
      return { start, end: todayStr };
    }
    if (datePreset === '30d') {
      const past = new Date(today);
      past.setDate(past.getDate() - 30);
      const py = past.getFullYear();
      const pm = String(past.getMonth() + 1).padStart(2, '0');
      const pd = String(past.getDate()).padStart(2, '0');
      return { start: `${py}-${pm}-${pd}`, end: todayStr };
    }
    if (datePreset === '90d') {
      const past = new Date(today);
      past.setDate(past.getDate() - 90);
      const py = past.getFullYear();
      const pm = String(past.getMonth() + 1).padStart(2, '0');
      const pd = String(past.getDate()).padStart(2, '0');
      return { start: `${py}-${pm}-${pd}`, end: todayStr };
    }
    if (datePreset === 'ytd') {
      return { start: `${y}-01-01`, end: todayStr };
    }
    if (datePreset === 'custom') {
      return { start: customStartDate, end: customEndDate };
    }
    return { start: '', end: '' };
  }, [datePreset, customStartDate, customEndDate]);

  // 2. Date Filtering
  const currentPeriodTransactions = useMemo(() => {
    return accountFilteredTransactions.filter((t) => {
      if (activeDateRange.start && t.date < activeDateRange.start) return false;
      if (activeDateRange.end && t.date > activeDateRange.end) return false;
      return true;
    });
  }, [accountFilteredTransactions, activeDateRange]);

  // 3. Previous Period for Comparison (matching duration)
  const previousPeriodTransactions = useMemo(() => {
    if (!activeDateRange.start || !activeDateRange.end) return [];
    const start = new Date(activeDateRange.start);
    const end = new Date(activeDateRange.end);
    const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - diffDays);

    const py1 = prevStart.getFullYear();
    const pm1 = String(prevStart.getMonth() + 1).padStart(2, '0');
    const pd1 = String(prevStart.getDate()).padStart(2, '0');
    const prevStartStr = `${py1}-${pm1}-${pd1}`;

    const py2 = prevEnd.getFullYear();
    const pm2 = String(prevEnd.getMonth() + 1).padStart(2, '0');
    const pd2 = String(prevEnd.getDate()).padStart(2, '0');
    const prevEndStr = `${py2}-${pm2}-${pd2}`;

    return accountFilteredTransactions.filter((t) => t.date >= prevStartStr && t.date <= prevEndStr);
  }, [accountFilteredTransactions, activeDateRange]);

  // 4. Metrics for Current Period
  const currentMetrics = useMemo(() => {
    let pureIncome = 0;
    let pureExpenses = 0;
    let grossCredits = 0;
    let grossDebits = 0;
    let refundCredits = 0;

    for (const t of currentPeriodTransactions) {
      const amt = Number(t.amount) || 0;
      const c = classifyTransactionType(t);
      if (t.type === 'credit') {
        grossCredits += amt;
        if (c.isRefundOrReversal) {
          refundCredits += amt;
        } else if (c.isPureIncome) {
          pureIncome += amt;
        }
      } else {
        grossDebits += amt;
        if (c.isPureExpense) {
          pureExpenses += amt;
        }
      }
    }

    const netAdjustedExpenses = Math.max(0, pureExpenses - refundCredits);
    const netCashFlow = Number((pureIncome - netAdjustedExpenses).toFixed(2));
    const rawSavingsRate =
      pureIncome > 0 ? Math.max(0, (((pureIncome - netAdjustedExpenses) / pureIncome) * 100)) : 0;
    const savingsRate =
      rawSavingsRate > 0 && rawSavingsRate < 0.1
        ? Number(rawSavingsRate.toFixed(2))
        : Number(rawSavingsRate.toFixed(1));

    return {
      pureIncome: Number(pureIncome.toFixed(2)),
      pureExpenses: Number(pureExpenses.toFixed(2)),
      netAdjustedExpenses: Number(netAdjustedExpenses.toFixed(2)),
      refundCredits: Number(refundCredits.toFixed(2)),
      netCashFlow,
      savingsRate,
      grossCredits: Number(grossCredits.toFixed(2)),
      grossDebits: Number(grossDebits.toFixed(2)),
      count: currentPeriodTransactions.length,
    };
  }, [currentPeriodTransactions]);

  // 5. Metrics for Previous Period
  const previousMetrics = useMemo(() => {
    if (previousPeriodTransactions.length === 0) return null;
    let pureIncome = 0;
    let pureExpenses = 0;
    let refundCredits = 0;

    for (const t of previousPeriodTransactions) {
      const amt = Number(t.amount) || 0;
      const c = classifyTransactionType(t);
      if (t.type === 'credit') {
        if (c.isRefundOrReversal) {
          refundCredits += amt;
        } else if (c.isPureIncome) {
          pureIncome += amt;
        }
      } else {
        if (c.isPureExpense) {
          pureExpenses += amt;
        }
      }
    }

    const netAdjustedExpenses = Math.max(0, pureExpenses - refundCredits);
    const netCashFlow = Number((pureIncome - netAdjustedExpenses).toFixed(2));
    const rawSavingsRate =
      pureIncome > 0 ? Math.max(0, (((pureIncome - netAdjustedExpenses) / pureIncome) * 100)) : 0;
    const savingsRate =
      rawSavingsRate > 0 && rawSavingsRate < 0.1
        ? Number(rawSavingsRate.toFixed(2))
        : Number(rawSavingsRate.toFixed(1));

    return {
      pureIncome: Number(pureIncome.toFixed(2)),
      pureExpenses: Number(pureExpenses.toFixed(2)),
      netAdjustedExpenses: Number(netAdjustedExpenses.toFixed(2)),
      netCashFlow,
      savingsRate,
      count: previousPeriodTransactions.length,
    };
  }, [previousPeriodTransactions]);

  // Calculate percentage delta
  const computeDelta = (current: number, previous: number | null | undefined): { pct: number; label: string; positive: boolean } | null => {
    if (previous === null || previous === undefined || previous === 0) return null;
    const diff = current - previous;
    const pct = Number(((diff / Math.abs(previous)) * 100).toFixed(1));
    return {
      pct,
      label: `${pct >= 0 ? '+' : ''}${pct}%`,
      positive: pct >= 0,
    };
  };

  const incomeDelta = computeDelta(currentMetrics.pureIncome, previousMetrics?.pureIncome);
  const expenseDelta = computeDelta(currentMetrics.pureExpenses, previousMetrics?.pureExpenses);
  const netDelta = computeDelta(currentMetrics.netCashFlow, previousMetrics?.netCashFlow);

  // 6. Deep Analytics Engine (Calculated on current period transactions)
  const computedAnalysis = useMemo<AnalysisResult | null>(() => {
    if (currentPeriodTransactions.length === 0) return null;

    const canonicalList: CanonicalTransaction[] = currentPeriodTransactions.map((t, idx) => {
      const extracted = extractMerchantAndMethod(t.description, (t as any).reference || null);
      const cleanMerchant = (t as any).merchant || extracted.merchant || null;
      return {
        id: t.id,
        date: t.date,
        description: extracted.cleanDescription || t.description,
        originalDescription: (t as any).originalDescription || (t as any).rawDescription || t.description,
        amount: Number(t.amount) || 0,
        debit: t.type === 'debit' ? Number(t.amount) || 0 : 0,
        credit: t.type === 'credit' ? Number(t.amount) || 0 : 0,
        balance: t.balanceAfter ?? null,
        reference: (t as any).reference || null,
        merchant: cleanMerchant,
        upiHandle: extracted.upiHandle,
        paymentMethod: extracted.paymentMethod,
        category: (t.categoryName || 'Others') as any,
        direction: t.type as any,
        confidence: 0.9,
        reviewRequired: false,
        sourceFile: 'Statement',
        sourceSheet: 'Transactions',
        sourceRow: idx + 1,
        isRecurring: t.isRecurring,
      };
    });

    const monthlySummaries = computeMonthlySummaries(canonicalList);
    const recurringCandidates = detectRecurringSubscriptions(canonicalList);
    const metrics = computeBehavioralMetrics(canonicalList, monthlySummaries);
    const charts = buildChartDatasets(canonicalList, monthlySummaries);
    const insights = generateAutomatedInsights(
      monthlySummaries,
      charts.categoryBreakdown,
      recurringCandidates,
      metrics
    );
    const health = computeFinancialHealthScore(canonicalList, monthlySummaries, metrics, recurringCandidates);

    return {
      success: true,
      provider: { name: 'Verified Statement', confidence: 0.95, format: 'Bank Ledger' },
      selectedSheet: 'Active Statement',
      sheetDiagnostics: [],
      transactions: canonicalList,
      diagnostics: {
        fileName: 'Active Statement',
        detectedProvider: 'Verified Statement',
        providerConfidence: 0.95,
        selectedSheet: 'Active Statement',
        sheetSelectionReason: 'User Selected Ledger',
        totalSheets: 1,
        totalRowsParsed: canonicalList.length,
        validRowCount: canonicalList.length,
        invalidRowCount: 0,
        duplicateCount: 0,
        suspectedDuplicateCount: 0,
        ambiguousDateCount: 0,
        lowConfidenceCategoryCount: 0,
        dateRange: {
          from: canonicalList[0]?.date || '',
          to: canonicalList[canonicalList.length - 1]?.date || '',
        },
        warnings: [],
        errors: [],
      },
      monthlySummaries,
      recurringCandidates,
      metrics,
      charts,
      insights,
      health,
      currency,
    };
  }, [currentPeriodTransactions, currency]);

  // Category breakdown with drilldown
  const categoriesList = computedAnalysis?.charts.categoryBreakdown || [];

  // Transactions belonging to the currently selected drilldown category
  const drillDownTransactions = useMemo(() => {
    if (!drillDownCategory) return [];
    return currentPeriodTransactions.filter((t) => (t.categoryName || 'Others') === drillDownCategory);
  }, [drillDownCategory, currentPeriodTransactions]);

  // Account breakdown calculation
  const accountBreakdown = useMemo(() => {
    if (accounts.length === 0) return [];
    return accounts.map((acc) => {
      const accTxs = currentPeriodTransactions.filter((t) => t.accountId === acc.id);
      let income = 0;
      let expenses = 0;
      let refunds = 0;
      for (const t of accTxs) {
        const amt = Number(t.amount) || 0;
        const c = classifyTransactionType(t);
        if (t.type === 'credit') {
          if (c.isRefundOrReversal) refunds += amt;
          else if (c.isPureIncome) income += amt;
        }
        if (t.type === 'debit' && c.isPureExpense) expenses += amt;
      }
      const netAdjustedExpenses = Math.max(0, expenses - refunds);
      return {
        account: acc,
        txCount: accTxs.length,
        income: Number(income.toFixed(2)),
        expenses: Number(netAdjustedExpenses.toFixed(2)),
        net: Number((income - netAdjustedExpenses).toFixed(2)),
      };
    });
  }, [accounts, currentPeriodTransactions]);

  // Canonical Monthly Trends from financial engine
  const monthlyTrends = useMemo(() => {
    return calculateMonthlyTrends(currentPeriodTransactions);
  }, [currentPeriodTransactions]);

  // Canonical Category Breakdown from financial engine
  const canonicalCategories = useMemo(() => {
    return calculateCategoryBreakdown(currentPeriodTransactions);
  }, [currentPeriodTransactions]);

  // Canonical Top Merchants & Counterparties from financial engine
  const canonicalTopMerchants = useMemo(() => {
    return calculateTopMerchants(currentPeriodTransactions, 6);
  }, [currentPeriodTransactions]);

  // Subscriptions & Recurring
  const recurringList = computedAnalysis?.recurringCandidates || [];
  const monthlyRecurringCommitment = recurringList.reduce((sum, r) => sum + (r.estimatedMonthlyCost || r.averageAmount || 0), 0);

  // Explainable Spending Predictions & Projections
  const predictions = useMemo<SpendingPrediction | null>(() => {
    return computeSpendingPredictions(currentPeriodTransactions, monthlyTrends, recurringList);
  }, [currentPeriodTransactions, monthlyTrends, recurringList]);

  // Weekly trend summaries
  const weeklySummaries = useMemo(() => {
    if (currentPeriodTransactions.length === 0) return [];
    const map = new Map<string, { week: string; label: string; income: number; expenses: number; netSavings: number; savingsRate: number; count: number }>();

    for (const t of currentPeriodTransactions) {
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      // Start of week (Monday)
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(d);
      startOfWeek.setDate(diff);
      const weekKey = startOfWeek.toISOString().split('T')[0];
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      const label = `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      const amt = Number(t.amount) || 0;
      const c = classifyTransactionType(t);
      const existing = map.get(weekKey) || { week: weekKey, label, income: 0, expenses: 0, netSavings: 0, savingsRate: 0, count: 0 };
      existing.count += 1;
      if (t.type === 'credit' && c.isPureIncome) existing.income += amt;
      if (t.type === 'debit' && c.isPureExpense) existing.expenses += amt;
      map.set(weekKey, existing);
    }

    return Array.from(map.values())
      .map((w) => {
        const net = Number((w.income - w.expenses).toFixed(2));
        const rate = w.income > 0 ? Number(Math.max(0, (((w.income - w.expenses) / w.income) * 100)).toFixed(1)) : 0;
        return {
          ...w,
          income: Number(w.income.toFixed(2)),
          expenses: Number(w.expenses.toFixed(2)),
          netSavings: net,
          savingsRate: rate,
        };
      })
      .sort((a, b) => b.week.localeCompare(a.week));
  }, [currentPeriodTransactions]);

  // Available unique categories in dataset for filtering
  const availableCategoriesInDataset = useMemo(() => {
    const set = new Set<string>();
    currentPeriodTransactions.forEach((t) => {
      if (t.categoryName) set.add(t.categoryName);
    });
    return Array.from(set).sort();
  }, [currentPeriodTransactions]);

  // Transaction history filter & pagination
  const filteredHistoryTransactions = useMemo(() => {
    return currentPeriodTransactions.filter((t) => {
      if (txTypeFilter !== 'all' && t.type !== txTypeFilter) return false;
      if (txCategoryFilter !== 'all' && (t.categoryName || 'Others') !== txCategoryFilter) return false;
      if (txSearch.trim()) {
        const q = txSearch.toLowerCase().trim();
        const desc = (t.description || '').toLowerCase();
        const cat = (t.categoryName || '').toLowerCase();
        const ref = ((t as any).reference || '').toLowerCase();
        if (!desc.includes(q) && !cat.includes(q) && !ref.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (txSortBy === 'date_desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (txSortBy === 'date_asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (txSortBy === 'amount_desc') return Number(b.amount) - Number(a.amount);
      if (txSortBy === 'amount_asc') return Number(a.amount) - Number(b.amount);
      return 0;
    });
  }, [currentPeriodTransactions, txTypeFilter, txCategoryFilter, txSearch, txSortBy]);

  const txPageSize = 12;
  const txTotalPages = Math.max(1, Math.ceil(filteredHistoryTransactions.length / txPageSize));
  const paginatedHistoryTransactions = useMemo(() => {
    const start = (txPage - 1) * txPageSize;
    return filteredHistoryTransactions.slice(start, start + txPageSize);
  }, [filteredHistoryTransactions, txPage, txPageSize]);

  return (
    <div className="space-y-6">
      {/* 1. Filter Control Banner (Date Presets, Custom Range, Account Selector) */}
      <div className="glass-panel p-4 sm:p-5 space-y-3.5 border border-[#5878FF]/15">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* View Selection Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-[#F4F9FF] border border-[#DCE7F6] rounded-2xl">
            {[
              { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
              { id: 'insights' as const, label: 'AI Insights Engine', icon: Sparkles },
              { id: 'trends' as const, label: 'Spending Trends', icon: TrendingUp },
              { id: 'categories' as const, label: 'Categories', icon: PieChart },
              { id: 'cashflow' as const, label: 'Cash Flow', icon: ArrowUpRight },
              { id: 'accounts' as const, label: 'Accounts', icon: Building },
              { id: 'transactions' as const, label: 'Transaction History', icon: Receipt },
              { id: 'recurring' as const, label: 'Recurring & SIPs', icon: Repeat },
              { id: 'health' as const, label: 'Health & Risk', icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#5878FF] text-white shadow-xs'
                      : 'text-[#64748B] hover:text-[#172B4D] hover:bg-white/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Account Selector Pill */}
          {onSelectAccount && accounts.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#64748B] font-semibold text-[11px]">Account:</span>
              <select
                value={selectedAccountId}
                onChange={(e) => onSelectAccount(e.target.value)}
                className="bg-white border border-[#DCE7F6] text-[#172B4D] rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-[#5878FF] cursor-pointer shadow-2xs"
              >
                <option value="all">All Accounts ({accounts.length})</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountName} ({acc.accountNumberMasked || '••••'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Date Presets and Custom Inputs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#DCE7F6] text-xs">
          <div className="flex items-center gap-1 overflow-x-auto p-0.5 bg-[#F4F9FF] border border-[#DCE7F6] rounded-xl">
            <span className="text-[#64748B] font-semibold text-[11px] px-2 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#5878FF]" />
              <span>Period:</span>
            </span>
            {[
              { id: 'all_time' as const, label: 'All Time' },
              { id: 'this_month' as const, label: 'This Month' },
              { id: '30d' as const, label: 'Last 30 Days' },
              { id: '90d' as const, label: 'Last 90 Days' },
              { id: 'ytd' as const, label: 'YTD' },
              { id: 'custom' as const, label: 'Custom' },
            ].map((p) => {
              const isSelected = datePreset === p.id || (p.id === 'all_time' && datePreset === 'all');
              return (
                <button
                  key={p.id}
                  onClick={() => setDatePreset(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#5878FF] text-white shadow-xs'
                      : 'text-[#64748B] hover:text-[#172B4D] hover:bg-white'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom Date Pickers */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-700"
              />
            </div>
          )}

          <div className="text-[11px] text-slate-500 font-mono">
            Showing <span className="font-bold text-slate-800">{currentPeriodTransactions.length}</span> txs
          </div>
        </div>
      </div>

      {/* Empty-period informative guidance banner when filtered period has 0 txs but account has statement data */}
      {currentPeriodTransactions.length === 0 && accountFilteredTransactions.length > 0 && (
        <div className="glass-card p-5 border-amber-200/80 bg-gradient-to-r from-amber-50/80 via-white to-orange-50/50 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Info className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-[#172B4D]">
                    No Transactions in Selected Period ({datePreset === 'this_month' ? 'This Month' : datePreset === '30d' ? 'Last 30 Days' : datePreset === '90d' ? 'Last 90 Days' : datePreset === 'ytd' ? 'Year to Date' : 'Custom Period'})
                  </h4>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                    Empty Period
                  </span>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed max-w-2xl">
                  There are no transactions recorded between{' '}
                  <span className="font-mono font-medium text-[#172B4D]">{activeDateRange.start || 'start'}</span> and{' '}
                  <span className="font-mono font-medium text-[#172B4D]">{activeDateRange.end || 'today'}</span>.
                  Your imported statement contains{' '}
                  <strong className="font-bold text-[#172B4D]">{accountFilteredTransactions.length.toLocaleString()} transactions</strong> spanning{' '}
                  <span className="font-mono font-semibold text-[#172B4D] bg-white px-1.5 py-0.5 rounded border border-amber-200/60">
                    {datasetDateBounds.min}
                  </span>{' '}
                  to{' '}
                  <span className="font-mono font-semibold text-[#172B4D] bg-white px-1.5 py-0.5 rounded border border-amber-200/60">
                    {datasetDateBounds.max}
                  </span>.
                </p>
              </div>
            </div>
            <button
              onClick={() => setDatePreset('all_time')}
              className="btn-sky-primary text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-center transition-all"
            >
              <span>View All Time ({accountFilteredTransactions.length.toLocaleString()} txs)</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* VIEW: AI FINANCIAL INSIGHT ENGINE */}
      {activeTab === 'insights' && (
        <FinancialInsightsSection
          customerId={transactions[0]?.customerId || 'customer'}
          selectedAccountId={selectedAccountId}
          transactions={transactions}
          accounts={accounts}
          currency={currency}
          isDemo={isDemo}
        />
      )}

      {/* 2. VIEW 1: OVERVIEW & PERIOD-OVER-PERIOD COMPARISONS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Period-Over-Period KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Pure Inflow */}
            <div className="card-luxury p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inflow (Period)</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-600">{formatMoney(currentMetrics.pureIncome)}</div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">vs prior period</span>
                {incomeDelta ? (
                  <span className={`font-bold font-mono ${incomeDelta.positive ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {incomeDelta.label}
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono">--</span>
                )}
              </div>
            </div>

            {/* Pure Outflow */}
            <div className="card-luxury p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Outflow (Period)</span>
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-rose-600">{formatMoney(currentMetrics.pureExpenses)}</div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">vs prior period</span>
                {expenseDelta ? (
                  <span className={`font-bold font-mono ${expenseDelta.positive ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {expenseDelta.label}
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono">--</span>
                )}
              </div>
            </div>

            {/* Net Savings */}
            <div className="card-luxury p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Cash Flow</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${currentMetrics.netCashFlow >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className={`text-2xl font-black ${currentMetrics.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {currentMetrics.netCashFlow >= 0 ? '+' : '-'}{formatMoney(currentMetrics.netCashFlow)}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">vs prior period</span>
                {netDelta ? (
                  <span className={`font-bold font-mono ${netDelta.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {netDelta.label}
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono">--</span>
                )}
              </div>
            </div>

            {/* Savings Rate */}
            <div className="card-luxury p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Savings Rate</span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-purple-700">{currentMetrics.savingsRate}%</div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Prior: {previousMetrics ? `${previousMetrics.savingsRate}%` : 'N/A'}</span>
                <span className="font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200/60">
                  {currentMetrics.savingsRate >= 20 ? 'Optimal' : currentMetrics.netCashFlow > 0 ? 'Positive' : currentMetrics.netCashFlow === 0 ? 'Balanced' : 'Deficit'}
                </span>
              </div>
            </div>

            {/* Recurring Commitments & Subscriptions */}
            <div
              onClick={() => setActiveTab('recurring')}
              className="card-luxury p-5 space-y-2 cursor-pointer hover:border-purple-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recurring & SIPs</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Repeat className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-indigo-700">{formatMoney(monthlyRecurringCommitment)}</div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">active commitments</span>
                <span className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200/60">
                  {recurringList.length} detected
                </span>
              </div>
            </div>
          </div>

          {/* Explainable Spending Forecast & Predictions */}
          {predictions && (
            <div className="card-luxury p-6 space-y-5 border-l-4 border-l-purple-600 bg-gradient-to-br from-white to-purple-50/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <h3 className="font-bold text-base text-slate-900">Explainable Spending Forecast & Next-Month Projections</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Statistically grounded {predictions.model} predictive model evaluated over {predictions.monthsAnalyzed} continuous monthly intervals.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                    {predictions.confidence.toUpperCase()} CONFIDENCE ({(predictions.confidenceScore * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>

              {/* Range and Forecast Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] text-slate-500 font-medium">Expected Spending ({predictions.nextMonthLabel})</span>
                  <div className="text-xl font-black text-slate-900 font-mono">{formatMoney(predictions.predictedExpenses)}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Range: {formatMoney(predictions.expensesRange.min)} – {formatMoney(predictions.expensesRange.max)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] text-slate-500 font-medium">Forecasted Income</span>
                  <div className="text-xl font-black text-emerald-600 font-mono">{formatMoney(predictions.predictedIncome)}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Range: {formatMoney(predictions.incomeRange.min)} – {formatMoney(predictions.incomeRange.max)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] text-slate-500 font-medium">Anticipated Surplus / Net</span>
                  <div className={`text-xl font-black font-mono ${predictions.predictedNetCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {predictions.predictedNetCashFlow >= 0 ? '+' : ''}{formatMoney(predictions.predictedNetCashFlow)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Target savings rate: {predictions.predictedSavingsRate}%
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <span className="text-[11px] text-slate-500 font-medium">Fixed Subscriptions Forecast</span>
                  <div className="text-xl font-black text-purple-700 font-mono">{formatMoney(predictions.subscriptionForecast.detectedCommitment)}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {formatMoney(predictions.subscriptionForecast.minExpected)} – {formatMoney(predictions.subscriptionForecast.maxExpected)} (95–110%)
                  </div>
                </div>
              </div>

              {/* Top 6 Category Forecasts */}
              {predictions.categoryForecasts.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Top Category Spending Forecasts for {predictions.nextMonthLabel}</span>
                    <span className="text-[11px] text-slate-400">EWMA Trajectory</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {predictions.categoryForecasts.map((cat) => (
                      <div key={cat.category} className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 truncate">{cat.category}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${
                            cat.trend === 'up' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            cat.trend === 'down' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {cat.trend === 'up' ? '↗ Increasing' : cat.trend === 'down' ? '↘ Decreasing' : '→ Stable'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-mono">
                          <span className="font-bold text-slate-900">{formatMoney(cat.predictedAmount)}</span>
                          <span className="text-[11px] text-slate-400">{cat.percentageOfTotal}% of total</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Historical monthly avg: {formatMoney(cat.historicalAverage)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Budget Deviation & Explanation Callout */}
              <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200/80 flex items-start gap-3 text-xs text-slate-700">
                <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-slate-800">{predictions.explanation}</p>
                  <p className="text-[11px] text-slate-500">{predictions.budgetDeviation.summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Historical Monthly Inflow vs Outflow Velocity Chart */}
          <div className="card-luxury p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <h3 className="font-bold text-base text-slate-900">Historical Monthly Velocity & Trajectory</h3>
                </div>
                <p className="text-xs text-slate-500">
                  Monthly cash velocity, expenditure, and net trajectory ({monthlyTrends.length} months active)
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                  <span>Inflow</span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                  <span>Outflow</span>
                </span>
              </div>
            </div>

            {monthlyTrends.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No monthly transactions found in the selected period.
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {monthlyTrends.map((m) => {
                  const max = Math.max(m.income, m.expenses, 1);
                  const incPct = Math.min(100, Math.max(3, (m.income / max) * 100));
                  const expPct = Math.min(100, Math.max(3, (m.expenses / max) * 100));

                  return (
                    <div key={m.month} className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{m.monthLabel}</span>
                          <span className="text-[11px] text-slate-400 font-mono">({m.transactionCount} txs)</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                          <span className="text-emerald-700 font-semibold">+{formatMoney(m.income)}</span>
                          <span className="text-rose-600 font-semibold">-{formatMoney(m.expenses)}</span>
                          <span className={`font-bold ${m.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            Net: {m.netCashFlow >= 0 ? '+' : '-'}{formatMoney(Math.abs(m.netCashFlow))}
                          </span>
                          <span className="font-sans font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60 text-[11px]">
                            {m.savingsRate.toFixed(1)}% Saved
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 pt-0.5">
                        <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden flex">
                          <div style={{ width: `${incPct}%` }} className="bg-emerald-500 rounded-full transition-all duration-500" />
                        </div>
                        <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden flex">
                          <div style={{ width: `${expPct}%` }} className="bg-rose-500 rounded-full transition-all duration-500" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Two-Column Grid: Categories & Top Counterparties */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <div className="card-luxury p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-purple-600" />
                  <h3 className="font-bold text-base text-slate-900">Spending by Category</h3>
                </div>
                <span className="text-xs text-slate-500 font-semibold">{canonicalCategories.length} categories</span>
              </div>

              {canonicalCategories.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No expense records in this period.
                </div>
              ) : (
                <div className="space-y-3">
                  {canonicalCategories.slice(0, 6).map((cat) => (
                    <div key={cat.categoryId || cat.categoryName} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.categoryColor || '#7c3aed' }} />
                          <span className="font-bold text-slate-800">{cat.categoryName}</span>
                          <span className="text-[11px] text-slate-400">({cat.transactionCount} txs)</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-slate-900">{formatMoney(cat.totalAmount)}</span>
                          <span className="text-xs text-slate-500 font-bold w-12 text-right">{cat.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(3, cat.percentage))}%`,
                            backgroundColor: cat.categoryColor || '#7c3aed',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Counterparties & Merchants */}
            <div className="card-luxury p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-purple-600" />
                  <h3 className="font-bold text-base text-slate-900">Top Counterparties & Payees</h3>
                </div>
                <span className="text-xs text-slate-500 font-semibold">{canonicalTopMerchants.length} counterparties</span>
              </div>

              {canonicalTopMerchants.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No counterparties found in this period.
                </div>
              ) : (
                <div className="space-y-3">
                  {canonicalTopMerchants.map((m, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{m.merchantName}</div>
                        <div className="text-[11px] text-slate-400">
                          {m.categoryName} • {m.transactionCount} transactions
                        </div>
                      </div>
                      <div className="font-mono font-bold text-rose-600 shrink-0">
                        -{formatMoney(m.totalAmount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cash Flow Trajectory & Operating Net Summary */}
          <div className="card-luxury p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-base text-slate-900">Cash Flow Trajectory & Operating Net</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
                <span className="text-xs font-semibold text-emerald-800 block">Total Pure Inflow</span>
                <span className="text-2xl font-black text-emerald-700 mt-1 block">+{formatMoney(currentMetrics.pureIncome)}</span>
                <span className="text-[11px] text-emerald-600 mt-0.5 block">Excludes transfers and refunds</span>
              </div>
              <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200/60">
                <span className="text-xs font-semibold text-rose-800 block">Total Pure Outflow</span>
                <span className="text-2xl font-black text-rose-700 mt-1 block">-{formatMoney(currentMetrics.pureExpenses)}</span>
                <span className="text-[11px] text-rose-600 mt-0.5 block">Excludes self-transfers</span>
              </div>
              <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200/60">
                <span className="text-xs font-semibold text-purple-800 block">Net Cumulative Surplus</span>
                <span className={`text-2xl font-black mt-1 block ${currentMetrics.netCashFlow >= 0 ? 'text-purple-900' : 'text-rose-700'}`}>
                  {currentMetrics.netCashFlow >= 0 ? '+' : '-'}{formatMoney(currentMetrics.netCashFlow)}
                </span>
                <span className="text-[11px] text-purple-700 mt-0.5 block">{currentMetrics.savingsRate}% overall retention</span>
              </div>
            </div>
          </div>

          {/* Quick Insights Banner */}
          {computedAnalysis?.insights && computedAnalysis.insights.length > 0 && (
            <div className="card-luxury p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h3 className="font-bold text-sm text-slate-900">Explainable Financial Insights</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {computedAnalysis.insights.slice(0, 4).map((ins) => (
                  <div key={ins.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{ins.title}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                        ins.severity === 'positive' ? 'bg-emerald-100 text-emerald-800' : ins.severity === 'alert' || ins.severity === 'warning' ? 'bg-rose-100 text-rose-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {ins.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{ins.explanation}</p>
                    {ins.suggestedAction && (
                      <div className="text-[11px] text-purple-700 font-medium pt-1">
                        👉 {ins.suggestedAction}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. VIEW 2: SPENDING TRENDS */}
      {activeTab === 'trends' && (
        <div className="card-luxury p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">Spending & Inflow Velocity</h3>
              <p className="text-xs text-slate-500">Period-over-period income vs expenditure trends</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              <button
                onClick={() => setTrendsGrouping('monthly')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  trendsGrouping === 'monthly' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setTrendsGrouping('weekly')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  trendsGrouping === 'weekly' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                Weekly View
              </button>
            </div>
          </div>

          {trendsGrouping === 'monthly' ? (
            computedAnalysis?.monthlySummaries && computedAnalysis.monthlySummaries.length > 0 ? (
              <div className="space-y-4">
                {computedAnalysis.monthlySummaries.map((m) => {
                  const max = Math.max(m.income, m.expenses, 1);
                  const incPct = Math.min(100, Math.max(4, (m.income / max) * 100));
                  const debPct = Math.min(100, Math.max(4, (m.expenses / max) * 100));

                  return (
                    <div key={m.month} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-sm text-slate-900">{m.monthLabel || m.month}</span>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-emerald-700 font-semibold">Inflow: +{formatMoney(m.income)}</span>
                          <span className="text-rose-600 font-semibold">Outflow: -{formatMoney(m.expenses)}</span>
                          <span className={`font-mono font-bold ${m.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            Net: {m.netCashFlow >= 0 ? '+' : '-'}{formatMoney(Math.abs(m.netCashFlow))}
                          </span>
                          <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60">
                            {(m.savingsRate ?? 0).toFixed(1)}% Saved
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden flex">
                          <div style={{ width: `${incPct}%` }} className="bg-emerald-500 rounded-full transition-all duration-500" />
                        </div>
                        <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden flex">
                          <div style={{ width: `${debPct}%` }} className="bg-rose-500 rounded-full transition-all duration-500" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                No monthly trend records available for the selected period.
              </div>
            )
          ) : (
            weeklySummaries.length > 0 ? (
              <div className="space-y-4">
                {weeklySummaries.map((w) => {
                  const max = Math.max(w.income, w.expenses, 1);
                  const incPct = Math.min(100, Math.max(4, (w.income / max) * 100));
                  const debPct = Math.min(100, Math.max(4, (w.expenses / max) * 100));

                  return (
                    <div key={w.week} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-sm text-slate-900">{w.label}</span>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-emerald-700 font-semibold">Inflow: +{formatMoney(w.income)}</span>
                          <span className="text-rose-600 font-semibold">Outflow: -{formatMoney(w.expenses)}</span>
                          <span className={`font-mono font-bold ${w.netSavings >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            Net: {w.netSavings >= 0 ? '+' : '-'}{formatMoney(w.netSavings)}
                          </span>
                          <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60">
                            {w.savingsRate.toFixed(1)}% Saved
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden flex">
                          <div style={{ width: `${incPct}%` }} className="bg-emerald-500 rounded-full transition-all duration-500" />
                        </div>
                        <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden flex">
                          <div style={{ width: `${debPct}%` }} className="bg-rose-500 rounded-full transition-all duration-500" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                No weekly trend records available for the selected period.
              </div>
            )
          )}
        </div>
      )}

      {/* 4. VIEW 3: CATEGORIES & TRANSACTION DRILL-DOWN */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Categories List (2 cols) */}
          <div className="lg:col-span-2 card-luxury p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">Spending by Category</h3>
                <p className="text-xs text-slate-500">Click any category to inspect matching transactions</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{categoriesList.length} categories</span>
            </div>

            {categoriesList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No debit transactions found in the selected date range.
              </div>
            ) : (
              <div className="space-y-3">
                {categoriesList.map((cat) => {
                  const isSelected = drillDownCategory === cat.category;
                  return (
                    <div
                      key={cat.category}
                      onClick={() => setDrillDownCategory(isSelected ? null : cat.category)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50/30 ring-1 ring-purple-500'
                          : 'border-slate-100 bg-slate-50 hover:bg-slate-100/80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="font-bold text-slate-800">{cat.category}</span>
                          <span className="text-[11px] text-slate-400">({cat.count} txs)</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-bold text-slate-900">{formatMoney(cat.amount)}</span>
                          <span className="text-xs text-slate-500 font-bold w-12 text-right">{cat.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(3, cat.percentage))}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Drill-Down Panel (1 col) */}
          <div className="card-luxury p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  {drillDownCategory ? `Drill-Down: ${drillDownCategory}` : 'Transaction Drill-Down'}
                </h4>
                {drillDownCategory && (
                  <button
                    onClick={() => setDrillDownCategory(null)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {!drillDownCategory ? (
                <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                  <PieChart className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>Click on any category on the left to inspect its individual line items.</p>
                </div>
              ) : drillDownTransactions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No transactions match this category.
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {drillDownTransactions.map((tx) => (
                    <div key={tx.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                      <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                        <span>{tx.date}</span>
                        <span className="font-bold text-rose-600">-{formatMoney(tx.amount)}</span>
                      </div>
                      <div className="font-medium text-slate-800 line-clamp-1">{tx.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {drillDownCategory && onNavigateToLedger && (
              <button
                onClick={() => onNavigateToLedger({ search: drillDownCategory })}
                className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <span>View in Ledger</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. VIEW 4: CASH FLOW & NET SAVINGS TRAJECTORY */}
      {activeTab === 'cashflow' && (
        <div className="card-luxury p-6 space-y-6">
          <div>
            <h3 className="font-bold text-base text-slate-900">Pure Cash Flow & Net Savings</h3>
            <p className="text-xs text-slate-500">Real verified earnings minus true consumer expenses</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/60">
              <span className="text-xs font-semibold text-emerald-800 block">Total Pure Inflow</span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">+{formatMoney(currentMetrics.pureIncome)}</span>
              <span className="text-[11px] text-emerald-600 mt-0.5 block">Excludes transfers and refunds</span>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/60">
              <span className="text-xs font-semibold text-rose-800 block">Total Pure Outflow</span>
              <span className="text-2xl font-black text-rose-700 mt-1 block">-{formatMoney(currentMetrics.pureExpenses)}</span>
              <span className="text-[11px] text-rose-600 mt-0.5 block">Excludes self-transfers and card payments</span>
            </div>
            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/60">
              <span className="text-xs font-semibold text-purple-800 block">Net Cumulative Surplus</span>
              <span className={`text-2xl font-black mt-1 block ${currentMetrics.netCashFlow >= 0 ? 'text-purple-900' : 'text-rose-700'}`}>
                {currentMetrics.netCashFlow >= 0 ? '+' : '-'}{formatMoney(currentMetrics.netCashFlow)}
              </span>
              <span className="text-[11px] text-purple-700 mt-0.5 block">{currentMetrics.savingsRate}% overall retention</span>
            </div>
          </div>
        </div>
      )}

      {/* 6. VIEW 5: ACCOUNTS BREAKDOWN & COMPLETE CRUD MANAGEMENT */}
      {activeTab === 'accounts' && (
        <div className="card-luxury p-6 space-y-5">
          {/* Section Header with Heading, Count, and Add Account Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#5878FF]" />
                <h3 className="font-bold text-base text-slate-900">Account Distribution & Activity</h3>
                <span className="text-xs bg-[#EAF3FF] text-[#5878FF] font-semibold px-2.5 py-0.5 rounded-full border border-[#B8D3FC]">
                  {accounts.length} {accounts.length === 1 ? 'Account' : 'Accounts'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Cash velocity, balances, and management across all connected financial accounts
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setAddForm({
                    accountName: '',
                    accountType: 'checking',
                    institutionName: '',
                    accountNumber: '',
                    initialBalance: '0',
                    currency: currency || 'INR',
                  });
                  setActionFeedback(null);
                  setIsAddModalOpen(true);
                }}
                className="bg-[#5878FF] hover:bg-[#4665E8] text-white flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Account</span>
              </button>
            </div>
          </div>

          {/* Real Success / Error Feedback Banner */}
          {actionFeedback && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 animate-in fade-in ${
                actionFeedback.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {actionFeedback.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{actionFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionFeedback(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {accountBreakdown.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-3">
              <p>No financial accounts connected yet.</p>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="bg-[#5878FF] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#4665E8] transition-colors cursor-pointer"
              >
                Create Your First Account
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accountBreakdown.map((item) => {
                const isArchived = item.account.accountName.includes('[Archived]');
                const isSelected = selectedAccountId === item.account.id;

                return (
                  <div
                    key={item.account.id}
                    className={`relative p-5 rounded-2xl bg-white border transition-all space-y-3.5 ${
                      isSelected
                        ? 'border-[#5878FF] ring-2 ring-[#5878FF]/20 shadow-sm bg-[#F8FBFF]'
                        : 'border-[#DCE7F6] hover:border-[#B8D3FC] shadow-2xs'
                    }`}
                  >
                    {/* Top Row: Type Badges & 3-Dot Action Menu */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[#F4F9FF] text-[#5878FF] border border-[#DCE7F6] px-2 py-0.5 rounded-md">
                          {item.account.accountType.replace('_', ' ')}
                        </span>
                        {isArchived ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-md">
                            Archived
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                            Active
                          </span>
                        )}
                      </div>

                      {/* Masked Account Number & 3-Dot Action Trigger */}
                      <div className="flex items-center gap-1.5 relative">
                        <span className="text-xs text-slate-500 font-mono">{item.account.accountNumberMasked}</span>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownAccountId(
                                openDropdownAccountId === item.account.id ? null : item.account.id
                              );
                            }}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            title="Account actions"
                            aria-label={`Actions for ${item.account.accountName}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* 3-Dot Actions Dropdown Menu */}
                          {openDropdownAccountId === item.account.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-7 w-44 bg-white/98 backdrop-blur-md rounded-xl shadow-lg border border-[#DCE7F6] py-1 z-30 animate-in fade-in zoom-in-95"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenDropdownAccountId(null);
                                  setDetailsAccount(item.account);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-[#F4F9FF] flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#5878FF]" />
                                <span>View Details</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenDropdownAccountId(null);
                                  setEditingAccount(item.account);
                                  setEditForm({
                                    accountName: item.account.accountName.replace(' [Archived]', ''),
                                    accountType: item.account.accountType,
                                    institutionName: item.account.institutionName,
                                  });
                                  setActionFeedback(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-[#F4F9FF] flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#5878FF]" />
                                <span>Edit Account</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenDropdownAccountId(null);
                                  setDeletingAccount(item.account);
                                  setActionFeedback(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-100"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Delete / Archive</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Account Name & Bank Name */}
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 truncate">{item.account.accountName}</h4>
                      <p className="text-xs text-slate-500 truncate">{item.account.institutionName}</p>
                    </div>

                    {/* Balances & Period Inflow/Outflow */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-500">Current Balance:</span>
                        <span className="font-extrabold text-slate-900 font-mono tnum text-sm">
                          {formatMoney(item.account.balance)}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline text-emerald-700">
                        <span>Period Inflow:</span>
                        <span className="font-bold font-mono tnum">+{formatMoney(item.income)}</span>
                      </div>
                      <div className="flex justify-between items-baseline text-rose-600">
                        <span>Period Outflow:</span>
                        <span className="font-bold font-mono tnum">-{formatMoney(item.expenses)}</span>
                      </div>
                    </div>

                    {/* Quick Filter by Account Action */}
                    {onSelectAccount && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => onSelectAccount(isSelected ? 'all' : item.account.id)}
                          className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#EAF3FF] text-[#5878FF] border border-[#B8D3FC]'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <span>{isSelected ? '✓ Filter Active' : 'Filter Ledger by Account'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ============================================================ */}
          {/* MODAL 1: ADD ACCOUNT                                          */}
          {/* ============================================================ */}
          {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl border border-[#DCE7F6] max-w-md w-full overflow-hidden animate-in zoom-in-95"
              >
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#EAF3FF] text-[#5878FF]">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Add Financial Account</h3>
                      <p className="text-[11px] text-slate-500">Connect a new checking, savings, or credit account</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateAccount} className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Account Display Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Salary Checking, Main Savings"
                      value={addForm.accountName}
                      onChange={(e) => setAddForm({ ...addForm, accountName: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-[#DCE7F6] bg-[#F8FBFF] focus:bg-white focus:border-[#5878FF] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Account Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={addForm.accountType}
                        onChange={(e) => setAddForm({ ...addForm, accountType: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-[#DCE7F6] bg-[#F8FBFF] focus:bg-white focus:border-[#5878FF] focus:outline-none cursor-pointer"
                      >
                        <option value="checking">Checking</option>
                        <option value="savings">Savings</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="investment">Investment</option>
                        <option value="loan">Loan</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Currency
                      </label>
                      <select
                        value={addForm.currency}
                        onChange={(e) => setAddForm({ ...addForm, currency: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-[#DCE7F6] bg-[#F8FBFF] focus:bg-white focus:border-[#5878FF] focus:outline-none cursor-pointer"
                      >
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Financial Institution / Bank <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. HDFC Bank, Chase, State Bank of India"
                      value={addForm.institutionName}
                      onChange={(e) => setAddForm({ ...addForm, institutionName: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-[#DCE7F6] bg-[#F8FBFF] focus:bg-white focus:border-[#5878FF] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Account Number <span className="text-slate-400 font-normal">(Last 4 digits)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 4984"
                        value={addForm.accountNumber}
                        onChange={(e) => setAddForm({ ...addForm, accountNumber: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-[#DCE7F6] bg-[#F8FBFF] focus:bg-white focus:border-[#5878FF] focus:outline-none font-mono"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Stored securely masked</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Opening Balance
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={addForm.initialBalance}
                        onChange={(e) => setAddForm({ ...addForm, initialBalance: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-[#DCE7F6] bg-[#F8FBFF] focus:bg-white focus:border-[#5878FF] focus:outline-none font-mono tnum"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-[#F4F9FF] rounded-xl border border-[#DCE7F6] text-[11px] text-slate-600 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#5878FF] shrink-0 mt-0.5" />
                    <span>
                      Accounts are strictly isolated to your customer tenant and verified against Supabase PostgreSQL rules.
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-[#5878FF] hover:bg-[#4665E8] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isSubmitting ? 'Creating...' : 'Create Account'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* MODAL 2: EDIT ACCOUNT                                         */}
          {/* ============================================================ */}
          {editingAccount && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl border border-[#DCE7F6] max-w-md w-full overflow-hidden animate-in zoom-in-95"
              >
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#EAF3FF] text-[#5878FF]">
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Edit Account Metadata</h3>
                      <p className="text-[11px] text-slate-500">Update display name, type, and financial provider</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingAccount(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateAccount} className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Account Display Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.accountName}
                      onChange={(e) => setEditForm({ ...editForm, accountName: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-[#DCE7F6] bg-[#F8FBFF] focus:bg-white focus:border-[#5878FF] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Account Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={editForm.accountType}
                      onChange={(e) => setEditForm({ ...editForm, accountType: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-[#DCE7F6] bg-[#F8FBFF] focus:bg-white focus:border-[#5878FF] focus:outline-none cursor-pointer"
                    >
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="investment">Investment</option>
                      <option value="loan">Loan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Financial Institution / Bank <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.institutionName}
                      onChange={(e) => setEditForm({ ...editForm, institutionName: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-[#DCE7F6] bg-[#F8FBFF] focus:bg-white focus:border-[#5878FF] focus:outline-none"
                    />
                  </div>

                  {/* Read-Only Immutable Protection Panel */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Account Number:</span>
                      <span className="font-mono font-semibold text-slate-900">{editingAccount.accountNumberMasked}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Current Ledger Balance:</span>
                      <span className="font-mono font-bold text-slate-900 tnum">{formatMoney(editingAccount.balance)}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-200/60 leading-relaxed">
                      🔒 Balances, transaction histories, and unique account IDs are immutable to preserve regulatory financial auditability.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingAccount(null)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-[#5878FF] hover:bg-[#4665E8] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* MODAL 3: VIEW ACCOUNT DETAILS                                 */}
          {/* ============================================================ */}
          {detailsAccount && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl border border-[#DCE7F6] max-w-md w-full overflow-hidden animate-in zoom-in-95"
              >
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#EAF3FF] text-[#5878FF]">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{detailsAccount.accountName}</h3>
                      <p className="text-[11px] text-slate-500">{detailsAccount.institutionName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailsAccount(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-[#F4F9FF] to-[#EAF3FF] border border-[#B8D3FC] space-y-1">
                    <span className="text-[11px] text-[#5878FF] font-semibold block">Available Balance</span>
                    <span className="text-2xl font-black text-slate-900 font-mono tnum block">
                      {formatMoney(detailsAccount.balance)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Currency: {detailsAccount.currency}</span>
                  </div>

                  <div className="space-y-2 border border-slate-100 rounded-xl p-3 bg-slate-50">
                    <div className="flex justify-between py-1 border-b border-slate-200/50">
                      <span className="text-slate-500">Account Type:</span>
                      <span className="font-semibold text-slate-900 uppercase text-[11px]">
                        {detailsAccount.accountType.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50">
                      <span className="text-slate-500">Masked ID:</span>
                      <span className="font-mono text-slate-900 font-semibold">{detailsAccount.accountNumberMasked}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50">
                      <span className="text-slate-500">Institution:</span>
                      <span className="font-semibold text-slate-900">{detailsAccount.institutionName}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/50">
                      <span className="text-slate-500">Account UUID:</span>
                      <span className="font-mono text-[10px] text-slate-600 truncate max-w-[180px]">{detailsAccount.id}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Connected Date:</span>
                      <span className="text-slate-700">
                        {detailsAccount.createdAt ? new Date(detailsAccount.createdAt).toLocaleDateString() : 'Active'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setDetailsAccount(null)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* MODAL 4: DELETE / ARCHIVE CONFIRMATION                        */}
          {/* ============================================================ */}
          {deletingAccount && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl border border-rose-200 max-w-md w-full overflow-hidden animate-in zoom-in-95"
              >
                <div className="p-5 border-b border-rose-100 flex items-center justify-between bg-rose-50/50">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Manage Account Lifecycle</h3>
                      <p className="text-[11px] text-slate-500">Delete or archive {deletingAccount.accountName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeletingAccount(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  <div className="space-y-2">
                    <p className="text-slate-700 leading-relaxed">
                      You are about to remove <strong>"{deletingAccount.accountName}"</strong> ({deletingAccount.accountNumberMasked}).
                    </p>

                    {/* Sole Account Warning */}
                    {accounts.length <= 1 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 space-y-1">
                        <strong className="block font-bold">Minimum Account Requirement:</strong>
                        <span>Customers must maintain at least one active primary account. To remove this account, connect a replacement account first.</span>
                      </div>
                    )}

                    {/* Linked Transactions & Accounting Protection Explanation */}
                    <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-900 space-y-1.5 leading-relaxed">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Archive className="w-4 h-4 text-[#5878FF]" />
                        <span>Recommended: Archive Account</span>
                      </div>
                      <p className="text-[11px] text-blue-800">
                        Archiving hides the account from active selectors while preserving all historical transactions, cash flow analytics, and compliance records.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setDeletingAccount(null)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleArchiveAccount}
                      className="bg-[#5878FF] hover:bg-[#4665E8] text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Archive Safe</span>
                    </button>

                    {accounts.length > 1 && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleDeleteAccount}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Delete Permanently</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. VIEW 6: TRANSACTION HISTORY & INTERACTIVE DRILL-DOWN */}
      {activeTab === 'transactions' && (
        <div className="card-luxury p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">Transaction History & Ledger Analysis</h3>
              <p className="text-xs text-slate-500">
                Filtered across the active date range • {filteredHistoryTransactions.length} matching transactions
              </p>
            </div>
            {onNavigateToLedger && (
              <button
                onClick={() => onNavigateToLedger()}
                className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                <span>Full Ledger View</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Interactive Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search description, merchant, or reference..."
                value={txSearch}
                onChange={(e) => {
                  setTxSearch(e.target.value);
                  setTxPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              {txSearch && (
                <button
                  onClick={() => {
                    setTxSearch('');
                    setTxPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Category Filter Dropdown */}
            <select
              value={txCategoryFilter}
              onChange={(e) => {
                setTxCategoryFilter(e.target.value);
                setTxPage(1);
              }}
              className="bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories ({availableCategoriesInDataset.length})</option>
              {availableCategoriesInDataset.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Direction / Type Segmented Buttons */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200">
              {(['all', 'debit', 'credit'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTxTypeFilter(t);
                    setTxPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer capitalize ${
                    txTypeFilter === t ? 'bg-purple-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t === 'all' ? 'All Types' : t === 'debit' ? 'Outflow' : 'Inflow'}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <select
              value={txSortBy}
              onChange={(e) => setTxSortBy(e.target.value as any)}
              className="bg-white border border-slate-200 text-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-none cursor-pointer"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="amount_desc">Highest Amount</option>
              <option value="amount_asc">Lowest Amount</option>
            </select>
          </div>

          {/* Transactions List */}
          {filteredHistoryTransactions.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
              <p>No transactions match the selected filters or date range.</p>
              {(txSearch || txCategoryFilter !== 'all' || txTypeFilter !== 'all') && (
                <button
                  onClick={() => {
                    setTxSearch('');
                    setTxCategoryFilter('all');
                    setTxTypeFilter('all');
                  }}
                  className="text-xs text-purple-600 font-semibold underline cursor-pointer"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
                {paginatedHistoryTransactions.map((tx) => {
                  const isExpanded = expandedTxId === tx.id;
                  const isCredit = tx.type === 'credit';
                  return (
                    <div key={tx.id} className="transition-colors hover:bg-slate-50/60">
                      <div
                        onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                        className="p-3.5 flex items-center justify-between gap-3 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isCredit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{tx.description}</div>
                            {/* Anti-slop zero pill metadata */}
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                              <span>{tx.date}</span>
                              <span aria-hidden="true">·</span>
                              <span className="flex items-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: tx.categoryColor || '#7c3aed' }}
                                />
                                <span className="text-slate-600">{tx.categoryName || 'General'}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-bold font-mono text-sm block ${
                              isCredit ? 'text-emerald-600' : 'text-slate-900'
                            }`}
                          >
                            {isCredit ? '+' : '-'}{formatMoney(tx.amount)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {isExpanded ? 'Hide details' : 'View details'}
                          </span>
                        </div>
                      </div>

                      {/* Expandable Drill-Down Details Drawer */}
                      {isExpanded && (
                        <div className="px-4 pb-3.5 pt-1 bg-slate-50/80 border-t border-slate-100 text-[11px] text-slate-600 space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Category</span>
                              <span className="font-medium text-slate-800">{tx.categoryName || 'General'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Flow Type</span>
                              <span className="font-medium text-slate-800 capitalize">{tx.type}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Transaction ID</span>
                              <span className="font-mono text-slate-700 truncate block">{tx.id}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Verified Date</span>
                              <span className="font-medium text-slate-800">{tx.date}</span>
                            </div>
                          </div>
                          {(tx as any).reference && (
                            <div className="text-[10px] font-mono text-slate-500 pt-1">
                              Reference: {(tx as any).reference}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination Bar */}
              {txTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2 px-1 text-xs text-slate-500">
                  <span>
                    Page <span className="font-bold text-slate-800">{txPage}</span> of{' '}
                    <span className="font-bold text-slate-800">{txTotalPages}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                      disabled={txPage === 1}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>
                    <button
                      onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                      disabled={txPage === txTotalPages}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 8. VIEW 7: RECURRING & SIPS */}
      {activeTab === 'recurring' && (
        <div className="card-luxury p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">Detected Subscriptions & Recurring Bills</h3>
              <p className="text-xs text-slate-500">Identified repeating monthly debits, SIPs, and utilities</p>
            </div>
            <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-800 font-semibold">
              Monthly Commitment: <span className="font-black text-purple-900">{formatMoney(monthlyRecurringCommitment)}</span>
            </div>
          </div>

          {recurringList.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No repeating recurring subscriptions detected in the selected transactions.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recurringList.map((rec) => (
                <div key={rec.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs text-slate-900">{rec.merchant}</div>
                    <div className="text-[11px] text-slate-500">
                      Cadence: {rec.detectedFrequency} • Status: {rec.reviewStatus} ({rec.confidence})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-sm text-slate-900">{formatMoney(rec.estimatedMonthlyCost || rec.averageAmount)}</div>
                    <div className="text-[10px] text-slate-400">per {rec.detectedFrequency}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. VIEW 7: FINANCIAL HEALTH & BEHAVIORAL DIMENSIONS */}
      {activeTab === 'health' && (
        <div className="card-luxury p-6 space-y-6">
          <div>
            <h3 className="font-bold text-base text-slate-900">Comprehensive Financial Health & Behavioral Scores</h3>
            <p className="text-xs text-slate-500">8-dimension behavioral diagnostic evaluated against verified ledger data</p>
          </div>

          {computedAnalysis?.health ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white font-black text-2xl flex items-center justify-center shrink-0 shadow-xs">
                  {computedAnalysis.health.grade}
                </div>
                <div>
                  <div className="text-base font-extrabold text-slate-900">
                    Health Score: {computedAnalysis.health.compositeScore}/100 • Grade {computedAnalysis.health.grade}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{computedAnalysis.health.summary}</p>
                </div>
              </div>

              {/* Factors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {computedAnalysis.health.factors.map((p) => {
                  const score = p.awardedPoints != null ? Math.round((p.awardedPoints / Math.max(1, p.maxPoints)) * 100) : 0;
                  return (
                    <div key={p.factorKey || p.name} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-800">{p.name}</span>
                        <span className="font-mono font-extrabold text-slate-900">{p.awardedPoints ?? 0}/{p.maxPoints} pts</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">{p.explanation}</p>
                      {p.recommendation && (
                        <p className="text-[10px] text-purple-700 font-medium">👉 {p.recommendation}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              Not enough transaction data to calculate behavioral health.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
