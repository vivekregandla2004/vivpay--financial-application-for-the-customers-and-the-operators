/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ShieldAlert,
  Inbox,
  AlertTriangle,
  FileCheck2,
  FolderKanban,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Users,
  Sparkles,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  CaseRecord,
  FraudAlert,
  StatementProcessingMetric,
  InvestigationRecord,
} from '../../types/operations.ts';

interface EmployeeOverviewPageProps {
  cases: CaseRecord[];
  fraudAlerts: FraudAlert[];
  statementMetrics: StatementProcessingMetric[];
  investigations: InvestigationRecord[];
  onNavigateTab: (tab: 'transactions' | 'fraud' | 'investigations' | 'cases' | 'customers' | 'statements' | 'analytics' | 'knowledge') => void;
  onUpdateAlertStatus?: (alertId: string, status: FraudAlert['status']) => void;
  onUpdateCaseStatus?: (caseId: string, status: CaseRecord['status']) => void;
}

export const EmployeeOverviewPage: React.FC<EmployeeOverviewPageProps> = ({
  cases,
  fraudAlerts,
  statementMetrics,
  investigations,
  onNavigateTab,
  onUpdateAlertStatus,
  onUpdateCaseStatus,
}) => {
  const openCases = cases.filter((c) => c.status === 'open' || c.status === 'investigating');
  const criticalAlerts = fraudAlerts.filter((f) => f.riskScore >= 75 && f.status === 'flagged');
  const activeInvestigations = investigations.filter((i) => i.status !== 'resolved');
  const totalStatements = statementMetrics.length;

  return (
    <div className="space-y-6">
      {/* Operations Role Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Operations & Fraud Triage Command Center</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Staff Active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Financial dispute adjudication, AML anomaly monitoring, and automated statement ingestion
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-medium">
            <span className="text-slate-500">Operator: </span>
            <span className="text-slate-900 font-bold">Sarah Chen (Ops Lead)</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-medium text-emerald-800">
            <span className="text-emerald-600 font-bold">99.4% SLA Target Met</span>
          </div>
        </div>
      </div>

      {/* 4 Workload KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigateTab('cases')}
          className="card-luxury p-5 cursor-pointer hover:border-purple-300 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Inquiries</span>
            <Inbox className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{openCases.length}</div>
          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
            <span>Disputes in queue</span>
            <ArrowRight className="w-3.5 h-3.5 text-purple-600" />
          </p>
        </div>

        <div
          onClick={() => onNavigateTab('fraud')}
          className="card-luxury p-5 cursor-pointer hover:border-rose-300 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Critical AML Alerts</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight">{criticalAlerts.length}</div>
          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
            <span>Risk score ≥ 75 flagged</span>
            <ArrowRight className="w-3.5 h-3.5 text-rose-600" />
          </p>
        </div>

        <div
          onClick={() => onNavigateTab('investigations')}
          className="card-luxury p-5 cursor-pointer hover:border-indigo-300 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open Investigations</span>
            <FolderKanban className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-indigo-700 tracking-tight">{activeInvestigations.length}</div>
          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
            <span>Active fraud dossiers</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
          </p>
        </div>

        <div
          onClick={() => onNavigateTab('statements')}
          className="card-luxury p-5 cursor-pointer hover:border-emerald-300 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Processed Ingestions</span>
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{totalStatements}</div>
          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
            <span>PhonePe & Axis statements</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
          </p>
        </div>
      </div>

      {/* Workload, Allocation & Resolution Matrix */}
      <div className="card-luxury p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Case Allocation & Resolution Health Matrix</h3>
            <p className="text-xs text-slate-500">Live operational backlog distribution and workload metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('cases')}
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Cases</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 block">Assigned Cases</span>
            <span className="text-xl font-black text-slate-900 block mt-1">
              {cases.filter((c) => c.assignedTo && c.assignedTo !== 'Unassigned').length}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Allocated to staff</span>
          </div>

          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl">
            <span className="text-[11px] font-semibold text-amber-800 block">Unassigned Pool</span>
            <span className="text-xl font-black text-amber-800 block mt-1">
              {cases.filter((c) => !c.assignedTo || c.assignedTo === 'Unassigned').length}
            </span>
            <span className="text-[10px] text-amber-700 mt-0.5 block">Awaiting assignment</span>
          </div>

          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl">
            <span className="text-[11px] font-semibold text-indigo-800 block">Pending Inquiries</span>
            <span className="text-xl font-black text-indigo-800 block mt-1">{openCases.length}</span>
            <span className="text-[10px] text-indigo-700 mt-0.5 block">Open & investigating</span>
          </div>

          <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl">
            <span className="text-[11px] font-semibold text-rose-800 block">Escalated Priority</span>
            <span className="text-xl font-black text-rose-700 block mt-1">
              {cases.filter((c) => c.status === 'escalated').length}
            </span>
            <span className="text-[10px] text-rose-600 mt-0.5 block">Tier 2 lead review</span>
          </div>
        </div>
      </div>

      {/* Priority Action Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Triage Queue */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="font-bold text-sm text-slate-900">Urgent Fraud & Anomaly Triage</h3>
            </div>
            <button
              onClick={() => onNavigateTab('fraud')}
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {fraudAlerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-all"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-purple-700 font-bold">{alert.alertId}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                        alert.riskScore >= 75
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      Risk {alert.riskScore}/100
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate">{alert.customerName}</span>
                  </div>
                  <p className="text-xs text-slate-600 truncate">
                    <span className="font-semibold text-slate-800">${alert.amount.toFixed(2)}</span> at {alert.merchant}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">Trigger: {alert.triggerReason}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {alert.status === 'flagged' ? (
                    <button
                      onClick={() => onUpdateAlertStatus && onUpdateAlertStatus(alert.id, 'cleared')}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-50 cursor-pointer"
                    >
                      Clear
                    </button>
                  ) : alert.status === 'pending_review' ? (
                    <button
                      onClick={() => onUpdateAlertStatus && onUpdateAlertStatus(alert.id, 'flagged')}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700 cursor-pointer shadow-xs"
                    >
                      Flag Risk
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Cleared
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Case Worklist */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-sm text-slate-900">Priority Dispute Worklist</h3>
            </div>
            <button
              onClick={() => onNavigateTab('cases')}
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {cases.slice(0, 3).map((c) => (
              <div
                key={c.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 transition-all"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-purple-700 font-bold">{c.caseNumber}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                        c.priority === 'critical'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : c.priority === 'high'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {c.priority}
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate">{c.customerName}</span>
                  </div>
                  <p className="text-xs text-slate-800 font-medium truncate">{c.title}</p>
                  <p className="text-[11px] text-slate-500">Category: {c.category}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {c.status !== 'resolved' ? (
                    <button
                      onClick={() => onUpdateCaseStatus && onUpdateCaseStatus(c.id, 'resolved')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-semibold cursor-pointer"
                    >
                      Resolve
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[11px] font-medium">Resolved</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Module Quick Launcher */}
      <div className="card-luxury p-6 space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Operations Workspace Modules</h3>
          <p className="text-xs text-slate-500">Authorized tools for fraud triage, compliance, and statement analytics</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigateTab('transactions')}
            className="p-4 bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-200 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="font-bold text-xs text-slate-900">Transaction Monitoring</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Filter by status, risk score, and amount</p>
          </button>

          <button
            onClick={() => onNavigateTab('investigations')}
            className="p-4 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div className="font-bold text-xs text-slate-900">Fraud Investigations</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Active dossiers and evidence notes</p>
          </button>

          <button
            onClick={() => onNavigateTab('customers')}
            className="p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div className="font-bold text-xs text-slate-900">Customers Directory</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Operational records with privacy filters</p>
          </button>

          <button
            onClick={() => onNavigateTab('knowledge')}
            className="p-4 bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-200 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="font-bold text-xs text-slate-900">Knowledge Assistant</div>
            <p className="text-[11px] text-slate-500 mt-0.5">RAG SOP queries with exact citations</p>
          </button>
        </div>
      </div>
    </div>
  );
};
