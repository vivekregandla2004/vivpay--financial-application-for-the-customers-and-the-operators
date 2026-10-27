/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Search,
  Filter,
  ArrowRight,
  FolderKanban,
  FileText,
  UserX,
  X,
  PlusCircle,
  Info,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { FraudAlert } from '../../types/operations.ts';

interface FraudAlertsPageProps {
  alerts: FraudAlert[];
  onUpdateAlertStatus?: (id: string, status: FraudAlert['status'], note?: string) => void;
  onEscalateAlert?: (alert: FraudAlert) => void;
}

export const FraudAlertsPage: React.FC<FraudAlertsPageProps> = ({
  alerts,
  onUpdateAlertStatus,
  onEscalateAlert,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAlertForModal, setSelectedAlertForModal] = useState<FraudAlert | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const filtered = alerts.filter((a) => {
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
    const matchesSearch =
      searchTerm === '' ||
      a.alertId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.triggerReason.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const criticalCount = alerts.filter((a) => a.riskScore >= 75).length;
  const pendingCount = alerts.filter((a) => a.status === 'pending_review').length;
  const flaggedCount = alerts.filter((a) => a.status === 'flagged').length;

  const handleApplyTriage = (status: FraudAlert['status']) => {
    if (!selectedAlertForModal) return;
    onUpdateAlertStatus?.(
      selectedAlertForModal.id,
      status,
      resolutionNote.trim() || undefined
    );
    setSelectedAlertForModal(null);
    setResolutionNote('');
  };

  return (
    <div className="space-y-6">
      {/* Fair Adjudication Legal & Operational Notice */}
      <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 flex items-start gap-3 text-amber-900 shadow-2xs">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <span className="font-bold block">Adjudication Standard & Evidence Rule</span>
          <p className="text-amber-800 leading-relaxed">
            An unusual or high-velocity transaction does not inherently constitute fraud. Staff must evaluate verified cardholder transaction history, corroborated IP/device telemetry, and merchant category codes before initiating fund freezes or FinCEN SAR escalations.
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">{pendingCount}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Alerts awaiting operator triage</p>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Flagged & Blocked</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 tracking-tight">{flaggedCount}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">High-confidence anomalies quarantined</p>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">High Risk Floor (≥75)</span>
            <Lock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-purple-700 tracking-tight">{criticalCount}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Mandatory escalation threshold</p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="card-luxury p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">AML & Anomaly Alert Surveillance Queue</h3>
            <p className="text-xs text-slate-500">
              Evaluated against FinCEN indicators, IP geolocation hops, and Rule 409 velocity patterns
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search alert, merchant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="pending_review">Pending Review</option>
              <option value="flagged">Flagged</option>
              <option value="cleared">Cleared</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        {/* Alerts Cards List */}
        <div className="space-y-3 pt-2">
          {filtered.map((alert) => {
            const isSynthetic = alert.id.startsWith('fr-');
            return (
              <div
                key={alert.id}
                className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-purple-300 transition-all"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs text-purple-700 font-bold">{alert.alertId}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        alert.riskScore >= 75
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : alert.riskScore >= 40
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      Risk Score: {alert.riskScore}/100
                    </span>

                    {/* Clear distinction between live rule alerts and synthetic benchmark data */}
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isSynthetic
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {isSynthetic ? 'Synthetic Baseline' : 'Live Rule Engine Alert'}
                    </span>

                    <span className="text-xs font-bold text-slate-900">{alert.customerName}</span>
                  </div>

                  <p className="text-xs text-slate-800">
                    Transaction:{' '}
                    <span className="font-bold text-slate-900">
                      ${alert.amount.toFixed(2)} {alert.currency}
                    </span>{' '}
                    at <span className="font-semibold text-slate-800">{alert.merchant}</span>
                  </p>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                    <p>
                      <strong className="text-slate-800">Trigger Reason: </strong>
                      {alert.triggerReason}
                    </p>
                    {alert.investigatorNotes && (
                      <p className="text-purple-700">
                        <strong>Investigator Note: </strong>
                        {alert.investigatorNotes}
                      </p>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-400">
                    Detected At: {new Date(alert.detectedAt).toLocaleString()}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setSelectedAlertForModal(alert);
                      setResolutionNote(alert.investigatorNotes || '');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 font-semibold cursor-pointer"
                  >
                    Review & Triage
                  </button>

                  <button
                    onClick={() => onEscalateAlert && onEscalateAlert(alert)}
                    className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>Escalate Dossier</span>
                  </button>

                  {alert.status === 'flagged' ? (
                    <button
                      onClick={() =>
                        onUpdateAlertStatus &&
                        onUpdateAlertStatus(alert.id, 'cleared', 'Cleared after customer identity verification.')
                      }
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-xs text-emerald-700 font-semibold border border-slate-200 cursor-pointer shadow-xs"
                    >
                      Clear Anomaly
                    </button>
                  ) : alert.status === 'pending_review' ? (
                    <button
                      onClick={() =>
                        onUpdateAlertStatus &&
                        onUpdateAlertStatus(alert.id, 'flagged', 'Quarantined for suspicious velocity.')
                      }
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs text-white font-semibold cursor-pointer shadow-xs"
                    >
                      Flag Risk
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 px-2 py-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review & Triage Modal */}
      {selectedAlertForModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  {selectedAlertForModal.alertId} — Fraud Adjudication Review
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlertForModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <strong className="text-slate-900">{selectedAlertForModal.customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount & Merchant:</span>
                <span className="font-semibold text-slate-900">
                  ${selectedAlertForModal.amount.toFixed(2)} at {selectedAlertForModal.merchant}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Risk Assessment:</span>
                <span className="font-bold text-rose-700">{selectedAlertForModal.riskScore}/100</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Surveillance Trigger:</span>
                <p className="font-mono text-[11px] text-slate-800 bg-white p-2 rounded-lg border border-slate-200">
                  {selectedAlertForModal.triggerReason}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block text-xs">
                Investigator Adjudication Notes
              </label>
              <textarea
                rows={3}
                placeholder="Document verification findings, call notes, or reason for clearance..."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyTriage('cleared')}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Clear (Verified Safe)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyTriage('flagged')}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Flag Risk / Quarantine
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAlertForModal(null)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
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
