/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CanonicalTransaction,
  CategoryName,
  PaymentMethod,
} from './types.ts';
import { RawExtractedTransaction } from './parser.ts';
import { extractPhonePeDetails } from './parsers/phonepe.ts';

interface CategorizationRule {
  category: CategoryName;
  keywords: string[];
  merchants?: string[];
  confidence: number;
}

const CATEGORY_RULES: CategorizationRule[] = [
  {
    category: 'Salary',
    keywords: ['salary', 'payroll', 'wages', 'stipend', 'monthly compensation', 'corporate payout', 'endowments officer'],
    merchants: ['techcorp', 'infosys', 'tcs', 'wipro', 'google', 'microsoft', 'accenture'],
    confidence: 0.95,
  },
  {
    category: 'Food & Dining',
    keywords: ['swiggy', 'zomato', 'restaurant', 'cafe', 'starbucks', 'mcdonalds', 'kfc', 'burger king', 'pizza', 'eats', 'dining', 'bakery', 'sweets', 'hotel', 'mess', 'canteen'],
    merchants: ['swiggy', 'zomato', 'starbucks', 'dominos', 'chaayos'],
    confidence: 0.9,
  },
  {
    category: 'Groceries',
    keywords: ['blinkit', 'zepto', 'instamart', 'bigbasket', 'dmart', 'nature basket', 'supermarket', 'grocery', 'reliance fresh', 'kirana', 'spencer', 'rice', 'provisions', 'flour', 'dairy', 'milk', 'vegetables', 'fruits', 'vijayalakshmi rice', 'super market'],
    merchants: ['blinkit', 'zepto', 'instamart', 'bigbasket', 'dmart', 'vijayalakshmi rice'],
    confidence: 0.9,
  },
  {
    category: 'Fuel',
    keywords: ['fuel', 'petrol', 'diesel', 'hpcl', 'bpcl', 'ioc', 'indian oil', 'bharat petroleum', 'shell', 'cng'],
    merchants: ['indian oil', 'hp petrol', 'bharat petroleum', 'shell'],
    confidence: 0.9,
  },
  {
    category: 'Transport',
    keywords: ['uber', 'ola', 'rapido', 'metro', 'irctc', 'railway', 'toll', 'fastag', 'cab', 'auto', 'apsrtc', 'tsrtc', 'bus', 'travel', 'redbus'],
    merchants: ['uber', 'ola', 'rapido', 'fastag', 'irctc', 'apsrtc'],
    confidence: 0.9,
  },
  {
    category: 'Shopping',
    keywords: ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'zara', 'h&m', 'retail', 'clothing', 'electronics', 'croma', 'reliance digital', 'store', 'cloth', 'footwear', 'mart'],
    merchants: ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'croma'],
    confidence: 0.85,
  },
  {
    category: 'Medical',
    keywords: ['pharmacy', 'hospital', 'clinic', 'apollo', 'medplus', '1mg', 'pharmeasy', 'doctor', 'diagnostic', 'dr lal', 'srikara', 'topstars', 'healthcare', 'medical', 'dental', 'chemist', 'lab'],
    merchants: ['apollo', 'pharmeasy', '1mg', 'medplus', 'srikara', 'topstars'],
    confidence: 0.88,
  },
  {
    category: 'Utilities',
    keywords: ['electricity', 'water bill', 'gas bill', 'bescom', 'tata power', 'adani electricity', 'piped gas', 'utility', 'broadband', 'act fibernet', 'airtel broadband', 'discom', 'bbps', 'bill desk'],
    merchants: ['bescom', 'tata power', 'mahavitaran', 'adani electricity', 'act fibernet'],
    confidence: 0.9,
  },
  {
    category: 'Recharge',
    keywords: ['recharge', 'mobile recharge', 'airtel prepaid', 'jio prepaid', 'vi prepaid', 'dth', 'tata sky', 'airtel recharge', 'jio recharge', 'vodafone idea', 'prepaid'],
    merchants: ['jio', 'airtel', 'vodafone idea', 'tata play'],
    confidence: 0.9,
  },
  {
    category: 'Entertainment',
    keywords: ['netflix', 'spotify', 'prime video', 'hotstar', 'disney', 'youtube premium', 'bookmyshow', 'cinema', 'pvr', 'inox', 'apple media', 'google play', 'google india digital', 'google india service', 'games'],
    merchants: ['netflix', 'spotify', 'hotstar', 'bookmyshow', 'pvr', 'google play', 'google india digital'],
    confidence: 0.92,
  },
  {
    category: 'Investment',
    keywords: ['zerodha', 'groww', 'mutual fund', 'sip', 'kuvera', 'et money', 'coin', 'bse', 'nse', 'camsonline', 'kfintech', 'upstox', 'smallcase', 'sebi', 'dividend', 'itc limited', 'itc hotels', 'int.pd', 'interest'],
    merchants: ['zerodha', 'groww', 'kuvera', 'camsonline', 'uti amc', 'hdfc mutual fund', 'itc hotels', 'itc limited'],
    confidence: 0.92,
  },
  {
    category: 'Insurance',
    keywords: ['lic', 'insurance', 'hdfc life', 'icici prudential', 'max life', 'star health', 'care health', 'premium', 'pmsby', 'pmjjby', 'tagic', 'policy'],
    merchants: ['lic', 'hdfc life', 'star health', 'icici pru', 'tagic'],
    confidence: 0.9,
  },
  {
    category: 'Travel',
    keywords: ['flight', 'air india', 'indigo', 'spicejet', 'vistara', 'makemytrip', 'goibibo', 'cleartrip', 'hotel booking', 'booking.com', 'agoda', 'oyo', 'resort'],
    merchants: ['makemytrip', 'goibibo', 'indigo', 'air india', 'booking.com'],
    confidence: 0.9,
  },
  {
    category: 'Education',
    keywords: ['school', 'college', 'university', 'tuition', 'coaching', 'coursera', 'udemy', 'unacademy', 'allen', 'fiitjee', 'aakash', 'education fee', 'exam fee'],
    merchants: ['coursera', 'udemy', 'unacademy'],
    confidence: 0.9,
  },
  {
    category: 'Cash Withdrawal',
    keywords: ['atm wdl', 'atm withdrawal', 'cash withdrawal', 'nfs atm', 'cash-atm', 'atm-cash', 'atm'],
    merchants: ['atm'],
    confidence: 0.98,
  },
  {
    category: 'Rent',
    keywords: ['rent', 'house rent', 'flat rent', 'maintenance fee', 'society dues', 'landlord', 'nobroker', 'to-let'],
    merchants: ['nobroker', 'mygate'],
    confidence: 0.88,
  },
  {
    category: 'EMI',
    keywords: ['emi', 'loan emi', 'home loan', 'car loan', 'bajaj finance', 'bajaj fin', 'hdfc loan', 'axis finance', 'idfc first loan', 'creditcard payment', 'credit card payment', 'cred payment', 'cred', 'mandate', 'upi mand', 'ecs/utib'],
    merchants: ['bajaj finance', 'hdfc loan service', 'tvs credit', 'cred'],
    confidence: 0.9,
  },
  {
    category: 'Loan',
    keywords: ['personal loan', 'gold loan', 'varthana finance', 'varthana', 'muthoot', 'manappuram', 'microfinance', 'disbursement'],
    merchants: ['varthana finance', 'muthoot', 'manappuram'],
    confidence: 0.88,
  },
  {
    category: 'Tax',
    keywords: ['incometax', 'income tax', 'advance tax', 'property tax', 'gst', 'challan', 'cbic', 'direct tax', 'municipal tax'],
    merchants: ['incometax', 'cbic', 'gst'],
    confidence: 0.95,
  },
  {
    category: 'Transfer',
    keywords: ['self transfer', 'to own account', 'bank account xxxxx', 'regandla saivivek', 'regandla  saivivek', 'saptagiri', 'inward rtgs', 'rtgs', 'neft', 'imps', 'internal transfer'],
    merchants: [],
    confidence: 0.8,
  },
  {
    category: 'Others',
    keywords: ['decline chrgs', 'bounce chrgs', 'pos decline', 'si bounce', 'charges', 'gst on charges'],
    merchants: [],
    confidence: 0.9,
  },
];

