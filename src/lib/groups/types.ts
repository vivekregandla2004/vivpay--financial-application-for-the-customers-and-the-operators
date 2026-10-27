/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GroupVisibilityTier = 'full' | 'category_only' | 'total_only' | 'hidden';

export type GroupMemberRole = 'admin' | 'member';

export type SplitType = 'equal' | 'custom' | 'shares';

export interface GroupMember {
  customerId: string;
  fullName: string;
  email: string;
  role: GroupMemberRole;
  visibility: GroupVisibilityTier;
  joinedAt: string;
}

export interface ExpenseSplit {
  customerId: string;
  amount: number;
  share?: number;
}

export interface SharedExpense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  paidBy: string; // customerId of payer
  splitType: SplitType;
  splits: ExpenseSplit[];
  date: string;
  category: string;
  isSettled: boolean;
  createdAt: string;
}

export interface SettlementTransfer {
  fromCustomerId: string;
  fromName: string;
  toCustomerId: string;
  toName: string;
  amount: number;
}

export interface MemberFinancialSnapshot {
  customerId: string;
  fullName: string;
  visibility: GroupVisibilityTier;
  monthlyTotalSpending: number | null;
  monthlyIncome: number | null;
  savingsRate: number | null;
  categoryBreakdown: Array<{ category: string; amount: number; percentage: number }> | null;
  transactions: Array<{ date: string; description: string; amount: number; category: string }> | null;
  isMasked: boolean;
  redactionNotice?: string;
}

export interface GroupSnapshot {
  groupId: string;
  groupName: string;
  requestingCustomerId: string;
  members: GroupMember[];
  memberSnapshots: MemberFinancialSnapshot[];
  sharedExpenses: SharedExpense[];
  activeSettlements: SettlementTransfer[];
  groupTotalSharedSpend: number;
  createdAt: string;
}

export interface CollaborativeGroup {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  members: GroupMember[];
  sharedExpenses: SharedExpense[];
  createdAt: string;
  updatedAt: string;
}
