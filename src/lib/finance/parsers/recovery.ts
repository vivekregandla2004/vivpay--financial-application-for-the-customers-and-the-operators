/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TransactionDirection } from '../types.ts';

export interface ParsedAmountResult {
  amount: number;
  direction: TransactionDirection | null;
  raw: string;
}

/**
 * Parses numeric currency strings supporting Indian numbering (e.g. 1,50,000.50),
 * negative values (e.g. -500, (500), 500 Dr), and currency symbols (₹, $, Rs., etc.).
 */
export function parseCurrencyAmount(raw: any): ParsedAmountResult | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') {
    if (isNaN(raw)) return null;
    return {
      amount: Math.abs(raw),
      direction: raw < 0 ? 'debit' : 'credit',
      raw: String(raw),
    };
  }

  let str = String(raw).trim();
  if (!str) return null;

  let inferredDirection: TransactionDirection | null = null;
  if (/\b(dr|debit|withdrawal|spent)\b/i.test(str)) {
    inferredDirection = 'debit';
  } else if (/\b(cr|credit|deposit|received)\b/i.test(str)) {
    inferredDirection = 'credit';
  }

  const isParenthesisNegative = /^\(.*\)$/.test(str);
  if (isParenthesisNegative || str.startsWith('-') || str.endsWith('-')) {
    inferredDirection = 'debit';
  }

  // Remove currencies, commas, words like Dr/Cr, spaces, parentheses
  const cleaned = str
    .replace(/[₹\$€£]/g, '')
    .replace(/\b(rs\.?|inr|dr|cr|amt|amount)\b/gi, '')
    .replace(/,/g, '')
    .replace(/[\(\)]/g, '')
    .trim();

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  return {
    amount: Math.abs(num),
    direction: inferredDirection,
    raw: str,
  };
}

/**
 * Date ambiguity detector across an entire column of dates
 */
export type DateOrder = 'DMY' | 'MDY' | 'YMD';

export function determineColumnDateOrder(sampleDateStrings: string[]): DateOrder {
  let hasDayGreaterThan12InFirstPos = false;
  let hasDayGreaterThan12InSecondPos = false;

  for (const raw of sampleDateStrings) {
    if (!raw) continue;
    const s = String(raw).trim();

    // Check YYYY-MM-DD
    if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(s)) {
      return 'YMD';
    }

    // Check DD/MM/YYYY or MM/DD/YYYY
    const match = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = parseInt(match[2], 10);

      if (p1 > 12) {
        hasDayGreaterThan12InFirstPos = true; // Definitely DD/MM/YYYY
      }
      if (p2 > 12) {
        hasDayGreaterThan12InSecondPos = true; // Definitely MM/DD/YYYY
      }
    }
  }

  if (hasDayGreaterThan12InFirstPos) return 'DMY';
  if (hasDayGreaterThan12InSecondPos) return 'MDY';

  // For Indian bank statements (PhonePe, HDFC, SBI, ICICI, etc.), standard is DD/MM/YYYY
  return 'DMY';
}

/**
 * Parses raw date value into standard YYYY-MM-DD ISO string and optional time string
 */