/**
 * Normalizes description and extracts merchant, UPI handle, and payment method
 */
export function extractMerchantAndMethod(
  rawDesc: string,
  reference: string | null = null
): {
  merchant: string | null;
  upiHandle: string | null;
  paymentMethod: PaymentMethod;
  cleanDescription: string;
} {
  // Normalize newline formatting commonly present in raw statement lines
  const sanitizedDesc = (rawDesc || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();

  const phonePeInfo = extractPhonePeDetails(sanitizedDesc);
  let merchant = phonePeInfo.cleanMerchant;
  let upiHandle = phonePeInfo.upiHandle;
  let paymentMethod: PaymentMethod = 'other';

  const lower = sanitizedDesc.toLowerCase();

  // Determine payment method
  if (upiHandle || lower.includes('upi') || lower.includes('@')) {
    paymentMethod = 'upi';
  } else if (lower.includes('pos') || lower.includes('debit card') || lower.includes('credit card') || lower.includes('visa') || lower.includes('mastercard')) {
    paymentMethod = 'card';
  } else if (lower.includes('neft') || lower.includes('rtgs') || lower.includes('imps') || lower.includes('netbanking')) {
    paymentMethod = 'netbanking';
  } else if (lower.includes('atm') || lower.includes('cash wdl') || lower.includes('atm-cash')) {
    paymentMethod = 'atm';
  } else if (lower.includes('cheque') || lower.includes('chq')) {
    paymentMethod = 'cheque';
  }

  // If merchant was not extracted by PhonePe regex, try standard UPI / POS / Transfer patterns
  if (!merchant) {
    // Enhanced UPI slash pattern supporting P2M, P2A, P2P, DR, CR
    const upiSlashMatch = sanitizedDesc.match(/upi(?:\/(?:dr|cr|p2m|p2a|p2p))?\/[0-9a-z_-]+\/(?:pay\s+to\s+|payment\s+to\s+|sent\s+to\s+)?([a-zA-Z0-9\s&_.-]+?)(?:\/.*)?$/i);
    if (upiSlashMatch && upiSlashMatch[1]) {
      const candidate = upiSlashMatch[1].replace(/^[0-9_-]+/, '').trim();
      if (candidate.length > 2) {
        merchant = candidate;
      }
    }

    // UPI dash pattern: e.g. "UPI-123456789012-SWIGGY-HDFC"
    if (!merchant) {
      const upiDashMatch = sanitizedDesc.match(/upi-[0-9a-z_-]+-([a-zA-Z0-9\s&]+?)(?:-[a-zA-Z0-9\s]+)*$/i);
      if (upiDashMatch && upiDashMatch[1]) {
        merchant = upiDashMatch[1].trim();
      }
    }

    // BBPS pattern: e.g. "BBPS/123456789/AIRTEL BROADBAND"
    if (!merchant) {
      const bbpsMatch = sanitizedDesc.match(/bbps\/[0-9a-z_-]+\/([a-zA-Z0-9\s&.-]+)/i);
      if (bbpsMatch && bbpsMatch[1]) {
        merchant = bbpsMatch[1].trim();
      }
    }

    // POS pattern: e.g. "POS 123456 STARBUCKS COFFEE MUMBAI"
    if (!merchant) {
      const posMatch = sanitizedDesc.match(/pos(?:\s+\d+)?\s+([a-zA-Z0-9\s&]+?)(?:\s+in|\s+mumbai|\s+delhi|\s+blr|\s+dt)?$/i);
      if (posMatch) {
        merchant = posMatch[1].trim();
      }
    }

    // Credit Card bill payment pattern
    if (!merchant && (lower.includes('creditcard payment') || lower.includes('credit card payment'))) {
      merchant = 'Credit Card Payment';
    }

    // ECS / Loan pattern
    if (!merchant && lower.includes('bajaj finance')) {
      merchant = 'Bajaj Finance';
    }
  }

  if (!merchant && upiHandle) {
    // Infer merchant from handle: e.g. "swiggy@kotak" -> "Swiggy"
    const handlePrefix = upiHandle.split('@')[0];
    if (handlePrefix && handlePrefix.length > 2 && !/^\d+$/.test(handlePrefix)) {
      merchant = handlePrefix.charAt(0).toUpperCase() + handlePrefix.slice(1);
    }
  }

  // Curated merchant dictionary for high-precision recognition
  const CURATED_MERCHANTS: Record<string, string> = {
    swiggy: 'Swiggy',
    zomato: 'Zomato',
    blinkit: 'Blinkit',
    zepto: 'Zepto',
    instamart: 'Instamart',
    bigbasket: 'BigBasket',
    dmart: 'DMart',
    uber: 'Uber',
    ola: 'Ola Cabs',
    rapido: 'Rapido',
    irctc: 'IRCTC',
    apsrtc: 'APSRTC',
    amazon: 'Amazon',
    flipkart: 'Flipkart',
    myntra: 'Myntra',
    nykaa: 'Nykaa',
    ajio: 'Ajio',
    croma: 'Croma',
    netflix: 'Netflix',
    spotify: 'Spotify',
    hotstar: 'Disney+ Hotstar',
    prime: 'Amazon Prime',
    youtube: 'YouTube Premium',
    bookmyshow: 'BookMyShow',
    pvr: 'PVR Cinemas',
    inox: 'INOX',
    starbucks: 'Starbucks',
    mcdonald: "McDonald's",
    dominos: "Domino's Pizza",
    kfc: 'KFC',
    burgerking: 'Burger King',
    apollo: 'Apollo Pharmacy',
    medplus: 'MedPlus',
    topstars: 'Topstars Pharmacy',
    srikara: 'Srikara Hospitals',
    pharmeasy: 'PharmEasy',
    '1mg': 'Tata 1mg',
    bescom: 'BESCOM Electricity',
    airtel: 'Airtel',
    jio: 'Jio',
    vodafone: 'Vodafone Idea',
    tataplay: 'Tata Play',
    zerodha: 'Zerodha',
    groww: 'Groww',
    upstox: 'Upstox',
    cred: 'CRED',
    apple: 'Apple Store',
    google: 'Google Play',
    'bajaj fin': 'Bajaj Finance',
    'varthana': 'Varthana Finance',
    'vijayalakshmi rice': 'Vijayalakshmi Rice',
    'creditcard payment': 'Credit Card Payment',
    'itc hotels': 'ITC Hotels',
    'itc limited': 'ITC Limited',
  };

  // Apply curated merchant normalization dictionary
  const lookupCandidate = `${merchant || ''} ${lower}`.toLowerCase();
  for (const [key, cleanName] of Object.entries(CURATED_MERCHANTS)) {
    if (lookupCandidate.includes(key)) {
      merchant = cleanName;
      break;
    }
  }

  // Common known merchant matching if still empty
  if (!merchant) {
    for (const rule of CATEGORY_RULES) {
      if (rule.merchants) {
        for (const m of rule.merchants) {
          if (lower.includes(m.toLowerCase())) {
            merchant = m.charAt(0).toUpperCase() + m.slice(1);
            break;
          }
        }
      }
      if (merchant) break;
    }
  }

  // Clean presentation description:
  let cleanDescription = sanitizedDesc
    .replace(/^upi(?:\/(?:dr|cr|p2m|p2a|p2p))?\/[0-9a-z_-]+\//i, '')
    .replace(/^bbps\/[0-9a-z_-]+\//i, '')
    .replace(/^pos\s+\d+\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    merchant: merchant || null,
    upiHandle: upiHandle || null,
    paymentMethod,
    cleanDescription,
  };
}

export const normalizeMerchantDescription = (rawDesc: string, reference: string | null = null) =>
  extractMerchantAndMethod(rawDesc, reference);

/**
 * Categorizes a transaction based on description, direction, and merchant
 */
export function categorizeTransaction(
  description: string,
  merchant: string | null,
  direction: 'debit' | 'credit'
): { category: CategoryName; confidence: number; reviewRequired: boolean; reviewReason?: string } {
  const sanitized = (description || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = `${sanitized} ${merchant || ''}`.toLowerCase();

  // If it's a credit:
  if (direction === 'credit') {
    if (lower.includes('salary') || lower.includes('payroll') || lower.includes('corp pay') || lower.includes('stipend') || lower.includes('endowments officer')) {
      return { category: 'Salary', confidence: 0.98, reviewRequired: false };
    }
    if (lower.includes('cashback') || lower.includes('reward')) {
      return { category: 'Others', confidence: 0.9, reviewRequired: false };
    }
    if (lower.includes('refund')) {
      return { category: 'Shopping', confidence: 0.85, reviewRequired: false };
    }
    if (lower.includes('interest') || lower.includes('dividend') || lower.includes('int.pd') || lower.includes('ach-cr') || lower.includes('itc')) {
      return { category: 'Investment', confidence: 0.92, reviewRequired: false };
    }
    return { category: 'Transfer', confidence: 0.75, reviewRequired: false };
  }

  // Debit flow: match against predefined rules in prioritized order
  for (const rule of CATEGORY_RULES) {
    // 1. Check merchant exact hit
    if (merchant && rule.merchants) {
      const lowerMerchant = merchant.toLowerCase();
      if (rule.merchants.some((m) => lowerMerchant.includes(m.toLowerCase()))) {
        return { category: rule.category, confidence: rule.confidence, reviewRequired: false };
      }
    }

    // 2. Check keyword hits
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        return { category: rule.category, confidence: rule.confidence, reviewRequired: false };
      }
    }
  }

  // Default fallback for debit peer transfers
  if (lower.includes('upi') || lower.includes('@')) {
    return {
      category: 'UPI',
      confidence: 0.65,
      reviewRequired: false,
    };
  }

  return {
    category: 'Others',
    confidence: 0.5,
    reviewRequired: true,
    reviewReason: 'Unrecognized merchant or transaction description',
  };
}

/**
 * Normalizes a single raw transaction into canonical model
 */
export function normalizeTransaction(
  raw: {
    date: string;
    description: string;
    rawAmount?: string | number;
    amount?: number;
    direction?: 'debit' | 'credit';
    reference?: string | null;
  },
  _currency = 'INR'
): CanonicalTransaction | null {
  const amt = typeof raw.amount === 'number' ? raw.amount : parseFloat(String(raw.rawAmount || '0').replace(/[^0-9.]/g, ''));
  if (isNaN(amt) || amt <= 0) return null;

  const dir = raw.direction || 'debit';
  const { merchant, upiHandle, paymentMethod, cleanDescription } = extractMerchantAndMethod(raw.description, raw.reference || null);
  const { category, confidence, reviewRequired, reviewReason } = categorizeTransaction(cleanDescription, merchant, dir);

  return {
    id: `tx-canon-single-${Date.now()}`,
    date: raw.date,
    description: cleanDescription,
    originalDescription: raw.description,
    amount: amt,
    debit: dir === 'debit' ? amt : 0,
    credit: dir === 'credit' ? amt : 0,
    balance: null,
    reference: raw.reference || null,
    merchant,
    upiHandle,
    paymentMethod,
    category,
    direction: dir,
    confidence,
    reviewRequired,
    reviewReason,
    sourceFile: 'statement.xlsx',
    sourceSheet: 'Sheet1',
    sourceRow: 1,
    isDuplicate: false,
    isSuspectedDuplicate: false,
  };
}

/**
 * Normalizes all extracted transactions into canonical models and performs deduplication
 */
export function normalizeTransactions(
  rawList: RawExtractedTransaction[],
  fileName: string,
  sheetName: string
): {
  transactions: CanonicalTransaction[];
  duplicateCount: number;
  suspectedDuplicateCount: number;
  lowConfidenceCategoryCount: number;
} {
  const seenExactHashes = new Set<string>();
  const seenSuspectedKeys = new Set<string>();

  let duplicateCount = 0;
  let suspectedDuplicateCount = 0;
  let lowConfidenceCategoryCount = 0;

  const transactions: CanonicalTransaction[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i];
    const { merchant, upiHandle, paymentMethod, cleanDescription } = extractMerchantAndMethod(
      raw.originalDescription,
      raw.reference
    );

    const { category, confidence, reviewRequired, reviewReason } = categorizeTransaction(
      raw.originalDescription,
      merchant,
      raw.direction
    );

    if (confidence < 0.6) {
      lowConfidenceCategoryCount++;
    }

    // Exact deduplication signature: date + amount + direction + normalized description + ref
    const exactSignature = `${raw.dateStr}_${raw.amount.toFixed(2)}_${raw.direction}_${raw.originalDescription.trim().toLowerCase()}_${raw.reference || ''}`;
    const isDuplicate = seenExactHashes.has(exactSignature);
    if (isDuplicate) {
      duplicateCount++;
    } else {
      seenExactHashes.add(exactSignature);
    }

    // Suspected duplicate signature: date + amount + merchant
    const suspectedSignature = `${raw.dateStr}_${raw.amount.toFixed(2)}_${merchant || 'none'}`;
    let isSuspectedDuplicate = false;
    if (seenSuspectedKeys.has(suspectedSignature) && !isDuplicate) {
      isSuspectedDuplicate = true;
      suspectedDuplicateCount++;
    } else {
      seenSuspectedKeys.add(suspectedSignature);
    }

    const tx: CanonicalTransaction = {
      id: `tx-canon-${Date.now().toString(36)}-${i + 1}`,
      date: raw.dateStr,
      description: cleanDescription,
      originalDescription: raw.originalDescription, // CRITICAL: strictly preserved unmodified
      amount: raw.amount,
      debit: raw.debit,
      credit: raw.credit,
      balance: raw.balance,
      reference: raw.reference,
      merchant,
      upiHandle,
      paymentMethod,
      category,
      direction: raw.direction,
      confidence,
      reviewRequired,
      reviewReason,
      sourceFile: fileName,
      sourceSheet: sheetName,
      sourceRow: raw.sourceRow,
      isDuplicate,
      isSuspectedDuplicate,
    };

    transactions.push(tx);
  }

  return {
    transactions,
    duplicateCount,
    suspectedDuplicateCount,
    lowConfidenceCategoryCount,
  };
}
