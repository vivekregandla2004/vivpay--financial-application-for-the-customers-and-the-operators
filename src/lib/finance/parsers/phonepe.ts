/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TransactionDirection } from '../types.ts';

export interface PhonePeExtractedMeta {
  cleanMerchant: string | null;
  upiHandle: string | null;
  purpose: string | null;
  direction: TransactionDirection;
}

/**
 * Parses PhonePe narration strings like:
 * "Paid to Swiggy (UPI ID: swiggy@kotak)"
 * "Payment to Uber India (UTR: 329847293847)"
 * "Received from Rahul Sharma (UPI ID: rahul@oksbi)"
 * "Refund from Amazon Pay"
 */
export function extractPhonePeDetails(
  description: string,
  rawType?: string
): PhonePeExtractedMeta {
  const desc = (description || '').trim();
  const lowerDesc = desc.toLowerCase();

  let direction: TransactionDirection = 'debit';
  if (rawType) {
    const t = rawType.toLowerCase();
    if (t.includes('cr') || t.includes('credit') || t.includes('received')) {
      direction = 'credit';
    } else {
      direction = 'debit';
    }
  } else {
    if (
      lowerDesc.startsWith('received from') ||
      lowerDesc.includes('refund') ||
      lowerDesc.includes('cashback') ||
      lowerDesc.startsWith('credit')
    ) {
      direction = 'credit';
    }
  }

  // Extract UPI ID / VPA
  let upiHandle: string | null = null;
  const upiMatch = desc.match(/([a-zA-Z0-9.\-_]{2,50}@[a-zA-Z]{2,20})/);
  if (upiMatch) {
    upiHandle = upiMatch[1].toLowerCase();
  }

  // Extract Merchant Name
  let cleanMerchant: string | null = null;

  // Patterns: "Paid to <Merchant>", "Payment to <Merchant>", "Transfer to <Merchant>"
  const paidToMatch = desc.match(/(?:paid to|payment to|transfer to|sent to)\s+([^-(,\n]+)/i);
  if (paidToMatch) {
    cleanMerchant = paidToMatch[1].trim();
  } else {
    const recFromMatch = desc.match(/(?:received from|refund from)\s+([^-(,\n]+)/i);
    if (recFromMatch) {
      cleanMerchant = recFromMatch[1].trim();
    }
  }

  if (cleanMerchant) {
    // Strip trailing parentheses or reference numbers
    cleanMerchant = cleanMerchant.replace(/\s*\(.*$/, '').trim();
  }

  return {
    cleanMerchant,
    upiHandle,
    purpose: null,
    direction,
  };
}
