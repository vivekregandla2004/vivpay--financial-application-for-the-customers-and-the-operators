/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import { supabaseCategoryRepo } from '../db/supabaseRepository.ts';

export interface ExtractedTransactionRow {
  date: string; // YYYY-MM-DD
  description: string;
  rawDescription?: string;
  amount: number;
  type: 'debit' | 'credit';
  categoryId: string;
  categoryName?: string;
  balanceAfter?: number;
  reference?: string | null;
  isRecurring?: boolean;
  isAmbiguous?: boolean;
  ambiguityReason?: string;
}

export interface SheetReportItem {
  sheetName: string;
  score: number;
  rowCount: number;
  validDateCount: number;
  amountCount: number;
  isCandidate: boolean;
  reason: string;
}

export interface ParseResult {
  success: boolean;
  rows: ExtractedTransactionRow[];
  totalRowsParsed: number;
  validRowsCount: number;
  ambiguousRowsCount: number;
  errors: string[];
  warnings?: string[];
  selectedSheet?: string;
  sheetSelectionReason?: string;
  allSheetsReport?: SheetReportItem[];
  isScannedPdf?: boolean;
  detectedProvider?: string;
  detectedCurrency?: string;
}

export const DEFAULT_PARSER_CATEGORIES = [
  { id: '3bce1cdd-3add-460c-a153-258a1a913fb2', name: 'Income / Salary', slug: 'income' },
  { id: '665441a1-1eb9-49ab-b2e7-c23a0f83fc3b', name: 'Groceries & Dining', slug: 'food-dining' },
  { id: 'fa512715-dde7-4231-bbb2-baa871ee6caf', name: 'Housing & Rent', slug: 'housing' },
  { id: 'fb8d3d3b-4c12-4312-85d2-0294a6c48111', name: 'Utilities & Bills', slug: 'utilities' },
  { id: '3a248e7b-c1fb-497a-9ff7-74253c8bfca1', name: 'Transportation & Travel', slug: 'transport' },
  { id: 'a8c0a5ef-5dc9-4749-bd62-63f4b5c03026', name: 'Shopping & Retail', slug: 'shopping' },
  { id: '7877848f-3565-4f39-8079-45936acac74c', name: 'Entertainment & Leisure', slug: 'entertainment' },
  { id: '0cb8d1ca-2563-4a09-b895-df5146973609', name: 'Healthcare & Medical', slug: 'health' },
  { id: 'fc15e42b-b98e-410d-96bc-fe96270e4cc7', name: 'Transfers & Payments', slug: 'transfers' },
  { id: 'a0646846-5aeb-4180-b077-46623b7b84a9', name: 'Investments & Savings', slug: 'investments' },
  { id: '478dea5c-1271-42ae-8183-a968dda771ad', name: 'General / Other', slug: 'other' },
];

const parserCorrectionsCache = new Map<string, { timestamp: number; corrections: { merchant_pattern: string; category_id: string }[] }>();
const parserCategoriesCache = new Map<string, { timestamp: number; categories: any[] }>();

/**
 * Intelligent category matching helper based on merchant keywords and Supabase user rules
 */
