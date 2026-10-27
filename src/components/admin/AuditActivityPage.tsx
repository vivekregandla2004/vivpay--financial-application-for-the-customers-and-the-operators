/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  Shield,
  Clock,
  User,
  Key,
  ExternalLink,
} from 'lucide-react';
import { AuditLogEntry } from '../../types/operations.ts';
import { adminApi } from '../../services/api.ts';

interface AuditActivityPageProps {
  auditLogs: AuditLogEntry[];
}

export const AuditActivityPage: React.FC<AuditActivityPageProps> = ({ auditLogs: initialLogs }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAuditLogs();
      if (res && res.auditLogs) {
        setLogs(res.auditLogs);
      }
    } catch {
      // Fallback to initial
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const actionTypes = Array.from(new Set(logs.map((l) => l.action)));

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchTerm === '' ||
      log.actorEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ipAddress.includes(searchTerm);

    const matchesRole = roleFilter === 'all' || log.actorRole === roleFilter;
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;

    return matchesSearch && matchesRole && matchesStatus && matchesAction;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `vivpay_audit_export_${new Date().toISOString().substring(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Security & Operational Audit Activity</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Traceability Stream
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive timeline of user access, role modifications, statement ingestion, and administrative actions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-purple-600" />
            <span>Export Log (JSON)</span>
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Stream</span>
          </button>
        </div>
      </div>

      {/* Audit Banner Notice */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-purple-600 shrink-0" />
          <div>
            <span className="font-bold text-slate-900">Session Audit Stream Architecture: </span>
            <span className="text-slate-600">
              Audit events reflect active system and demo activity held in server session state. Immutable ledger database tables with write-once audit trails will be configured in the Supabase persistence phase.
            </span>
          </div>
        </div>
        <div className="shrink-0 font-mono text-[11px] bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg border border-purple-200">
          Total Recorded: {logs.length}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card-luxury p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search actor, action, resource, IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Actor Roles</option>
            <option value="admin">Admin</option>
            <option value="employee">Employee / Ops</option>
            <option value="customer">Customer</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Action Types</option>
            {actionTypes.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Statuses</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="DENIED">DENIED</option>
            <option value="FLAGGED">FLAGGED</option>
          </select>
        </div>

        {/* Audit Event Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Actor & Role</th>
                <th className="py-2.5 px-3">Action Type</th>
                <th className="py-2.5 px-3">Target Resource</th>
                <th className="py-2.5 px-3">IP Address</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {paginatedLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="hover:bg-purple-50/20 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="font-semibold text-slate-900 block">{log.actorEmail}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        log.actorRole === 'admin'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : log.actorRole === 'employee'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {log.actorRole}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-purple-700 font-mono text-xs">{log.action}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-700 max-w-xs truncate" title={log.resource}>
                    {log.resource}
                  </td>
                  <td className="py-3 px-3 text-slate-500 text-[10px]">{log.ipAddress}</td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        log.status === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : log.status === 'DENIED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No audit records matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredLogs.length > pageSize && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
            <span className="text-slate-500 text-[11px]">
              Showing <span className="font-bold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-slate-800">
                {Math.min(currentPage * pageSize, filteredLogs.length)}
              </span>{' '}
              of <span className="font-bold text-slate-800">{filteredLogs.length}</span> audit events
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
              >
                Previous
              </button>
              <span className="px-3 py-1 font-mono text-[11px] font-bold text-purple-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Audit Log Modal / Detail View */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 text-left border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-sm text-slate-900">Audit Event Details</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Event ID:</span>
                <span className="font-bold text-slate-900">{selectedLog.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Timestamp:</span>
                <span className="text-slate-900">{selectedLog.timestamp}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Actor Email:</span>
                <span className="text-purple-700 font-semibold">{selectedLog.actorEmail}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Actor Role:</span>
                <span className="uppercase text-slate-800">{selectedLog.actorRole}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Action:</span>
                <span className="font-bold text-purple-900">{selectedLog.action}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Target Resource:</span>
                <span className="text-slate-900 font-sans text-right max-w-xs">{selectedLog.resource}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">IP Address:</span>
                <span className="text-slate-800">{selectedLog.ipAddress}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Verification Result:</span>
                <span
                  className={`font-bold ${
                    selectedLog.status === 'SUCCESS'
                      ? 'text-emerald-700'
                      : selectedLog.status === 'DENIED'
                      ? 'text-rose-700'
                      : 'text-amber-700'
                  }`}
                >
                  {selectedLog.status}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
