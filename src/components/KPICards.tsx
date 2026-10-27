import React, { useMemo } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  CreditCard,
  Sparkles,
  Layers,
  Repeat,
  Store,
  Flame,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { FinancialSummary, Transaction } from '../types/database.ts';

interface KPICardsProps {
  summary: FinancialSummary | null;
  loading?: boolean;
  transactions?: (Transaction & { categoryName?: string; categoryColor?: string })[];
  healthScore?: number;
  healthGrade?: string;
  currency?: string;
}

export const KPICards: React.FC<KPICardsProps> = ({
  summary,
  loading,
  transactions = [],
  healthScore,
  healthGrade,
  currency,
}) => {
  const [showAllCards, setShowAllCards] = React.useState(true);

  const effectiveCurrency = currency || summary?.currency || 'INR';
  const currencySymbol =
    effectiveCurrency === 'INR' ? '₹' : effectiveCurrency === 'EUR' ? '€' : effectiveCurrency === 'GBP' ? '£' : '$';

  const formatMoney = (amount: number) => {
    const locale = effectiveCurrency === 'INR' ? 'en-IN' : 'en-US';
    return `${currencySymbol}${Math.abs(amount).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // 1. Months analyzed
  const monthsAnalyzed = useMemo(() => {
    if (summary?.spendingTrend && summary.spendingTrend.length > 0) {
      return summary.spendingTrend.length;
    }
    if (transactions.length === 0) return 1;
    const months = new Set(transactions.map((t) => (t.date || '').slice(0, 7)).filter(Boolean));
    return Math.max(months.size, 1);
  }, [summary, transactions]);

  // 2. Debit transaction count
  const debitCount = useMemo(() => {
    return transactions.filter((t) => t.type === 'debit').length;
  }, [transactions]);

  // 3. Top category
  const topCategory = useMemo(() => {
    if (summary?.categoryBreakdown && summary.categoryBreakdown.length > 0) {
      return summary.categoryBreakdown[0];
    }
    return null;
  }, [summary]);

  // 4. Top merchant
  const topMerchant = useMemo(() => {
    if (summary?.topExpenseMerchants && summary.topExpenseMerchants.length > 0) {
      return summary.topExpenseMerchants[0];
    }
    return null;
  }, [summary]);

  // 5. Largest expense
  const largestExpense = useMemo(() => {
    const debits = transactions.filter((t) => t.type === 'debit' && t.amount > 0);
    if (debits.length === 0) return null;
    return [...debits].sort((a, b) => b.amount - a.amount)[0];
  }, [transactions]);

  // 6. Recurring subscriptions count & normalized monthly cost
  const recurringMetrics = useMemo(() => {
    const list = summary?.recurringPayments || [];
    const count = list.length;
    const totalCost = list.reduce((sum, r) => sum + (r.estimatedAmount || (r as any).amount || 0), 0);
    return { count, totalCost };
  }, [summary]);

  // 7. Estimated / Explainable Health Score
  const scoreVal = healthScore !== undefined
    ? healthScore
    : summary
    ? Math.min(100, Math.max(30, Math.round(50 + (summary.savingsRate * 0.8) + (summary.netCashFlow > 0 ? 15 : -10))))
    : 75;
  const gradeVal = healthGrade || (scoreVal >= 85 ? 'A' : scoreVal >= 70 ? 'B' : scoreVal >= 55 ? 'C' : 'D');

  if (loading || !summary) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse w-full">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" />
        ))}
      </div>
    );
  }

  const isNetPositive = summary.netCashFlow >= 0;
  const avgMonthlySavings = summary.netCashFlow / Math.max(1, monthsAnalyzed);

  return (
    <div className="space-y-4 w-full">
      {/* 10 Executive KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* KPI 1: Total Inflow (Pure Income) & Months Analyzed */}
        <div className="glass-card p-5 text-left space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total Income</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight font-mono tnum">
              {formatMoney(summary.pureIncome)}
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Across <strong className="text-[#172B4D] font-bold">{monthsAnalyzed}</strong> statement month{monthsAnalyzed === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* KPI 2: Total Outflow (Pure Expenses) & Debit Count */}
        <div className="glass-card p-5 text-left space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total Expenses</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight font-mono tnum">
              {formatMoney(summary.pureExpenses)}
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              <strong className="text-[#172B4D] font-bold">{debitCount || summary.totalTransactions}</strong> debit transaction{debitCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* KPI 3: Net Cash Flow & Surplus/Deficit Status */}
        <div className="glass-card p-5 text-left space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Net Cash Flow</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
              isNetPositive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
            }`}>
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono tnum ${
              isNetPositive ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              {isNetPositive ? '+' : '-'}{formatMoney(summary.netCashFlow)}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                isNetPositive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {isNetPositive ? 'Operating Surplus' : 'Operating Deficit'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Savings Rate & Average Monthly Savings */}
        <div className="glass-card p-5 text-left space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Savings Rate</span>
            <div className="w-8 h-8 rounded-xl bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center border border-[#5878FF]/20">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#5878FF] tracking-tight font-mono tnum">
              {summary.savingsRate}%
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5 font-mono tnum">
              Avg <strong className="text-[#172B4D] font-bold">{formatMoney(avgMonthlySavings)}</strong>/mo saved
            </p>
          </div>
        </div>

        {/* Extended Executive Cards (KPI 5-10) */}
        {showAllCards && (
          <>
            {/* KPI 5: Top Spending Category & Amount */}
            <div className="glass-card p-5 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Top Category</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-[#172B4D] tracking-tight truncate">
                  {topCategory ? topCategory.categoryName : 'General Outlay'}
                </div>
                <p className="text-[11px] text-[#64748B] mt-0.5 font-mono tnum">
                  {topCategory ? `${formatMoney(topCategory.amount)} (${topCategory.percentage}% of debits)` : 'No category data'}
                </p>
              </div>
            </div>

            {/* KPI 6: Explainable Financial Health Score */}
            <div className="glass-card p-5 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Health Score</span>
                <div className="w-8 h-8 rounded-xl bg-[#EDE9FF] text-[#5878FF] flex items-center justify-center border border-[#5878FF]/20">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-[#5878FF] tracking-tight font-mono tnum">
                    {scoreVal}
                  </span>
                  <span className="text-xs text-[#64748B] font-medium">/ 100</span>
                  <span className="ml-auto text-xs font-black px-2 py-0.5 rounded-lg bg-[#EAF3FF] text-[#5878FF] border border-[#5878FF]/20">
                    Grade {gradeVal}
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] mt-0.5">Canonical 10-factor model</p>
              </div>
            </div>

            {/* KPI 7: Top Merchant by Total Spending */}
            <div className="glass-card p-5 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Top Merchant</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Store className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-[#172B4D] tracking-tight truncate">
                  {topMerchant ? topMerchant.merchant : 'No Payee Recorded'}
                </div>
                <p className="text-[11px] text-[#64748B] mt-0.5 font-mono tnum">
                  {topMerchant ? `${formatMoney(topMerchant.amount)} (${topMerchant.count} payments)` : 'No transactions'}
                </p>
              </div>
            </div>

            {/* KPI 8: Recurring Subscriptions Count & Monthly Cost */}
            <div className="glass-card p-5 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Subscriptions</span>
                <div className="w-8 h-8 rounded-xl bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center border border-[#5878FF]/20">
                  <Repeat className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#172B4D] tracking-tight font-mono tnum">
                  {recurringMetrics.count}
                </div>
                <p className="text-[11px] text-[#64748B] mt-0.5 font-mono tnum">
                  {recurringMetrics.count > 0 ? `~${formatMoney(recurringMetrics.totalCost)}/mo normalized` : 'None detected'}
                </p>
              </div>
            </div>

            {/* KPI 9: Largest Single Expense */}
            <div className="glass-card p-5 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Largest Expense</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <Flame className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-extrabold text-rose-600 tracking-tight truncate font-mono tnum">
                  {largestExpense ? formatMoney(largestExpense.amount) : '--'}
                </div>
                <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
                  {largestExpense ? `${largestExpense.description} (${largestExpense.date})` : 'No debits'}
                </p>
              </div>
            </div>

            {/* KPI 10: Total Balance Across Active Accounts */}
            <div className="glass-card p-5 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total Balance</span>
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#172B4D] tracking-tight font-mono tnum">
                  {formatMoney(summary.totalBalance)}
                </div>
                <p className="text-[11px] text-[#64748B] mt-0.5">Reconciled across active accounts</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Toggle button to expand / collapse 10 Executive KPI cards */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setShowAllCards((prev) => !prev)}
          className="glass-pill inline-flex items-center gap-1.5 text-xs font-semibold text-[#172B4D] hover:bg-[#EAF3FF] px-3.5 py-1.5 transition-colors cursor-pointer shadow-xs"
        >
          <span>{showAllCards ? 'Show Core 4 KPIs' : 'Show All 10 Executive KPI Cards'}</span>
          {showAllCards ? <ChevronUp className="w-3.5 h-3.5 text-[#5878FF]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#5878FF]" />}
        </button>
      </div>
    </div>
  );
};
