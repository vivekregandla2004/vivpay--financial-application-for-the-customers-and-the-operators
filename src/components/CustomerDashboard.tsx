/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { CustomerProfile, Account, Transaction, FinancialSummary } from '../types/database.ts';
import { KPICards } from './KPICards.tsx';
import { FinancialInsightsSection } from './FinancialInsightsSection.tsx';
import { calculateCategoryBreakdown, calculateMonthlyTrends } from '../lib/analytics/financialEngine.ts';
import { analyzeBehaviour } from '../lib/identity/behavior.ts';
import { loadIdentityFromStorage } from '../lib/identity/store.ts';
import { api } from '../services/api.ts';
import {
  AddAccountModal,
  EditAccountModal,
  AccountDetailsModal,
  DeleteAccountModal,
} from './AccountModals.tsx';
import {
  CreditCard,
  Building,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  PieChart,
  Target,
  FileSpreadsheet,
  ChevronRight,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Receipt,
  UploadCloud,
  Layers,
  Wallet,
  Compass,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react';

export interface CustomerGoalItem {
  id: string;
  name: string;
  targetAmount: number;
  currentSavings: number;
  targetDate: string;
  priority: string;
  status: string;
  notes?: string;
}

interface CustomerDashboardProps {
  customer: CustomerProfile;
  accounts: Account[];
  selectedAccountId: string | 'all';
  onSelectAccount: (id: string | 'all') => void;
  summary: FinancialSummary | null;
  transactions: (Transaction & { categoryName?: string; categoryColor?: string })[];
  goals?: CustomerGoalItem[];
  loading: boolean;
  currency?: string;
  isDemoSession?: boolean;
  onSwitchDemoCustomer?: (customerId: string) => void;
  selectedDemoCustomerId?: string;
  onNavigateTab: (tab: 'overview' | 'transactions' | 'vault' | 'analytics' | 'twin' | 'profile') => void;
  onOpenUpload: () => void;
  onOpenAskViv: () => void;
  onOpenAddAccount?: () => void;
  onAccountCreated?: (newAccount: Account) => void;
  onAccountUpdated?: (updatedAccount: Account) => void;
  onAccountDeleted?: (accountId: string) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  customer,
  accounts,
  selectedAccountId,
  onSelectAccount,
  summary,
  transactions,
  goals = [],
  loading,
  currency = 'INR',
  isDemoSession = false,
  onSwitchDemoCustomer,
  selectedDemoCustomerId = 'alex',
  onNavigateTab,
  onOpenUpload,
  onOpenAskViv,
  onOpenAddAccount,
  onAccountCreated,
  onAccountUpdated,
  onAccountDeleted,
}) => {
  // Account Management Modals State
  const [addAccountModalOpen, setAddAccountModalOpen] = useState(false);
  const [viewAccountModalOpen, setViewAccountModalOpen] = useState(false);
  const [editAccountModalOpen, setEditAccountModalOpen] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [openMenuAccountId, setOpenMenuAccountId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const currencySymbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';

  const formatMoney = (amount: number) => {
    return `${currencySymbol}${Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Filter transactions for the selected account if specified
  const filteredTransactions = useMemo(() => {
    if (selectedAccountId === 'all') return transactions;
    return transactions.filter((t) => t.accountId === selectedAccountId);
  }, [transactions, selectedAccountId]);

  // Derive Category Breakdown from the dataset
  const categoryBreakdown = useMemo(() => {
    return calculateCategoryBreakdown(filteredTransactions).slice(0, 5);
  }, [filteredTransactions]);

  // Derive Monthly Trends
  const monthlyTrends = useMemo(() => {
    return calculateMonthlyTrends(filteredTransactions).slice(-4);
  }, [filteredTransactions]);

  // Derive Behavioral Score
  const { behavior } = useMemo(() => {
    const identity = loadIdentityFromStorage('customer');
    return analyzeBehaviour(filteredTransactions, identity);
  }, [filteredTransactions]);

  // Recent transactions preview (latest 6)
  const recentTransactions = useMemo(() => {
    return [...filteredTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [filteredTransactions]);

  const handleDeleteConfirm = async () => {
    if (!activeAccount) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      if (!isDemoSession) {
        await api.deleteAccount(activeAccount.id);
      }
      if (onAccountDeleted) {
        onAccountDeleted(activeAccount.id);
      }
      setDeleteAccountModalOpen(false);
      setActiveAccount(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete account.');
    } finally {
      setIsDeleting(false);
    }
  };

  const hasNoData = accounts.length === 0 && transactions.length === 0 && !loading;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="glass-panel p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#172B4D] tracking-tight">
              Welcome back, {customer.fullName || 'Member'}
            </h1>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified Customer</span>
            </span>
            {isDemoSession && (
              <div className="inline-flex items-center gap-1.5 text-xs text-amber-800 font-medium bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="font-bold">Demo Workspace</span>
                {onSwitchDemoCustomer && (
                  <select
                    value={selectedDemoCustomerId}
                    onChange={(e) => onSwitchDemoCustomer(e.target.value)}
                    className="ml-1 text-[11px] font-semibold bg-white border border-amber-300 text-amber-900 rounded px-1.5 py-0.5 cursor-pointer focus:outline-none"
                  >
                    <option value="alex">Alex Rivera (Salaried Tech)</option>
                    <option value="priya">Priya Sharma (Studio Consultant)</option>
                  </select>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            {accounts.length} active account{accounts.length === 1 ? '' : 's'} connected • {transactions.length} verified transactions in ledger
          </p>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenUpload}
            className="btn-sky-primary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Statement</span>
          </button>
          <button
            onClick={onOpenAskViv}
            className="glass-pill flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold hover:bg-[#EAF3FF] text-[#172B4D] transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#5878FF]" />
            <span>Ask Viv Copilot</span>
          </button>
          {onOpenAddAccount && (
            <button
              onClick={onOpenAddAccount}
              className="neu-subtle flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#172B4D] hover:bg-[#EAF3FF] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#5878FF]" />
              <span>Add Account</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Empty State Onboarding if user has 0 accounts & 0 transactions */}
      {hasNoData && (
        <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50/40 border border-purple-200/80 rounded-2xl p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-extrabold text-slate-900">Welcome to your VivPay Financial Command Center</h3>
            <p className="text-xs text-slate-600">
              Get started by uploading your first bank statement (Excel / CSV / PDF) or connect a verified financial account to unlock real-time cash flow analytics and your AI Financial Twin.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenUpload}
              className="btn-primary-gradient text-white font-semibold text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-xs flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Import First Statement</span>
            </button>
            {onOpenAddAccount && (
              <button
                onClick={onOpenAddAccount}
                className="bg-white border border-slate-300 text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-purple-600" />
                <span>Create Manual Account</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Primary KPI Cards */}
      <KPICards summary={summary} loading={loading} transactions={filteredTransactions} currency={currency} />

      {/* 4. Accounts Cards & Balances Carousel / Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#5878FF]" />
            <h2 className="text-sm font-bold text-[#172B4D] tracking-tight">Active Financial Accounts</h2>
            <span className="text-xs text-[#64748B] font-normal">({accounts.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectAccount('all')}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
                selectedAccountId === 'all'
                  ? 'bg-[#EAF3FF] text-[#172B4D] font-bold border border-[#5878FF]/30 shadow-xs'
                  : 'text-[#64748B] hover:text-[#172B4D] hover:bg-[#F4F9FF]'
              }`}
            >
              All Accounts
            </button>
            <button
              onClick={() => {
                if (onOpenAddAccount) onOpenAddAccount();
                setAddAccountModalOpen(true);
              }}
              className="btn-sky-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Account</span>
            </button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="bento-card p-6 text-center text-xs text-[#64748B]">
            No accounts connected yet. Click "+ Add Account" or upload a statement to auto-provision an account.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              const isCredit = acc.accountType === 'credit_card';

              return (
                <div
                  key={acc.id}
                  onClick={() => onSelectAccount(isSelected ? 'all' : acc.id)}
                  className={`bento-card p-4 text-left transition-all cursor-pointer relative overflow-visible ${
                    isSelected
                      ? 'ring-2 ring-[#5878FF] border-[#5878FF] bg-[#EAF3FF]/40 shadow-sm'
                      : 'hover:border-[#B8D3FC]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] bg-[#F4F9FF] border border-[#DCE7F6] px-2 py-0.5 rounded-md shrink-0">
                        {acc.accountType.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-[#64748B] font-medium truncate">{acc.institutionName}</span>
                    </div>

                    {/* Three-dot actions menu */}
                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenMenuAccountId(openMenuAccountId === acc.id ? null : acc.id)}
                        className="p-1 rounded-lg text-[#64748B] hover:text-[#172B4D] hover:bg-white border border-transparent hover:border-[#DCE7F6] transition-colors cursor-pointer"
                        title="Account actions"
                        aria-label="Account actions menu"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuAccountId === acc.id && (
                        <div className="absolute right-0 top-7 z-30 w-36 bg-white rounded-xl border border-[#DCE7F6] shadow-lg py-1 text-xs animate-in fade-in duration-100">
                          <button
                            onClick={() => {
                              setActiveAccount(acc);
                              setViewAccountModalOpen(true);
                              setOpenMenuAccountId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-[#172B4D] hover:bg-[#F4F9FF] font-medium cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#5878FF]" />
                            <span>View Details</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveAccount(acc);
                              setEditAccountModalOpen(true);
                              setOpenMenuAccountId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-[#172B4D] hover:bg-[#F4F9FF] font-medium cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#5878FF]" />
                            <span>Edit Account</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveAccount(acc);
                              setDeleteError(null);
                              setDeleteAccountModalOpen(true);
                              setOpenMenuAccountId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-rose-600 hover:bg-rose-50 font-medium cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Account</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-sm font-bold text-[#172B4D] truncate mb-1">{acc.accountName}</div>
                  <div className="text-xs text-[#64748B] font-mono mb-3">{acc.accountNumberMasked || '•••• ••••'}</div>

                  <div className="flex items-baseline justify-between pt-2 border-t border-[#EEF4FC]">
                    <span className="text-[11px] text-[#64748B]">Available Balance</span>
                    <span className={`text-base font-extrabold font-mono tnum ${isCredit && acc.balance < 0 ? 'text-rose-600' : 'text-[#172B4D]'}`}>
                      {formatMoney(acc.balance)}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 right-8 w-2 h-2 rounded-full bg-[#5878FF]" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. AI Financial Insight Engine (Phase 4A) */}
      <FinancialInsightsSection
        customerId={customer.id}
        selectedAccountId={selectedAccountId}
        transactions={filteredTransactions}
        accounts={accounts}
        currency={currency}
        isDemo={isDemoSession}
        onNavigateTab={onNavigateTab}
        onOpenUpload={onOpenUpload}
        onOpenAskViv={onOpenAskViv}
      />

      {/* 6. Bento Grid: Cash Flow Trajectory & Spending by Category */}
      <div className="bento-grid">
        {/* Left: Monthly Trend Overview */}
        <div className="bento-card col-span-12 lg:col-span-7 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#5878FF]" />
                <h3 className="font-bold text-sm text-[#172B4D]">Monthly Cash Flow Trajectory</h3>
              </div>
              <button
                onClick={() => onNavigateTab('analytics')}
                className="text-xs text-[#5878FF] hover:text-[#4665E8] font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span>Full Analytics</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {monthlyTrends.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#64748B]">
                No monthly statement data available. Import a statement to view cash flow trajectory.
              </div>
            ) : (
              <div className="space-y-4">
                {monthlyTrends.map((trend) => {
                  const maxVal = Math.max(trend.income, trend.expenses, 1);
                  const incomeWidth = Math.min(100, Math.max(5, (trend.income / maxVal) * 100));
                  const expenseWidth = Math.min(100, Math.max(5, (trend.expenses / maxVal) * 100));

                  return (
                    <div key={trend.month} className="space-y-1.5 p-3 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#172B4D]">{trend.monthLabel}</span>
                        <div className="flex items-center gap-3 font-mono tnum">
                          <span className="text-emerald-700 font-semibold">+{formatMoney(trend.income)}</span>
                          <span className="text-rose-600 font-semibold">-{formatMoney(trend.expenses)}</span>
                          <span className={`font-bold ${trend.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            Net: {trend.netCashFlow >= 0 ? '+' : '-'}{formatMoney(trend.netCashFlow)}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="h-1.5 w-full bg-[#EAF3FF] rounded-full overflow-hidden flex">
                          <div style={{ width: `${incomeWidth}%` }} className="bg-emerald-500 rounded-full" />
                        </div>
                        <div className="h-1.5 w-full bg-[#EAF3FF] rounded-full overflow-hidden flex">
                          <div style={{ width: `${expenseWidth}%` }} className="bg-rose-500 rounded-full" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Top Categories Spending */}
        <div className="bento-card col-span-12 lg:col-span-5 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#5878FF]" />
                <h3 className="font-bold text-sm text-[#172B4D]">Top Spending Categories</h3>
              </div>
              <button
                onClick={() => onNavigateTab('analytics')}
                className="text-xs text-[#5878FF] hover:text-[#4665E8] font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span>Drilldown</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {categoryBreakdown.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#64748B]">
                No expense transactions recorded yet to group by category.
              </div>
            ) : (
              <div className="space-y-3.5">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.categoryColor }} />
                        <span className="font-semibold text-[#172B4D]">{cat.categoryName}</span>
                        <span className="text-[11px] text-[#64748B]">({cat.transactionCount} txs)</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono tnum">
                        <span className="font-bold text-[#172B4D]">{formatMoney(cat.totalAmount)}</span>
                        <span className="text-[10px] text-[#64748B] w-9 text-right font-bold">{cat.percentage}%</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-[#EAF3FF] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(3, cat.percentage))}%`,
                          backgroundColor: cat.categoryColor,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 7. Bento Grid: Financial Health & Financial Goals Row */}
      <div className="bento-grid">
        {/* Financial Health Scorecard */}
        <div className="bento-card col-span-12 lg:col-span-6 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-[#172B4D]">Financial Health & Behavioral Health</h3>
              </div>
              <button
                onClick={() => onNavigateTab('profile')}
                className="text-xs text-[#5878FF] hover:text-[#4665E8] font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span>Cognitive Profile</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-4 p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-xs">
                {behavior.overallFinancialDiscipline >= 80 ? 'A' : behavior.overallFinancialDiscipline >= 65 ? 'B' : 'C'}
              </div>
              <div>
                <div className="text-sm font-bold text-[#172B4D]">
                  Overall Financial Discipline: {behavior.overallFinancialDiscipline}/100
                </div>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Verified behavioral scores across verified ledger events and active commitments.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6]">
                <span className="text-[10px] text-[#64748B] block uppercase font-bold">Savings Velocity</span>
                <span className="text-base font-extrabold text-[#172B4D] font-mono tnum">{behavior.savingsVelocity.score}/100</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6]">
                <span className="text-[10px] text-[#64748B] block uppercase font-bold">Shopping Discipline</span>
                <span className="text-base font-extrabold text-[#172B4D] font-mono tnum">{behavior.shoppingDiscipline.score}/100</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6]">
                <span className="text-[10px] text-[#64748B] block uppercase font-bold">Bill Discipline</span>
                <span className="text-base font-extrabold text-[#172B4D] font-mono tnum">{behavior.billPaymentDiscipline.score}/100</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6]">
                <span className="text-[10px] text-[#64748B] block uppercase font-bold">Investment Ratio</span>
                <span className="text-base font-extrabold text-[#172B4D] font-mono tnum">{behavior.investmentRatio.score}/100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Goals Progress */}
        <div className="bento-card col-span-12 lg:col-span-6 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#5878FF]" />
                <h3 className="font-bold text-sm text-[#172B4D]">Active Financial Goals</h3>
              </div>
              <button
                onClick={() => onNavigateTab('profile')}
                className="text-xs text-[#5878FF] hover:text-[#4665E8] font-semibold flex items-center gap-0.5 cursor-pointer"
              >
                <span>Manage Goals</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {goals.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#64748B]">
                No financial goals declared yet. Create your first savings goal in the Financial Profile.
              </div>
            ) : (
              <div className="space-y-3.5">
                {goals.map((goal) => {
                  const pct = Math.min(100, Math.round((goal.currentSavings / (goal.targetAmount || 1)) * 100));

                  return (
                    <div key={goal.id} className="p-3 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6] space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#172B4D]">{goal.name}</span>
                        <span className="font-mono tnum text-[#5878FF] font-bold">{pct}%</span>
                      </div>
                      <div className="h-2 w-full bg-[#EAF3FF] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#5878FF] rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#64748B] font-mono tnum">
                        <span>Saved: {formatMoney(goal.currentSavings)}</span>
                        <span>Target: {formatMoney(goal.targetAmount)} ({goal.targetDate})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 8. Recent Verified Transactions Preview: Flat Design 2.0 */}
      <div className="card-flat-2 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#5878FF]" />
            <h3 className="font-bold text-sm text-[#172B4D]">Recent Transactions</h3>
            <span className="text-xs text-[#64748B] font-normal">({filteredTransactions.length} total)</span>
          </div>
          <button
            onClick={() => onNavigateTab('transactions')}
            className="text-xs text-[#5878FF] hover:text-[#4665E8] font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>View Full Ledger</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#64748B]">
            No transactions found for the selected account.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#DCE7F6]">
            <table className="w-full text-left text-xs table-flat">
              <thead>
                <tr className="text-[#64748B] uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3 font-semibold">Date</th>
                  <th className="py-2.5 px-3 font-semibold">Description</th>
                  <th className="py-2.5 px-3 font-semibold">Category</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF4FC]">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#F8FBFF] transition-colors">
                    <td className="py-3 px-3 text-[#64748B] font-mono tnum text-[11px] whitespace-nowrap">{tx.date}</td>
                    <td className="py-3 px-3 font-semibold text-[#172B4D]">{tx.description}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 text-xs text-[#172B4D]">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: tx.categoryColor || '#5878FF' }}
                        />
                        <span className="font-medium">{tx.categoryName || 'General'}</span>
                      </div>
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-bold font-mono tnum ${
                        tx.type === 'credit' ? 'text-emerald-600' : 'text-[#172B4D]'
                      }`}
                    >
                      {tx.type === 'credit' ? '+' : '-'}{formatMoney(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Account Management Modals */}
      <AddAccountModal
        isOpen={addAccountModalOpen}
        onClose={() => setAddAccountModalOpen(false)}
        currency={currency}
        isDemo={isDemoSession}
        onSuccess={(newAccount) => {
          if (onAccountCreated) onAccountCreated(newAccount);
        }}
      />

      <EditAccountModal
        isOpen={editAccountModalOpen}
        account={activeAccount}
        onClose={() => {
          setEditAccountModalOpen(false);
          setActiveAccount(null);
        }}
        isDemo={isDemoSession}
        onSuccess={(updatedAccount) => {
          if (onAccountUpdated) onAccountUpdated(updatedAccount);
        }}
      />

      <AccountDetailsModal
        isOpen={viewAccountModalOpen}
        account={activeAccount}
        currency={currency}
        transactionsCount={activeAccount ? filteredTransactions.filter((t) => t.accountId === activeAccount.id).length : 0}
        onClose={() => {
          setViewAccountModalOpen(false);
          setActiveAccount(null);
        }}
        onEdit={() => {
          setEditAccountModalOpen(true);
        }}
        onDelete={() => {
          setDeleteAccountModalOpen(true);
        }}
      />

      <DeleteAccountModal
        isOpen={deleteAccountModalOpen}
        account={activeAccount}
        hasTransactions={activeAccount ? transactions.some((t) => t.accountId === activeAccount.id) : false}
        isOnlyAccount={accounts.length <= 1}
        isDeleting={isDeleting}
        error={deleteError}
        onClose={() => {
          setDeleteAccountModalOpen(false);
          setActiveAccount(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};
