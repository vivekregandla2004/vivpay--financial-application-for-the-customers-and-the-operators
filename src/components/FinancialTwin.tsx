/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Transaction, Account, FinancialSummary } from '../types/database.ts';
import {
  Sparkles,
  TrendingUp,
  Sliders,
  ShieldCheck,
  PiggyBank,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calculator,
  Compass,
  Zap,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  Target,
  Activity,
  Brain,
  User,
} from 'lucide-react';
import { useIdentity } from '../lib/identity/use-identity.ts';
import { analyzeBehaviour } from '../lib/identity/behavior.ts';
import { calculateGoalMetrics } from '../lib/identity/store.ts';
import { generateFinancialInsights } from '../lib/analytics/financialInsightEngine.ts';
import { FinancialInsight } from '../types/insights.ts';
import { detectRecurringSubscriptions } from '../lib/finance/analytics.ts';
import { computeSpendingPredictions } from '../lib/finance/intelligence/prediction.ts';
import { extractMerchantAndMethod } from '../lib/finance/normalize.ts';
import { CanonicalTransaction } from '../lib/finance/types.ts';

interface FinancialTwinProps {
  summary: FinancialSummary | null;
  accounts: Account[];
  transactions: (Transaction & { categoryName?: string })[];
  currency?: string;
  onOpenUpload: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const FinancialTwin: React.FC<FinancialTwinProps> = ({
  summary,
  accounts,
  transactions,
  currency = 'INR',
  onOpenUpload,
  onNavigateTab,
}) => {
  // Interactive Simulation Controls
  const [expenseReductionPct, setExpenseReductionPct] = useState<number>(15); // e.g. 15% cut in discretionary spending
  const [incomeAdjustment, setIncomeAdjustment] = useState<number>(0); // e.g. +$500/mo raise or freelance
  const [plannedOutlay, setPlannedOutlay] = useState<number>(0); // e.g. $1,200 travel/laptop

  // Grounding in Unified User Model
  const { identity } = useIdentity('customer');
  const { behavior, archetypes } = useMemo(() => {
    return analyzeBehaviour(transactions, identity);
  }, [transactions, identity]);

  const currencySymbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';

  const formatMoney = (amount: number) => {
    return `${currencySymbol}${Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Base metrics
  const totalBalance = summary?.totalBalance || accounts.reduce((acc, a) => acc + a.balance, 0);
  const pureIncome = summary?.pureIncome || 0;
  const pureExpenses = summary?.pureExpenses || 0;
  const netCashFlow = summary?.netCashFlow || pureIncome - pureExpenses;
  const currentSavingsRate = summary?.savingsRate || (pureIncome > 0 ? ((pureIncome - pureExpenses) / pureIncome) * 100 : 0);

  // Canonical transactions for recurring intelligence and predictions
  const canonicalTxs: CanonicalTransaction[] = useMemo(() => {
    return transactions.map((t, idx) => {
      const extracted = extractMerchantAndMethod(t.description);
      return {
        id: t.id,
        date: t.date,
        description: extracted.cleanDescription || t.description,
        originalDescription: t.description,
        amount: Number(t.amount) || 0,
        debit: t.type === 'debit' ? Number(t.amount) || 0 : 0,
        credit: t.type === 'credit' ? Number(t.amount) || 0 : 0,
        balance: t.balanceAfter ?? null,
        reference: null,
        merchant: extracted.merchant || null,
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
  }, [transactions]);

  // Auto-detect recurring subscriptions / fixed commitments from transactions using unified engine
  const recurringSubscriptions = useMemo(() => {
    return detectRecurringSubscriptions(canonicalTxs);
  }, [canonicalTxs]);

  // Explainable Spending Predictions
  const spendingPredictions = useMemo(() => {
    return computeSpendingPredictions(transactions);
  }, [transactions]);

  // Financial Health Score Calculation (0 to 100)
  const healthScore = useMemo(() => {
    let score = 50;

    // Savings rate factor (+/- 25 pts)
    if (currentSavingsRate >= 30) score += 25;
    else if (currentSavingsRate >= 20) score += 20;
    else if (currentSavingsRate >= 10) score += 10;
    else if (currentSavingsRate > 0) score += 5;
    else score -= 15;

    // Runway factor (+/- 25 pts)
    const monthlyBurn = pureExpenses > 0 ? pureExpenses : 1000;
    const runwayMonths = totalBalance / monthlyBurn;
    if (runwayMonths >= 6) score += 25;
    else if (runwayMonths >= 3) score += 15;
    else if (runwayMonths >= 1) score += 5;
    else score -= 10;

    return Math.max(15, Math.min(98, Math.round(score)));
  }, [currentSavingsRate, totalBalance, pureExpenses]);

  // Simulation Calculations
  const simulatedMonthlyExpenses = Math.max(0, pureExpenses * (1 - expenseReductionPct / 100));
  const simulatedMonthlyIncome = pureIncome + incomeAdjustment;
  const simulatedNetCashFlow = simulatedMonthlyIncome - simulatedMonthlyExpenses;
  const simulatedAnnualSurplus = (simulatedNetCashFlow * 12) - plannedOutlay;
  const currentRunwayMonths = pureExpenses > 0 ? Number((totalBalance / pureExpenses).toFixed(1)) : 12;
  const simulatedRunwayMonths = simulatedMonthlyExpenses > 0 ? Number(((totalBalance - plannedOutlay) / simulatedMonthlyExpenses).toFixed(1)) : 12;

  // Canonical Phase 4A Financial Insight Engine
  const engineResult = useMemo(() => {
    return generateFinancialInsights({
      customerId: transactions[0]?.customerId || 'customer',
      transactions,
      accounts,
      currency,
    });
  }, [transactions, accounts, currency]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header Banner */}
      <div className="glass-card p-6 sm:p-7 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#5878FF]/10 via-[#EDE9FF]/30 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF3FF] border border-[#5878FF]/20 text-[#5878FF] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#5878FF]" />
              <span>Autonomous Financial Twin Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172B4D] tracking-tight">
              Predictive Cash Flow & Resilience Simulation
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
              Your Financial Twin models verified statement inflows, spending velocity, and subscription commitments to simulate your financial trajectory in real time.
            </p>
          </div>

          {/* Overall Health Score Circular Card */}
          <div className="bg-white/90 border border-[#DCE7F6] rounded-2xl p-5 flex items-center gap-5 shrink-0 shadow-xs">
            <div className="relative flex items-center justify-center">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="currentColor"
                  strokeWidth="7"
                  className="text-slate-200"
                  fill="transparent"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="currentColor"
                  strokeWidth="7"
                  strokeDasharray={213.6}
                  strokeDashoffset={213.6 - (213.6 * healthScore) / 100}
                  strokeLinecap="round"
                  className="text-[#5878FF] transition-all duration-1000 ease-out"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black text-[#172B4D] leading-none font-mono tnum">{healthScore}</span>
                <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider">/ 100</span>
              </div>
            </div>

            <div className="space-y-1 text-left">
              <span className="text-xs font-bold text-[#172B4D] block">Health Index</span>
              <span className="text-xs font-semibold text-[#5878FF] bg-[#EDE9FF] px-2 py-0.5 rounded-full inline-block border border-[#5878FF]/20">
                {healthScore >= 80 ? 'Optimal Resilience' : healthScore >= 60 ? 'Stable Trajectory' : 'Needs Optimization'}
              </span>
              <p className="text-[11px] text-[#64748B] mt-1 max-w-[140px]">
                Derived from verified inflows, savings margin, and runway buffer.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Unified User Model Grounding Bar */}
      <div className="glass-card p-4 sm:p-5 bg-[#EAF3FF]/40 border border-[#5878FF]/20 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5878FF] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-[#172B4D]">
                Grounded in Unified User Model ({identity.personal.fullName})
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Discipline: {behavior.overallFinancialDiscipline}/100
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Declared Monthly Salary: <strong className="text-[#172B4D]">₹{identity.income.monthlyIncome.toLocaleString()}</strong> • Fixed Commitments: <strong className="text-[#172B4D]">₹{((identity.commitments.rent || 0) + (identity.commitments.homeLoanEmi || 0) + (identity.commitments.vehicleLoanEmi || 0) + (identity.commitments.personalLoanEmi || 0) + (identity.commitments.sipContributions || 0)).toLocaleString()}/mo</strong> • Risk: <strong className="text-[#172B4D] capitalize">{identity.risk.riskTolerance}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto text-xs shrink-0">
          {archetypes.filter((a) => a.matched).map((arch) => (
            <span key={arch.archetype} className="px-2.5 py-1 bg-white border border-[#5878FF]/20 rounded-lg text-[#5878FF] font-bold text-[11px] shadow-2xs">
              {arch.label}
            </span>
          ))}
        </div>
      </div>

      {/* 2. Three Diagnostic Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pillar 1: Savings Velocity */}
        <div className="bento-card p-5 space-y-3 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Savings Velocity</span>
            <div className="w-8 h-8 rounded-xl bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-[#5878FF] font-mono tnum">{currentSavingsRate.toFixed(1)}%</div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Net retained surplus vs total verified inflow
            </p>
          </div>
          <div className="w-full bg-[#EAF3FF] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#5878FF] h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, currentSavingsRate))}%` }}
            />
          </div>
          <span className="text-[10px] text-[#64748B] block">Recommended threshold: &gt;20.0%</span>
        </div>

