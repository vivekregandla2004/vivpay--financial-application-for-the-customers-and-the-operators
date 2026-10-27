/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DetectedProvider } from '../types.ts';

interface ProviderSignature {
  name: string;
  keywords: string[];
  headerTokens: string[];
  formatName: string;
  weight: number;
}

const PROVIDER_SIGNATURES: ProviderSignature[] = [
  {
    name: 'PhonePe',
    keywords: ['phonepe', 'phonepe private limited', 'transaction id', 'utr no', 'paid to', 'payment to', 'debit from'],
    headerTokens: ['transaction details', 'type', 'utr', 'utr no', 'txn id'],
    formatName: 'PhonePe Statement (Excel/CSV)',
    weight: 1.0,
  },
  {
    name: 'Google Pay',
    keywords: ['google pay', 'gpay', 'google india digital services', 'okhdfcbank', 'okaxis', 'oksbi', 'okicici', 'google transaction id'],
    headerTokens: ['google transaction id', 'transaction details', 'paid to', 'received from', 'status', 'amount'],
    formatName: 'Google Pay (GPay) Statement',
    weight: 0.95,
  },
  {
    name: 'Paytm',
    keywords: ['paytm', 'one97 communications', 'wallet txn id', 'order id'],
    headerTokens: ['wallet tx id', 'activity', 'source/destination'],
    formatName: 'Paytm Payments Bank / Wallet Statement',
    weight: 0.95,
  },
  {
    name: 'Amazon Pay',
    keywords: ['amazon pay', 'amazon seller services', 'amazon pay balance', 'amazonpay', 'apl/'],
    headerTokens: ['amazon pay transaction id', 'order id', 'activity', 'amount (inr)', 'payment method'],
    formatName: 'Amazon Pay Statement',
    weight: 0.95,
  },
  {
    name: 'HDFC',
    keywords: ['hdfc bank', 'hdfcbank', 'we understand your world', 'housing development finance'],
    headerTokens: ['narration', 'chq/ref no', 'value dt', 'withdrawal amt', 'deposit amt', 'closing balance'],
    formatName: 'HDFC Bank Account Statement',
    weight: 0.9,
  },
  {
    name: 'SBI',
    keywords: ['state bank of india', 'sbi', 'the banker to every indian', 'cif no', 'ifs code: sbin'],
    headerTokens: ['txn date', 'value date', 'description', 'ref no/cheque no', 'debit', 'credit', 'balance'],
    formatName: 'State Bank of India (SBI) Statement',
    weight: 0.9,
  },
  {
    name: 'ICICI',
    keywords: ['icici bank', 'khayaal aapka', 'icicibank', 'icic'],
    headerTokens: ['transaction remarks', 'cheque number', 'withdrawal amount (inr)', 'deposit amount (inr)', 'balance (inr)'],
    formatName: 'ICICI Bank Statement',
    weight: 0.9,
  },
  {
    name: 'Axis',
    keywords: ['axis bank', 'badhti ka naam zindagi', 'utib'],
    headerTokens: ['tran date', 'particulars', 'chq no', 'debit', 'credit', 'balance', 'init. br'],
    formatName: 'Axis Bank Statement',
    weight: 0.9,
  },
  {
    name: 'Kotak',
    keywords: ['kotak mahindra', 'kotak bank', 'kmb', 'kkbk'],
    headerTokens: ['transaction date', 'narration', 'chq / ref no', 'dr / cr', 'amount', 'balance'],
    formatName: 'Kotak Mahindra Bank Statement',
    weight: 0.9,
  },
  {
    name: 'PNB',
    keywords: ['punjab national bank', 'pnb', 'punb'],
    headerTokens: ['tran date', 'post date', 'particulars', 'cheque no', 'withdrawals', 'deposits', 'balance'],
    formatName: 'Punjab National Bank (PNB) Statement',
    weight: 0.9,
  },
  {
    name: 'Bank of Baroda',
    keywords: ['bank of baroda', 'bob', 'barb'],
    headerTokens: ['tran date', 'value date', 'particulars', 'chq no', 'debit', 'credit', 'balance'],
    formatName: 'Bank of Baroda Statement',
    weight: 0.9,
  },
  {
    name: 'Credit Card',
    keywords: ['credit card statement', 'credit card', 'card ending in', 'minimum amount due', 'minimum payment due', 'total amount due', 'payment due date', 'credit limit', 'available credit limit', 'statement date'],
    headerTokens: ['transaction date', 'posting date', 'transaction details', 'details', 'amount', 'ref no', 'reward points'],
    formatName: 'Credit Card Statement',
    weight: 0.92,
  },
];

