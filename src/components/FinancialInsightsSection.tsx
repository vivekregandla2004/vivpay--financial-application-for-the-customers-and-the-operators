/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  Repeat,
  Wallet,
  RotateCcw,
  AlertTriangle,
  Target,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { FinancialInsight, FinancialInsightType, FinancialInsightEngineResult } from '../types/insights.ts';
import { Transaction, Account } from '../types/database.ts';
import { generateFinancialInsights } from '../lib/analytics/financialInsightEngine.ts';
import { insightsApi } from '../services/api.ts';

interface FinancialInsightsSectionProps {
  customerId: string;
  selectedAccountId?: string | 'all';
  transactions: (Transaction & { categoryName?: string; categoryColor?: string })[];
  accounts: Account[];
  currency?: string;
  isDemo?: boolean;
  onNavigateTab?: (tab: string) => void;
  onOpenUpload?: () => void;
  onOpenAskViv?: () => void;
}

export const FinancialInsightsSection: React.FC<FinancialInsightsSectionProps> = ({
  customerId,
  selectedAccountId = 'all',
  transactions,
  accounts,
  currency = 'INR',
  isDemo = false,
  onNavigateTab,
  onOpenUpload,
  onOpenAskViv,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);
  const [confirmedPayees, setConfirmedPayees] = useState<Set<string>>(new Set());
  const [engineResult, setEngineResult] = useState<FinancialInsightEngineResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshCount, setRefreshCount] = useState<number>(0);

  // Compute or fetch insights
  useEffect(() => {
    let isCancelled = false;

    const runEngine = async () => {
      setLoading(true);
      try {
        if (isDemo) {
          // In demo mode: compute client-side using canonical deterministic engine
          const result = generateFinancialInsights({
            customerId,
            accountId: selectedAccountId !== 'all' ? selectedAccountId : null,
            transactions,
            accounts,
            currency,
            confirmedRecurringIds: confirmedPayees,
          });
          if (!isCancelled) {
            setEngineResult(result);
          }
        } else {
          // In live mode: call authenticated API endpoint
          const result = await insightsApi.getInsights({
            accountId: selectedAccountId !== 'all' ? selectedAccountId : undefined,
            aiSummarize: true,
          });
          if (!isCancelled) {
            setEngineResult(result);
          }
        }
      } catch (err) {
        console.warn('Insights fetch fallback to local engine:', err);
        const fallback = generateFinancialInsights({
          customerId,
          accountId: selectedAccountId !== 'all' ? selectedAccountId : null,
          transactions,
          accounts,
          currency,
          confirmedRecurringIds: confirmedPayees,
        });
        if (!isCancelled) {
          setEngineResult(fallback);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    runEngine();

    return () => {
      isCancelled = true;
    };
  }, [customerId, selectedAccountId, transactions, accounts, currency, isDemo, confirmedPayees, refreshCount]);

  const handleConfirmRecurring = async (merchant: string) => {
    try {
      if (isDemo) {
        setConfirmedPayees((prev) => {
          const next = new Set(prev);
          next.add(merchant.toLowerCase());
          return next;
        });
      } else {
        await insightsApi.confirmRecurring(merchant, true);
        setConfirmedPayees((prev) => new Set(prev).add(merchant.toLowerCase()));
        setRefreshCount((c) => c + 1);
      }
    } catch (err) {
      console.error('Failed to confirm recurring payment:', err);
    }
  };

  const insights = engineResult?.insights || [];

  // Filter insights by category
  const filteredInsights = useMemo(() => {
    if (selectedCategory === 'all') return insights;
    return insights.filter((i) => i.type === selectedCategory || i.category === selectedCategory);
  }, [insights, selectedCategory]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: insights.length,
      spending_trend: 0,
      recurring_payment: 0,
      cash_flow_intelligence: 0,
      refund_reversal: 0,
      unusual_transaction: 0,
      savings_goal: 0,
    };
    for (const i of insights) {
      if (counts[i.type] !== undefined) {
        counts[i.type]++;
      }
    }
    return counts;
  }, [insights]);

  const getCategoryIcon = (type: FinancialInsightType) => {
    switch (type) {
      case 'spending_trend':
        return <TrendingUp className="w-4 h-4 text-indigo-600" />;
      case 'recurring_payment':
        return <Repeat className="w-4 h-4 text-violet-600" />;
      case 'cash_flow_intelligence':
        return <Wallet className="w-4 h-4 text-emerald-600" />;
      case 'refund_reversal':
        return <RotateCcw className="w-4 h-4 text-teal-600" />;
      case 'unusual_transaction':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'savings_goal':
        return <Target className="w-4 h-4 text-blue-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-purple-600" />;
    }
  };

  const getCategoryBadgeLabel = (type: FinancialInsightType) => {
    switch (type) {
      case 'spending_trend':
        return 'Spending Trend';
      case 'recurring_payment':
        return 'Potential Recurring';
      case 'cash_flow_intelligence':
        return 'Cash Flow Intelligence';
      case 'refund_reversal':
        return 'Contra-Refund Offset';
      case 'unusual_transaction':
        return 'Unusual Outflow (Non-Fraudulent)';
      case 'savings_goal':
        return 'Goal Feasibility';
      default:
        return 'Insight';
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'warning':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'positive':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              AI Financial Insight Engine
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Phase 4A Verified
            </span>
            {engineResult?.dataSufficiency && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                  engineResult.dataSufficiency === 'sufficient'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : engineResult.dataSufficiency === 'partial'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {engineResult.dataSufficiency} Evidence
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Explainable, deterministic calculations across 6 insight pillars with strictly verified provenance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshCount((c) => c + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors"
            title="Recalculate Insights"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Recalculate</span>
          </button>
        </div>
      </div>

      {/* AI Executive Summary Callout */}
      {engineResult?.aiExecutiveSummary && (
        <div className="bg-linear-to-r from-indigo-50/70 via-purple-50/50 to-white border border-indigo-100/80 rounded-xl p-4 flex items-start gap-3 shadow-xs">
          <div className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                Executive Synthesis
              </span>
              <span className="text-[10px] font-medium text-indigo-600 bg-white/80 border border-indigo-200/80 px-1.5 py-0.2 rounded">
                Server-Side Verified
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {engineResult.aiExecutiveSummary}
            </p>
          </div>
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: 'All Insights', count: categoryCounts.all },
          { key: 'spending_trend', label: 'Spending Trends', count: categoryCounts.spending_trend },
          { key: 'recurring_payment', label: 'Recurring Payments', count: categoryCounts.recurring_payment },
          { key: 'cash_flow_intelligence', label: 'Cash Flow', count: categoryCounts.cash_flow_intelligence },
          { key: 'refund_reversal', label: 'Refunds & Offsets', count: categoryCounts.refund_reversal },
          { key: 'unusual_transaction', label: 'Unusual Outflows', count: categoryCounts.unusual_transaction },
          { key: 'savings_goal', label: 'Goals & Targets', count: categoryCounts.savings_goal },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedCategory(tab.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === tab.key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedCategory === tab.key ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Insights Cards List */}
      <div className="space-y-3">
        {filteredInsights.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No insights match this filter criteria</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Select another category or import additional monthly statements.
            </p>
          </div>
        ) : (
          filteredInsights.map((insight) => {
            const isExpanded = expandedInsightId === insight.id;
            const evidence = insight.aggregateEvidence || {};

            return (
              <div
                key={insight.id}
                className="border border-slate-200/90 hover:border-slate-300 rounded-xl p-4 transition-all bg-white hover:shadow-xs space-y-3"
              >
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 shrink-0 mt-0.5">
                      {getCategoryIcon(insight.type)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          {getCategoryBadgeLabel(insight.type)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSeverityStyle(
                            insight.severity
                          )}`}
                        >
                          {insight.severity.toUpperCase()}
                        </span>
                        {insight.confidence && (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded">
                            {Math.round(insight.confidence * 100)}% Confidence
                          </span>
                        )}
                        {insight.type === 'recurring_payment' && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              insight.isConfirmed
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-900 border-amber-200'
                            }`}
                          >
                            {insight.isConfirmed ? 'CONFIRMED RECURRING' : 'POTENTIAL RECURRING'}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">{insight.title}</h3>
                    </div>
                  </div>

                  {/* Period Tags */}
                  <div className="text-[11px] text-slate-500 shrink-0 flex items-center gap-1.5 self-start">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {insight.observationPeriod.label ||
                        `${insight.observationPeriod.startDate} - ${insight.observationPeriod.endDate}`}
                    </span>
                    {insight.comparisonPeriod && (
                      <span className="text-slate-400">
                        (vs {insight.comparisonPeriod.label || insight.comparisonPeriod.startDate})
                      </span>
                    )}
                  </div>
                </div>

                {/* Explanation */}
                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  {insight.explanation}
                </p>

                {/* Suggested Action Callout if available */}
                {insight.suggestedAction && (
                  <div className="flex items-start gap-2 bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-xs text-slate-700">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900">Recommended Action: </span>
                      <span>{insight.suggestedAction}</span>
                    </div>
                  </div>
                )}

                {/* Action Row & Expand Details */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedInsightId(isExpanded ? null : insight.id)}
                      className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      <span>{isExpanded ? 'Hide Calculation Evidence' : 'Inspect Mathematical Evidence'}</span>
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {insight.type === 'recurring_payment' && !insight.isConfirmed && evidence.merchant && (
                    <button
                      onClick={() => handleConfirmRecurring(evidence.merchant)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-2xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm as Recurring</span>
                    </button>
                  )}
                </div>

                {/* Expanded Mathematical Evidence Drawer */}
                {isExpanded && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 space-y-2 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <span className="font-bold text-slate-800">Calculation Method: </span>
                        <span className="font-mono text-slate-600">{insight.calculationMethod}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-800">Detection Rule: </span>
                        <span>{insight.detectionRule}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-800">Severity Basis: </span>
                        <span>{insight.severityBasis}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-800">Engine Source: </span>
                        <span className="uppercase font-mono text-[10px] text-indigo-700">
                          {insight.source} ({Math.round(insight.confidence * 100)}% verified)
                        </span>
                      </div>
                    </div>

                    {Object.keys(evidence).length > 0 && (
                      <div className="border-t border-slate-200 pt-2">
                        <span className="font-bold text-slate-800 block mb-1">Aggregate Metrics Evidence:</span>
                        <div className="bg-white rounded p-2 border border-slate-200/80 font-mono text-[10px] text-slate-700 overflow-x-auto">
                          {JSON.stringify(evidence, null, 2)}
                        </div>
                      </div>
                    )}

                    {insight.supportingTransactionIds && insight.supportingTransactionIds.length > 0 && (
                      <div className="text-[10px] text-slate-500">
                        <span className="font-bold text-slate-700">Supporting Transaction IDs: </span>
                        <span className="font-mono">{insight.supportingTransactionIds.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
