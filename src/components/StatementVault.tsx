/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { StatementDocument, Account } from '../types/database.ts';
import { api } from '../services/api.ts';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  Download,
  Loader2,
  FileSpreadsheet,
  Check,
  RefreshCw,
  PlusCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ShieldCheck,
  Tag,
} from 'lucide-react';

import { ActiveDatasetMeta } from './DatasetControlBanner.tsx';

interface StatementVaultProps {
  documents: StatementDocument[];
  accounts: Account[];
  selectedAccountId: string | 'all';
  onRefresh: () => void;
  currency?: string;
  activeDataset?: ActiveDatasetMeta | null;
  onOpenReplace?: () => void;
  onRemoveDataset?: () => void;
  onOpenUploadModal?: () => void;
}

export const StatementVault: React.FC<StatementVaultProps> = ({
  documents,
  accounts,
  selectedAccountId,
  onRefresh,
  currency = 'INR',
  activeDataset,
  onOpenReplace,
  onRemoveDataset,
  onOpenUploadModal,
}) => {
  const [uploading, setUploading] = useState(false);
  const validAccounts = React.useMemo(
    () => (accounts || []).filter((a): a is Account => Boolean(a && typeof a.id === 'string' && a.id.trim().length > 0)),
    [accounts]
  );
  const [selectedAccountForUpload, setSelectedAccountForUpload] = useState(
    selectedAccountId !== 'all' && validAccounts.some((a) => a.id === selectedAccountId)
      ? selectedAccountId
      : validAccounts[0]?.id || ''
  );

  // Synchronize selectedAccountForUpload whenever accounts or selectedAccountId changes
  React.useEffect(() => {
    if (selectedAccountId !== 'all' && validAccounts.some((a) => a.id === selectedAccountId)) {
      setSelectedAccountForUpload(selectedAccountId);
    } else if (validAccounts.length > 0 && (!selectedAccountForUpload || !validAccounts.some((a) => a.id === selectedAccountForUpload))) {
      setSelectedAccountForUpload(validAccounts[0].id);
    }
  }, [validAccounts, selectedAccountId]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [expandedPreviewDocId, setExpandedPreviewDocId] = useState<string | null>(null);
  const [previewLoadingDocId, setPreviewLoadingDocId] = useState<string | null>(null);
  const [cachedPreviews, setCachedPreviews] = useState<Record<string, any[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currencySymbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';

  const handleTogglePreview = async (doc: StatementDocument) => {
    if (expandedPreviewDocId === doc.id) {
      setExpandedPreviewDocId(null);
      return;
    }

    setExpandedPreviewDocId(doc.id);

    // If preview rows not cached, try doc.rawTextPreview or fetch from backend
    if (!cachedPreviews[doc.id]) {
      if (doc.rawTextPreview) {
        try {
          const parsed = JSON.parse(doc.rawTextPreview);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCachedPreviews((prev) => ({ ...prev, [doc.id]: parsed }));
            return;
          }
        } catch {
          // parse error, fallback to API fetch
        }
      }

      // Fetch on demand from backend /api/documents/:id
      setPreviewLoadingDocId(doc.id);
      try {
        const res = await api.getDocument(doc.id);
        if (res.preview && Array.isArray(res.preview)) {
          setCachedPreviews((prev) => ({ ...prev, [doc.id]: res.preview || [] }));
        }
      } catch (fetchErr) {
        console.warn('Could not load staged preview for doc:', doc.id, fetchErr);
      } finally {
        setPreviewLoadingDocId(null);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedAccountForUpload) {
      setUploadError('Please select a target account before uploading.');
      return;
    }

    setUploadError(null);
    setStatusMessage(null);
    setUploading(true);

    try {
      const res: any = await api.uploadStatement(file, selectedAccountForUpload);
      const docId = res?.document?.id || res?.id;
      if (!docId) {
        throw new Error(res?.error || 'Statement upload succeeded but server did not return a valid document ID.');
      }

      if (res.isScannedPdf) {
        setUploadError(res.error || 'Scanned or image-only PDF detected. Optical Character Recognition (OCR) is required.');
        onRefresh();
        return;
      }

      setStatusMessage(`Statement "${file.name}" uploaded to private vault! Processing...`);

      // Immediately trigger processing
      const processRes: any = await api.processDocument(docId);

      if (processRes.isScannedPdf) {
        setUploadError(processRes.error || 'Scanned or image-only PDF detected. Optical Character Recognition (OCR) is required.');
        onRefresh();
        return;
      }

      setStatusMessage(`Processed "${file.name}"! ${processRes.extractedCount || 0} valid transactions ready to review & import.`);

      if (processRes.rows && Array.isArray(processRes.rows)) {
        setCachedPreviews((prev) => ({ ...prev, [docId]: processRes.rows }));
      }
      setExpandedPreviewDocId(docId);

      onRefresh();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload statement.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImport = async (docId: string, fileName: string) => {
    if (!docId || typeof docId !== 'string' || docId.trim() === '') {
      setUploadError('Invalid document ID for import.');
      return;
    }
    setActionLoadingId(docId);
    setUploadError(null);
    setStatusMessage(null);
    try {
      const res = await api.importDocument(docId, selectedAccountForUpload);
      setStatusMessage(res.message || `Successfully imported transactions from ${fileName}!`);
      onRefresh();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to import transactions.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (docId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}" and its stored copy?`)) return;
    setActionLoadingId(docId);
    try {
      await api.deleteDocument(docId);
      if (expandedPreviewDocId === docId) setExpandedPreviewDocId(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete statement.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // One-click Sample Generators
  const handleDownloadSamplePhonePe = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['PhonePe Transaction Statement'],
      ['Statement Period:', '01 Oct 2026 to 12 Oct 2026'],
      ['Account:', accounts[0]?.accountName || 'Primary Checking'],
      [],
      ['Date', 'Transaction Details', 'Type', 'Amount (INR)', 'UTR No.', 'Status'],
      ['12/10/2026', 'Paid to Swiggy Delivery Bangalore', 'DEBIT', '420.00', 'UTR9482018401', 'COMPLETED'],
      ['11/10/2026', 'Paid to Uber Technologies Trip', 'DEBIT', '285.50', 'UTR9482018402', 'COMPLETED'],
      ['10/10/2026', 'Salary Credited - TechCorp Global Payout', 'CREDIT', '75000.00', 'UTR9482018403', 'COMPLETED'],
      ['08/10/2026', 'Paid to Blinkit Grocery Store', 'DEBIT', '640.00', 'UTR9482018404', 'COMPLETED'],
      ['07/10/2026', 'Paid to Flipkart Internet Pvt Ltd', 'DEBIT', '1499.00', 'UTR9482018405', 'COMPLETED'],
      ['05/10/2026', 'Paid to BESCOM Electricity Utility', 'DEBIT', '1250.00', 'UTR9482018406', 'COMPLETED'],
      ['04/10/2026', 'Received from Priya Sharma - Split bill', 'CREDIT', '850.00', 'UTR9482018407', 'COMPLETED'],
      ['03/10/2026', 'Paid to Zerodha Broking SIP Investment', 'DEBIT', '10000.00', 'UTR9482018408', 'COMPLETED'],
      ['02/10/2026', 'Paid to Netflix Monthly Subscription', 'DEBIT', '649.00', 'UTR9482018409', 'COMPLETED'],
      ['01/10/2026', 'Paid to Starbucks Coffee India', 'DEBIT', '380.00', 'UTR9482018410', 'COMPLETED'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'PhonePe Statement');
    XLSX.writeFile(wb, 'PhonePe_Sample_Statement.xlsx');
  };

  const handleDownloadSampleCsv = () => {
    const sampleCsvContent = `Date,Description,Amount,Type
2026-10-01,Direct Deposit Payroll ACME Corp,3250.00,credit
2026-10-02,Trader Joe's Supermarket,114.30,debit
2026-10-03,Starbucks Coffee #491,6.75,debit
2026-10-05,Metropolitan Electric & Gas,85.20,debit
2026-10-06,Amazon.com Prime Order,42.50,debit
2026-10-08,Uber Technologies Trip,28.40,debit
2026-10-10,Netflix Monthly Subscription,15.99,debit
2026-10-12,CVS Pharmacy Health,23.10,debit
2026-10-14,Whole Foods Market,92.45,debit
2026-10-15,Vanguard Brokerage Transfer,500.00,debit`;

    const blob = new Blob([sampleCsvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_bank_statement.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card-luxury p-6 sm:p-7 space-y-6">
      {/* Title & Description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <span>Bank Statement Vault & Parser</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Ingest and parse PhonePe, Excel (.xlsx/.xls), CSV, and PDF statements securely into Supabase Storage
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadSamplePhonePe}
            className="flex items-center gap-1.5 text-xs text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100/80 border border-purple-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Sample PhonePe (.xlsx)</span>
          </button>
          <button
            onClick={handleDownloadSampleCsv}
            className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Sample CSV</span>
          </button>
        </div>
      </div>

      {/* Active Statement Dataset Summary Card */}
      {activeDataset && (
        <div className="bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-slate-50 border border-purple-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm text-slate-900">{activeDataset.fileName}</span>
                <span className="text-[10px] bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                  Currently Active Dataset
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-3">
                <span>{activeDataset.transactionCount} transactions ingested</span>
                {activeDataset.dateRange.from && activeDataset.dateRange.to && (
                  <span>
                    Period: {activeDataset.dateRange.from} &mdash; {activeDataset.dateRange.to}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            {onOpenReplace && (
              <button
                type="button"
                onClick={onOpenReplace}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Replace Statement</span>
              </button>
            )}
            {onRemoveDataset && (
              <button
                type="button"
                onClick={onRemoveDataset}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Dataset</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notifications */}
      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {uploadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Upload Dropzone */}
      <div className="border-2 border-dashed border-slate-200 hover:border-purple-500/60 rounded-2xl p-6 sm:p-8 text-center bg-slate-50/60 hover:bg-purple-50/30 transition-all">
        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto shadow-xs">
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            ) : (
              <UploadCloud className="w-6 h-6" />
            )}
          </div>

          <div>
            <h4 className="font-bold text-sm text-slate-900">Upload PhonePe or Bank Statement</h4>
            <p className="text-xs text-slate-500 mt-1">
              Supports CSV, Microsoft Excel (.xlsx/.xls), and digital PDF statements up to 15MB
            </p>
          </div>

          {accounts.length === 0 ? (
            <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>No bank account connected. Please create or link an account before uploading statements.</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 font-medium">Target Account:</span>
                <select
                  value={selectedAccountForUpload}
                  onChange={(e) => setSelectedAccountForUpload(e.target.value)}
                  className="bg-white border border-slate-200 text-xs text-slate-800 rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-500 cursor-pointer shadow-xs"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName} ({a.accountNumberMasked})
                    </option>
                  ))}
                </select>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="statement-file-input"
                disabled={uploading}
              />

              <label
                htmlFor="statement-file-input"
                className={`btn-primary-gradient flex items-center gap-1.5 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer ${
                  uploading ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                <span>{uploading ? 'Processing File...' : 'Choose Statement File'}</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Uploaded Documents List */}
      <div>
        <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-3">
          Vault Documents ({documents.length})
        </h4>

        {documents.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-500 text-xs">
            No bank statements in the vault yet. Upload your first statement above.
          </div>
        ) : (
          <div className="space-y-2.5">
            {documents
              .filter((doc): doc is StatementDocument => Boolean(doc && typeof doc.id === 'string' && doc.id.trim().length > 0))
              .map((doc) => {
                const account = validAccounts.find((a) => a.id === doc.accountId);
              const isLoading = actionLoadingId === doc.id;
              const isPreviewOpen = expandedPreviewDocId === doc.id;
              const isPreviewLoading = previewLoadingDocId === doc.id;

              // Extract rows from cached preview or rawTextPreview
              let previewRows: any[] = cachedPreviews[doc.id] || [];
              if (previewRows.length === 0 && doc.rawTextPreview) {
                try {
                  const p = JSON.parse(doc.rawTextPreview);
                  if (Array.isArray(p)) previewRows = p;
                } catch {}
              }

              const validRows = previewRows.filter((r) => !r.isAmbiguous && r.amount > 0);
              const ambiguousRows = previewRows.filter((r) => r.isAmbiguous);
              const isImported = doc.importedCount > 0;

              return (
                <div
                  key={doc.id}
                  className="bg-white border border-slate-200 hover:border-purple-300 rounded-2xl overflow-hidden transition-all shadow-xs"
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 mt-0.5">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-slate-900" title={doc.originalName}>
                            {doc.originalName}
                          </span>
                          {/* Status Badge */}
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              isImported
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : doc.processingStatus === 'partially_completed'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : doc.processingStatus === 'failed'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {isImported
                              ? `Imported (${doc.importedCount} txs)`
                              : doc.processingStatus === 'partially_completed'
                              ? `Parsed (${doc.extractedCount || validRows.length || 0} valid)`
                              : doc.processingStatus === 'failed'
                              ? 'Failed'
                              : 'Ready to Import'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                          <span>Account: <strong className="text-slate-700">{account?.accountName || 'Unknown'}</strong></span>
                          <span>•</span>
                          <span>Size: {(doc.fileSizeBytes / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>Uploaded: {new Date(doc.createdAt).toLocaleDateString()}</span>
                          {(doc.extractedCount > 0 || previewRows.length > 0) && (
                            <>
                              <span>•</span>
                              <span className="text-purple-700 font-bold">
                                {doc.extractedCount || validRows.length} transactions extracted
                              </span>
                            </>
                          )}
                          {doc.duplicateCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-slate-600 font-medium">
                                {doc.duplicateCount} duplicates skipped
                              </span>
                            </>
                          )}
                        </div>

                        {doc.errorMessage && (
                          <div className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200/90 rounded-xl p-2.5 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                            <div className="space-y-0.5">
                              <span className="font-semibold block">Processing Notice:</span>
                              <span className="text-slate-700">{doc.errorMessage}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleTogglePreview(doc)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors cursor-pointer ${
                          isPreviewOpen
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                        title="Review parsed rows and ambiguous items"
                      >
                        <Eye className="w-3.5 h-3.5 text-purple-600" />
                        <span>{isPreviewOpen ? 'Hide Preview' : 'Review Rows'}</span>
                        {isPreviewOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {!isImported ? (
                        <button
                          type="button"
                          onClick={() => handleImport(doc.id, doc.originalName)}
                          disabled={isLoading}
                          className="btn-primary-gradient flex items-center gap-1.5 text-xs text-white px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Import to Ledger</span>
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ledger Synced</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id, doc.originalName)}
                        disabled={isLoading}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete Statement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Preview Section */}
                  {isPreviewOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/70 p-4 space-y-3.5 animate-in fade-in duration-150">
                      {isPreviewLoading ? (
                        <div className="flex items-center justify-center py-6 text-xs text-slate-500 gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                          <span>Loading staged transaction rows...</span>
                        </div>
                      ) : doc.errorMessage ? (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">Processing Issue</span>
                            <span>{doc.errorMessage}</span>
                          </div>
                        </div>
                      ) : previewRows.length === 0 ? (
                        <div className="text-center py-4 text-xs text-slate-500">
                          No preview rows available for this statement yet.
                        </div>
                      ) : (
                        <>
                          {/* Preview Summary Bar */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-slate-200/90 text-xs">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="font-bold text-slate-800">
                                Parsed Rows ({previewRows.length}):
                              </span>
                              <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <Check className="w-3 h-3" /> {validRows.length} Valid Transactions
                              </span>
                              {ambiguousRows.length > 0 && (
                                <span className="flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                  <AlertTriangle className="w-3 h-3" /> {ambiguousRows.length} Ambiguous / Metadata Rows Skipped
                                </span>
                              )}
                            </div>

                            {!isImported && validRows.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleImport(doc.id, doc.originalName)}
                                disabled={isLoading}
                                className="btn-primary-gradient flex items-center gap-1.5 text-xs text-white px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs self-start sm:self-auto shrink-0 disabled:opacity-50"
                              >
                                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                <span>Import Valid ({validRows.length}) Transactions</span>
                              </button>
                            )}
                          </div>

                          {/* Rows Table */}
                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs max-h-64 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                                <tr>
                                  <th className="p-2.5 font-semibold">Date</th>
                                  <th className="p-2.5 font-semibold">Description</th>
                                  <th className="p-2.5 font-semibold">Category</th>
                                  <th className="p-2.5 font-semibold text-right">Amount</th>
                                  <th className="p-2.5 font-semibold text-center">Type</th>
                                  <th className="p-2.5 font-semibold">Row Status / Ingestion Rule</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {previewRows.map((row, idx) => {
                                  const isAmbiguous = Boolean(row.isAmbiguous);
                                  return (
                                    <tr
                                      key={idx}
                                      className={`transition-colors ${
                                        isAmbiguous ? 'bg-amber-50/50 hover:bg-amber-50/80' : 'hover:bg-slate-50/60'
                                      }`}
                                    >
                                      <td className="p-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                        {row.date || '—'}
                                      </td>
                                      <td className="p-2.5">
                                        <div className="font-medium text-slate-800">{row.description}</div>
                                        {row.rawDescription && row.rawDescription !== row.description && (
                                          <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-xs">
                                            {row.rawDescription}
                                          </div>
                                        )}
                                      </td>
                                      <td className="p-2.5">
                                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium border border-slate-200 whitespace-nowrap">
                                          {row.categoryName || 'General / Other'}
                                        </span>
                                      </td>
                                      <td className="p-2.5 font-bold font-mono text-right text-slate-900 whitespace-nowrap">
                                        {(account?.currency || currency) === 'INR' ? '₹' : (account?.currency || currency) === 'EUR' ? '€' : (account?.currency || currency) === 'GBP' ? '£' : '$'}
                                        {Number(row.amount || 0).toLocaleString((account?.currency || currency) === 'INR' ? 'en-IN' : 'en-US', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </td>
                                      <td className="p-2.5 text-center">
                                        <span
                                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap ${
                                            row.type === 'credit'
                                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                                          }`}
                                        >
                                          {row.type}
                                        </span>
                                      </td>
                                      <td className="p-2.5">
                                        {isAmbiguous ? (
                                          <span className="flex items-center gap-1 text-[11px] text-amber-800 font-semibold bg-amber-100/70 border border-amber-300 px-2 py-0.5 rounded-md">
                                            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                            <span>{row.ambiguityReason || 'Opening/Closing balance metadata row. Excluded from ledger.'}</span>
                                          </span>
                                        ) : (
                                          <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                            <span>Valid transaction</span>
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
