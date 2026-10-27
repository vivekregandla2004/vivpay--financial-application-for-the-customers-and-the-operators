/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GroupMember,
  GroupVisibilityTier,
  MemberFinancialSnapshot,
} from './types.ts';
import { CanonicalTransaction } from '../finance/types.ts';

export interface RawMemberFinancialData {
  monthlyTotalSpending: number;
  monthlyIncome: number;
  savingsRate: number;
  categoryBreakdown: Array<{ category: string; amount: number; percentage: number }>;
  transactions: CanonicalTransaction[];
}

/**
 * Strict privacy firewall: Sanitizes a member's financial data according to their
 * configured visibility tier BEFORE it is included in shared group snapshots,
 * API responses, or AI prompts.
 *
 * Tiers:
 * - 'full': Complete category breakdown and transaction details.
 * - 'category_only': Aggregated category totals only. Individual transactions (descriptions, UTRs, dates) are masked.
 * - 'total_only': Only aggregate monthly spending and savings rate. Category breakdowns and transactions are masked.
 * - 'hidden': Entire financial state is masked (null). Zero leakage of spending, categories, or transactions.
 */
export function sanitizeMemberSnapshot(
  member: GroupMember,
  raw: RawMemberFinancialData,
  requestingCustomerId: string
): MemberFinancialSnapshot {
  const isOwner = requestingCustomerId === member.customerId;

  // The member themselves can always see their own full unredacted metrics
  if (isOwner) {
    return {
      customerId: member.customerId,
      fullName: member.fullName,
      visibility: member.visibility,
      monthlyTotalSpending: raw.monthlyTotalSpending,
      monthlyIncome: raw.monthlyIncome,
      savingsRate: raw.savingsRate,
      categoryBreakdown: raw.categoryBreakdown,
      transactions: raw.transactions.map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
      })),
      isMasked: false,
    };
  }

  // Enforcement for external group peers
  switch (member.visibility) {
    case 'hidden':
      return {
        customerId: member.customerId,
        fullName: member.fullName,
        visibility: 'hidden',
        monthlyTotalSpending: null,
        monthlyIncome: null,
        savingsRate: null,
        categoryBreakdown: null,
        transactions: null,
        isMasked: true,
        redactionNotice: 'Privacy Tier: Hidden. Financial data is masked by member.',
      };

    case 'total_only':
      return {
        customerId: member.customerId,
        fullName: member.fullName,
        visibility: 'total_only',
        monthlyTotalSpending: raw.monthlyTotalSpending,
        monthlyIncome: null, // Income is kept private
        savingsRate: raw.savingsRate,
        categoryBreakdown: null, // Mask category breakdown
        transactions: null, // Mask individual transactions
        isMasked: true,
        redactionNotice: 'Privacy Tier: Total-Only. Category breakdown and transactions are masked.',
      };

    case 'category_only':
      return {
        customerId: member.customerId,
        fullName: member.fullName,
        visibility: 'category_only',
        monthlyTotalSpending: raw.monthlyTotalSpending,
        monthlyIncome: null, // Income is kept private
        savingsRate: raw.savingsRate,
        categoryBreakdown: raw.categoryBreakdown,
        transactions: null, // Mask individual transactions
        isMasked: true,
        redactionNotice: 'Privacy Tier: Category-Only. Individual transactions are masked.',
      };

    case 'full':
    default:
      return {
        customerId: member.customerId,
        fullName: member.fullName,
        visibility: 'full',
        monthlyTotalSpending: raw.monthlyTotalSpending,
        monthlyIncome: raw.monthlyIncome,
        savingsRate: raw.savingsRate,
        categoryBreakdown: raw.categoryBreakdown,
        transactions: raw.transactions.map((t) => ({
          date: t.date,
          description: t.description,
          amount: t.amount,
          category: t.category,
        })),
        isMasked: false,
      };
  }
}

/**
 * Prepares privacy-sanitized prompt context for AI Copilot when discussing group metrics.
 * Ensures the model CANNOT see or leak masked transactions or categories of peers.
 */
export function buildPrivacyPreservingGroupAIPromptContext(
  snapshots: MemberFinancialSnapshot[]
): string {
  const lines: string[] = ['Collaborative Group Peer Summary:'];

  for (const s of snapshots) {
    if (s.isMasked && s.visibility === 'hidden') {
      lines.push(`- Member: ${s.fullName} [HIDDEN: No financial data shared]`);
    } else if (s.isMasked && s.visibility === 'total_only') {
      lines.push(
        `- Member: ${s.fullName} [TOTAL ONLY: Monthly Spend ₹${s.monthlyTotalSpending?.toLocaleString('en-IN') || 0}, Savings Rate ${s.savingsRate?.toFixed(1) || 0}%]`
      );
    } else if (s.isMasked && s.visibility === 'category_only') {
      const topCats = s.categoryBreakdown?.slice(0, 3).map((c) => `${c.category}: ₹${c.amount}`).join(', ') || 'None';
      lines.push(
        `- Member: ${s.fullName} [CATEGORY ONLY: Monthly Spend ₹${s.monthlyTotalSpending?.toLocaleString('en-IN') || 0}, Top Categories: ${topCats}]`
      );
    } else {
      lines.push(
        `- Member: ${s.fullName} [FULL: Monthly Spend ₹${s.monthlyTotalSpending?.toLocaleString('en-IN') || 0}, Savings Rate ${s.savingsRate?.toFixed(1) || 0}%]`
      );
    }
  }

  return lines.join('\n');
}
