/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Search,
  Filter,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  X,
  PlusCircle,
  FileText,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { MonitoredTransaction } from '../../types/operations.ts';

interface TransactionMonitoringPageProps {
  transactions: MonitoredTransaction[];
  onUpdateStatus?: (id: string, status: MonitoredTransaction['status']) => void;
  onEscalateToInvestigation?: (tx: MonitoredTransaction) => void;
}

export const TransactionMonitoringPage: React.FC<TransactionMonitoringPageProps> = ({
  transactions,
  onUpdateStatus,
  onEscalateToInvestigation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedTx, setSelectedTx] = useState<MonitoredTransaction | null>(null);
  const [findingNote, setFindingNote] = useState('');

  const filtered = transactions.filter((t) => {
    const matchesSearch =
      searchTerm === '' ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.accountNumberMasked.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesRisk =
      riskFilter === 'all' ||
      (riskFilter === 'high' && t.riskScore >= 75) ||
      (riskFilter === 'medium' && t.riskScore >= 40 && t.riskScore < 75) ||
      (riskFilter === 'low' && t.riskScore < 40);

    return matchesSearch && matchesStatus && matchesType && matchesRisk;
  });

  const handleApplyFinding = (newStatus: MonitoredTransaction['status']) => {
    if (!selectedTx) return;
    onUpdateStatus?.(selectedTx.id, newStatus);
    setSelectedTx({ ...selectedTx, status: newStatus });
    setFindingNote('');
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="card-luxury p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Transaction Surveillance & Risk Triage</h3>
            <p className="text-xs text-slate-500">
              Authorized transaction inspection, anomaly rule indicators, and AML evidence analysis
            </p>
          </div>
          <div className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
            Surveillance Pool: <span className="font-bold text-slate-800">{transactions.length} items</span>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search merchant, customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="cleared">Cleared</option>
            <option value="flagged">Flagged</option>
            <option value="under_review">Under Review</option>
          </select>

          {/* Risk Level Filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">All Risk Levels</option>
            <option value="high">High Risk (≥ 75)</option>
            <option value="medium">Medium Risk (40 - 74)</option>
            <option value="low">Low Risk (&lt; 40)</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">All Directions</option>
            <option value="debit">Debits Only</option>
            <option value="credit">Credits Only</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card-luxury p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Customer & Account</th>
                <th className="py-2.5 px-3">Description / Merchant</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Risk Score</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-purple-50/20 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">{tx.date}</td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-900 block">{tx.customerName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{tx.accountNumberMasked}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-slate-800 font-medium block max-w-xs truncate">{tx.description}</span>
                    {tx.riskFlag && tx.riskFlag !== 'normal' && (
                      <span className="inline-block mt-0.5 text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        {tx.riskFlag.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{tx.categoryName}</td>
                  <td className="py-3 px-3 whitespace-nowrap font-semibold">
                    <span className={tx.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'}>
                      {tx.type === 'credit' ? '+' : '-'}
                      {tx.currency === 'INR' ? '₹' : '$'}
                      {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                        tx.riskScore >= 75
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : tx.riskScore >= 40
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {tx.riskScore}/100
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        tx.status === 'cleared'
                          ? 'bg-emerald-50 text-emerald-700'
                          : tx.status === 'flagged'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {tx.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap space-x-1.5">
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
                      title="Inspect Anomaly Details & Record Findings"
                    >
                      Inspect & Review
                    </button>
                    {tx.status !== 'cleared' && (
                      <button
                        onClick={() => onUpdateStatus && onUpdateStatus(tx.id, 'cleared')}
                        className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-semibold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                    {tx.status !== 'flagged' && tx.riskScore >= 40 && (
                      <button
                        onClick={() => onUpdateStatus && onUpdateStatus(tx.id, 'flagged')}
                        className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-semibold cursor-pointer"
                      >
                        Flag
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-sm text-slate-900">Transaction Forensic Record & Findings</h3>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction ID:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedTx.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer Name:</span>
                  <span className="font-bold text-slate-900">{selectedTx.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account:</span>
                  <span className="font-mono text-slate-800">{selectedTx.accountNumberMasked}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount & Type:</span>
                  <span className="font-bold text-slate-900">
                    {selectedTx.currency === 'INR' ? '₹' : '$'}
                    {selectedTx.amount.toFixed(2)} ({selectedTx.type})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Risk Assessment:</span>
                  <span className="font-bold text-rose-600">{selectedTx.riskScore}/100</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-1">Description / Merchant Raw Text:</span>
                <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-slate-700">
                  {selectedTx.description}
                </p>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Anomaly Indicator & Evidence
                </span>
                <p className="text-[11px] leading-relaxed">
                  Flag: {selectedTx.riskFlag || 'Standard threshold verification'}. Analyzed under FinCEN Rule 409 velocity patterns and merchant category risk baseline.
                </p>
              </div>

              {/* Triage Decision Buttons */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 block">Operator Surveillance Finding</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyFinding('cleared')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      selectedTx.status === 'cleared'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    Clear (Normal)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyFinding('under_review')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      selectedTx.status === 'under_review'
                        ? 'bg-amber-600 text-white'
                        : 'bg-white border border-slate-200 text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    Under Review
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyFinding('flagged')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      selectedTx.status === 'flagged'
                        ? 'bg-rose-600 text-white'
                        : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    Flag Anomaly
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  onEscalateToInvestigation && onEscalateToInvestigation(selectedTx);
                  setSelectedTx(null);
                }}
                className="btn-primary-gradient text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Escalate to Investigation</span>
              </button>

              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
