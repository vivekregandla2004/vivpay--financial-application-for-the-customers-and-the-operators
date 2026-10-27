/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  Search,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Eye,
  FileSpreadsheet,
  Inbox,
  X,
  AlertCircle,
} from 'lucide-react';
import { CustomerOpsRecord } from '../../types/operations.ts';

interface CustomersOpsPageProps {
  customers: CustomerOpsRecord[];
}

export const CustomersOpsPage: React.FC<CustomersOpsPageProps> = ({ customers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [kycFilter, setKycFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOpsRecord | null>(null);

  const filtered = customers.filter((c) => {
    const matchesSearch =
      searchTerm === '' ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.accountNumberMasked.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesKyc = kycFilter === 'all' || c.kycStatus === kycFilter;
    const matchesRisk = riskFilter === 'all' || c.riskTier === riskFilter;

    return matchesSearch && matchesKyc && matchesRisk;
  });

  return (
    <div className="space-y-6">
      {/* Privacy and Security Notice Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Employee Security & Privacy Perimeter Active (SOP-SEC-05)</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Access is strictly restricted to assigned operational duties. Raw passwords, authentication tokens, and hidden group details are cryptographically shielded.
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl text-emerald-400 font-bold self-start md:self-auto">
          Audit Trail Active
        </span>
      </div>

      {/* Control Bar */}
      <div className="card-luxury p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Customer Operational Profiles</h3>
            <p className="text-xs text-slate-500">
              Customer identification verification, risk tier categorization, and account metadata
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
            Customer Directory: <span className="font-bold text-slate-900">{customers.length} profiles</span>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer name, email, account..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={kycFilter}
            onChange={(e) => setKycFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">All KYC Statuses</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="flagged">Flagged</option>
          </select>

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">All Risk Tiers</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card-luxury p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Customer Name</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">Masked Account</th>
                <th className="py-2.5 px-3">KYC Status</th>
                <th className="py-2.5 px-3">Risk Tier</th>
                <th className="py-2.5 px-3">Linked Accounts</th>
                <th className="py-2.5 px-3">Open Tickets</th>
                <th className="py-2.5 px-3">Ledger Balance</th>
                <th className="py-2.5 px-3 text-right">Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-purple-50/20 transition-colors">
                  <td className="py-3 px-3 font-semibold text-slate-900">{c.name}</td>
                  <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">{c.email}</td>
                  <td className="py-3 px-3 font-mono text-slate-700">{c.accountNumberMasked}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        c.kycStatus === 'verified'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : c.kycStatus === 'pending'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {c.kycStatus}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        c.riskTier === 'high'
                          ? 'bg-rose-50 text-rose-700'
                          : c.riskTier === 'medium'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {c.riskTier}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700">{c.linkedAccountsCount}</td>
                  <td className="py-3 px-3">
                    {c.openCasesCount > 0 ? (
                      <span className="font-bold text-amber-600">{c.openCasesCount} active</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-slate-900">
                    {c.currency === 'INR' ? '₹' : '$'}
                    {c.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => setSelectedCustomer(c)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Inspection Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Operational Customer Dossier — {selectedCustomer.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Full Legal Name:</span>
                  <span className="font-bold text-slate-900">{selectedCustomer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Contact Email:</span>
                  <span className="font-mono text-slate-800">{selectedCustomer.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Masked Account:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedCustomer.accountNumberMasked}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Statement Balance:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedCustomer.currency === 'INR' ? '₹' : '$'}
                    {selectedCustomer.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">KYC Compliance Tier:</span>
                  <span className="font-bold uppercase text-emerald-700">{selectedCustomer.kycStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Risk Assessment:</span>
                  <span className="font-bold uppercase text-rose-600">{selectedCustomer.riskTier} Risk</span>
                </div>
              </div>

              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-purple-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                  Compliance & Tenant Isolation Verification
                </span>
                <p className="text-[11px] text-purple-800 leading-relaxed">
                  Customer records are isolated under tenant UUID. All private credentials, passwords, cryptographic salts, and hidden collaborative group budgets are strictly redacted from this operational view.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
