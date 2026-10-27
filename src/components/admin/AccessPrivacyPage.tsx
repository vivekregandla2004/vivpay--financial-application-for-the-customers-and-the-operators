/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Lock,
  ShieldCheck,
  ShieldAlert,
  Users,
  EyeOff,
  FileKey,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  FileSpreadsheet,
  PieChart,
} from 'lucide-react';

export const AccessPrivacyPage: React.FC = () => {
  const permissionsMatrix = [
    {
      domain: 'Customer Banking Ledgers & Transactions',
      description: 'Personal accounts, debit/credit records, and financial summary',
      customer: 'Full (Self Only)',
      employee: 'Masked (Disputes Only)',
      admin: 'Denied (Metadata Only)',
      adminAccessDenied: true,
    },
    {
      domain: 'Raw Statement Files & Bank Credentials',
      description: 'Original PDF/XLSX imports and temporary extraction streams',
      customer: 'Self Upload Only',
      employee: 'Sanitized Parser Output',
      admin: 'Denied (Zero-Knowledge)',
      adminAccessDenied: true,
    },
    {
      domain: 'Collaborative Groups & Split Balances',
      description: 'Shared group expense ledger and peer-to-peer settlement math',
      customer: 'Active Members Only',
      employee: 'Denied (Unless Escalated)',
      admin: 'Denied (Tenant Isolated)',
      adminAccessDenied: true,
    },
    {
      domain: 'Financial Twin & Wealth Goal Forecasts',
      description: 'Simulated cash flow forecasts, identity profile, and feasibility metrics',
      customer: 'Full (Self Only)',
      employee: 'Denied',
      admin: 'Denied',
      adminAccessDenied: true,
    },
    {
      domain: 'Fraud Detection & AML Alert Queue',
      description: 'Risk score alerts, velocity anomalies, and investigation dossiers',
      customer: 'Denied',
      employee: 'Full (Triage & Resolve)',
      admin: 'Governance & Escalation',
      adminAccessDenied: false,
    },
    {
      domain: 'Operations SOPs & Knowledge Documents',
      description: 'Internal policy manuals, compliance guidance, and vector chunks',
      customer: 'Denied',
      employee: 'Read & Semantic Query',
      admin: 'Manage, Index & Audit',
      adminAccessDenied: false,
    },
    {
      domain: 'Identity Directory & RBAC Assignment',
      description: 'User activation, quarantine status, and organizational role mapping',
      customer: 'Self Profile Only',
      employee: 'Denied',
      admin: 'Full Administration',
      adminAccessDenied: false,
    },
    {
      domain: 'Immutable Security Audit Logs',
      description: 'Cryptographic event stream, actor tracking, and IP origin logs',
      customer: 'Denied',
      employee: 'Denied',
      admin: 'Full Audit Inspection',
      adminAccessDenied: false,
    },
  ];

  return (
    <div className="space-y-6 text-left">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Access Control & Privacy Boundaries</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                RBAC & Zero-Trust
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cryptographic boundary enforcement, customer ledger isolation, and separation of duties matrix
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700">
          Enforcement: <span className="text-emerald-700 font-bold">Client & Server Authoritative</span>
        </div>
      </div>

      {/* Critical Privacy Boundary Notice */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200/90 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2.5 font-bold text-sm text-purple-950">
          <EyeOff className="w-5 h-5 text-purple-700 shrink-0" />
          <span>Core Privacy Principle: Admins Cannot Access Customer Financial Ledgers</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          VivPay operates under strict <strong>zero-knowledge customer privacy</strong>. Possessing an Administrator role permits system governance, user directory management, and audit inspection, but <strong>does not grant permission to browse customer transaction histories, account balances, or personal statements</strong>. Private customer records remain isolated under cryptographic tenant boundaries and Row-Level Security (RLS).
        </p>
      </div>

      {/* Role & Permissions Matrix Table */}
      <div className="card-luxury p-6 space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Role-Based Access Control (RBAC) Entitlements Matrix</h3>
          <p className="text-xs text-slate-500">Fine-grained resource permissions across Customer, Operations, and Administrator domains</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Resource Domain</th>
                <th className="py-2.5 px-3">Customer Entitlement</th>
                <th className="py-2.5 px-3">Operations / Staff</th>
                <th className="py-2.5 px-3 text-right">Administrator Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permissionsMatrix.map((item, idx) => (
                <tr key={idx} className="hover:bg-purple-50/20 transition-colors">
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-900 block">{item.domain}</span>
                    <span className="text-[10px] text-slate-500">{item.description}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        item.customer.includes('Full') || item.customer.includes('Self')
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {item.customer}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        item.employee.includes('Full')
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : item.employee.includes('Masked') || item.employee.includes('Read')
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {item.employee}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        item.adminAccessDenied
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-purple-50 text-purple-700 border-purple-200'
                      }`}
                    >
                      {item.admin}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Pillars Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-luxury p-5 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
            <FileKey className="w-4 h-4 text-purple-600" />
            <span>Zero-Knowledge Credentials</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Bank account credentials, UPI PINs, and plain passwords are never stored in memory or persistence stores. Parsing relies entirely on client-side and sanitized temporary buffers.
          </p>
        </div>

        <div className="card-luxury p-5 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Tenant Isolation in RAG</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Knowledge vectors are strictly tagged with tenant identifiers. Customer Ask Viv queries are partitioned to personal statements, while Operations queries are scoped to organizational SOP manuals.
          </p>
        </div>

        <div className="card-luxury p-5 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Separation of Duties</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Operations personnel handle service cases and fraud triage without access to user administration. Administrators configure access without visibility into customers' private banking data.
          </p>
        </div>
      </div>
    </div>
  );
};
