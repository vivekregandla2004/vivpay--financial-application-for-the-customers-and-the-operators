/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface HeaderAliases {
  date: string[];
  description: string[];
  debit: string[];
  credit: string[];
  amount: string[];
  balance: string[];
  reference: string[];
  type: string[];
}

export const CANONICAL_HEADER_ALIASES: HeaderAliases = {
  date: [
    'txn date',
    'tran date',
    'transaction date',
    'value date',
    'posting date',
    'post date',
    'booking date',
    'date',
    'trans date',
    'effective date',
    'date & time',
    'date and time',
    'time',
  ],
  description: [
    'narration',
    'description',
    'narrative',
    'particulars',
    'remarks',
    'transaction details',
    'details',
    'paid to',
    'payment to',
    'sent to',
    'received from',
    'memo',
    'merchant',
    'payee',
    'name',
    'purpose',
    'beneficiary',
    'chq/ref no & description',
  ],
  debit: [
    'withdrawal',
    'withdrawal (dr)',
    'withdrawal amt',
    'debit',
    'debit (dr)',
    'dr',
    'debit amount',
    'money out',
    'spent',
    'charge',
  ],
  credit: [
    'deposit',
    'deposit (cr)',
    'deposit amt',
    'credit',
    'credit (cr)',
    'cr',
    'credit amount',
    'money in',
    'received',
  ],
  amount: [
    'amount',
    'transaction amount',
    'txn amount',
    'net amount',
    'amount (inr)',
    'amount(inr)',
    'amount (₹)',
    'amount(₹)',
    'total amount',
    'amount (rs)',
    'amount(rs)',
  ],
  balance: [
    'closing balance',
    'available balance',
    'balance',
    'running balance',
    'bal',
    'account balance',
    'balance (inr)',
  ],
  reference: [
    'chq no',
    'cheque number',
    'chq / ref no',
    'chq/ref no',
    'utr',
    'utr no',
    'utr no.',
    'utr number',
    'transaction id',
    'txn id',
    'reference no',
    'ref no',
    'ref #',
    'cheque / ref. no.',
  ],
  type: [
    'type',
    'transaction type',
    'txn type',
    'cr/dr',
    'dr/cr',
    'status/type',
    'payment type',
    'payment mode',
    'mode',
  ],
};

/**
 * Normalizes header string for comparison
 */
export function normalizeHeaderString(raw: any): string {
  if (raw === undefined || raw === null) return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/\r?\n/g, ' ')
    .replace(/[_\.\-\/]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Checks if a candidate header matches any of the given aliases
 */
export function matchHeaderAlias(
  candidate: string,
  category: keyof HeaderAliases
): boolean {
  const normalized = normalizeHeaderString(candidate);
  if (!normalized) return false;

  const aliases = CANONICAL_HEADER_ALIASES[category];
  return aliases.some((alias) => {
    const normAlias = normalizeHeaderString(alias);
    if (!normAlias) return false;
    if (normalized === normAlias) return true;
    if (normAlias.length <= 3) {
      // Must match whole word boundary, not substring inside words like "description"
      const escaped = normAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
      return regex.test(normalized);
    }
    return normalized.includes(normAlias);
  });
}