        {/* Pillar 2: Liquidity Runway */}
        <div className="bento-card p-5 space-y-3 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Emergency Buffer</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600 font-mono tnum">
              {currentRunwayMonths} <span className="text-sm font-semibold text-[#64748B]">Months</span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Available liquid runway at current spend rate
            </p>
          </div>
          <div className="w-full bg-emerald-50 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (currentRunwayMonths / 6) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-[#64748B] block">Standard milestone: 6.0 Months</span>
        </div>

        {/* Pillar 3: Net Cash Balance */}
        <div className="bento-card p-5 space-y-3 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Net Cash Flow</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${netCashFlow >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {netCashFlow >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black font-mono tnum ${netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {netCashFlow >= 0 ? '+' : '-'}{formatMoney(netCashFlow)}
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Monthly inflow ({formatMoney(pureIncome)}) minus outflow ({formatMoney(pureExpenses)})
            </p>
          </div>
          <div className="w-full bg-[#EAF3FF] h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${netCashFlow >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(100, pureIncome > 0 ? (Math.abs(netCashFlow) / pureIncome) * 100 : 0)}%` }}
            />
          </div>
          <span className="text-[10px] text-[#64748B] block">Status: {netCashFlow >= 0 ? 'Net Positive Surplus' : 'Deficit Outflow'}</span>
        </div>
      </div>

