/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Activity,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  Zap,
  ShoppingBag,
  PiggyBank,
  Briefcase,
  CreditCard,
  Tv,
  Receipt,
  Banknote,
  LineChart,
} from 'lucide-react';
import { EightDimensionalBehavior, ArchetypeEvaluation, BehavioralDimensionScore } from '../../lib/identity/types.ts';

interface BehavioralAnalyticsViewProps {
  behavior: EightDimensionalBehavior;
  archetypes: ArchetypeEvaluation[];
}

interface DimensionMeta {
  key: keyof Omit<EightDimensionalBehavior, 'overallFinancialDiscipline' | 'dataSufficiency' | 'totalTransactionsEvaluated' | 'observationPeriodMonths'>;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  goodThreshold: string;
}

const DIMENSION_METAS: DimensionMeta[] = [
  {
    key: 'shoppingDiscipline',
    title: 'Shopping Discipline',
    icon: ShoppingBag,
    description: 'Measures impulse control and non-essential retail spending as a proportion of total outflows.',
    goodThreshold: '> 70: Minimal discretionary leakage',
  },
  {
    key: 'savingsVelocity',
    title: 'Savings Velocity',
    icon: PiggyBank,
    description: 'Measures net accumulation rate of positive monthly cash flow relative to inbound credits.',
    goodThreshold: '> 75: High surplus capital retention',
  },
  {
    key: 'incomeStability',
    title: 'Income Stability',
    icon: Briefcase,
    description: 'Measures regularity, interval consistency, and low coefficient of variation in salary credits.',
    goodThreshold: '> 80: Predictable recurring payroll',
  },
  {
    key: 'loanRepaymentEmiLoad',
    title: 'Loan Repayment & EMI Load',
    icon: CreditCard,
    description: 'Assesses debt-to-income (DTI) service burden across active loans, EMIs, and credit commitments.',
    goodThreshold: '> 75: Safe conservative DTI (< 25%)',
  },
  {
    key: 'subscriptionDiscretionaryLoad',
    title: 'Subscription & Discretionary Load',
    icon: Tv,
    description: 'Evaluates recurring entertainment, streaming, cloud services, and leisure subscription creep.',
    goodThreshold: '> 70: Lean digital footprint (< 10%)',
  },
  {
    key: 'billPaymentDiscipline',
    title: 'Bill Payment Discipline',
    icon: Receipt,
    description: 'Tracks on-time settlements for electricity, broadband, mobile recharges, and zero penalty fees.',
    goodThreshold: '> 85: Clean settlement history',
  },
  {
    key: 'cashWithdrawalFrequency',
    title: 'Cash Withdrawal Frequency',
    icon: Banknote,
    description: 'Monitors physical ATM cash extraction vs transparent, trackable digital ledger settlements.',
    goodThreshold: '> 80: High digital transparency',
  },
  {
    key: 'investmentRatio',
    title: 'Investment Ratio',
    icon: LineChart,
    description: 'Measures monthly capital allocation to mutual fund SIPs, equity, and wealth compounding assets.',
    goodThreshold: '> 65: Over 15% income to investments',
  },
];

