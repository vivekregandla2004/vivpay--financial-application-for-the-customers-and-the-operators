/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Inbox,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  UserCheck,
  ChevronRight,
  X,
  Send,
  FileCheck2,
  Plus,
  Shield,
  User,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { CaseRecord } from '../../types/operations.ts';

interface ServiceCasesPageProps {
  cases: CaseRecord[];
  onUpdateCaseStatus?: (caseId: string, status: CaseRecord['status'], notes?: string) => void;
  onUpdateCaseDetails?: (caseId: string, updates: Partial<CaseRecord>) => void;
  onCreateCase?: (caseData: any) => void;
}

export const ServiceCasesPage: React.FC<ServiceCasesPageProps> = ({
  cases,
  onUpdateCaseStatus,
  onUpdateCaseDetails,
  onCreateCase,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [statusValidationError, setStatusValidationError] = useState<string | null>(null);

  // New Case Modal State
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('•••• 4120');
  const [newCategory, setNewCategory] = useState<CaseRecord['category']>('Dispute');
  const [newPriority, setNewPriority] = useState<CaseRecord['priority']>('medium');
  const [newAssignedTo, setNewAssignedTo] = useState('Sarah Chen');
  const [newNotes, setNewNotes] = useState('');

  const filtered = cases.filter((c) => {
    const matchesSearch =
      searchTerm === '' ||
      c.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.accountNumberMasked.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;
    const matchesAssignment =
      assignmentFilter === 'all' ||
      (assignmentFilter === 'unassigned' && (!c.assignedTo || c.assignedTo === 'Unassigned')) ||
      (assignmentFilter === 'assigned' && c.assignedTo && c.assignedTo !== 'Unassigned') ||
      c.assignedTo === assignmentFilter;

    return matchesSearch && matchesStatus && matchesCategory && matchesAssignment;
  });

  const handleResolve = (caseId: string) => {
    onUpdateCaseStatus?.(caseId, 'resolved', resolveNote.trim() || undefined);
    setSelectedCase(null);
    setResolveNote('');
    setStatusValidationError(null);
  };

  const handleStatusChange = (newStatus: CaseRecord['status']) => {
    if (!selectedCase) return;

    // Validate status transition
    if (selectedCase.status === 'resolved' && newStatus === 'open') {
      setStatusValidationError('Re-opening a resolved case requires supervisor authorization. Transitioning to Investigating.');
      newStatus = 'investigating';
    } else {
      setStatusValidationError(null);
    }

    onUpdateCaseDetails?.(selectedCase.id, { status: newStatus });
    setSelectedCase({ ...selectedCase, status: newStatus });
  };

  const handleAssignmentChange = (newAssignee: string) => {
    if (!selectedCase) return;
    onUpdateCaseDetails?.(selectedCase.id, { assignedTo: newAssignee });
    setSelectedCase({ ...selectedCase, assignedTo: newAssignee });
  };

  const handlePriorityChange = (newPriority: CaseRecord['priority']) => {
    if (!selectedCase) return;
    onUpdateCaseDetails?.(selectedCase.id, { priority: newPriority });
    setSelectedCase({ ...selectedCase, priority: newPriority });
  };

  const handleAddNoteToDocket = () => {
    if (!selectedCase || !resolveNote.trim()) return;
    const timestamp = new Date().toISOString().substring(0, 19).replace('T', ' ');
    const noteEntry = `[${timestamp}] (Sarah Chen) ${resolveNote.trim()}`;
    const updatedNotes = selectedCase.notes ? `${selectedCase.notes}\n${noteEntry}` : noteEntry;

    onUpdateCaseDetails?.(selectedCase.id, { notes: updatedNotes });
    setSelectedCase({ ...selectedCase, notes: updatedNotes });
    setResolveNote('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCustomerName.trim()) return;

    onCreateCase?.({
      title: newTitle.trim(),
      customerName: newCustomerName.trim(),
      customerId: newCustomerId.trim() || undefined,
      accountNumberMasked: newAccountNumber.trim() || '•••• 0000',
      category: newCategory,
      priority: newPriority,
      assignedTo: newAssignedTo,
      notes: newNotes.trim() ? `[Initial] ${newNotes.trim()}` : '',
    });

    setNewTitle('');
    setNewCustomerName('');
    setNewCustomerId('');
    setNewNotes('');
    setNewModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Control Banner */}
      <div className="card-luxury p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Customer Inquiries & Dispute Adjudication</h3>
            <p className="text-xs text-slate-500">
              Manage transaction chargebacks, KYC verification tickets, and limit increase requests
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewModalOpen(true)}
              className="btn-primary-gradient text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Case</span>
            </button>
            <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl">
              Total: <span className="text-purple-700 font-bold">{cases.length}</span>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search case, customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="escalated">Escalated</option>
            <option value="resolved">Resolved</option>
          </select>

          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">All Assignments</option>
            <option value="unassigned">Unassigned Pool</option>
            <option value="assigned">Assigned Staff</option>
            <option value="Sarah Chen">Sarah Chen</option>
            <option value="Marcus Vance">Marcus Vance</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">All Ticket Categories</option>
            <option value="Dispute">Dispute</option>
            <option value="KYC Verification">KYC Verification</option>
            <option value="Suspected Fraud">Suspected Fraud</option>
            <option value="Statement Inquiry">Statement Inquiry</option>
            <option value="Limit Increase">Limit Increase</option>
          </select>
        </div>
      </div>

      {/* Cases Table */}
      <div className="card-luxury p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Case ID</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Subject & Category</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Assigned To</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-purple-50/20 transition-colors">
                  <td className="py-3 px-3 font-mono text-purple-700 font-bold whitespace-nowrap">{c.caseNumber}</td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-900 block">{c.customerName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{c.accountNumberMasked}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-slate-800 font-medium block max-w-xs truncate">{c.title}</span>
                    <span className="text-[10px] text-slate-500">{c.category}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        c.priority === 'critical'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : c.priority === 'high'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {c.priority}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        c.status === 'resolved'
                          ? 'bg-emerald-50 text-emerald-700'
                          : c.status === 'escalated'
                          ? 'bg-rose-50 text-rose-700'
                          : c.status === 'investigating'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-xs ${c.assignedTo === 'Unassigned' ? 'text-amber-700 font-medium' : 'text-slate-700 font-semibold'}`}>
                      {c.assignedTo || 'Unassigned'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap space-x-1.5">
                    <button
                      onClick={() => {
                        setSelectedCase(c);
                        setStatusValidationError(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                    >
                      Inspect & Adjudicate
                    </button>
                    {c.status !== 'resolved' && (
                      <button
                        onClick={() => handleResolve(c.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-semibold cursor-pointer"
                      >
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Case Inspector Modal with Authorized Customer Context */}
      {selectedCase && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  {selectedCase.caseNumber} — Adjudication Docket
                </h3>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {statusValidationError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{statusValidationError}</span>
              </div>
            )}

            {/* Authorized Customer & Account Context Card */}
            <div className="p-3.5 bg-purple-50/50 rounded-xl border border-purple-200/70 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-900 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-purple-700" />
                  Authorized Customer Context (Least Privilege)
                </span>
                <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                  KYC Tier 2 Verified
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                <div>
                  <span className="text-slate-500">Customer: </span>
                  <strong className="text-slate-900">{selectedCase.customerName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Account: </span>
                  <span className="font-mono text-slate-800">{selectedCase.accountNumberMasked}</span>
                </div>
                <div>
                  <span className="text-slate-500">Category: </span>
                  <strong className="text-purple-700">{selectedCase.category}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Opened: </span>
                  <span>{new Date(selectedCase.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Docket Controls Grid */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Status</label>
                <select
                  value={selectedCase.status}
                  onChange={(e) => handleStatusChange(e.target.value as CaseRecord['status'])}
                  className="w-full bg-slate-50 border border-slate-200 font-semibold rounded-lg px-2.5 py-1.5 text-xs text-slate-800 cursor-pointer"
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="escalated">Escalated</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Assigned Staff</label>
                <select
                  value={selectedCase.assignedTo || 'Unassigned'}
                  onChange={(e) => handleAssignmentChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 font-semibold rounded-lg px-2.5 py-1.5 text-xs text-slate-800 cursor-pointer"
                >
                  <option value="Sarah Chen">Sarah Chen (Ops Lead)</option>
                  <option value="Marcus Vance">Marcus Vance (Fraud Lead)</option>
                  <option value="David Ross">David Ross (AML)</option>
                  <option value="Elena Wu">Elena Wu (Support)</option>
                  <option value="Unassigned">Unassigned</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Priority</label>
                <select
                  value={selectedCase.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as CaseRecord['priority'])}
                  className="w-full bg-slate-50 border border-slate-200 font-semibold rounded-lg px-2.5 py-1.5 text-xs text-slate-800 cursor-pointer"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-800 block mb-1 text-xs">Docket Subject:</span>
              <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-800 font-medium text-xs">
                {selectedCase.title}
              </p>
            </div>

            {/* Historical Notes & Internal Resolution Trail */}
            <div>
              <span className="font-bold text-slate-800 block mb-1 text-xs">Internal Notes & Resolution History:</span>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700 text-xs font-mono max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {selectedCase.notes || 'No notes currently logged.'}
              </div>
            </div>

            {/* Add Action Note */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block text-xs">Record Adjudication / Action Note</label>
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  placeholder="Record internal findings, document request, or adjudication directive..."
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={handleAddNoteToDocket}
                  disabled={!resolveNote.trim()}
                  className="px-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold cursor-pointer shrink-0"
                >
                  Append Note
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => handleResolve(selectedCase.id)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Mark Resolved & Close
              </button>

              <button
                onClick={() => setSelectedCase(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Done Inspecting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Case Modal */}
      {newModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-sm text-slate-900">Initiate Operational Support Case</h3>
              </div>
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Subject / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Disputed ATM Withdrawal - Mumbai Branch"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Customer Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Customer Name"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Account Masked</label>
                  <input
                    type="text"
                    placeholder="•••• 4120"
                    value={newAccountNumber}
                    onChange={(e) => setNewAccountNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as CaseRecord['category'])}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 cursor-pointer"
                  >
                    <option value="Dispute">Dispute</option>
                    <option value="KYC Verification">KYC Verification</option>
                    <option value="Suspected Fraud">Suspected Fraud</option>
                    <option value="Statement Inquiry">Statement Inquiry</option>
                    <option value="Limit Increase">Limit Increase</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as CaseRecord['priority'])}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assignee</label>
                  <select
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 cursor-pointer"
                  >
                    <option value="Sarah Chen">Sarah Chen</option>
                    <option value="Marcus Vance">Marcus Vance</option>
                    <option value="David Ross">David Ross</option>
                    <option value="Unassigned">Unassigned</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Initial Case Notes</label>
                <textarea
                  rows={2}
                  placeholder="Record customer statement or reason for opening case..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary-gradient text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Create Case
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