export async function guessCategory(
  description: string,
  customerId: string,
  cachedCategories?: any[]
): Promise<{ id: string; name: string }> {
  const now = Date.now();
  const CACHE_TTL_MS = 60000;

  try {
    let cachedCorr = parserCorrectionsCache.get(customerId);
    if (!cachedCorr || now - cachedCorr.timestamp > CACHE_TTL_MS) {
      const { getSupabaseAdmin } = await import('../db/supabase.ts');
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from('category_corrections')
        .select('merchant_pattern, category_id')
        .eq('customer_id', customerId);
      cachedCorr = { timestamp: now, corrections: data || [] };
      parserCorrectionsCache.set(customerId, cachedCorr);
    }

    const normalizedDesc = description.toLowerCase();
    for (const r of cachedCorr.corrections) {
      if (r.merchant_pattern && normalizedDesc.includes(r.merchant_pattern.toLowerCase())) {
        const cat = await supabaseCategoryRepo.getById(r.category_id);
        if (cat) return { id: cat.id, name: cat.name };
      }
    }
  } catch {
    // Continue with keyword heuristic
  }

  const d = description.toLowerCase();

  const rules: { keywords: string[]; slug: string }[] = [
    { keywords: ['payroll', 'salary', 'direct dep', 'dividend', 'interest payment', 'employer', 'stripe payout', 'ach dep', 'credited', 'salary credited', 'payout', 'bonus', 'consulting retainer', 'retainer milestone', 'consulting'], slug: 'income' },
    { keywords: ['whole foods', 'trader joe', 'kroger', 'safeway', 'walmart', 'target', 'supermarket', 'market', 'coffee', 'starbucks', 'mcdonald', 'restaurant', 'uber eats', 'doordash', 'grubhub', 'chipotle', 'dunkin', 'swiggy', 'zomato', 'blinkit', 'zepto', 'instamart', 'bigbasket', 'dmart', 'nature basket', 'groceries', 'organic groceries', 'cafe', 'food', 'bakery', 'sweets'], slug: 'food-dining' },
    { keywords: ['rent', 'mortgage', 'lease', 'apartment', 'realty', 'property mgmt', 'maintenance', 'society', 'flat'], slug: 'housing' },
    { keywords: ['electric', 'energy', 'water', 'gas co', 'coned', 'pge', 'internet', 'comcast', 'verizon', 'att', 'at&t', 't-mobile', 'utility', 'bescom', 'tneb', 'airtel', 'airtel broadband', 'fiber bill', 'fiber broadband', 'jio', 'vi', 'vodafone', 'broadband', 'wifi', 'dth', 'tatasky', 'cylinder', 'indane', 'recharge', 'bill desk', 'bbps'], slug: 'utilities' },
    { keywords: ['uber', 'lyft', 'chevron', 'shell', 'exxon', 'bp gas', 'subway', 'metro', 'transit', 'airline', 'delta', 'united', 'parking', 'amtrak', 'ola', 'rapido', 'irctc', 'indian railway', 'fuel', 'petrol', 'hpcl', 'bpcl', 'ioc', 'fastag', 'toll'], slug: 'transport' },
    { keywords: ['amazon', 'apple store', 'best buy', 'ebay', 'clothing', 'zara', 'nike', 'nordstrom', 'retail', 'etsy', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tata cliq', 'croma', 'reliance digital'], slug: 'shopping' },
    { keywords: ['netflix', 'spotify', 'hulu', 'disney', 'cinema', 'amc', 'steam', 'playstation', 'nintendo', 'hbo', 'hotstar', 'prime video', 'youtube', 'bookmyshow', 'pvr', 'inox', 'theatre', 'gaming'], slug: 'entertainment' },
    { keywords: ['pharmacy', 'cvs', 'walgreens', 'doctor', 'hospital', 'clinic', 'dental', 'medical', 'optometry', 'health', 'apollo', '1mg', 'pharmeasy', 'medplus', 'dr ', 'diagnostic', 'pathology'], slug: 'health' },
    { keywords: ['transfer', 'venmo', 'zelle', 'wire out', 'wire in', 'autopay payment', 'credit card payment', 'upi', 'gpay', 'phonepe', 'paytm', 'cred', 'neft', 'rtgs', 'imps', 'p2p', 'qr payment', 'internal transfer'], slug: 'transfers' },
    { keywords: ['vanguard', 'fidelity', 'schwab', 'robinhood', 'coinbase', 'savings deposit', 'zerodha', 'groww', 'upstox', 'angel one', 'mutual fund', 'sip', 'kuvera', 'etmoney', 'crypto', 'fd ', 'recurring deposit'], slug: 'investments' },
  ];

  let allCategories = cachedCategories;
  if (!allCategories) {
    let cachedPool = parserCategoriesCache.get(customerId);
    if (!cachedPool || now - cachedPool.timestamp > CACHE_TTL_MS) {
      try {
        const loaded = await supabaseCategoryRepo.list(customerId);
        cachedPool = { timestamp: now, categories: loaded };
        parserCategoriesCache.set(customerId, cachedPool);
      } catch {
        cachedPool = { timestamp: now, categories: [] };
      }
    }
    allCategories = cachedPool.categories;
  }

  const categoryPool = allCategories && allCategories.length > 0 ? allCategories : DEFAULT_PARSER_CATEGORIES;

  for (const rule of rules) {
    if (rule.keywords.some((k) => d.includes(k))) {
      const match = categoryPool.find((c: any) => c.slug === rule.slug);
      if (match) return { id: match.id, name: match.name };
    }
  }

  const defaultCat = categoryPool.find((c: any) => c.slug === 'other') || categoryPool[categoryPool.length - 1];
  return { id: defaultCat?.id || '478dea5c-1271-42ae-8183-a968dda771ad', name: defaultCat?.name || 'General / Other' };
}

/**
 * Normalize flexible date strings into ISO YYYY-MM-DD
 * Handles Date objects, Excel date serials, ISO, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, and textual dates.
 */
export function normalizeDate(raw: any): string | null {
  if (raw === undefined || raw === null || raw === '') return null;

  // Native Date object
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const d = String(raw.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Excel serial date number (approx 1982 to 2064: 30000 to 70000)
  if (typeof raw === 'number' && raw > 30000 && raw < 70000) {
    const ms = (raw - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  const clean = String(raw).trim();
  if (!clean || clean === 'null' || clean === 'undefined') return null;

  // Check if string is a pure Excel serial number like "45579" or "45579.5"
  if (/^\d{5}(?:\.\d+)?$/.test(clean)) {
    const num = parseFloat(clean);
    if (num > 30000 && num < 70000) {
      const ms = (num - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
  }

  // Standard YYYY-MM-DD (with optional time or timestamp)
  const isoMatch = clean.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})(?:[\sT].*)?$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY or MM/DD/YYYY
  const slashDashMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:[\sT].*)?$/);
  if (slashDashMatch) {
    const [, p1, p2, p3] = slashDashMatch;
    const y = p3.length === 2 ? `20${p3}` : p3;
    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);
    if (n1 > 12) {
      // First component is definitely day: DD/MM/YYYY
      return `${y}-${String(n2).padStart(2, '0')}-${String(n1).padStart(2, '0')}`;
    }
    if (n2 > 12) {
      // Second component is definitely day: MM/DD/YYYY
      return `${y}-${String(n1).padStart(2, '0')}-${String(n2).padStart(2, '0')}`;
    }
    // Default convention for Indian banking & global statements: DD/MM/YYYY
    return `${y}-${String(n2).padStart(2, '0')}-${String(n1).padStart(2, '0')}`;
  }

  // Textual dates like "14-Oct-2026", "14 Oct, 2026", "Oct 14, 2026", "14-OCT-26", "14.10.2026"
  const textDateMatch = clean.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s,]+(\d{2,4})/);
  if (textDateMatch) {
    const [, day, monthStr, yearStr] = textDateMatch;
    const y = yearStr.length === 2 ? `20${yearStr}` : yearStr;
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const m = months[monthStr.substring(0, 3).toLowerCase()];
    if (m) {
      return `${y}-${m}-${day.padStart(2, '0')}`;
    }
  }

  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Clean monetary strings into numeric amount and negative/debit status.
 * Handles Indian notation (1,12,151.00), ₹, $, Rs., Dr/Cr, (parentheses), minus signs.
 */
export function parseCurrencyAmount(raw: any): { amount: number; isNegative: boolean } | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') {
    if (isNaN(raw)) return null;
    return { amount: Math.abs(raw), isNegative: raw < 0 };
  }

  let str = String(raw).trim();
  if (!str) return null;

  const isParenNegative = /^\(.*\)$/.test(str);
  const isExplicitMinus = str.startsWith('-') || str.endsWith('-');
  const isDr = /\b(dr|debit)\b/i.test(str);
  const isNegative = isParenNegative || isExplicitMinus || isDr;

  // Clean currency symbols: ₹, INR, Rs., $, €, £, commas, quotes, words
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

  return { amount: Math.abs(num), isNegative };
}