export const BehavioralAnalyticsView: React.FC<BehavioralAnalyticsViewProps> = ({
  behavior,
  archetypes,
}) => {
  const matchedArchetypes = archetypes.filter((a) => a.matched);
  const unmatchedArchetypes = archetypes.filter((a) => !a.matched);

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 50) return 'text-blue-700 bg-blue-50 border-blue-200';
    if (score >= 35) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const getBarGradient = (score: number) => {
    if (score >= 75) return 'from-emerald-500 to-teal-600';
    if (score >= 50) return 'from-blue-500 to-indigo-600';
    if (score >= 35) return 'from-amber-400 to-orange-500';
    return 'from-rose-500 to-red-600';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Executive Summary Banner */}
      <div className="card-luxury p-6 sm:p-7 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30">
                Layer 2 Behavioral Intelligence
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                behavior.dataSufficiency === 'sufficient'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
              }`}>
                {behavior.dataSufficiency === 'sufficient' ? 'Empirically Sufficient Data' : 'Preliminary Data Mode'}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight font-['Plus_Jakarta_Sans']">
              Eight-Dimensional Behavioral Analysis
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Derived deterministically from {behavior.totalTransactionsEvaluated} canonical transaction records across {behavior.observationPeriodMonths} observation cycle(s). Scores evaluate financial impulse control, capital retention velocity, and recurring commitment stability.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 shrink-0">
            <div className="text-right">
              <div className="text-3xl font-black text-emerald-400">
                {behavior.overallFinancialDiscipline}
                <span className="text-sm text-slate-400 font-semibold">/100</span>
              </div>
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                Overall Discipline Score
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Observation parameters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">Total Analyzed</span>
            <span className="font-bold text-slate-100">{behavior.totalTransactionsEvaluated} verified entries</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">Observation Span</span>
            <span className="font-bold text-slate-100">{behavior.observationPeriodMonths} monthly cycle(s)</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">Active Archetypes</span>
            <span className="font-bold text-emerald-300">{matchedArchetypes.length} confirmed</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">Calculation Standard</span>
            <span className="font-bold text-slate-100">Deterministic DJB2 taxonomy</span>
          </div>
        </div>
      </div>

      {/* 2. Behavioral Archetypes Section */}
      <div className="card-luxury p-6 sm:p-7 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-900">Behavioral Archetypes</h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {matchedArchetypes.length} of {archetypes.length} Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Empirical behavioral patterns classified by explicit score thresholds. Users are never labeled under insufficient evidence.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {archetypes.map((arch) => (
            <div
              key={arch.archetype}
              className={`p-4 rounded-2xl border transition-all ${
                arch.matched
                  ? 'bg-purple-50/40 border-purple-200/90 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200/60 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-extrabold text-xs text-slate-900 leading-tight">
                  {arch.label}
                </span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                  arch.matched
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-200/80 text-slate-600'
                }`}>
                  {arch.matched ? 'Active Match' : 'Not Met'}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">
                {arch.description}
              </p>

              <div className="space-y-1.5 pt-2 border-t border-slate-200/70 text-[10px]">
                <div className="flex items-center justify-between text-slate-500 font-semibold">
                  <span>Threshold:</span>
                  <span className="text-slate-700 font-bold">{arch.thresholdMetDescription}</span>
                </div>
                <div className="text-slate-600">
                  <span className="font-semibold text-slate-500">Evidence: </span>
                  <span className="font-medium">{arch.evidence}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. The 8 Dimensions Detailed Cards Grid */}
      <div className="card-luxury p-6 sm:p-7 space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-base text-slate-900">
            Eight Dimensions of Financial Behavior
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Normalized 0–100 scales with confidence ratings, empirical factors, and mathematical justifications.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {DIMENSION_METAS.map((meta) => {
            const data: BehavioralDimensionScore = behavior[meta.key];
            const Icon = meta.icon;

            return (
              <div
                key={meta.key}
                className="p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{meta.title}</h4>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{meta.description}</p>
                    </div>
                  </div>

                  <span className={`text-xs font-black px-2.5 py-1 rounded-xl border shrink-0 ${getScoreColor(data.score)}`}>
                    {data.score} / 100
                  </span>
                </div>

                {/* Score Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${getBarGradient(data.score)} transition-all duration-500`}
                      style={{ width: `${Math.max(3, data.score)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                    <span>Benchmark: {meta.goodThreshold}</span>
                    <span>Confidence: {(data.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {/* Justification */}
                <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-700 font-medium leading-relaxed">
                  {data.justification}
                </div>

                {/* Factors Breakdown */}
                {data.factors && data.factors.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                    {data.factors.map((f, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border flex items-center justify-between ${
                          f.impact === 'positive'
                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
                            : f.impact === 'negative'
                            ? 'bg-rose-50/50 border-rose-200 text-rose-800'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="font-semibold truncate pr-1">{f.label}</span>
                        <span className="font-bold shrink-0">{f.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
