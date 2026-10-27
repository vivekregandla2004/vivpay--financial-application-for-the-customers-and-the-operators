/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { matchHeaderAlias, normalizeHeaderString } from './aliases.ts';

export interface ColumnMapping {
  dateCol: number;
  descriptionCol: number;
  debitCol: number | null;
  creditCol: number | null;
  amountCol: number | null;
  balanceCol: number | null;
  referenceCol: number | null;
  typeCol: number | null;
}

export interface HeaderDetectionResult {
  headerRowIndex: number;
  rawHeaders: string[];
  mapping: ColumnMapping;
  confidence: number;
}

/**
 * Dynamically finds the transaction header row in raw 2D sheet rows
 */
export function detectHeaderRow(rows: any[][]): HeaderDetectionResult | null {
  if (!rows || rows.length === 0) return null;

  const maxScanRows = Math.min(rows.length, 30);
  let bestRowIndex = -1;
  let bestScore = -1;
  let bestMapping: ColumnMapping | null = null;
  let bestRawHeaders: string[] = [];

  for (let r = 0; r < maxScanRows; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const stringCells = row.map((cell) => normalizeHeaderString(cell));
    const nonBlankCells = stringCells.filter(Boolean);
    if (nonBlankCells.length < 2) continue;

    let score = 0;
    const mapping: ColumnMapping = {
      dateCol: -1,
      descriptionCol: -1,
      debitCol: null,
      creditCol: null,
      amountCol: null,
      balanceCol: null,
      referenceCol: null,
      typeCol: null,
    };

    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      const norm = normalizeHeaderString(val);
      if (!norm) continue;

      if (mapping.dateCol === -1 && matchHeaderAlias(norm, 'date')) {
        mapping.dateCol = c;
        score += 35;
      } else if (mapping.descriptionCol === -1 && matchHeaderAlias(norm, 'description')) {
        mapping.descriptionCol = c;
        score += 35;
      } else if (mapping.debitCol === null && matchHeaderAlias(norm, 'debit')) {
        mapping.debitCol = c;
        score += 25;
      } else if (mapping.creditCol === null && matchHeaderAlias(norm, 'credit')) {
        mapping.creditCol = c;
        score += 25;
      } else if (mapping.amountCol === null && matchHeaderAlias(norm, 'amount')) {
        mapping.amountCol = c;
        score += 25;
      } else if (mapping.balanceCol === null && matchHeaderAlias(norm, 'balance')) {
        mapping.balanceCol = c;
        score += 15;
      } else if (mapping.referenceCol === null && matchHeaderAlias(norm, 'reference')) {
        mapping.referenceCol = c;
        score += 15;
      } else if (mapping.typeCol === null && matchHeaderAlias(norm, 'type')) {
        mapping.typeCol = c;
        score += 15;
      }
    }

    // Must have at least a date and either (amount OR debit OR credit)
    const hasDate = mapping.dateCol !== -1;
    const hasMoney = mapping.amountCol !== null || mapping.debitCol !== null || mapping.creditCol !== null;
    const hasDesc = mapping.descriptionCol !== -1;

    if (hasDate && hasMoney && score > bestScore) {
      bestScore = score;
      bestRowIndex = r;
      bestMapping = mapping;
      bestRawHeaders = row.map((c) => String(c || '').trim());
    }
  }

  if (bestRowIndex === -1 || !bestMapping) {
    return null;
  }

  // Fallback: if description was not matched explicitly, pick the widest text column
  if (bestMapping.descriptionCol === -1) {
    const usedCols = new Set<number>([
      bestMapping.dateCol,
      bestMapping.amountCol,
      bestMapping.debitCol,
      bestMapping.creditCol,
      bestMapping.balanceCol,
      bestMapping.referenceCol,
      bestMapping.typeCol,
    ].filter((c): c is number => c !== null && c !== -1));

    for (let c = 0; c < bestRawHeaders.length; c++) {
      if (!usedCols.has(c)) {
        bestMapping.descriptionCol = c;
        break;
      }
    }
  }

  const confidence = Math.min(1.0, bestScore / 100);

  return {
    headerRowIndex: bestRowIndex,
    rawHeaders: bestRawHeaders,
    mapping: bestMapping,
    confidence,
  };
}