export function parseDateCell(
  raw: any,
  preferredOrder: DateOrder = 'DMY'
): { isoDate: string | null; timeStr: string | null } {
  if (raw === undefined || raw === null || raw === '') {
    return { isoDate: null, timeStr: null };
  }

  // Handle native Date
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return { isoDate: null, timeStr: null };
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    const hours = String(raw.getHours()).padStart(2, '0');
    const mins = String(raw.getMinutes()).padStart(2, '0');
    const secs = String(raw.getSeconds()).padStart(2, '0');
    return {
      isoDate: `${y}-${m}-${d}`,
      timeStr: `${hours}:${mins}:${secs}`,
    };
  }

  // Handle Excel serial date numbers (e.g. 45678.5)
  if (typeof raw === 'number' && raw > 30000 && raw < 70000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const wholeDays = Math.floor(raw);
    const fractionalDay = raw - wholeDays;
    const ms = (wholeDays * 86400 + Math.round(fractionalDay * 86400)) * 1000;
    const dateObj = new Date(excelEpoch.getTime() + ms);

    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getUTCDate()).padStart(2, '0');
    const hours = String(dateObj.getUTCHours()).padStart(2, '0');
    const mins = String(dateObj.getUTCMinutes()).padStart(2, '0');
    const secs = String(dateObj.getUTCSeconds()).padStart(2, '0');

    return {
      isoDate: `${y}-${m}-${d}`,
      timeStr: `${hours}:${mins}:${secs}`,
    };
  }

  const str = String(raw).trim();
  let extractedTime: string | null = null;

  // Extract time if present (e.g. "12:45:00 PM", "14:30")
  const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hh = parseInt(timeMatch[1], 10);
    const mm = timeMatch[2];
    const ss = timeMatch[3] || '00';
    const ampm = timeMatch[4]?.toLowerCase();

    if (ampm === 'pm' && hh < 12) hh += 12;
    if (ampm === 'am' && hh === 12) hh = 0;

    extractedTime = `${String(hh).padStart(2, '0')}:${mm}:${ss}`;
  }

  // Text month date: e.g. "12 Oct 2026", "Oct 12, 2026", "12-Oct-2026"
  const MONTHS: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };

  const textMonthRegex1 = /(\d{1,2})[-\s]([a-zA-Z]{3,9})[-\s](\d{2,4})/;
  const matchT1 = str.match(textMonthRegex1);
  if (matchT1) {
    const d = matchT1[1].padStart(2, '0');
    const monthKey = matchT1[2].toLowerCase().slice(0, 3);
    const m = MONTHS[monthKey];
    let y = matchT1[3];
    if (y.length === 2) y = `20${y}`;
    if (m) {
      return { isoDate: `${y}-${m}-${d}`, timeStr: extractedTime };
    }
  }

  const textMonthRegex2 = /([a-zA-Z]{3,9})[-\s](\d{1,2}),?[-\s](\d{2,4})/;
  const matchT2 = str.match(textMonthRegex2);
  if (matchT2) {
    const monthKey = matchT2[1].toLowerCase().slice(0, 3);
    const d = matchT2[2].padStart(2, '0');
    const m = MONTHS[monthKey];
    let y = matchT2[3];
    if (y.length === 2) y = `20${y}`;
    if (m) {
      return { isoDate: `${y}-${m}-${d}`, timeStr: extractedTime };
    }
  }

  // YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return { isoDate: `${y}-${m}-${d}`, timeStr: extractedTime };
  }

  // Standard numeric separator: DD/MM/YYYY or MM/DD/YYYY
  const numMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (numMatch) {
    const p1 = numMatch[1];
    const p2 = numMatch[2];
    let y = numMatch[3];
    if (y.length === 2) y = `20${y}`;

    if (preferredOrder === 'MDY') {
      const m = p1.padStart(2, '0');
      const d = p2.padStart(2, '0');
      return { isoDate: `${y}-${m}-${d}`, timeStr: extractedTime };
    } else {
      // DMY default
      const d = p1.padStart(2, '0');
      const m = p2.padStart(2, '0');
      return { isoDate: `${y}-${m}-${d}`, timeStr: extractedTime };
    }
  }

  return { isoDate: null, timeStr: extractedTime };
}

/**
 * Detects if a row is a footer, disclaimer, summary total, opening/closing balance, or pagination line
 */
export function isSummaryOrFooterRow(row: any[]): boolean {
  if (!Array.isArray(row) || row.length === 0) return true;

  const rowStr = row.map((c) => String(c || '').trim()).join(' ').toLowerCase();
  if (!rowStr) return true;

  // Opening / Closing balance markers
  if (/(?:^|\b)(?:opening balance|closing balance|balance b\/f|b\/f balance|carried forward|brought forward)(?:\b|$)/i.test(rowStr)) {
    return true;
  }

  // Summary and Total row markers
  if (
    /^\s*total(?:\s*[:\-]|\s+\d|\s*$)/i.test(rowStr) ||
    /(?:^|\b)(?:grand total|total debit|total credit|total withdrawal|total deposit|statement total|total amount|sum total)(?:\b|$)/i.test(rowStr)
  ) {
    return true;
  }

  // Standard bank metadata / disclaimer / pagination markers
  const FOOTER_MARKERS = [
    'statement summary',
    'page ',
    'this is a computer generated',
    'end of statement',
    'generated on',
    'disclaimer:',
    'note:',
    'important notes',
    'customer service',
    'for any queries',
    '*** end of',
  ];

  return FOOTER_MARKERS.some((marker) => rowStr.includes(marker));
}