      {/* 3. Interactive What-If Simulation Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Sliders */}
        <div className="lg:col-span-7 glass-card p-6 sm:p-7 space-y-6 text-left">
          <div className="flex items-center justify-between border-b border-[#DCE7F6] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#172B4D]">What-If Cash Flow Sandbox</h3>
                <p className="text-xs text-[#64748B]">Adjust variables to project outcomes over the next 12 months</p>
              </div>
            </div>

            <button
              onClick={() => {
                setExpenseReductionPct(15);
                setIncomeAdjustment(0);
                setPlannedOutlay(0);
              }}
              className="text-xs text-[#64748B] hover:text-[#5878FF] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="space-y-6">
            {/* Slider 1: Discretionary Spend Reduction */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#172B4D]">Trim Discretionary Expenses</span>
                <span className="font-extrabold text-[#5878FF] bg-[#EDE9FF] px-2.5 py-0.5 rounded-full border border-[#5878FF]/20 font-mono tnum">
                  -{expenseReductionPct}% (Save {formatMoney(pureExpenses * (expenseReductionPct / 100))}/mo)
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="5"
                value={expenseReductionPct}
                onChange={(e) => setExpenseReductionPct(Number(e.target.value))}
                className="w-full accent-[#5878FF] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#64748B]">
                <span>0% (As-is)</span>
                <span>-20%</span>
                <span>-40% (Aggressive Frugality)</span>
              </div>
            </div>

            {/* Slider 2: Inflow Adjustment */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#172B4D]">Simulate Monthly Inflow Increase</span>
                <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-mono tnum">
                  +{formatMoney(incomeAdjustment)} / mo
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={currency === 'INR' ? 50000 : 2500}
                step={currency === 'INR' ? 2500 : 100}
                value={incomeAdjustment}
                onChange={(e) => setIncomeAdjustment(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#64748B]">
                <span>+$0</span>
                <span>+{currencySymbol}{currency === 'INR' ? '25,000' : '1,200'}</span>
                <span>+{currencySymbol}{currency === 'INR' ? '50,000' : '2,500'}</span>
              </div>
            </div>

            {/* Slider 3: Planned Capital Outlay */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#172B4D]">Planned One-Time Expense</span>
                <span className="font-extrabold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 font-mono tnum">
                  -{formatMoney(plannedOutlay)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={currency === 'INR' ? 100000 : 5000}
                step={currency === 'INR' ? 5000 : 250}
                value={plannedOutlay}
                onChange={(e) => setPlannedOutlay(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#64748B]">
                <span>$0</span>
                <span>{currencySymbol}{currency === 'INR' ? '50,000' : '2,500'}</span>
                <span>{currencySymbol}{currency === 'INR' ? '100,000' : '5,000'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Simulated Trajectory Preview */}
        <div className="lg:col-span-5 glass-card p-6 sm:p-7 space-y-6 text-left">
          <div className="flex items-center gap-2.5 border-b border-[#DCE7F6] pb-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#172B4D]">Projected 12-Month Impact</h3>
              <p className="text-xs text-[#64748B]">Autonomous simulation outcomes</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Projected Net Monthly Cash Flow */}
            <div className="bg-[#F4F9FF] border border-[#DCE7F6] p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] block">Projected Monthly Cash Flow</span>
                <span className="text-xl font-black text-emerald-600 font-mono tnum">
                  {simulatedNetCashFlow >= 0 ? '+' : '-'}{formatMoney(simulatedNetCashFlow)}
                </span>
              </div>
              <span className="text-[11px] font-bold text-[#5878FF] bg-[#EDE9FF] px-2 py-1 rounded-lg border border-[#5878FF]/20 font-mono tnum">
                +{formatMoney(simulatedNetCashFlow - netCashFlow)}/mo
              </span>
            </div>

            {/* 12-Month Net Balance Boost */}
            <div className="bg-[#F4F9FF] border border-[#DCE7F6] p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] block">12-Month Cumulative Surplus</span>
                <span className="text-xl font-black text-[#172B4D] font-mono tnum">
                  {formatMoney(simulatedAnnualSurplus)}
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                1-Year Outlook
              </span>
            </div>

            {/* Revised Emergency Runway */}
            <div className="bg-[#F4F9FF] border border-[#DCE7F6] p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] block">Emergency Survival Runway</span>
                <span className="text-xl font-black text-[#5878FF] font-mono tnum">
                  {simulatedRunwayMonths} Months
                </span>
              </div>
              <span className="text-[11px] text-[#64748B] font-mono tnum">
                Current: {currentRunwayMonths} mo
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onOpenUpload}
              className="btn-sky-primary w-full py-2.5 rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Refine with Fresh Statement</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Goal Trajectory & Acceleration Simulation */}
      {identity.goals && identity.goals.length > 0 && (
        <div className="glass-card p-6 sm:p-7 space-y-4 text-left">
          <div className="flex items-center gap-2.5 border-b border-[#DCE7F6] pb-3">
            <div className="w-8 h-8 rounded-xl bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Simulated Goal Pacing & Milestone Acceleration
              </h3>
              <p className="text-xs text-slate-500">
                Modeled against declared milestones and simulated cash flow surplus
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {identity.goals.map((goal) => {
              const metrics = calculateGoalMetrics(goal);
              // Calculate acceleration with simulated net cash flow
              const surplusDelta = Math.max(0, simulatedNetCashFlow - netCashFlow);
              const boostedMonthly = goal.monthlyContribution + (surplusDelta * 0.4); // 40% surplus to goals
              const acceleratedMonths = boostedMonthly > 0 ? Math.ceil(metrics.remainingAmount / boostedMonthly) : metrics.monthsRemaining;
              const monthsSaved = Math.max(0, metrics.monthsRemaining - acceleratedMonths);

              return (
                <div key={goal.id} className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{goal.name}</h4>
                      <p className="text-[11px] text-slate-500">Target: ₹{goal.targetAmount.toLocaleString()} by {goal.targetDate}</p>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                      {metrics.progressPercentage}% Saved
                    </span>
                  </div>

                  <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-600"
                      style={{ width: `${metrics.progressPercentage}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block font-semibold">Standard Pace</span>
                      <span className="font-bold text-slate-800">{metrics.monthsRemaining} months</span>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900">
                      <span className="text-[10px] text-emerald-700 block font-semibold">Simulated Pace</span>
                      <span className="font-bold">{acceleratedMonths} months {monthsSaved > 0 ? `(-${monthsSaved} mo)` : ''}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Actionable AI Recommendations & Subscription Commitments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
        {/* Grounded Recommendations */}
        <div className="lg:col-span-7 card-luxury p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Statement-Grounded Recommendations</h3>
                <p className="text-xs text-slate-500">Deterministic actions tailored to your ledger records</p>
              </div>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('analytics')}
                className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>All Insights</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-3">
            {/* Phase 4A Verified Financial Insights if available */}
            {engineResult.insights.slice(0, 3).map((insight) => (
              <div
                key={insight.id}
                className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                      {insight.type.replace('_', ' ')}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        insight.severity === 'critical'
                          ? 'bg-rose-100 text-rose-800'
                          : insight.severity === 'warning'
                          ? 'bg-amber-100 text-amber-800'
                          : insight.severity === 'positive'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {insight.severity}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {Math.round(insight.confidence * 100)}% Conf
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900">{insight.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{insight.explanation}</p>
                {insight.suggestedAction && (
                  <p className="text-[11px] text-indigo-700 font-medium">
                    ↳ {insight.suggestedAction}
                  </p>
                )}
              </div>
            ))}

            {/* Recommendation 1 */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900">Emergency Reserve Acceleration</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your current reserves cover <strong className="text-slate-900">{currentRunwayMonths} months</strong> of core expenses. Allocating your projected net monthly surplus of{' '}
                  <strong className="text-emerald-700">{formatMoney(Math.max(0, netCashFlow))}</strong> directly into liquid savings reaches the recommended 6-month resilience target within{' '}
                  <strong className="text-slate-900">{Math.max(1, Math.round((6 - currentRunwayMonths) * 2))} months</strong>.
                </p>
              </div>
            </div>

            {/* Recommendation 2 */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-start gap-3">
              <Zap className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900">Discretionary Category Optimization</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Applying a modest 10% reduction to food delivery, entertainment, and transit preserves an extra{' '}
                  <strong className="text-purple-700">{formatMoney(pureExpenses * 0.1)} monthly</strong> without altering fixed mortgage, rent, or utility commitments.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Detected Recurring Obligations */}
        <div className="lg:col-span-5 card-luxury p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Detected Recurring Commitments</h3>
              <p className="text-xs text-slate-500">Auto-detected from bank & PhonePe statement ledger</p>
            </div>
          </div>

          {recurringSubscriptions.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500">
              Upload bank or PhonePe statements to auto-detect monthly subscriptions and recurring obligations.
            </div>
          ) : (
            <div className="space-y-2.5">
              {recurringSubscriptions.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 block truncate max-w-[180px]">{item.merchant}</span>
                    <span className="text-[10px] text-slate-500 capitalize">{item.detectedFrequency} • {item.occurrenceCount} debits</span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-900 block">
                      {formatMoney(item.estimatedMonthlyCost || item.averageAmount)}<span className="text-[10px] font-normal text-slate-400">/mo</span>
                    </span>
                    <span className="text-[9px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/60 px-1.5 py-0.2 rounded uppercase">
                      {item.confidence} conf
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
