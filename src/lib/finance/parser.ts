/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  DetectedProvider,
  ImportDiagnostics,
  SheetScore,
  TransactionDirection,
} from './types.ts';
import { inspectWorkbookSheets } from './parsers/sheet-inspector.ts';
import { detectProvider } from './parsers/provider-detector.ts';
import { detectHeaderRow, ColumnMapping } from './parsers/detector.ts';
import {
  determineColumnDateOrder,
  parseCurrencyAmount,
  parseDateCell,
  isSummaryOrFooterRow,
  recoverTableFromDateAnchors,
  DateOrder,
} from './parsers/recovery.ts';

export interface RawExtractedTransaction {
  sourceRow: number;
  dateStr: string; // ISO YYYY-MM-DD
  timeStr: string | null;
  originalDescription: string;
  debit: number;
  credit: number;
  amount: number;
  direction: TransactionDirection;
  balance: number | null;
  reference: string | null;
  rawType: string | null;
}

export interface WorkbookParseResult {
  fileName: string;
  provider: DetectedProvider;
  selectedSheet: string;
  sheetSelectionReason: string;
  allSheetScores: SheetScore[];
  rawTransactions: RawExtractedTransaction[];
  diagnostics: ImportDiagnostics;
}

/**
 * Reads a File into ArrayBuffer
 */