/**
 * Checks if a description row represents metadata like opening/closing balance, totals, or page summary
 */
export function isMetadataOrSummaryRow(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase().trim();

  // Opening & closing balance markers
  if (/(?:^|\b)(?:opening balance|closing balance|balance b\/f|b\/f balance|carried forward|brought forward|opening bal|closing bal|opening|closing)(?:\b|$)/i.test(lower)) {
    return true;
  }

  // Totals & grand totals
  if (
    /^\s*total(?:\s*[:\-]|\s+\d|\s*$)/i.test(lower) ||
    /(?:^|\b)(?:grand total|total debit|total credit|total withdrawal|total deposit|statement total|sum total|total amount)(?:\b|$)/i.test(lower)
  ) {
    return true;
  }

  // Bank statements footers / computer generated notes / disclaimers
  const FOOTER_MARKERS = [
    'statement summary',
    'page ',
    'this is a computer generated',
    'end of statement',
    'generated on',
    'disclaimer:',
    'important notes',
    'customer service',
    'for any queries',
    '*** end of',
  ];

  return FOOTER_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * Detect statement provider and currency from text content
 */
export function detectDocumentProviderAndCurrency(text: string): { provider: string; currency: string } {
  const lower = text.toLowerCase();
  let provider = 'Universal Bank Statement';
  let currency = 'INR';

  if (lower.includes('state bank of india') || lower.includes('sbi')) {
    provider = 'State Bank of India (SBI)';
    currency = 'INR';
  } else if (lower.includes('hdfc bank') || lower.includes('hdfc')) {
    provider = 'HDFC Bank';
    currency = 'INR';
  } else if (lower.includes('icici bank') || lower.includes('icici')) {
    provider = 'ICICI Bank';
    currency = 'INR';
  } else if (lower.includes('axis bank')) {
    provider = 'Axis Bank';
    currency = 'INR';
  } else if (lower.includes('punjab national bank') || lower.includes('pnb')) {
    provider = 'Punjab National Bank (PNB)';
    currency = 'INR';
  } else if (lower.includes('bank of baroda') || lower.includes('bob')) {
    provider = 'Bank of Baroda';
    currency = 'INR';
  } else if (lower.includes('phonepe')) {
    provider = 'PhonePe';
    currency = 'INR';
  } else if (lower.includes('google pay') || lower.includes('gpay')) {
    provider = 'Google Pay';
    currency = 'INR';
  } else if (lower.includes('paytm')) {
    provider = 'Paytm';
    currency = 'INR';
  } else if (lower.includes('amazon pay')) {
    provider = 'Amazon Pay';
    currency = 'INR';
  } else if (lower.includes('chase')) {
    provider = 'Chase Bank';
    currency = 'USD';
  } else if (lower.includes('bank of america') || lower.includes('bofa')) {
    provider = 'Bank of America';
    currency = 'USD';
  } else if (lower.includes('citibank') || lower.includes('citi')) {
    provider = 'Citibank';
    currency = lower.includes('₹') || lower.includes('inr') ? 'INR' : 'USD';
  } else if (lower.includes('$') || lower.includes('usd')) {
    currency = 'USD';
  } else if (lower.includes('€') || lower.includes('eur')) {
    currency = 'EUR';
  } else if (lower.includes('£') || lower.includes('gbp')) {
    currency = 'GBP';
  } else if (lower.includes('₹') || lower.includes('inr') || lower.includes('rs.') || lower.includes('utr') || lower.includes('upi')) {
    currency = 'INR';
  }

  return { provider, currency };
}

/**
 * Parse CSV Bank Statement
 */
export async function parseCsvStatement(content: string, customerId: string): Promise<ParseResult> {
  const errors: string[] = [];
  const rows: ExtractedTransactionRow[] = [];
  const { provider: detectedProvider, currency: detectedCurrency } = detectDocumentProviderAndCurrency(content);

  let effectiveContent = content;
  // Detect if table has preamble/metadata rows (PhonePe, HDFC, SBI statement preambles)
  const preliminary = Papa.parse<string[]>(content, { header: false, skipEmptyLines: true });
  if (preliminary.data && preliminary.data.length > 0) {
    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(preliminary.data.length, 25); r++) {
      const line = (preliminary.data[r] || []).map((c) => String(c || '').toLowerCase().trim()).join(' ');
      const hasDate = line.includes('date') || line.includes('time');
      const hasAmt = line.includes('amount') || line.includes('debit') || line.includes('credit') || line.includes('inr') || line.includes('₹');
      const hasDetails = line.includes('detail') || line.includes('desc') || line.includes('paid to') || line.includes('type') || line.includes('utr') || line.includes('narrat');
      if (hasDate && (hasAmt || hasDetails)) {
        headerRowIdx = r;
        break;
      }
    }
    if (headerRowIdx > 0) {
      effectiveContent = Papa.unparse(preliminary.data.slice(headerRowIdx));
    }
  }

  const parsed = Papa.parse(effectiveContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parsed.errors.length > 0) {
    for (const e of parsed.errors) {
      errors.push(`Row ${e.row}: ${e.message}`);
    }
  }

  const data = parsed.data as Record<string, string>[];

  for (let i = 0; i < data.length; i++) {
    const record = data[i];

    // Find date field
    const dateField = Object.keys(record).find((k) =>
      ['date', 'posting date', 'transaction date', 'trans date', 'effective date', 'post date', 'date & time', 'date and time', 'value date', 'time', 'txn date'].includes(k)
    );
    const rawDate = dateField ? record[dateField] : null;
    const normalizedDate = rawDate ? normalizeDate(rawDate) : null;

    // Find description field
    const descField = Object.keys(record).find((k) =>
      ['description', 'narrative', 'details', 'transaction details', 'paid to', 'payment to', 'sent to', 'received from', 'particulars', 'narration', 'transaction narration', 'txn details', 'memo', 'merchant', 'payee', 'name', 'remarks', 'purpose', 'beneficiary'].includes(k)
    );
    const description = descField ? record[descField]?.trim() : 'Unknown Transaction';

    // Find amounts & debits/credits
    const debitField = Object.keys(record).find((k) => ['debit', 'withdrawal', 'charge', 'money out', 'spent', 'dr', 'debit amount'].includes(k));
    const creditField = Object.keys(record).find((k) => ['credit', 'deposit', 'money in', 'received', 'cr', 'credit amount'].includes(k));
    const amountField = Object.keys(record).find((k) => ['amount', 'net amount', 'transaction amount', 'amount (inr)', 'amount(inr)', 'amount (₹)', 'amount(₹)', 'txn amount', 'total amount'].includes(k));
    const typeField = Object.keys(record).find((k) => ['type', 'transaction type', 'cr/dr', 'dr/cr', 'status/type', 'payment type'].includes(k));

    let type: 'debit' | 'credit' = 'debit';
    let finalAmount: number | null = null;
    let isAmbiguous = false;
    let ambiguityReason: string | undefined;

    if (debitField && record[debitField] && record[debitField].trim() !== '') {
      const parsedDebit = parseCurrencyAmount(record[debitField]);
      if (parsedDebit && parsedDebit.amount > 0) {
        type = 'debit';
        finalAmount = parsedDebit.amount;
      }
    }

    if (creditField && record[creditField] && record[creditField].trim() !== '') {
      const parsedCredit = parseCurrencyAmount(record[creditField]);
      if (parsedCredit && parsedCredit.amount > 0) {
        type = 'credit';
        finalAmount = parsedCredit.amount;
      }
    }

    if (finalAmount === null && amountField && record[amountField]) {
      const parsedAmt = parseCurrencyAmount(record[amountField]);
      if (parsedAmt) {
        finalAmount = parsedAmt.amount;
        if (parsedAmt.isNegative) {
          type = 'debit';
        } else if (typeField && record[typeField]) {
          const t = record[typeField].toLowerCase();
          type = t.includes('cr') || t.includes('credit') || t.includes('dep') || t.includes('income') || t.includes('refund') || t.includes('received') ? 'credit' : 'debit';
        } else {
          const descLower = description.toLowerCase();
          if (descLower.startsWith('received from') || descLower.includes('refund from') || descLower.includes('cashback')) {
            type = 'credit';
          } else {
            type = 'debit';
          }
        }
      }
    }

    // Running balance
    const balanceField = Object.keys(record).find((k) =>
      k.includes('balance') || k.includes('bal ') || k === 'bal'
    );
    let balanceAfter: number | undefined;
    if (balanceField && record[balanceField]) {
      const parsedBal = parseCurrencyAmount(record[balanceField]);
      if (parsedBal) {
        balanceAfter = parsedBal.isNegative ? -parsedBal.amount : parsedBal.amount;
      }
    }

    // Exclude opening / closing balance rows from ledger transactions
    if (isMetadataOrSummaryRow(description)) {
      isAmbiguous = true;
      ambiguityReason = 'Opening or closing balance row recorded as statement metadata, excluded from transactions.';
    }

    if (!normalizedDate) {
      isAmbiguous = true;
      ambiguityReason = 'Unparseable or missing transaction date.';
    }

    if (!finalAmount || finalAmount <= 0) {
      isAmbiguous = true;
      ambiguityReason = ambiguityReason ? `${ambiguityReason} Invalid transaction amount.` : 'Invalid transaction amount.';
    }

    const { id: categoryId, name: categoryName } = await guessCategory(description, customerId);

    rows.push({
      date: normalizedDate || new Date().toISOString().split('T')[0],
      description: description || 'Bank Transaction',
      rawDescription: JSON.stringify(record),
      amount: finalAmount || 0,
      type,
      categoryId,
      categoryName,
      balanceAfter,
      isAmbiguous,
      ambiguityReason,
    });
  }

  const validRowsCount = rows.filter((r) => !r.isAmbiguous).length;
  const ambiguousRowsCount = rows.filter((r) => r.isAmbiguous).length;

  return {
    success: rows.length > 0 && validRowsCount > 0,
    rows,
    totalRowsParsed: rows.length,
    validRowsCount,
    ambiguousRowsCount,
    errors,
    detectedProvider,
    detectedCurrency,
  };
}

