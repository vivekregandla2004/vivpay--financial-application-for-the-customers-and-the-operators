/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { SheetScore } from '../types.ts';
import { matchHeaderAlias, normalizeHeaderString } from './aliases.ts';

const EXCLUDED_SHEET_KEYWORDS = [
  'summary',
  'instruction',
  'instructions',
  'terms',
  'condition',
  'conditions',
  'cover',
  'about',
  'legend',
  'disclaimer',
  'notes',
  'faq',
  'help',
  'guideline',
  'guidelines',
];

const TRANSACTION_KEYWORDS = [
  'transaction',
  'statement',
  'ledger',
  'passbook',
  'history',
  'account',
  'debit',
  'credit',
  'balance',
  'utr',
  'narration',
  'phonepe',
  'upi',
];

/**
 * Checks if a cell contains a plausible transaction date
 */
function isDateLikeCell(val: any): boolean {
  if (val === undefined || val === null || val === '') return false;
  if (val instanceof Date) return true;
  if (typeof val === 'number' && val > 30000 && val < 60000) return true; // Excel serial dates (approx 1982 - 2064)

  const s = String(val).trim();
  // YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY or text dates
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(s)) return true;
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(s)) return true;
  if (/\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{2,4}\b/i.test(s)) return true;

  return false;
}

/**
 * Checks if a cell contains a monetary amount
 */
function isAmountLikeCell(val: any): boolean {
  if (val === undefined || val === null || val === '') return false;
  if (typeof val === 'number') return val > 0 && Number.isFinite(val);

  const s = String(val).trim();
  // Strip currency symbols and commas
  const cleaned = s.replace(/[₹\$€£\s,]/g, '').replace(/\b(cr|dr)\b/gi, '').replace(/[\(\)]/g, '');
  const num = parseFloat(cleaned);
  return !isNaN(num) && num > 0 && !/^0+$/.test(cleaned) && /^\d+(\.\d{1,4})?$/.test(cleaned);
}

/**
 * Evaluates a single sheet by transaction density scoring:
 * score = validDateCount × 2 + amountCount × 2 + keywordHits × 3 − penalty
 */
export function inspectSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string
): SheetScore {
  const normName = normalizeHeaderString(sheetName);
  const isExcludedByName = EXCLUDED_SHEET_KEYWORDS.some((k) => normName.includes(k));

  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
  });

  if (!rows || rows.length === 0) {
    return {
      sheetName,
      score: -100,
      validDateCount: 0,
      amountCount: 0,
      keywordHits: 0,
      rowCount: 0,
      isSummaryOrDisclaimer: isExcludedByName,
      selectionReason: 'Worksheet is completely empty.',
    };
  }

  let validDateCount = 0;
  let amountCount = 0;
  let keywordHits = 0;

  // Scan up to 500 rows to sample density
  const sampleLimit = Math.min(rows.length, 500);

  for (let r = 0; r < sampleLimit; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val === undefined || val === null || val === '') continue;

      if (isDateLikeCell(val)) validDateCount++;
      if (isAmountLikeCell(val)) amountCount++;

      const strVal = String(val).toLowerCase();
      if (TRANSACTION_KEYWORDS.some((kw) => strVal.includes(kw))) {
        keywordHits++;
      }
    }
  }

  let penalty = 0;
  if (isExcludedByName) penalty += 50;
  if (rows.length < 3) penalty += 30;
  if (validDateCount === 0) penalty += 40;
  if (amountCount === 0) penalty += 40;

  // Bonus if sheet name specifically hints at transactions
  if (normName.includes('transaction') || normName.includes('statement') || normName.includes('phonepe')) {
    keywordHits += 10;
  }

  const score = validDateCount * 2 + amountCount * 2 + keywordHits * 3 - penalty;

  let selectionReason = `Density: ${validDateCount} dates, ${amountCount} amounts, ${keywordHits} keyword hits across ${rows.length} rows.`;
  if (isExcludedByName) {
    selectionReason += ' Penalized due to summary/disclaimer keywords in sheet name.';
  }

  return {
    sheetName,
    score,
    validDateCount,
    amountCount,
    keywordHits,
    rowCount: rows.length,
    isSummaryOrDisclaimer: isExcludedByName,
    selectionReason,
  };
}

/**
 * Inspects all sheets in a workbook and selects the optimal sheet by score
 */
export function inspectWorkbookSheets(workbook: XLSX.WorkBook): {
  selectedSheet: string;
  selectionReason: string;
  allScores: SheetScore[];
} {
  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    return {
      selectedSheet: '',
      selectionReason: 'Workbook has no sheets.',
      allScores: [],
    };
  }

  const allScores: SheetScore[] = sheetNames.map((name) =>
    inspectSheet(workbook.Sheets[name], name)
  );

  // Sort descending by score
  allScores.sort((a, b) => b.score - a.score);

  const best = allScores[0];
  const selectedSheet = best.sheetName;
  const selectionReason = `Selected "${best.sheetName}" with highest density score of ${best.score}. (${best.selectionReason})`;

  return {
    selectedSheet,
    selectionReason,
    allScores,
  };
}
