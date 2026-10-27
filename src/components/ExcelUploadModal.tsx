/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Account, Transaction } from '../types/database.ts';
import { api } from '../services/api.ts';
import { generateTransactionChecksum } from '../lib/analytics/financialEngine.ts';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Table,
  Check,
  X,
  RefreshCw,
  Loader2,
  FileCheck,
  Sparkles,
} from 'lucide-react';
import { ActiveDatasetMeta } from './DatasetControlBanner.tsx';
import { analyzeFile, AnalysisResult } from '../lib/finance/services.ts';

interface ExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  selectedAccountId?: string;
  isDemo?: boolean;
  existingTransactions?: Transaction[];
  onImportSuccess: (
    importedCount: number,
    duplicateCount: number,
    transactions: any[],
    fileName?: string,
    isReplace?: boolean,
    analysisResult?: any
  ) => void;
  initialMode?: 'upload' | 'replace';
  currentDataset?: ActiveDatasetMeta | null;
  currency?: string;
}

interface ColumnMapping {
  dateCol: string;
  descCol: string;
  amountCol: string;
  debitCol: string;
  creditCol: string;
  typeCol: string;
  categoryCol: string;
}

export const ExcelUploadModal: React.FC<ExcelUploadModalProps> = ({
  isOpen,
  onClose,
  accounts,
  selectedAccountId,
  isDemo = false,
  existingTransactions = [],
  onImportSuccess,
  initialMode = 'upload',
  currentDataset,
  currency = 'INR',
}) => {
  const [step, setStep] = useState<'upload' | 'map' | 'importing' | 'summary'>('upload');
  const [importMode, setImportMode] = useState<'upload' | 'replace'>(initialMode);
  const [file, setFile] = useState<File | null>(null);
  // Filter valid accounts with non-empty IDs
  const validAccounts = React.useMemo(
    () => (accounts || []).filter((a): a is Account => Boolean(a && typeof a.id === 'string' && a.id.trim().length > 0)),
    [accounts]
  );

  const [targetAccount, setTargetAccount] = useState<string>(
    selectedAccountId && selectedAccountId !== 'all' && validAccounts.some((a) => a.id === selectedAccountId)
      ? selectedAccountId
      : validAccounts[0]?.id || ''
  );
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    dateCol: '',
    descCol: '',
    amountCol: '',
    debitCol: '',
    creditCol: '',
    typeCol: '',
    categoryCol: '',
  });

  // Validation results
  const [validatedRows, setValidatedRows] = useState<any[]>([]);
  const [invalidRowsCount, setInvalidRowsCount] = useState<number>(0);
  const [duplicatesCount, setDuplicatesCount] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{ imported: number; duplicates: number; total: number; isReplace?: boolean } | null>(null);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize targetAccount whenever accounts or selectedAccountId changes
  React.useEffect(() => {
    if (selectedAccountId && selectedAccountId !== 'all' && validAccounts.some((a) => a.id === selectedAccountId)) {
      setTargetAccount(selectedAccountId);
    } else if (validAccounts.length > 0 && (!targetAccount || !validAccounts.some((a) => a.id === targetAccount))) {
      setTargetAccount(validAccounts[0].id);
    }
  }, [validAccounts, selectedAccountId, isOpen]);

  // Authoritative statement/account currency resolution
  const targetAccountObj = validAccounts.find((a) => a.id === targetAccount);
  const effectiveCurrency =
    analysisResult?.provider?.detectedCurrency ||
    targetAccountObj?.currency ||
    currency ||
    'INR';

  const currencySymbol =
    effectiveCurrency === 'INR' ? '₹' :
    effectiveCurrency === 'EUR' ? '€' :
    effectiveCurrency === 'GBP' ? '£' : '$';

  const formatAmount = (amt: number) => {
    return amt.toLocaleString(effectiveCurrency === 'INR' ? 'en-IN' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Synchronize initialMode whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      setImportMode(initialMode);
      setStep('upload');
      setFile(null);
      setErrorMsg(null);
      setValidatedRows([]);
      setAnalysisResult(null);
      setUploadedDocId(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  // 1. Process File Selection via client-side financial engine
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!targetAccount) {
      setErrorMsg('Please select an account before selecting a statement file.');
      return;
    }

    setErrorMsg(null);
    setFile(selectedFile);
    setLoading(true);

    try {
      const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      if (ext === '.pdf') {
        const uploadRes: any = await api.uploadStatement(selectedFile, targetAccount);
        if (uploadRes.isScannedPdf) {
          throw new Error(uploadRes.error || 'Scanned or image-only PDF detected. This document requires Optical Character Recognition (OCR) to extract transactions, which is not supported in the standard digital extractor. Please upload a digital text-based statement or an Excel/CSV export.');
        }
        const docId = uploadRes?.document?.id || (uploadRes as any)?.id;
        if (!docId) {
          throw new Error(uploadRes?.error || 'Statement upload succeeded but server did not return a valid document ID.');
        }
        const procRes: any = await api.processDocument(docId);
        const rows = (procRes.rows || []).map((t: any) => ({
          date: t.date,
          description: t.description,
          amount: t.amount,
          type: t.type,
          categoryName: t.categoryName,
          reference: t.reference,
          balanceAfter: t.balanceAfter,
        }));

        if (rows.length === 0) {
          throw new Error('Unsupported statement layout: Unable to identify standard date and transaction columns. The original document has been preserved in your private vault for retry.');
        }

        const pdfCurrency = uploadRes.detectedCurrency || targetAccountObj?.currency || 'INR';
        const pdfProvider = uploadRes.detectedProvider || 'Bank Statement (PDF)';

        setAnalysisResult({
          success: true,
          provider: {
            name: pdfProvider,
            format: pdfProvider as any,
            confidence: 0.95,
            detectedCurrency: pdfCurrency,
          },
          selectedSheet: 'PDF Document',
          sheetDiagnostics: [],
          transactions: rows.map((r: any) => ({
            id: `tx-pdf-${r.date}-${r.amount}`,
            date: r.date,
            description: r.description,
            originalDescription: r.description,
            amount: r.amount,
            debit: r.type === 'debit' ? r.amount : 0,
            credit: r.type === 'credit' ? r.amount : 0,
            balance: r.balanceAfter ?? null,
            reference: r.reference ?? null,
            merchant: null,
            upiHandle: null,
            paymentMethod: 'other' as const,
            category: (r.categoryName || 'Others') as any,
            direction: r.type,
            confidence: 0.95,
            reviewRequired: false,
            sourceFile: selectedFile.name,
            sourceSheet: 'PDF Document',
            sourceRow: 1,
            isDuplicate: false,
            isSuspectedDuplicate: false,
          })),
          monthlySummaries: [],
          recurringCandidates: [],
          metrics: {
            averageDailySpending: 0,
            activeTransactionDays: 0,
            totalCalendarDays: 30,
            weekendSpending: 0,
            weekdaySpending: 0,
            weekendVsWeekdayRatio: null,
            timeOfDay: { available: false, nightSpending: 0, morningSpending: 0, afternoonSpending: 0, eveningSpending: 0 },
            paymentMethodBreakdown: {},
            monthlyExpenseVolatility: null,
            emiDebtBurden: { available: false, totalEmiMonthly: 0, ratioToIncome: null },
          },
          charts: {
            dailySpending: [],
            weeklySpending: [],
            monthlyIncomeVsExpenses: [],
            monthlyNetCashFlow: [],
            categoryBreakdown: [],
            topMerchants: [],
            paymentMethods: [],
            timeOfDay: null,
          },
          insights: [],
          health: {
            compositeScore: 75,
            grade: 'B',
            coveragePercentage: 100,
            isProvisional: false,
            factors: [],
            summary: 'PDF statement processed.',
          },
          currency: pdfCurrency,
          diagnostics: {
            fileName: selectedFile.name,
            detectedProvider: pdfProvider,
            providerConfidence: 0.95,
            selectedSheet: 'PDF Document',
            sheetSelectionReason: 'Primary PDF statement text content',
            totalSheets: 1,
            totalRowsParsed: rows.length,
            validRowCount: rows.length,
            invalidRowCount: 0,
            duplicateCount: 0,
            suspectedDuplicateCount: 0,
            ambiguousDateCount: 0,
            lowConfidenceCategoryCount: 0,
            dateRange: { from: rows[0]?.date || '', to: rows[rows.length - 1]?.date || '' },
            warnings: [],
            errors: [],
          },
        });

        setUploadedDocId(docId);
        setValidatedRows(rows);
        setInvalidRowsCount(rows.filter((r: any) => r.isAmbiguous).length);
        setDuplicatesCount(0);
        setStep('importing');
        return;
      }

      setUploadedDocId(null);

      // In live mode, pre-stage file into vault so documentId exists early for seamless preview & import
      if (!isDemo) {
        try {
          const preUploadRes: any = await api.uploadStatement(selectedFile, targetAccount);
          const preDocId = preUploadRes?.document?.id || (preUploadRes as any)?.id;
          if (preDocId) {
            setUploadedDocId(preDocId);
            await api.processDocument(preDocId);
          }
        } catch (preUploadErr: any) {
          console.warn('Initial server staging note (will verify during import confirmation):', preUploadErr.message);
        }
      }

      const analysis = await analyzeFile(selectedFile);
      setAnalysisResult(analysis);
      setSelectedSheet(analysis.selectedSheet);

      // Pre-fill validated rows preserving originalDescription exactly
      const rows = analysis.transactions.map((t) => ({
        date: t.date,
        description: t.originalDescription, // strictly verbatim from statement!
        amount: t.amount,
        type: t.direction,
        categoryName: t.category,
        reference: t.reference,
        merchant: t.merchant,
      }));

      setValidatedRows(rows);
      setInvalidRowsCount(analysis.diagnostics.invalidRowCount);
      setDuplicatesCount(analysis.diagnostics.duplicateCount);

      // Parse headers for optional manual adjustment
      if (ext === '.csv') {
        const text = await selectedFile.text();
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
        setRawHeaders(parsed.meta.fields || []);
        setRawRows(parsed.data as any[]);
        autoDetectMapping(parsed.meta.fields || []);
      } else {
        const buffer = await selectedFile.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        setSheetNames(wb.SheetNames);
        const ws = wb.Sheets[analysis.selectedSheet] || wb.Sheets[wb.SheetNames[0]];
        const raw2D = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false });
        if (raw2D && raw2D.length > 0) {
          const firstRow = (raw2D[0] || []).map((h) => String(h || '').trim()).filter(Boolean);
          setRawHeaders(firstRow);
          setRawRows(raw2D.slice(1));
          autoDetectMapping(firstRow);
        }
      }

      setStep('importing');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to read statement file.');
    } finally {
      setLoading(false);
    }
  };

  // Heuristic column autodetector with PhonePe and Indian banking patterns
  const autoDetectMapping = (headers: string[]) => {
    const lower = headers.map((h) => h.toLowerCase().trim());
    const findCol = (keys: string[]) => {
      const idx = lower.findIndex((h) => keys.some((k) => h === k || h.includes(k)));
      return idx !== -1 ? headers[idx] : '';
    };

    const detectedDate = findCol(['date', 'trans date', 'transaction date', 'posting date', 'post date', 'time', 'date & time', 'value date', 'txn date']);
    const detectedDesc = findCol(['transaction details', 'details', 'paid to', 'payment to', 'sent to', 'received from', 'description', 'narrative', 'memo', 'merchant', 'payee', 'name', 'remarks', 'purpose']);
    const detectedAmount = findCol(['amount (inr)', 'amount(inr)', 'amount (₹)', 'amount(₹)', 'amount', 'net amount', 'total', 'transaction amount', 'txn amount']);
    const detectedDebit = findCol(['debit', 'withdrawal', 'money out', 'spent', 'charge', 'dr', 'debit amount']);
    const detectedCredit = findCol(['credit', 'deposit', 'money in', 'received', 'cr', 'credit amount']);
    const detectedType = findCol(['type', 'transaction type', 'cr/dr', 'dr/cr', 'status/type']);
    const detectedCategory = findCol(['category', 'tag', 'classification']);

    setMapping({
      dateCol: detectedDate,
      descCol: detectedDesc,
      amountCol: detectedAmount,
      debitCol: detectedDebit,
      creditCol: detectedCredit,
      typeCol: detectedType,
      categoryCol: detectedCategory,
    });
  };

  // Helper: Normalize Date flexibly
  const parseFlexibleDate = (raw: any): string | null => {
    if (!raw) return null;
    const str = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.substring(0, 10);
    }
    const slashDash = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (slashDash) {
      const [, p1, p2, p3] = slashDash;
      const y = p3.length === 2 ? `20${p3}` : p3;
      const n1 = parseInt(p1, 10);
      const n2 = parseInt(p2, 10);
      if (n1 > 12) return `${y}-${String(n2).padStart(2, '0')}-${String(n1).padStart(2, '0')}`;
      if (n2 > 12) return `${y}-${String(n1).padStart(2, '0')}-${String(n2).padStart(2, '0')}`;
      return `${y}-${String(n2).padStart(2, '0')}-${String(n1).padStart(2, '0')}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return null;
  };

  // Helper: Clean currency amounts
  const cleanAmountVal = (raw: any): { amount: number; isNegative: boolean } | null => {
    if (raw === undefined || raw === null || raw === '') return null;
    if (typeof raw === 'number') {
      return { amount: Math.abs(raw), isNegative: raw < 0 };
    }
    let str = String(raw).trim();
    const isNeg = str.startsWith('-') || str.endsWith('-') || /^\(.*\)$/.test(str) || /\b(dr|debit)\b/i.test(str);
    str = str
      .replace(/(₹|inr|rs\.?|\$|\€|\£)/gi, '')
      .replace(/,/g, '')
      .replace(/[\(\)]/g, '')
      .replace(/\b(cr|dr)\b/gi, '')
      .replace(/^-/, '')
      .replace(/-$/, '')
      .trim();
    const num = parseFloat(str);
    if (isNaN(num)) return null;
    return { amount: Math.abs(num), isNegative: isNeg };
  };

  // 2. Validate and Preview Rows based on mapping
  const handleValidateAndProceed = () => {
    if (!mapping.dateCol || !mapping.descCol) {
      setErrorMsg('Date and Description columns are mandatory.');
      return;
    }
    if (!mapping.amountCol && !mapping.debitCol && !mapping.creditCol) {
      setErrorMsg('Please map either Amount, or separate Debit/Credit columns.');
      return;
    }

    setErrorMsg(null);
    let invalid = 0;
    const validated: any[] = [];

    for (const row of rawRows) {
      const rawDate = row[mapping.dateCol];
      const desc = row[mapping.descCol];
      let amt: number | null = null;
      let type: 'debit' | 'credit' = 'debit';

      // Parse Debit / Credit
      if (mapping.debitCol && row[mapping.debitCol]) {
        const parsedDebit = cleanAmountVal(row[mapping.debitCol]);
        if (parsedDebit && parsedDebit.amount > 0) {
          amt = parsedDebit.amount;
          type = 'debit';
        }
      }
      if (mapping.creditCol && row[mapping.creditCol]) {
        const parsedCredit = cleanAmountVal(row[mapping.creditCol]);
        if (parsedCredit && parsedCredit.amount > 0) {
          amt = parsedCredit.amount;
          type = 'credit';
        }
      }

      if (amt === null && mapping.amountCol && row[mapping.amountCol]) {
        const parsedAmt = cleanAmountVal(row[mapping.amountCol]);
        if (parsedAmt) {
          amt = parsedAmt.amount;
          if (parsedAmt.isNegative) {
            type = 'debit';
          } else if (mapping.typeCol && row[mapping.typeCol]) {
            const t = String(row[mapping.typeCol]).toLowerCase();
            type = t.includes('cr') || t.includes('credit') || t.includes('dep') || t.includes('refund') || t.includes('income') || t.includes('received')
              ? 'credit'
              : 'debit';
          } else {
            const descLower = String(desc || '').toLowerCase();
            if (descLower.startsWith('received from') || descLower.includes('refund from') || descLower.includes('cashback')) {
              type = 'credit';
            } else {
              type = 'debit';
            }
          }
        }
      }

      const normalizedDate = parseFlexibleDate(rawDate);

      if (normalizedDate && desc && amt && amt > 0) {
        validated.push({
          date: normalizedDate,
          description: String(desc).trim(),
          amount: amt,
          type,
          categoryName: mapping.categoryCol && row[mapping.categoryCol] ? String(row[mapping.categoryCol]) : 'General / Other',
        });
      } else {
        invalid++;
      }
    }

    setValidatedRows(validated);
    setInvalidRowsCount(invalid);
    setStep('importing');
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
    const csvContent = `Date,Description,Amount,Type
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

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Sample_Bank_Statement.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 3. Commit Import (Real API or Isolated Demo Engine)
  const handleConfirmImport = async () => {
    if (!targetAccount) {
      setErrorMsg('Please select an account.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      if (isDemo) {
        // Isolated demo commit with deterministic deduplication
        const seenChecksums = new Set<string>();
        if (importMode !== 'replace') {
          (existingTransactions || []).forEach((t) => {
            const ck = t.checksum || generateTransactionChecksum(t.date, t.description, t.amount, t.type, t.accountId);
            seenChecksums.add(ck);
          });
        }

        const newTransactions: any[] = [];
        let duplicateCount = 0;

        for (let i = 0; i < validatedRows.length; i++) {
          const v = validatedRows[i];
          const checksum = generateTransactionChecksum(v.date, v.description, v.amount, v.type, targetAccount);

          if (seenChecksums.has(checksum)) {
            duplicateCount++;
            continue;
          }

          seenChecksums.add(checksum);
          newTransactions.push({
            id: `tx-${checksum}`,
            customerId: 'demo-customer-uuid-001',
            accountId: targetAccount,
            date: v.date,
            description: v.description, // Verbatim from statement!
            amount: v.amount,
            type: v.type,
            categoryId: 'cat-imported',
            categoryName: v.categoryName || (v.type === 'credit' ? 'Income / Salary' : 'General / Other'),
            categoryColor: v.type === 'credit' ? '#10b981' : '#f59e0b',
            isUserCorrected: false,
            isRecurring: false,
            checksum,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        setImportStats({
          imported: newTransactions.length,
          duplicates: duplicateCount,
          total: rawRows.length,
          isReplace: importMode === 'replace',
        });

        onImportSuccess(
          newTransactions.length,
          duplicateCount,
          newTransactions,
          file?.name || 'Statement_Export.xlsx',
          importMode === 'replace',
          analysisResult || undefined
        );
        setStep('summary');
      } else {
        // Production: Upload statement file through backend endpoint if not already uploaded during preview
        if (!file && !uploadedDocId) {
          throw new Error('Statement file handle lost. Please re-select your statement file.');
        }

        const selectedAccountObj = validAccounts.find((a) => a.id === targetAccount);
        if (!selectedAccountObj || !selectedAccountObj.id) {
          throw new Error('Selected financial account is invalid or no longer exists. Please re-select an account.');
        }

        let docId = uploadedDocId;
        if (!docId) {
          if (!file) throw new Error('Statement file handle lost. Please re-select your statement file.');
          const res: any = await api.uploadStatement(file, targetAccount);
          const resolvedDocId = res?.document?.id || res?.id;
          if (!resolvedDocId) {
            throw new Error(res?.error || 'Upload succeeded but server did not return a valid document ID.');
          }
          docId = resolvedDocId;
          setUploadedDocId(resolvedDocId);
          await api.processDocument(resolvedDocId);
        }

        // Send confirmed document ID, target account ID, and previewed transactions
        const importRes: any = await api.importDocument(docId, targetAccount, validatedRows);
        const importedDoc = importRes?.document || (importRes?.id ? importRes : null);
        if (!importedDoc) {
          throw new Error(importRes?.error || 'Import completed but no document record was returned by the database.');
        }

        const actualImported = typeof importRes.importedCount === 'number' ? importRes.importedCount : validatedRows.length;
        const actualDuplicates = typeof importRes.duplicateCount === 'number' ? importRes.duplicateCount : 0;

        setImportStats({
          imported: actualImported,
          duplicates: actualDuplicates,
          total: rawRows.length || validatedRows.length,
          isReplace: importMode === 'replace',
        });

        onImportSuccess(
          actualImported,
          actualDuplicates,
          importRes.transactions || [],
          file?.name || analysisResult?.diagnostics?.fileName || 'Statement_Export.xlsx',
          importMode === 'replace',
          analysisResult || undefined
        );
        setStep('summary');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#172B4D]/35 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border border-[#DCE7F6] rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DCE7F6] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EAF3FF] border border-[#5878FF]/20 flex items-center justify-center text-[#5878FF] shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#172B4D] flex items-center gap-2">
                <span>{importMode === 'replace' ? 'Replace Statement Dataset' : 'Excel & CSV Ingestion Wizard'}</span>
                {isDemo && (
                  <span className="text-[10px] bg-[#EDE9FF] text-[#5878FF] border border-[#5878FF]/20 px-2 py-0.5 rounded-full font-bold">
                    Demo Mode
                  </span>
                )}
              </h3>
              <p className="text-xs text-[#64748B]">
                {importMode === 'replace'
                  ? 'Validates replacement statement and recomputes all financial analytics'
                  : 'Autodetects PhonePe & bank tables, deduplicates, and calculates KPIs'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#64748B] hover:text-[#172B4D] hover:bg-[#F4F9FF] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Upload File */}
        {step === 'upload' && (
          <div className="space-y-5">
            {/* Active Dataset Replacement Notice */}
            {currentDataset && (
              <div className="p-3.5 bg-[#EAF3FF]/60 border border-[#5878FF]/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2 font-bold text-[#172B4D]">
                    <span>Active Dataset: {currentDataset.fileName}</span>
                    <span className="text-[10px] bg-[#EDE9FF] text-[#5878FF] px-2 py-0.2 rounded-full font-bold border border-[#5878FF]/20">
                      {currentDataset.transactionCount} txs
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {importMode === 'replace'
                      ? 'Replacement will only occur after the new statement is fully validated.'
                      : 'New rows will be appended to the current statement ledger.'}
                  </p>
                </div>

                <div className="flex bg-white rounded-xl p-0.5 border border-[#DCE7F6] shadow-xs shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      importMode === 'replace'
                        ? 'bg-[#5878FF] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#172B4D]'
                    }`}
                  >
                    Replace Dataset
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('upload')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      importMode === 'upload'
                        ? 'bg-[#5878FF] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#172B4D]'
                    }`}
                  >
                    Append Rows
                  </button>
                </div>
              </div>
            )}

            {validAccounts.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-amber-950">No Eligible Financial Account Found</h4>
                  <p className="mt-1 text-[#64748B] leading-relaxed">
                    A financial account is required to associate and store statement transactions. Please create or link an account from the dashboard before uploading.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1.5">Target Financial Account *</label>
                <select
                  value={targetAccount}
                  onChange={(e) => setTargetAccount(e.target.value)}
                  className="w-full bg-[#F4F9FF] border border-[#DCE7F6] rounded-xl px-3.5 py-2.5 text-xs text-[#172B4D] focus:outline-none focus:border-[#5878FF] cursor-pointer shadow-xs"
                >
                  {validAccounts.map((a) => {
                    const sym = a.currency === 'INR' ? '₹' : a.currency === 'EUR' ? '€' : a.currency === 'GBP' ? '£' : '$';
                    const loc = a.currency === 'INR' ? 'en-IN' : 'en-US';
                    return (
                      <option key={a.id} value={a.id}>
                        {a.accountName} ({a.accountNumberMasked}) — Balance: {sym}{a.balance.toLocaleString(loc, { minimumFractionDigits: 2 })}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div
              onClick={() => {
                if (validAccounts.length === 0) {
                  setErrorMsg('Please link or create a financial account first before uploading statements.');
                  return;
                }
                fileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all group ${
                validAccounts.length === 0
                  ? 'border-slate-200 bg-slate-50/50 opacity-60 cursor-not-allowed'
                  : 'border-[#5878FF]/30 hover:border-[#5878FF] bg-[#F4F9FF]/60 hover:bg-[#EAF3FF]/40 cursor-pointer'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-[#172B4D]">
                {accounts.length === 0
                  ? 'Connect an account first to upload statements'
                  : importMode === 'replace'
                  ? 'Click to select replacement statement'
                  : 'Click to select PhonePe or Bank statement'}
              </p>
              <p className="text-xs text-[#64748B] mt-1">Supports Microsoft Excel (.xlsx, .xls), CSV, and digital PDF statement files</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleFileChange}
                disabled={accounts.length === 0}
                className="hidden"
              />
            </div>

            {/* Quick Sample Downloads */}
            <div className="bg-[#F4F9FF] border border-[#DCE7F6] rounded-2xl p-4 space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] block">
                Don't have a file ready? Test with pre-built bank statements:
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadSamplePhonePe}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#EAF3FF] hover:bg-[#5878FF]/15 text-[#5878FF] border border-[#5878FF]/20 transition-colors cursor-pointer shadow-2xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#5878FF]" />
                  <span>Download PhonePe Statement (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white hover:bg-[#F4F9FF] text-[#172B4D] border border-[#DCE7F6] transition-colors cursor-pointer shadow-2xs"
                >
                  <Table className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>Download Sample Statement (.csv)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Map Columns */}
        {step === 'map' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/70">
              <span>File: <strong className="text-slate-900 font-bold">{file?.name}</strong></span>
              <span>Detected rows: <strong className="text-purple-700 font-bold">{rawRows.length}</strong></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Date Column *</label>
                <select
                  value={mapping.dateCol}
                  onChange={(e) => setMapping({ ...mapping, dateCol: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select column...</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description / Merchant *</label>
                <select
                  value={mapping.descCol}
                  onChange={(e) => setMapping({ ...mapping, descCol: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select column...</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Amount Column</label>
                <select
                  value={mapping.amountCol}
                  onChange={(e) => setMapping({ ...mapping, amountCol: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                >
                  <option value="">(Optional if Debit/Credit mapped)</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Type Column (Debit / Credit)</label>
                <select
                  value={mapping.typeCol}
                  onChange={(e) => setMapping({ ...mapping, typeCol: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                >
                  <option value="">(Optional)</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Debit Column</label>
                <select
                  value={mapping.debitCol}
                  onChange={(e) => setMapping({ ...mapping, debitCol: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                >
                  <option value="">(Optional)</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Credit Column</label>
                <select
                  value={mapping.creditCol}
                  onChange={(e) => setMapping({ ...mapping, creditCol: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-purple-500"
                >
                  <option value="">(Optional)</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleValidateAndProceed}
                className="btn-primary-gradient px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-sm cursor-pointer"
              >
                Validate & Preview
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Validate & Import Confirmation */}
        {step === 'importing' && (
          <div className="space-y-4">
            {/* If replace mode, display prominent confirmation alert */}
            {importMode === 'replace' && currentDataset && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-bold block">Dataset Replacement Confirmation</span>
                  <p className="mt-0.5 leading-relaxed">
                    You are replacing statement <strong>{currentDataset.fileName}</strong> ({currentDataset.transactionCount} transactions) with <strong>{validatedRows.length} transactions</strong> from <strong>{file?.name}</strong>.
                    All dependent KPIs, category summaries, cash flow trends, and financial insights will be freshly recalculated.
                  </p>
                </div>
              </div>
            )}

            {analysisResult && (
              <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-bold text-purple-950">
                    Detected Format: {analysisResult.provider.format} ({Math.round(analysisResult.provider.confidence * 100)}% match)
                  </span>
                </div>
                <span className="text-[10px] bg-purple-200 text-purple-900 px-2 py-0.5 rounded-full font-bold">
                  Sheet: {analysisResult.selectedSheet}
                </span>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Valid Transactions Extracted:</span>
                <span className="text-emerald-700 font-bold text-sm">{validatedRows.length} rows</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Discarded / Header Rows:</span>
                <span className="text-slate-500 font-medium">{invalidRowsCount} rows</span>
              </div>
            </div>

            {/* Quick table preview */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-52 overflow-y-auto shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 font-semibold">Date</th>
                    <th className="p-2.5 font-semibold">Description</th>
                    <th className="p-2.5 font-semibold">Amount</th>
                    <th className="p-2.5 font-semibold">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validatedRows.slice(0, 6).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-mono text-[11px] text-slate-600">{r.date}</td>
                      <td className="p-2.5 font-medium text-slate-800">{r.description}</td>
                      <td className="p-2.5 font-bold text-slate-900">{currencySymbol}{formatAmount(r.amount)}</td>
                      <td className="p-2.5">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${r.type === 'credit' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                          {r.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep('map')}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Back to Mapping
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={loading || validatedRows.length === 0}
                className="btn-primary-gradient px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                <span>{importMode === 'replace' ? 'Confirm & Replace Dataset' : 'Confirm & Import Records'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === 'summary' && importStats && (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-slate-900">
                {importStats.isReplace ? 'Dataset Replaced Successfully!' : 'Statement Ingested Successfully!'}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {importStats.isReplace
                  ? `Successfully replaced statement dataset with ${importStats.imported} transactions. Dependent KPIs and charts have refreshed.`
                  : `Successfully processed ${importStats.imported} transactions. Financial KPIs, balances, and charts have updated.`}
              </p>
            </div>

            <div className="max-w-xs mx-auto bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">
                  {importStats.isReplace ? 'Active Transactions:' : 'Transactions Added:'}
                </span>
                <span className="text-emerald-700 font-bold">{importStats.imported}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Duplicates Filtered:</span>
                <span className="text-slate-800 font-semibold">{importStats.duplicates}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-primary-gradient px-6 py-2.5 rounded-xl text-white font-semibold text-xs shadow-md cursor-pointer"
            >
              View Updated Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
