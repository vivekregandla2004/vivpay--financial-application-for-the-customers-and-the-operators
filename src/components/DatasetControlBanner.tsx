/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Upload,
  CheckCircle2,
  Shield,
  Info,
} from 'lucide-react';

export interface ActiveDatasetMeta {
  fileName: string;
  transactionCount: number;
  dateRange: {
    from: string;
    to: string;
  };
  totalInflow?: number;
  totalOutflow?: number;
  netCashFlow?: number;
  source: 'demo' | 'persisted' | 'uploaded';
  importedAt?: string;
}

interface DatasetControlBannerProps {
  dataset: ActiveDatasetMeta | null;
  currency?: string;
  isDemo?: boolean;
  onOpenUpload: () => void;
  onOpenReplace: () => void;
  onRemoveDataset: () => void;
}

export const DatasetControlBanner: React.FC<DatasetControlBannerProps> = ({
  dataset,
  currency = 'INR',
  isDemo = false,
  onOpenUpload,
  onOpenReplace,
  onRemoveDataset,
}) => {
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);

  const currencySymbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';

  const formatMoney = (amount: number) => {
    return `${currencySymbol}${Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDateDisplay = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const [y, m, d] = isoStr.split('-');
      if (!y || !m || !d) return isoStr;
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  const handleExecuteRemove = () => {
    setShowConfirmRemove(false);
    onRemoveDataset();
  };

  if (!dataset || dataset.transactionCount === 0) {
    return (
      <div className="glass-card bg-gradient-to-r from-[#EAF3FF]/80 via-white to-[#F4F9FF] border border-[#5878FF]/20 rounded-2xl p-5 shadow-xs text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center shrink-0 border border-[#5878FF]/20 shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-[#172B4D]">No Statement Dataset Loaded</h4>
                <span className="text-[10px] bg-[#EDE9FF] text-[#5878FF] px-2 py-0.5 rounded-full font-semibold border border-[#5878FF]/20">
                  Ledger Empty
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Upload a PhonePe Excel (.xlsx) or CSV statement to populate the ledger, compute cash flow KPIs, and unlock analytics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={onOpenUpload}
              className="btn-sky-primary text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Statement</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const dateFrom = formatDateDisplay(dataset.dateRange.from);
  const dateTo = formatDateDisplay(dataset.dateRange.to);

  return (
    <>
      <div className="glass-card bg-white/95 border border-[#5878FF]/20 rounded-2xl p-4 sm:p-5 shadow-xs text-left space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#DCE7F6] pb-3">
          {/* File name & source status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF3FF] text-[#5878FF] border border-[#5878FF]/20 flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm text-[#172B4D] tracking-tight">
                  {dataset.fileName}
                </span>
                <span className="text-[10px] bg-[#EAF3FF] text-[#5878FF] border border-[#5878FF]/20 px-2.5 py-0.5 rounded-full font-bold">
                  Active Dataset
                </span>
                <span className="text-[10px] bg-[#F4F9FF] border border-[#DCE7F6] text-[#64748B] px-2 py-0.5 rounded-full font-medium">
                  {isDemo ? 'Demo Workspace' : 'Supabase Storage'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B] mt-0.5">
                <span className="flex items-center gap-1 font-medium text-[#172B4D] font-mono tnum">
                  <Layers className="w-3.5 h-3.5 text-[#5878FF]" />
                  {dataset.transactionCount} transactions
                </span>
                {dateFrom && dateTo && (
                  <span className="flex items-center gap-1 font-mono tnum text-[#64748B]">
                    <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
                    <span>
                      {dateFrom} &mdash; {dateTo}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions: Replace Statement & Remove Dataset */}
          <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
            <button
              onClick={onOpenReplace}
              className="flex items-center gap-1.5 bg-[#EAF3FF] hover:bg-[#5878FF] text-[#5878FF] hover:text-white border border-[#5878FF]/30 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
              title="Validate and replace this statement with a new Excel or CSV file"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Replace Statement</span>
            </button>

            <button
              onClick={() => setShowConfirmRemove(true)}
              className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-2xs"
              title="Remove this dataset from the ledger and reset dependent calculations"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Dataset</span>
            </button>
          </div>
        </div>

        {/* Quick summary strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/80 rounded-xl px-3.5 py-2 border border-slate-100">
          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            {dataset.totalInflow !== undefined && (
              <span className="flex items-center gap-1">
                <span className="text-slate-400">Total Inflow:</span>
                <span className="font-semibold text-emerald-600">
                  +{formatMoney(dataset.totalInflow)}
                </span>
              </span>
            )}
            {dataset.totalOutflow !== undefined && (
              <span className="flex items-center gap-1">
                <span className="text-slate-400">Total Outflow:</span>
                <span className="font-semibold text-rose-600">
                  -{formatMoney(dataset.totalOutflow)}
                </span>
              </span>
            )}
            {dataset.netCashFlow !== undefined && (
              <span className="flex items-center gap-1">
                <span className="text-slate-400">Net Flow:</span>
                <span
                  className={`font-bold ${
                    dataset.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {dataset.netCashFlow >= 0 ? '+' : '-'}
                  {formatMoney(dataset.netCashFlow)}
                </span>
              </span>
            )}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3 h-3 text-slate-400" />
            <span>Preserves Financial Profile & Goals on removal</span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Removing Dataset */}
      {showConfirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl text-left">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Remove Statement Dataset?</h3>
                <p className="text-xs text-slate-500">Confirm removal of current statement records</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between font-semibold text-slate-800">
                <span className="truncate max-w-[220px]">{dataset.fileName}</span>
                <span className="text-slate-500">{dataset.transactionCount} transactions</span>
              </div>
              {dateFrom && dateTo && (
                <div className="text-slate-500 text-[11px]">
                  Date Range: {dateFrom} to {dateTo}
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <p>
                Removing this dataset will clear its {dataset.transactionCount} transactions from the ledger and recalculate all dependent cash flow KPIs, category summaries, and spending analytics.
              </p>
              <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800 flex items-start gap-2">
                <Shield className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span className="text-[11px]">
                  <strong>Protected Data:</strong> Your Financial Profile, personal employment data, declared commitments, and Financial Goals will <strong>not</strong> be deleted.
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Scope: Affects {isDemo ? 'the active demo session workspace' : 'persisted records in Supabase'}.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowConfirmRemove(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRemove}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Remove Dataset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