async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof (file as any).arrayBuffer === 'function') {
    return await (file as any).arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new (globalThis as any).FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file into memory'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Reads a File as text for CSV parsing
 */
async function readFileAsText(file: File): Promise<string> {
  if (typeof (file as any).text === 'function') {
    return await (file as any).text();
  }
  return new Promise((resolve, reject) => {
    const reader = new (globalThis as any).FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file as text'));
    reader.readAsText(file);
  });
}

/**
 * Main workbook and CSV parsing engine
 */
export async function parseStatementFile(file: File): Promise<WorkbookParseResult> {
  const fileName = file.name || 'statement.xlsx';
  const isCsv = fileName.toLowerCase().endsWith('.csv');

  let rows: any[][] = [];
  let selectedSheet = 'Sheet1';
  let sheetSelectionReason = 'CSV single-sheet source';
  let allSheetScores: SheetScore[] = [];
  let totalSheets = 1;
  let preHeaderMetadata = '';

  if (isCsv) {
    const text = await readFileAsText(file);
    const parsed = Papa.parse(text, { skipEmptyLines: false });
    rows = parsed.data as any[][];
    preHeaderMetadata = rows.slice(0, 10).map((r) => (Array.isArray(r) ? r.join(' ') : '')).join('\n');
    allSheetScores = [
      {
        sheetName: 'CSV',
        score: 100,
        validDateCount: rows.length,
        amountCount: rows.length,
        keywordHits: 10,
        rowCount: rows.length,
        isSummaryOrDisclaimer: false,
        selectionReason: 'Direct CSV file parsed',
      },
    ];
  } else {
    // Excel file (.xlsx, .xls)
    const buffer = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      raw: false,
      dateNF: 'yyyy-mm-dd',
    });

    totalSheets = workbook.SheetNames.length;
    const inspection = inspectWorkbookSheets(workbook);
    selectedSheet = inspection.selectedSheet;
    sheetSelectionReason = inspection.selectionReason;
    allSheetScores = inspection.allScores;

    const worksheet = workbook.Sheets[selectedSheet];
    if (!worksheet) {
      throw new Error(`Worksheet "${selectedSheet}" could not be loaded from workbook.`);
    }

    rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: false,
      defval: '',
    });

    preHeaderMetadata = rows.slice(0, 10).map((r) => (Array.isArray(r) ? r.join(' ') : '')).join('\n');
  }

  const warnings: string[] = [];
  const errors: string[] = [];

  if (!rows || rows.length === 0) {
    throw new Error('Statement document contains no readable rows.');
  }

  // 1. Dynamic Header Row Detection with Date-Anchor Recovery Fallback
  const headerDetection = detectHeaderRow(rows);
  let headerRowIndex = -1;
  let rawHeaders: string[] = [];
  let mapping: ColumnMapping;
  let dateOrder: DateOrder = 'DMY';
  let recoveryConfidence = 1.0;

  if (headerDetection) {
    headerRowIndex = headerDetection.headerRowIndex;
    rawHeaders = headerDetection.rawHeaders;
    mapping = headerDetection.mapping;

    // Scan Date Column to Resolve Ambiguity (DD/MM/YYYY vs MM/DD/YYYY)
    const sampleDateStrings: string[] = [];
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const rawVal = rows[r][mapping.dateCol];
      if (rawVal !== undefined && rawVal !== null) {
        sampleDateStrings.push(String(rawVal));
      }
    }
    dateOrder = determineColumnDateOrder(sampleDateStrings);
  } else {
    const recovered = recoverTableFromDateAnchors(rows);
    if (!recovered) {
      throw new Error(
        'Could not detect standard statement headers (Date, Description, Amount/Debit/Credit) or identify structured date anchors. Please check your file layout.'
      );
    }
    headerRowIndex = Math.max(0, recovered.startRow - 1);
    rawHeaders = rows[headerRowIndex] ? rows[headerRowIndex].map((c) => String(c || '').trim()) : [];
    mapping = {
      dateCol: recovered.recoveredMapping.dateCol,
      descriptionCol: recovered.recoveredMapping.descriptionCol,
      amountCol: recovered.recoveredMapping.amountCol,
      debitCol: null,
      creditCol: null,
      balanceCol: null,
      referenceCol: null,
      typeCol: null,
    };
    dateOrder = recovered.dateOrder;
    recoveryConfidence = recovered.confidence;
    warnings.push('Standard header row not detected; reconstructed table columns via date-anchor pattern matching.');
  }

  // 2. Provider Detection
  const sampleDataRows = rows.slice(headerRowIndex + 1, headerRowIndex + 15);
  const provider = detectProvider(preHeaderMetadata, rawHeaders, sampleDataRows);
  if (recoveryConfidence < 1.0) {
    provider.confidence = Math.min(provider.confidence, recoveryConfidence);
  }

  // 4. Extract and Recover Data Rows
  const rawTransactions: RawExtractedTransaction[] = [];
  let invalidRowCount = 0;
  let minDate = '9999-12-31';
  let maxDate = '0000-01-01';

  let lastTx: RawExtractedTransaction | null = null;

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Check if summary, footer, disclaimer row
    if (isSummaryOrFooterRow(row)) {
      continue;
    }

    const rawDateVal = row[mapping.dateCol];
    const { isoDate, timeStr } = parseDateCell(rawDateVal, dateOrder);

    const rawDesc = String(row[mapping.descriptionCol] || '').trim();

    // Determine monetary amounts
    let debit = 0;
    let credit = 0;
    let amount = 0;
    let direction: TransactionDirection = 'debit';

    if (mapping.debitCol !== null || mapping.creditCol !== null) {
      // Separate Debit / Credit columns
      const debVal = mapping.debitCol !== null ? parseCurrencyAmount(row[mapping.debitCol]) : null;
      const credVal = mapping.creditCol !== null ? parseCurrencyAmount(row[mapping.creditCol]) : null;

      if (debVal && debVal.amount > 0) {
        debit = debVal.amount;
        amount = debVal.amount;
        direction = 'debit';
      } else if (credVal && credVal.amount > 0) {
        credit = credVal.amount;
        amount = credVal.amount;
        direction = 'credit';
      }
    }

    if (amount === 0 && mapping.amountCol !== null) {
      // Single amount column with Type (or sign)
      const amtVal = parseCurrencyAmount(row[mapping.amountCol]);
      if (amtVal && amtVal.amount > 0) {
        amount = amtVal.amount;
        let typeStr = mapping.typeCol !== null ? String(row[mapping.typeCol] || '').trim().toLowerCase() : '';

        if (typeStr.includes('cr') || typeStr.includes('credit') || typeStr.includes('deposit') || amtVal.direction === 'credit') {
          credit = amount;
          direction = 'credit';
        } else {
          debit = amount;
          direction = 'debit';
        }
      }
    }

    // Running Balance
    let balance: number | null = null;
    if (mapping.balanceCol !== null) {
      const balVal = parseCurrencyAmount(row[mapping.balanceCol]);
      if (balVal) balance = balVal.amount;
    }

    // Reference / UTR
    let reference: string | null = null;
    if (mapping.referenceCol !== null) {
      const refVal = String(row[mapping.referenceCol] || '').trim();
      if (refVal) reference = refVal;
    }

    const rawType = mapping.typeCol !== null ? String(row[mapping.typeCol] || '').trim() : null;

    // Handle Continuation row: wrapped description with missing date and blank amount columns
    // Must be directly adjacent to previous transaction (no gap) and have completely empty amount cells
    const isDirectlyAdjacent = lastTx && r === lastTx.sourceRow;
    const isBlankAmount =
      (mapping.amountCol === null || row[mapping.amountCol] === undefined || row[mapping.amountCol] === null || String(row[mapping.amountCol]).trim() === '') &&
      (mapping.debitCol === null || row[mapping.debitCol] === undefined || row[mapping.debitCol] === null || String(row[mapping.debitCol]).trim() === '') &&
      (mapping.creditCol === null || row[mapping.creditCol] === undefined || row[mapping.creditCol] === null || String(row[mapping.creditCol]).trim() === '');

    if (!isoDate && isBlankAmount && rawDesc && isDirectlyAdjacent) {
      lastTx.originalDescription += ` ${rawDesc}`;
      continue;
    }

    if (!isoDate || amount <= 0) {
      invalidRowCount++;
      continue;
    }

    if (isoDate < minDate) minDate = isoDate;
    if (isoDate > maxDate) maxDate = isoDate;

    const tx: RawExtractedTransaction = {
      sourceRow: r + 1,
      dateStr: isoDate,
      timeStr,
      originalDescription: rawDesc || 'Transaction',
      debit,
      credit,
      amount,
      direction,
      balance,
      reference,
      rawType,
    };

    rawTransactions.push(tx);
    lastTx = tx;
  }

  if (rawTransactions.length === 0) {
    throw new Error('No valid transactions could be parsed from the selected statement sheet.');
  }

  const diagnostics: ImportDiagnostics = {
    fileName,
    detectedProvider: provider.name,
    providerConfidence: provider.confidence,
    selectedSheet,
    sheetSelectionReason,
    totalSheets,
    totalRowsParsed: rows.length,
    validRowCount: rawTransactions.length,
    invalidRowCount,
    duplicateCount: 0,
    suspectedDuplicateCount: 0,
    ambiguousDateCount: 0,
    lowConfidenceCategoryCount: 0,
    dateRange: {
      from: minDate !== '9999-12-31' ? minDate : '',
      to: maxDate !== '0000-01-01' ? maxDate : '',
    },
    warnings,
    errors,
  };

  return {
    fileName,
    provider,
    selectedSheet,
    sheetSelectionReason,
    allSheetScores,
    rawTransactions,
    diagnostics,
  };
}
