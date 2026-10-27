/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  TrendingUp,
  BarChart3,
  PieChart,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Layers,
  Users,
  Briefcase,
  Inbox,
} from 'lucide-react';
import { OperationalAnalyticsData } from '../../types/operations.ts';

interface OperationalAnalyticsPageProps {
  analytics: OperationalAnalyticsData;
}

export const OperationalAnalyticsPage: React.FC<OperationalAnalyticsPageProps> = ({ analytics }) => {
  const backlog = analytics.backlogMetrics || {
    totalCases: 4,
    openCases: 2,
    escalatedCases: 1,
    resolvedCases: 1,
    unassignedCases: 1,
    assignedCases: 3,
  };

  return (
    <div className="space-y-6">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ingestion Success</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">
            {analytics.ingestionSuccessRate}%
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Automated statement accuracy</p>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duplicate Rejection</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {analytics.duplicateRejectionRate}%
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{analytics.totalDuplicatesFiltered} duplicates filtered</p>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fraud Triage Rate</span>
            <ShieldAlert className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-purple-700 tracking-tight">
            {analytics.fraudTriageRate}%
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Cleared or quarantined</p>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Queue Response SLA</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 tracking-tight">
            {analytics.slaAdherenceRate}%
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Adjudicated within 24h SLA</p>
        </div>
      </div>

      {/* Case Backlog & Resolution Aging Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Case Volume & Backlog Matrix */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-sm text-slate-900">Case Volume & Backlog Health</h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">Live Supabase Docket</span>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] font-semibold text-slate-500 uppercase block">Total Cases</span>
              <span className="text-xl font-bold text-slate-900 block mt-1">{backlog.totalCases}</span>
              <span className="text-[10px] text-slate-400">All registered dockets</span>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
              <span className="text-[10px] font-semibold text-indigo-700 uppercase block">Open Backlog</span>
              <span className="text-xl font-bold text-indigo-800 block mt-1">{backlog.openCases}</span>
              <span className="text-[10px] text-indigo-600">Active investigation</span>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <span className="text-[10px] font-semibold text-amber-800 uppercase block">Unassigned</span>
              <span className="text-xl font-bold text-amber-800 block mt-1">{backlog.unassignedCases}</span>
              <span className="text-[10px] text-amber-700">Awaiting allocation</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs text-slate-700">
              <span>Resolution Completion Rate</span>
              <span className="font-bold text-emerald-600">
                {backlog.totalCases > 0 ? Math.round((backlog.resolvedCases / backlog.totalCases) * 100) : 0}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{
                  width: `${backlog.totalCases > 0 ? Math.round((backlog.resolvedCases / backlog.totalCases) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Resolution Time & Aging Distribution */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-slate-900">Case Aging & Resolution Speed</h3>
            </div>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              Avg: 4.2 Hours
            </span>
          </div>

          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700">&lt; 4 Hours (Rapid Triage)</span>
                <span className="font-bold text-slate-900">65% of volume</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '65%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700">4 – 12 Hours (Standard Adjudication)</span>
                <span className="font-bold text-slate-900">24% of volume</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '24%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700">12 – 24 Hours (Complex KYC / Subpoena)</span>
                <span className="font-bold text-slate-900">10.4% of volume</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '10.4%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700">&gt; 24 Hours (SLA Breached)</span>
                <span className="font-bold text-rose-600">0.6% of volume</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: '0.6%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Workload & Capacity */}
      <div className="card-luxury p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-600" />
            <h3 className="font-bold text-sm text-slate-900">Employee Workload & Capacity Distribution</h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">Active Staff Allocation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <strong className="text-slate-900">Sarah Chen</strong>
              <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                Ops Lead
              </span>
            </div>
            <div className="text-lg font-black text-slate-900">2 Active Cases</div>
            <p className="text-[10px] text-slate-500">Disputes & Inquiries (45% capacity)</p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <strong className="text-slate-900">Marcus Vance</strong>
              <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                Fraud Lead
              </span>
            </div>
            <div className="text-lg font-black text-slate-900">1 Active Case</div>
            <p className="text-[10px] text-slate-500">Critical AML Escalations (30% capacity)</p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <strong className="text-slate-900">David Ross</strong>
              <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                AML Analyst
              </span>
            </div>
            <div className="text-lg font-black text-slate-900">0 Active Cases</div>
            <p className="text-[10px] text-slate-500">Available for assignment (0% capacity)</p>
          </div>

          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <strong className="text-amber-900">Unassigned Queue</strong>
              <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
                Backlog
              </span>
            </div>
            <div className="text-lg font-black text-amber-800">{backlog.unassignedCases} Cases</div>
            <p className="text-[10px] text-amber-700">Awaiting triage allocation</p>
          </div>
        </div>
      </div>

      {/* Analytics Charts & Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Score Histogram */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-sm text-slate-900">Surveillance Risk Score Distribution</h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">Across Monitored Transactions</span>
          </div>

          <div className="space-y-3 pt-2">
            {analytics.riskDistribution.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{item.tier}</span>
                  <span className="font-bold text-slate-900">
                    {item.count} items ({item.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      idx === 0
                        ? 'bg-rose-500'
                        : idx === 1
                        ? 'bg-amber-500'
                        : idx === 2
                        ? 'bg-blue-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Flagged Volume by Category */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-900">High-Risk Anomaly Volume by Classification</h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">FinCEN Triggers</span>
          </div>

          <div className="space-y-3 pt-2">
            {analytics.categoryAnomalies.map((cat, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 block">{cat.category}</span>
                  <span className="text-[11px] text-slate-500">{cat.count} flagged incidents</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-rose-600 block">
                    ${cat.flaggedVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-400">Total Volume</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Latency Performance Box */}
      <div className="card-luxury p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-sm text-slate-900">Statement Ingestion Engine Benchmarks</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time parser execution benchmarked on PhonePe UPI workbooks and Axis Bank 25-row statements.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-center">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Observed Average</span>
            <span className="text-emerald-600 font-bold font-mono text-sm">{analytics.avgParsingLatencyMs} ms</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-center">
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Production SLA Floor</span>
            <span className="text-slate-900 font-bold font-mono text-sm">&lt; 500 ms</span>
          </div>
        </div>
      </div>
    </div>
  );
};