export interface DateAnchorRecoveryResult {
  recoveredMapping: {
    dateCol: number;
    descriptionCol: number;
    amountCol: number;
    debitCol: number | null;
    creditCol: number | null;
  };
  startRow: number;
  confidence: number;
  dateOrder: DateOrder;
}

/**
 * Recovers tabular transactions using date anchors when standard header rows cannot be matched
 */
export function recoverTableFromDateAnchors(rows: any[][]): DateAnchorRecoveryResult | null {
  if (!rows || rows.length < 3) return null;

  // 1. Column analysis: date density, amount density, text length
  const maxCols = Math.max(...rows.map((r) => (Array.isArray(r) ? r.length : 0)));
  if (maxCols < 2) return null;

  const dateCounts = new Array(maxCols).fill(0);
  const amountCounts = new Array(maxCols).fill(0);
  const textLengths = new Array(maxCols).fill(0);

  const sampleLimit = Math.min(rows.length, 100);
  for (let r = 0; r < sampleLimit; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || isSummaryOrFooterRow(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      const parsedD = parseDateCell(val);
      if (parsedD.isoDate) {
        dateCounts[c]++;
      }

      const parsedA = parseCurrencyAmount(val);
      if (parsedA && parsedA.amount > 0) {
        amountCounts[c]++;
      }

      const strVal = String(val || '').trim();
      if (strVal.length > 5 && !parsedD.isoDate) {
        textLengths[c] += strVal.length;
      }
    }
  }

  // Find best date column (must have at least 2 detected dates)
  let bestDateCol = -1;
  let maxDates = 1;
  for (let c = 0; c < maxCols; c++) {
    if (dateCounts[c] > maxDates) {
      maxDates = dateCounts[c];
      bestDateCol = c;
    }
  }

  if (bestDateCol === -1) return null;

  // Find best amount column (excluding date column)
  let bestAmtCol = -1;
  let maxAmounts = 1;
  for (let c = 0; c < maxCols; c++) {
    if (c !== bestDateCol && amountCounts[c] > maxAmounts) {
      maxAmounts = amountCounts[c];
      bestAmtCol = c;
    }
  }

  if (bestAmtCol === -1) return null;

  // Find best description column (excluding date and amount columns)
  let bestDescCol = -1;
  let maxText = -1;
  for (let c = 0; c < maxCols; c++) {
    if (c !== bestDateCol && c !== bestAmtCol && textLengths[c] > maxText) {
      maxText = textLengths[c];
      bestDescCol = c;
    }
  }

  if (bestDescCol === -1) {
    // If no text column found, fallback to any other non-date non-amount column
    bestDescCol = bestDateCol === 0 ? (bestAmtCol === 1 ? 2 : 1) : 0;
  }

  // Find first row where date begins
  let startRow = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (Array.isArray(row) && parseDateCell(row[bestDateCol]).isoDate) {
      startRow = r;
      break;
    }
  }

  // Determine date order from sample
  const sampleDates: string[] = [];
  for (let r = startRow; r < Math.min(rows.length, startRow + 25); r++) {
    if (Array.isArray(rows[r]) && rows[r][bestDateCol]) {
      sampleDates.push(String(rows[r][bestDateCol]));
    }
  }
  const dateOrder = determineColumnDateOrder(sampleDates);

  const confidence = parseFloat(Math.min(0.85, (maxDates / (sampleLimit - startRow)) * 0.9).toFixed(2));

  return {
    recoveredMapping: {
      dateCol: bestDateCol,
      descriptionCol: bestDescCol,
      amountCol: bestAmtCol,
      debitCol: null,
      creditCol: null,
    },
    startRow,
    confidence,
    dateOrder,
  };
}
