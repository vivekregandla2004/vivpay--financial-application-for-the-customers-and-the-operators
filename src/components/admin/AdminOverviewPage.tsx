/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Database,
  Activity,
  Lock,
  ArrowRight,
  BookOpen,
  Sliders,
  AlertTriangle,
  FileCheck2,
  Inbox,
  Shield,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  Radio,
} from 'lucide-react';
import { SystemUser, AuditLogEntry } from '../../types/operations.ts';
import { adminApi } from '../../services/api.ts';

interface AdminOverviewPageProps {
  systemUsers: SystemUser[];
  auditLogs: AuditLogEntry[];
  supabaseStatus: any;
  onNavigateTab: (tab: 'users' | 'knowledge' | 'audit' | 'config' | 'privacy') => void;
  onRefreshHealth?: () => void;
}

export const AdminOverviewPage: React.FC<AdminOverviewPageProps> = ({
  systemUsers,
  auditLogs,
  supabaseStatus,
  onNavigateTab,
  onRefreshHealth,
}) => {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getOverview();
      setOverview(data);
    } catch (e: any) {
      console.warn('Could not fetch live admin overview:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const customerCount = overview?.userBreakdown?.customers ?? systemUsers.filter((u) => u.role === 'customer').length;
  const employeeCount = overview?.userBreakdown?.employees ?? systemUsers.filter((u) => u.role === 'employee').length;
  const adminCount = overview?.userBreakdown?.admins ?? systemUsers.filter((u) => u.role === 'admin').length;
  const totalUsers = overview?.totalUsers ?? systemUsers.length;

  const staffActive = overview?.staffStatusBreakdown?.active ?? systemUsers.filter((u) => (u.role === 'employee' || u.role === 'admin') && u.status === 'active').length;
  const staffSuspended = overview?.staffStatusBreakdown?.suspended ?? systemUsers.filter((u) => (u.role === 'employee' || u.role === 'admin') && u.status === 'suspended').length;
  const staffPending = overview?.staffStatusBreakdown?.pending ?? systemUsers.filter((u) => (u.role === 'employee' || u.role === 'admin') && u.status === 'pending').length;

  const totalAuditEvents = overview?.totalAuditEvents ?? auditLogs.length;
  const isLiveConnected = overview?.isLive || supabaseStatus?.isConfigured;

  return (
    <div className="space-y-6 text-left">
      {/* Governance Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Governance & Security Command Center</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Admin Root
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              System access control, RAG knowledge integrity, cryptographic privacy policies, and audit observability
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5">
            <span className="text-slate-500">Telemetry: </span>
            <span className={`font-bold flex items-center gap-1 ${isLiveConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
              <Radio className={`w-3 h-3 ${isLiveConnected ? 'animate-pulse text-emerald-600' : 'text-amber-600'}`} />
              {isLiveConnected ? 'Live Supabase DB' : 'Demo State'}
            </span>
          </div>
          <button
            onClick={() => {
              fetchOverview();
              onRefreshHealth?.();
            }}
            className="bg-purple-50 hover:bg-purple-100/80 border border-purple-200 text-purple-700 font-semibold px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            {loading ? 'Verifying...' : 'Verify Health'}
          </button>
        </div>
      </div>

      {/* Staff Status Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Active Staff Members</span>
            <span className="text-xl font-extrabold text-emerald-900 block mt-0.5">{staffActive}</span>
            <span className="text-[10px] text-emerald-700">Authenticated staff with operational access</span>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        </div>

        <div className="p-3.5 bg-rose-50/60 border border-rose-200/80 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block">Suspended Staff</span>
            <span className="text-xl font-extrabold text-rose-900 block mt-0.5">{staffSuspended}</span>
            <span className="text-[10px] text-rose-700">Quarantined accounts (access revoked)</span>
          </div>
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
        </div>

        <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Pending Staff Approval</span>
            <span className="text-xl font-extrabold text-amber-900 block mt-0.5">{staffPending}</span>
            <span className="text-[10px] text-amber-700">Awaiting supervisor verification</span>
          </div>
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
        </div>
      </div>

      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigateTab('users')}
          className="card-luxury p-5 cursor-pointer hover:border-purple-300 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">System Users</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{systemUsers.length}</div>
          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
            <span>{customerCount} Cust · {employeeCount} Staff · {adminCount} Admin</span>
            <ArrowRight className="w-3.5 h-3.5 text-purple-600" />
          </p>
        </div>

        <div
          onClick={() => onNavigateTab('knowledge')}
          className="card-luxury p-5 cursor-pointer hover:border-indigo-300 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">RAG Knowledge Base</span>
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-indigo-700 tracking-tight">768-Dim</div>
          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
            <span>L2-norm vector space active</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
          </p>
        </div>

        <div
          onClick={() => onNavigateTab('audit')}
          className="card-luxury p-5 cursor-pointer hover:border-amber-300 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Audit Trail Events</span>
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{auditLogs.length}</div>
          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
            <span>Immutable security events</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
          </p>
        </div>

        <div
          onClick={() => onNavigateTab('config')}
          className="card-luxury p-5 cursor-pointer hover:border-emerald-300 transition-all hover:shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Database Tables</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">8 / 8 Schemas</div>
          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
            <span>RLS isolated policies</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
          </p>
        </div>
      </div>

      {/* Infrastructure Health & Recent Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core Infrastructure Matrix */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600" />
              <span>Core Infrastructure Status</span>
            </h3>
            <button
              onClick={() => onNavigateTab('config')}
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
            >
              <span>Config Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-800 block">Database Target</span>
                <span className="text-slate-500 font-mono text-[11px]">https://qkuasaeecakwjfeymtwv.supabase.co</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Connected
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-800 block">RAG Vector Intelligence</span>
                <span className="text-slate-500 text-[11px]">768-Dim Normalized text-embedding-004</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Active (0.38 Floor)
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-800 block">Tenant & RBAC Boundary</span>
                <span className="text-slate-500 text-[11px]">SOP-SEC-05 Zero-Knowledge Access</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Strictly Guarded
              </span>
            </div>
          </div>
        </div>

        {/* Recent Audit Stream */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-600" />
              <span>Live Audit Stream (Recent 4 Events)</span>
            </h3>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {auditLogs.slice(0, 4).map((log) => (
              <div
                key={log.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs font-mono"
              >
                <div className="space-y-0.5 min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-purple-700">{log.action}</span>
                    <span className="text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate font-sans">
                    By {log.actorEmail} on {log.resource}
                  </p>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                    log.status === 'SUCCESS'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admin Module Navigation Cards */}
      <div className="card-luxury p-6 space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Governance Modules</h3>
          <p className="text-xs text-slate-500">Administrative tools for access security, policy knowledge, and audit inspections</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigateTab('users')}
            className="p-4 bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-200 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div className="font-bold text-xs text-slate-900">User & Role Management</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Toggle status and manage RBAC roles</p>
          </button>

          <button
            onClick={() => onNavigateTab('knowledge')}
            className="p-4 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="font-bold text-xs text-slate-900">Knowledge & Documents</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Vector chunks and SOP documentation</p>
          </button>

          <button
            onClick={() => onNavigateTab('audit')}
            className="p-4 bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-200 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
            <div className="font-bold text-xs text-slate-900">Audit Activity</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Full administrative event log</p>
          </button>

          <button
            onClick={() => onNavigateTab('privacy')}
            className="p-4 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-200 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
              <Lock className="w-4 h-4" />
            </div>
            <div className="font-bold text-xs text-slate-900">Access & Privacy Matrix</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Enforce zero-knowledge customer privacy</p>
          </button>
        </div>
      </div>
    </div>
  );
};
