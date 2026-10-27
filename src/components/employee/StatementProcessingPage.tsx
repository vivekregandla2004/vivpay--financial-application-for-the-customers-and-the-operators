/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileCheck2,
  AlertTriangle,
  Clock,
  Search,
  CheckCircle2,
  Filter,
  Layers,
  ShieldCheck,
  Hash,
} from 'lucide-react';
import { StatementProcessingMetric } from '../../types/operations.ts';

interface StatementProcessingPageProps {
  metrics: StatementProcessingMetric[];
}

export const StatementProcessingPage: React.FC<StatementProcessingPageProps> = ({ metrics }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [formatFilter, setFormatFilter] = useState('all');

  const filtered = metrics.filter((m) => {
    const matchesSearch =
      searchTerm === '' ||
      m.documentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.uploadedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.accountName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFormat = formatFilter === 'all' || m.format === formatFilter;

    return matchesSearch && matchesFormat;
  });

  const totalExtracted = metrics.reduce((sum, m) => sum + m.extractedCount, 0);
  const totalImported = metrics.reduce((sum, m) => sum + m.importedCount, 0);
  const totalDuplicates = metrics.reduce((sum, m) => sum + m.duplicateCount, 0);
  const avgLatency = Math.round(
    metrics.reduce((sum, m) => sum + m.parsingTimeMs, 0) / (metrics.length || 1)
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Extracted</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{totalExtracted}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Raw transaction rows parsed</p>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verified Imported</span>
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">{totalImported}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Clean normalized records</p>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duplicates Filtered</span>
            <Hash className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">{totalDuplicates}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">SHA-256 deduplicated rows</p>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Latency</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 tracking-tight">{avgLatency} ms</div>
          <p className="text-[11px] text-slate-500 mt-0.5">SLA Target &lt; 500 ms</p>
        </div>
      </div>

      {/* Parser Technical Verification Banner */}
      <div className="card-luxury p-5 bg-gradient-to-r from-purple-50/50 via-slate-50 to-indigo-50/40 border border-purple-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-900">Multi-Format Financial Statement Parser Engine</h4>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Verified formats: PhonePe statement workbook, Axis Bank density-scored multi-sheet, HDFC CSV, and ICICI statement extracts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="bg-white border border-purple-200 text-purple-700 px-3 py-1.5 rounded-xl font-bold">
            Zero Opening Balance Leakage
          </span>
        </div>
      </div>

      {/* Ingestion Table */}
      <div className="card-luxury p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Ingested Statement Execution Log</h3>
            <p className="text-xs text-slate-500">Telemetry across file parse duration, extraction density, and deduplication</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search file name, customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
            </div>

            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="all">All Formats</option>
              <option value="XLSX">XLSX</option>
              <option value="CSV">CSV</option>
              <option value="PDF">PDF</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Statement Document</th>
                <th className="py-2.5 px-3">Format</th>
                <th className="py-2.5 px-3">Uploader & Account</th>
                <th className="py-2.5 px-3">Extracted</th>
                <th className="py-2.5 px-3">Imported</th>
                <th className="py-2.5 px-3">Duplicates</th>
                <th className="py-2.5 px-3">Latency</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((sm) => (
                <tr key={sm.id} className="hover:bg-purple-50/20 transition-colors">
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-900 block">{sm.documentName}</span>
                    <span className="text-[10px] text-slate-400">{new Date(sm.timestamp).toLocaleString()}</span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-purple-700">{sm.format}</td>
                  <td className="py-3 px-3">
                    <span className="text-slate-800 font-medium block">{sm.uploadedBy}</span>
                    <span className="text-[10px] text-slate-500">{sm.accountName}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-semibold">{sm.extractedCount}</td>
                  <td className="py-3 px-3 text-emerald-600 font-bold">{sm.importedCount}</td>
                  <td className="py-3 px-3 text-amber-600 font-bold">{sm.duplicateCount}</td>
                  <td className="py-3 px-3 font-mono text-slate-600">{sm.parsingTimeMs} ms</td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {sm.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