/**
 * Parse Excel (XLSX, XLS) Statement with multi-sheet inspection, header autodetection,
 * and support for serial dates, formulas, merged cells, and separate/single amount columns.
 */
export async function parseExcelStatement(buffer: Buffer, customerId: string): Promise<ParseResult> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      cellNF: true,
      cellFormula: true,
    });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (/password|encrypt/i.test(msg)) {
      return {
        success: false,
        rows: [],
        totalRowsParsed: 0,
        validRowsCount: 0,
        ambiguousRowsCount: 0,
        errors: ['Password-protected or encrypted workbook. Please decrypt or upload an unprotected statement.'],
      };
    }
    return {
      success: false,
      rows: [],
      totalRowsParsed: 0,
      validRowsCount: 0,
      ambiguousRowsCount: 0,
      errors: [`Corrupted or unsupported Excel workbook: ${msg}`],
    };
  }

  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    return {
      success: false,
      rows: [],
      totalRowsParsed: 0,
      validRowsCount: 0,
      ambiguousRowsCount: 0,
      errors: ['Excel document does not contain any sheets.'],
    };
  }

  // Multi-sheet density scoring to find the primary transaction worksheet
  const EXCLUDED_KEYWORDS = ['summary', 'instruction', 'terms', 'condition', 'cover', 'about', 'legend', 'disclaimer', 'faq', 'notes'];
  const TRANSACTION_KEYWORDS = ['date', 'amount', 'narration', 'particulars', 'description', 'debit', 'credit', 'withdrawal', 'deposit', 'balance', 'utr', 'upi', 'phonepe', 'txn'];

  const allReports: SheetReportItem[] = [];

  for (const name of sheetNames) {
    const ws = workbook.Sheets[name];
    if (!ws) continue;
    const raw2D = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, defval: '' });

    if (!raw2D || raw2D.length === 0) {
      allReports.push({
        sheetName: name,
        score: -100,
        rowCount: 0,
        validDateCount: 0,
        amountCount: 0,
        isCandidate: false,
        reason: 'Worksheet is completely empty.',
      });
      continue;
    }

    const normName = name.toLowerCase().trim();
    const isExcludedName = EXCLUDED_KEYWORDS.some((kw) => normName.includes(kw));

    let dateCount = 0;
    let amtCount = 0;
    let keywordHits = 0;

    const sampleLimit = Math.min(raw2D.length, 100);
    for (let r = 0; r < sampleLimit; r++) {
      const row = raw2D[r];
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        if (cell === undefined || cell === null || cell === '') continue;
        if (normalizeDate(cell)) dateCount++;
        const pAmt = parseCurrencyAmount(cell);
        if (pAmt && pAmt.amount > 0) amtCount++;
        const strVal = String(cell).toLowerCase();
        if (TRANSACTION_KEYWORDS.some((k) => strVal.includes(k))) keywordHits++;
      }
    }

    let penalty = 0;
    if (isExcludedName) penalty += 50;
    if (dateCount === 0) penalty += 40;
    if (amtCount === 0) penalty += 40;

    const score = dateCount * 2 + amtCount * 2 + keywordHits * 3 - penalty;
    const isCandidate = dateCount > 0 && amtCount > 0 && score > 0;

    allReports.push({
      sheetName: name,
      score,
      rowCount: raw2D.length,
      validDateCount: dateCount,
      amountCount: amtCount,
      isCandidate,
      reason: `Found ${dateCount} dates, ${amtCount} amounts, ${keywordHits} keyword hits across ${raw2D.length} rows.`,
    });
  }

  // Sort descending by score
  allReports.sort((a, b) => b.score - a.score);
  const bestSheet = allReports[0];

  if (!bestSheet || bestSheet.score <= -50 || bestSheet.rowCount === 0) {
    return {
      success: false,
      rows: [],
      totalRowsParsed: 0,
      validRowsCount: 0,
      ambiguousRowsCount: 0,
      allSheetsReport: allReports,
      errors: ['No transaction tables found in any worksheet of this Excel workbook.'],
    };
  }

  const selectedSheetName = bestSheet.sheetName;
  const otherCandidates = allReports.filter((r) => r.sheetName !== selectedSheetName && r.isCandidate);
  const sheetSelectionReason = otherCandidates.length > 0
    ? `Selected worksheet "${selectedSheetName}" with highest transaction density (score ${bestSheet.score}). Detected ${otherCandidates.length} other sheet(s) with data: ${otherCandidates.map((c) => c.sheetName).join(', ')}.`
    : `Selected worksheet "${selectedSheetName}" (score ${bestSheet.score}).`;

  const sheet = workbook.Sheets[selectedSheetName];
  const rowsRaw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, blankrows: false, defval: '' });

  // Autodetect header row in top 35 rows
  let headerRowIndex = -1;
  let colDate = -1;
  let colDesc = -1;
  let colDebit = -1;
  let colCredit = -1;
  let colAmount = -1;
  let colBalance = -1;
  let colType = -1;
  let colRef = -1;

  const DATE_ALIASES = ['date', 'txn date', 'transaction date', 'value date', 'posting date', 'post date', 'trans date', 'effective date', 'date & time', 'time', 'tran date'];
  const DESC_ALIASES = ['particulars', 'narration', 'transaction details', 'details', 'description', 'paid to', 'payment to', 'sent to', 'received from', 'memo', 'merchant', 'payee', 'name', 'remarks', 'purpose', 'beneficiary', 'chq/ref no & description', 'narrative'];
  const DEBIT_ALIASES = ['debit', 'withdrawal', 'withdrawal (dr)', 'debit (dr)', 'dr', 'debit amount', 'money out', 'spent', 'charge', 'withdrawal amt', 'debit (inr)', 'debit(inr)', 'debit (₹)'];
  const CREDIT_ALIASES = ['credit', 'deposit', 'deposit (cr)', 'credit (cr)', 'cr', 'credit amount', 'money in', 'received', 'deposit amt', 'credit (inr)', 'credit(inr)', 'credit (₹)'];
  const AMOUNT_ALIASES = ['amount', 'net amount', 'transaction amount', 'amount (inr)', 'amount(inr)', 'amount (₹)', 'amount(₹)', 'txn amount', 'total amount', 'amount (rs)', 'amount(rs)'];
  const BALANCE_ALIASES = ['closing balance', 'available balance', 'balance', 'running balance', 'bal', 'balance (inr)', 'balance (₹)', 'account balance'];
  const TYPE_ALIASES = ['type', 'transaction type', 'cr/dr', 'dr/cr', 'status/type', 'payment type', 'direction'];
  const REF_ALIASES = ['utr', 'utr no', 'chq no', 'cheque no', 'chq/ref no', 'chq / ref no', 'reference', 'ref no', 'txn id', 'transaction id'];

  const matchAlias = (cellStr: string, aliases: string[]) => {
    const s = cellStr.toLowerCase().trim();
    return aliases.some((a) => s === a || s.startsWith(`${a} `) || s.endsWith(` ${a}`));
  };

  for (let r = 0; r < Math.min(rowsRaw.length, 35); r++) {
    const row = rowsRaw[r];
    if (!Array.isArray(row)) continue;

    let dCol = -1;
    let descC = -1;
    let drCol = -1;
    let crCol = -1;
    let amtCol = -1;
    let balCol = -1;
    let typCol = -1;
    let refCol = -1;

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').trim();
      if (!cell) continue;

      if (dCol === -1 && matchAlias(cell, DATE_ALIASES)) dCol = c;
      else if (descC === -1 && matchAlias(cell, DESC_ALIASES)) descC = c;
      else if (drCol === -1 && matchAlias(cell, DEBIT_ALIASES)) drCol = c;
      else if (crCol === -1 && matchAlias(cell, CREDIT_ALIASES)) crCol = c;
      else if (amtCol === -1 && matchAlias(cell, AMOUNT_ALIASES)) amtCol = c;
      else if (balCol === -1 && matchAlias(cell, BALANCE_ALIASES)) balCol = c;
      else if (typCol === -1 && matchAlias(cell, TYPE_ALIASES)) typCol = c;
      else if (refCol === -1 && matchAlias(cell, REF_ALIASES)) refCol = c;
    }

    if (dCol !== -1 && (drCol !== -1 || crCol !== -1 || amtCol !== -1 || descC !== -1)) {
      headerRowIndex = r;
      colDate = dCol;
      colDesc = descC;
      colDebit = drCol;
      colCredit = crCol;
      colAmount = amtCol;
      colBalance = balCol;
      colType = typCol;
      colRef = refCol;
      break;
    }
  }

  // Fallback if header wasn't matched explicitly: fallback to CSV parser
  if (headerRowIndex === -1 || colDate === -1) {
    const csvFallback = Papa.unparse(rowsRaw);
    return parseCsvStatement(csvFallback, customerId);
  }

  const rows: ExtractedTransactionRow[] = [];
  const errors: string[] = [];

  for (let r = headerRowIndex + 1; r < rowsRaw.length; r++) {
    const row = rowsRaw[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Check if empty row
    const nonBlank = row.filter((c) => c !== undefined && c !== null && String(c).trim() !== '');
    if (nonBlank.length === 0) continue;

    // Check repeated header row
    const firstCellStr = String(row[colDate] || '').toLowerCase().trim();
    if (DATE_ALIASES.includes(firstCellStr)) continue;

    // Check summary or disclaimer row
    const fullRowStr = row.map((c) => String(c || '').trim()).join(' ');
    if (isMetadataOrSummaryRow(fullRowStr)) {
      continue;
    }

    const rawDateVal = row[colDate];
    const normalizedDate = normalizeDate(rawDateVal);

    const descVal = colDesc !== -1 && row[colDesc] !== undefined ? String(row[colDesc]).trim() : '';
    const description = descVal || 'Bank Transaction';

    let type: 'debit' | 'credit' = 'debit';
    let finalAmount: number | null = null;
    let isAmbiguous = false;
    let ambiguityReason: string | undefined;

    // Separate Debit and Credit columns
    if (colDebit !== -1 && row[colDebit] !== undefined && String(row[colDebit]).trim() !== '') {
      const pDr = parseCurrencyAmount(row[colDebit]);
      if (pDr && pDr.amount > 0) {
        type = 'debit';
        finalAmount = pDr.amount;
      }
    }

    if (colCredit !== -1 && row[colCredit] !== undefined && String(row[colCredit]).trim() !== '') {
      const pCr = parseCurrencyAmount(row[colCredit]);
      if (pCr && pCr.amount > 0) {
        type = 'credit';
        finalAmount = pCr.amount;
      }
    }

    // Single Amount column
    if (finalAmount === null && colAmount !== -1 && row[colAmount] !== undefined) {
      const pAmt = parseCurrencyAmount(row[colAmount]);
      if (pAmt) {
        finalAmount = pAmt.amount;
        if (pAmt.isNegative) {
          type = 'debit';
        } else if (colType !== -1 && row[colType]) {
          const t = String(row[colType]).toLowerCase().trim();
          type = t.includes('cr') || t.includes('credit') || t.includes('dep') || t.includes('income') || t.includes('refund') || t.includes('received') ? 'credit' : 'debit';
        } else {
          const descLower = description.toLowerCase();
          if (descLower.startsWith('received from') || descLower.includes('refund from') || descLower.includes('cashback') || descLower.includes('salary')) {
            type = 'credit';
          } else {
            type = 'debit';
          }
        }
      }
    }

    // Running Balance
    let balanceAfter: number | undefined;
    if (colBalance !== -1 && row[colBalance] !== undefined && String(row[colBalance]).trim() !== '') {
      const pBal = parseCurrencyAmount(row[colBalance]);
      if (pBal) {
        balanceAfter = pBal.isNegative ? -pBal.amount : pBal.amount;
      }
    }

    // Reference
    const reference = colRef !== -1 && row[colRef] !== undefined ? String(row[colRef]).trim() : null;

    if (isMetadataOrSummaryRow(description)) {
      isAmbiguous = true;
      ambiguityReason = 'Opening or closing balance row recorded as statement metadata, excluded from transactions.';
    }

    if (!normalizedDate) {
      isAmbiguous = true;
      ambiguityReason = 'Unparseable or missing transaction date.';
    }

    if (!finalAmount || finalAmount <= 0) {
      isAmbiguous = true;
      ambiguityReason = ambiguityReason ? `${ambiguityReason} Invalid transaction amount.` : 'Invalid transaction amount.';
    }

    const { id: categoryId, name: categoryName } = await guessCategory(description, customerId);

    rows.push({
      date: normalizedDate || new Date().toISOString().split('T')[0],
      description,
      rawDescription: JSON.stringify(row),
      amount: finalAmount || 0,
      type,
      categoryId,
      categoryName,
      balanceAfter,
      reference,
      isAmbiguous,
      ambiguityReason,
    });
  }

  const validRowsCount = rows.filter((r) => !r.isAmbiguous).length;
  const ambiguousRowsCount = rows.filter((r) => r.isAmbiguous).length;

  const sampleText = [selectedSheetName, ...sheetNames, ...rowsRaw.slice(0, 25).map((r) => Array.isArray(r) ? r.join(' ') : '')].join(' ');
  const { provider: detectedProvider, currency: detectedCurrency } = detectDocumentProviderAndCurrency(sampleText);

  return {
    success: rows.length > 0 && validRowsCount > 0,
    rows,
    totalRowsParsed: rows.length,
    validRowsCount,
    ambiguousRowsCount,
    errors,
    selectedSheet: selectedSheetName,
    sheetSelectionReason,
    allSheetsReport: allReports,
    detectedProvider,
    detectedCurrency,
  };
}

