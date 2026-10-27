/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction } from '../../types/database.ts';
import { FinancialCommitments, IncomeInfo } from '../identity/types.ts';

export interface DetectedRecurringCandidate {
  id: string;
  category: string;
  detectedType: 'income' | 'rent' | 'loan' | 'sip' | 'insurance' | 'utility' | 'subscription';
  description: string;
  averageAmount: number;
  occurrences: number;
  lastDate: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ReconciliationComparison {
  declaredIncome: number;
  detectedIncome: number;
  incomeVariance: number;
  declaredCommitmentsTotal: number;
  detectedCommitmentsTotal: number;
  commitmentsVariance: number;
  detectedCandidates: DetectedRecurringCandidate[];
}

/**
 * Reconciles imported transactions with declared financial identity.
 * Strictly separates transaction evidence from user declaration.
 */
export function analyzeTransactionsForReconciliation(
  transactions: Transaction[],
  declaredIncome: IncomeInfo,
  declaredCommitments: FinancialCommitments
): ReconciliationComparison {
  const candidates: DetectedRecurringCandidate[] = [];

  // 1. Group credits by description keyword to detect income candidates
  const creditTxs = transactions.filter((t) => t.type === 'credit');
  const totalCreditVolume = creditTxs.reduce((sum, t) => sum + t.amount, 0);

  // Group salary or recurring deposit candidates
  const incomeGroup: Record<string, Transaction[]> = {};
  creditTxs.forEach((t) => {
    const key = t.description.toLowerCase().slice(0, 15);
    if (!incomeGroup[key]) incomeGroup[key] = [];
    incomeGroup[key].push(t);
  });

  Object.entries(incomeGroup).forEach(([key, txs]) => {
    const total = txs.reduce((s, t) => s + t.amount, 0);
    const avg = Math.round(total / txs.length);
    const isSalaryLike = txs.some((t) =>
      /salary|payroll|direct dep|techcorp|corp|payout/i.test(t.description)
    );
    if (avg > 5000 || isSalaryLike) {
      candidates.push({
        id: `cand-inc-${key.replace(/\s+/g, '-')}`,
        category: 'Income Evidence',
        detectedType: 'income',
        description: txs[0].description,
        averageAmount: avg,
        occurrences: txs.length,
        lastDate: txs[0].date,
        confidence: isSalaryLike ? 'high' : 'medium',
      });
    }
  });

  // 2. Scan debit transactions for recurring patterns (SIP, EMIs, Rent, Utilities)
  const debitTxs = transactions.filter((t) => t.type === 'debit');

  const debitPatterns: {
    pattern: RegExp;
    type: DetectedRecurringCandidate['detectedType'];
    categoryName: string;
  }[] = [
    { pattern: /zerodha|groww|sip|mutual fund|uti|hdfc amc|vanguard/i, type: 'sip', categoryName: 'SIP & Investment' },
    { pattern: /rent|housing|landlord|nobroker|nestaway/i, type: 'rent', categoryName: 'Rent Payment' },
    { pattern: /emi|loan|bajaj finserv|hdb|bank emi|auto loan/i, type: 'loan', categoryName: 'Loan EMI' },
    { pattern: /insurance|lic|hdfc ergo|max life|star health/i, type: 'insurance', categoryName: 'Insurance Premium' },
    { pattern: /bescom|electricity|utility|bill|water|tneb|broadband|wifi|airtel/i, type: 'utility', categoryName: 'Utilities & Bills' },
    { pattern: /netflix|spotify|prime|hotstar|apple|google storage/i, type: 'subscription', categoryName: 'Digital Subscription' },
  ];

  debitPatterns.forEach(({ pattern, type, categoryName }) => {
    const matching = debitTxs.filter((t) => pattern.test(t.description));
    if (matching.length > 0) {
      const total = matching.reduce((s, t) => s + t.amount, 0);
      const avg = Math.round((total / matching.length) * 100) / 100;
      candidates.push({
        id: `cand-deb-${type}-${matching[0].id}`,
        category: categoryName,
        detectedType: type,
        description: matching[0].description,
        averageAmount: avg,
        occurrences: matching.length,
        lastDate: matching[0].date,
        confidence: matching.length > 1 ? 'high' : 'medium',
      });
    }
  });

  const detectedIncome = candidates
    .filter((c) => c.detectedType === 'income')
    .reduce((s, c) => s + c.averageAmount, 0);

  const detectedCommitmentsTotal = candidates
    .filter((c) => c.detectedType !== 'income')
    .reduce((s, c) => s + c.averageAmount, 0);

  const declaredCommitmentsTotal =
    (declaredCommitments.rent || 0) +
    (declaredCommitments.homeLoanEmi || 0) +
    (declaredCommitments.vehicleLoanEmi || 0) +
    (declaredCommitments.personalLoanEmi || 0) +
    (declaredCommitments.creditCardCommitments || 0) +
    (declaredCommitments.sipContributions || 0) +
    (declaredCommitments.insurance || 0) +
    (declaredCommitments.utilities || 0) +
    (declaredCommitments.groceries || 0);

  return {
    declaredIncome: declaredIncome.monthlyIncome + (declaredIncome.additionalIncome || 0),
    detectedIncome: detectedIncome || totalCreditVolume,
    incomeVariance: Math.round(
      (declaredIncome.monthlyIncome + (declaredIncome.additionalIncome || 0)) -
        (detectedIncome || totalCreditVolume)
    ),
    declaredCommitmentsTotal,
    detectedCommitmentsTotal,
    commitmentsVariance: Math.round(declaredCommitmentsTotal - detectedCommitmentsTotal),
    detectedCandidates: candidates,
  };
}
