/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FolderKanban,
  Search,
  Plus,
  AlertTriangle,
  Clock,
  UserCheck,
  CheckCircle2,
  FileText,
  Send,
  X,
  Shield,
} from 'lucide-react';
import { InvestigationRecord, CustomerOpsRecord } from '../../types/operations.ts';

interface InvestigationsPageProps {
  investigations: InvestigationRecord[];
  customers: CustomerOpsRecord[];
  onCreateInvestigation?: (data: {
    title: string;
    targetCustomerId: string;
    targetCustomerName: string;
    linkedAlertId?: string;
    priority: InvestigationRecord['priority'];
    leadInvestigator: string;
    initialEvidence?: string;
    flaggedAmount?: number;
    currency?: string;
  }) => void;
  onUpdateInvestigation?: (id: string, updates: Partial<InvestigationRecord>) => void;
  onAddEvidenceNote?: (id: string, note: string) => void;
}

export const InvestigationsPage: React.FC<InvestigationsPageProps> = ({
  investigations,
  customers,
  onCreateInvestigation,
  onUpdateInvestigation,
  onAddEvidenceNote,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedInv, setSelectedInv] = useState<InvestigationRecord | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newEvidenceText, setNewEvidenceText] = useState('');

  // Form state for creating new investigation
  const [newTitle, setNewTitle] = useState('');
  const [newCustomerId, setNewCustomerId] = useState(customers[0]?.id || '');
  const [newPriority, setNewPriority] = useState<InvestigationRecord['priority']>('high');
  const [newAmount, setNewAmount] = useState('0');
  const [newInitialNote, setNewInitialNote] = useState('');

  const filtered = investigations.filter((inv) => {
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
    const matchesSearch =
      searchTerm === '' ||
      inv.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.targetCustomerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const customer = customers.find((c) => c.id === newCustomerId) || customers[0];

    onCreateInvestigation?.({
      title: newTitle,
      targetCustomerId: customer ? customer.id : 'cust-generic',
      targetCustomerName: customer ? customer.name : 'Unknown Customer',
      priority: newPriority,
      leadInvestigator: 'Sarah Chen',
      initialEvidence: newInitialNote,
      flaggedAmount: parseFloat(newAmount) || 0,
      currency: customer?.currency || 'USD',
    });

    setNewTitle('');
    setNewInitialNote('');
    setNewAmount('0');
    setNewModalOpen(false);
  };

  const handleAddNote = (id: string) => {
    if (!newEvidenceText.trim()) return;
    onAddEvidenceNote?.(id, newEvidenceText);
    setNewEvidenceText('');
    // refresh active selection
    if (selectedInv && selectedInv.id === id) {
      setSelectedInv({
        ...selectedInv,
        evidenceNotes: [...selectedInv.evidenceNotes, `[${new Date().toISOString().substring(0, 19)}] ${newEvidenceText}`],
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="card-luxury p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900">Fraud & AML Investigation Dossiers</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Structured forensic dossiers, multi-jurisdiction subpoenas, and chain-of-custody evidence notes
          </p>
        </div>

        <button
          onClick={() => setNewModalOpen(true)}
          className="btn-primary-gradient text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Investigation</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card-luxury p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search dossier by ID, title, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="all">All Dossier Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="escalated">Escalated</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Investigations Table */}
      <div className="card-luxury p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Case Number</th>
                <th className="py-2.5 px-3">Title & Subject</th>
                <th className="py-2.5 px-3">Target Customer</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Lead Investigator</th>
                <th className="py-2.5 px-3">Flagged Volume</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-purple-50/20 transition-colors">
                  <td className="py-3 px-3 font-mono text-purple-700 font-bold whitespace-nowrap">{inv.caseNumber}</td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-900 block max-w-sm truncate">{inv.title}</span>
                    <span className="text-[10px] text-slate-500">{inv.evidenceNotes.length} notes recorded</span>
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-800">{inv.targetCustomerName}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        inv.priority === 'critical'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : inv.priority === 'high'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {inv.priority}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        inv.status === 'resolved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : inv.status === 'escalated'
                          ? 'bg-rose-50 text-rose-700'
                          : inv.status === 'investigating'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700">{inv.leadInvestigator}</td>
                  <td className="py-3 px-3 font-mono font-semibold text-slate-900">
                    ${inv.flaggedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setSelectedInv(inv)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-semibold cursor-pointer"
                    >
                      Inspect Dossier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dossier Detail Modal */}
      {selectedInv && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {selectedInv.caseNumber} — {selectedInv.title}
                  </h3>
                  <span className="text-[11px] text-slate-500">Lead Investigator: {selectedInv.leadInvestigator}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedInv(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dossier Overview Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Target:</span>
                <span className="font-bold text-slate-900">{selectedInv.targetCustomerName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Priority:</span>
                <span className="font-bold uppercase text-rose-600">{selectedInv.priority}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Flagged Volume:</span>
                <span className="font-mono font-bold text-slate-900">${selectedInv.flaggedAmount.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Status:</span>
                <select
                  value={selectedInv.status}
                  onChange={(e) => {
                    const newStat = e.target.value as InvestigationRecord['status'];
                    onUpdateInvestigation?.(selectedInv.id, { status: newStat });
                    setSelectedInv({ ...selectedInv, status: newStat });
                  }}
                  className="bg-white border border-slate-200 font-semibold rounded-lg px-2 py-0.5 text-xs text-slate-800"
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="escalated">Escalated</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            {/* Evidence Timeline */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Forensic Evidence Notes & Chain of Custody</span>
              </h4>

              <div className="space-y-2 bg-slate-50/60 p-3 rounded-xl border border-slate-200 max-h-52 overflow-y-auto">
                {selectedInv.evidenceNotes.length === 0 ? (
                  <p className="text-slate-400 text-xs italic">No evidence notes recorded yet.</p>
                ) : (
                  selectedInv.evidenceNotes.map((note, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200/80 text-xs text-slate-700">
                      {note}
                    </div>
                  ))
                )}
              </div>

              {/* Add Note Input */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Record timestamped investigator note..."
                  value={newEvidenceText}
                  onChange={(e) => setNewEvidenceText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote(selectedInv.id)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => handleAddNote(selectedInv.id)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>Add Note</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedInv(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Investigation Modal */}
      {newModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">Initiate Formal Fraud Investigation</h3>
              </div>
              <button
                onClick={() => setNewModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Dossier Title / Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. High-Velocity Micro-Burst Crypto Ring"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Customer</label>
                  <select
                    value={newCustomerId}
                    onChange={(e) => setNewCustomerId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.accountNumberMasked})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Estimated Flagged Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Initial Forensic Finding</label>
                <textarea
                  rows={3}
                  placeholder="Document initial trigger reason, IPs, and merchant telemetry..."
                  value={newInitialNote}
                  onChange={(e) => setNewInitialNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-gradient text-white font-semibold px-4 py-2 rounded-xl cursor-pointer shadow-xs"
                >
                  Create Dossier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