/**
 * Parse Digital PDF Bank Statement across multiple pages.
 * Supports multi-line narrations, wrapped rows, page headers/footers,
 * Indian currency formats (1,12,151.00), running balance tracking, and scanned PDF detection.
 */
export async function parsePdfStatement(buffer: Buffer, customerId: string): Promise<ParseResult> {
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: buffer });
    const textRes = await parser.getText({ cellSeparator: '\t', lineEnforce: true });

    // Scanned / Image-Only PDF Detection
    // If the PDF contains pages but has virtually no text characters (< 25 characters total across the document)
    const totalPages = textRes.total || (textRes.pages ? textRes.pages.length : 1);
    const pageTextCombined = (textRes.pages && textRes.pages.length > 0 ? textRes.pages.map((p) => p.text || '').join(' ') : (textRes.text || ''))
      .replace(/--\s*\d+\s+of\s+\d+\s*--/g, '')
      .trim();
    const nonWhitespaceCount = pageTextCombined.replace(/\s+/g, '').length;

    if (totalPages > 0 && nonWhitespaceCount < 25) {
      return {
        success: false,
        rows: [],
        totalRowsParsed: 0,
        validRowsCount: 0,
        ambiguousRowsCount: 0,
        isScannedPdf: true,
        errors: [
          'Scanned or image-only PDF detected. This document requires Optical Character Recognition (OCR) to extract transactions, which is not supported in the standard digital extractor. Please upload a digital text-based statement or an Excel/CSV export.',
        ],
      };
    }

    const rows: ExtractedTransactionRow[] = [];
    const DATE_START_REGEX = /^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/;
    const REFINED_AMOUNT_REGEX = /(?:(?:₹|\$|€|£|Rs\.?\s*)?\(?-?\d{1,3}(?:,\d{2,3})*\.\d{2}\)?(?:\s*(?:CR|DR|cr|dr))?|(?:₹|\$|€|£|Rs\.?\s*)\(?-?\d{1,3}(?:,\d{2,3})*\)?(?:\s*(?:CR|DR|cr|dr))?)/g;

    const HEADER_OR_FOOTER_REGEX = /^(?:page\s+\d+|--\s*\d+\s+of\s+\d+\s*--|date\s+narration|statement\s+of|total\s+debits?|total\s+credits?|end\s+of\s+statement|account\s*:|statement\s+period)/i;

    let previousRunningBalance: number | null = null;

    interface PendingTx {
      date: string;
      description: string;
      rawLine: string;
      amounts: string[];
      isMetadata: boolean;
    }

    const pendingTransactions: PendingTx[] = [];
    let currentPending: PendingTx | null = null;

    // Process page by page
    const pages = textRes.pages && textRes.pages.length > 0 ? textRes.pages : [{ num: 1, text: textRes.text }];

    for (const page of pages) {
      const lines = (page.text || '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      for (const line of lines) {
        // Skip obvious page headers/footers
        if (HEADER_OR_FOOTER_REGEX.test(line)) {
          continue;
        }

        // Check if line starts with a date
        const dateMatch = line.match(DATE_START_REGEX);
        if (dateMatch) {
          if (currentPending) {
            pendingTransactions.push(currentPending);
            currentPending = null;
          }

          const rawDate = dateMatch[1];
          const isMetadata = isMetadataOrSummaryRow(line);

          // Extract amounts from line
          const matchedAmounts: string[] = [];
          let m;
          while ((m = REFINED_AMOUNT_REGEX.exec(line)) !== null) {
            matchedAmounts.push(m[0].trim());
          }

          // Strip date and amounts from line to extract narration
          let narration = line.substring(dateMatch[0].length).trim();
          for (const amt of matchedAmounts) {
            narration = narration.replace(amt, ' ');
          }
          narration = narration.replace(/\s+/g, ' ').trim();

          currentPending = {
            date: rawDate,
            description: narration || 'PDF Bank Transaction',
            rawLine: line,
            amounts: matchedAmounts,
            isMetadata,
          };
        } else if (currentPending) {
          // Wrapped continuation line (multi-line description)
          // If the line is not a summary or footer, append to current pending transaction narration
          if (!isMetadataOrSummaryRow(line)) {
            // Also check if any amounts were on this continuation line
            const continuationAmounts: string[] = [];
            let cm;
            while ((cm = REFINED_AMOUNT_REGEX.exec(line)) !== null) {
              continuationAmounts.push(cm[0].trim());
            }

            let cleanedContinuation = line;
            for (const ca of continuationAmounts) {
              cleanedContinuation = cleanedContinuation.replace(ca, ' ');
            }
            cleanedContinuation = cleanedContinuation.replace(/\s+/g, ' ').trim();

            if (cleanedContinuation) {
              currentPending.description += ' ' + cleanedContinuation;
              currentPending.description = currentPending.description.replace(/\s+/g, ' ').trim();
            }

            if (continuationAmounts.length > 0) {
              currentPending.amounts.push(...continuationAmounts);
            }
          }
        }
      }

      if (currentPending) {
        pendingTransactions.push(currentPending);
        currentPending = null;
      }
    }

    // Now resolve each transaction row with amounts, direction, and balance
    for (const pending of pendingTransactions) {
      if (pending.isMetadata) {
        // Skip or mark as ambiguous opening/closing balance
        continue;
      }

      const normalizedDate = normalizeDate(pending.date);
      let txAmount: number | null = null;
      let balanceAfter: number | undefined;
      let type: 'debit' | 'credit' = 'debit';
      let isAmbiguous = false;
      let ambiguityReason: string | undefined;

      const parsedAmounts = pending.amounts.map((a) => parseCurrencyAmount(a)).filter((a): a is { amount: number; isNegative: boolean } => a !== null && a.amount > 0);

      if (parsedAmounts.length >= 2) {
        // Typically [Amount, RunningBalance]
        const first = parsedAmounts[0];
        const last = parsedAmounts[parsedAmounts.length - 1];

        txAmount = first.amount;
        balanceAfter = last.amount;

        // Determine Debit vs Credit
        if (first.isNegative) {
          type = 'debit';
        } else if (pending.rawLine.toUpperCase().includes(' CR') || pending.rawLine.toUpperCase().includes('CREDIT')) {
          type = 'credit';
        } else if (pending.rawLine.toUpperCase().includes(' DR') || pending.rawLine.toUpperCase().includes('DEBIT')) {
          type = 'debit';
        } else if (previousRunningBalance !== null && balanceAfter !== undefined) {
          // Mathematical balance reconciliation
          const diff = Number((balanceAfter - previousRunningBalance).toFixed(2));
          if (Math.abs(diff - txAmount) < 0.05) {
            type = 'credit'; // Balance increased by amount
          } else if (Math.abs(diff + txAmount) < 0.05) {
            type = 'debit'; // Balance decreased by amount
          } else {
            // Keyword check
            const descLower = pending.description.toLowerCase();
            type = descLower.includes('salary') || descLower.includes('credit') || descLower.includes('deposit') || descLower.includes('refund') || descLower.includes('received') ? 'credit' : 'debit';
          }
        } else {
          const descLower = pending.description.toLowerCase();
          type = descLower.includes('salary') || descLower.includes('credit') || descLower.includes('deposit') || descLower.includes('refund') || descLower.includes('received') ? 'credit' : 'debit';
        }

        previousRunningBalance = balanceAfter;
      } else if (parsedAmounts.length === 1) {
        const first = parsedAmounts[0];
        txAmount = first.amount;
        type = first.isNegative ? 'debit' : 'debit';
        if (pending.rawLine.toUpperCase().includes(' CR') || pending.rawLine.toUpperCase().includes('CREDIT')) {
          type = 'credit';
        }
      }

      if (!normalizedDate) {
        isAmbiguous = true;
        ambiguityReason = 'Unparseable or missing transaction date.';
      }

      if (!txAmount || txAmount <= 0) {
        isAmbiguous = true;
        ambiguityReason = ambiguityReason ? `${ambiguityReason} Invalid transaction amount.` : 'Invalid transaction amount.';
      }

      const { id: categoryId, name: categoryName } = await guessCategory(pending.description, customerId);

      rows.push({
        date: normalizedDate || new Date().toISOString().split('T')[0],
        description: pending.description || 'PDF Bank Transaction',
        rawDescription: pending.rawLine,
        amount: txAmount || 0,
        type,
        categoryId,
        categoryName,
        balanceAfter,
        isAmbiguous,
        ambiguityReason,
      });
    }

    const validRowsCount = rows.filter((r) => !r.isAmbiguous).length;
    const ambiguousRowsCount = rows.filter((r) => r.isAmbiguous).length;

    if (rows.length === 0 || validRowsCount === 0) {
      return {
        success: false,
        rows: [],
        totalRowsParsed: 0,
        validRowsCount: 0,
        ambiguousRowsCount: 0,
        errors: [
          'Unsupported statement layout: Unable to identify standard date and transaction columns. The original document has been preserved in your private vault for retry.',
        ],
      };
    }

    const { provider: detectedProvider, currency: detectedCurrency } = detectDocumentProviderAndCurrency(pageTextCombined);

    return {
      success: true,
      rows,
      totalRowsParsed: rows.length,
      validRowsCount,
      ambiguousRowsCount,
      errors: [],
      detectedProvider,
      detectedCurrency,
    };
  } catch (err: any) {
    return {
      success: false,
      rows: [],
      totalRowsParsed: 0,
      validRowsCount: 0,
      ambiguousRowsCount: 0,
      errors: [`PDF extraction error: ${err.message || String(err)}`],
    };
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {});
    }
  }
}