/**
 * Detects the bank or payment provider from pre-header text and column headers
 */
export function detectProvider(
  metadataOrHeaders: string | string[],
  headersOrMetadata: string[] | string = [],
  sampleRows: any[][] = []
): DetectedProvider {
  let metadataText = '';
  let headers: string[] = [];

  if (Array.isArray(metadataOrHeaders)) {
    headers = metadataOrHeaders;
    metadataText = typeof headersOrMetadata === 'string' ? headersOrMetadata : '';
  } else {
    metadataText = String(metadataOrHeaders || '');
    headers = Array.isArray(headersOrMetadata) ? headersOrMetadata : [String(headersOrMetadata || '')];
  }

  const sampleStr = Array.isArray(sampleRows)
    ? sampleRows.slice(0, 10).map((r) => (Array.isArray(r) ? r.join(' ') : String(r || ''))).join(' ').toLowerCase()
    : String(sampleRows || '').toLowerCase();

  const combinedContext = [
    metadataText.toLowerCase(),
    headers.join(' ').toLowerCase(),
    sampleStr,
  ].join(' \n ');

  let bestMatch: { name: string; score: number; format: string } = {
    name: 'Generic',
    score: 0.2,
    format: 'Standard Bank / Financial Statement',
  };

  for (const sig of PROVIDER_SIGNATURES) {
    let score = 0;

    // Check pre-header and document text keywords
    for (const kw of sig.keywords) {
      if (combinedContext.includes(kw)) {
        score += 0.35;
      }
    }

    // Check specific header matches
    const joinedHeaders = headers.join(' ').toLowerCase();
    for (const token of sig.headerTokens) {
      if (joinedHeaders.includes(token)) {
        score += 0.25;
      }
    }

    score = Math.min(score * sig.weight, 0.99);

    if (score > bestMatch.score) {
      bestMatch = {
        name: sig.name,
        score: parseFloat(score.toFixed(2)),
        format: sig.formatName,
      };
    }
  }

  // Attempt to extract masked account number if present
  let accountNumberMasked: string | undefined;
  const accMatch = combinedContext.match(/(?:account(?:\s+no|\s+number)?|a\/c\s+no|card\s+ending\s+(?:in)?)[\s:]*([x*0-9]{4,18})/i);
  if (accMatch && accMatch[1]) {
    const rawAcc = accMatch[1].trim();
    if (rawAcc.length >= 4) {
      accountNumberMasked = '••' + rawAcc.slice(-4);
    }
  }

  // Currency inference based on provider and text context
  let detectedCurrency: string | undefined;
  const isIndianProvider = [
    'PhonePe',
    'Google Pay',
    'Paytm',
    'Amazon Pay',
    'HDFC',
    'SBI',
    'ICICI',
    'Axis',
    'Kotak',
    'PNB',
    'Bank of Baroda',
  ].includes(bestMatch.name);

  if (combinedContext.includes('₹') || combinedContext.includes('inr') || combinedContext.includes('rs.') || isIndianProvider) {
    detectedCurrency = 'INR';
  } else if (combinedContext.includes('€') || combinedContext.includes('eur')) {
    detectedCurrency = 'EUR';
  } else if (combinedContext.includes('£') || combinedContext.includes('gbp')) {
    detectedCurrency = 'GBP';
  } else if (combinedContext.includes('$') || combinedContext.includes('usd')) {
    detectedCurrency = 'USD';
  }

  return {
    name: bestMatch.name,
    confidence: bestMatch.score,
    format: bestMatch.format,
    accountNumberMasked,
    detectedCurrency,
  };
}
