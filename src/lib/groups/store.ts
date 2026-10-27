/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CollaborativeGroup,
  GroupMember,
  GroupVisibilityTier,
  SharedExpense,
  GroupSnapshot,
} from './types.ts';
import { sanitizeMemberSnapshot, RawMemberFinancialData } from './privacy.ts';
import { calculateGroupSettlements } from './settlement.ts';

const GROUPS_STORAGE_KEY = 'vivpay_collaborative_groups';

class CollaborativeGroupsStore {
  private groups: Map<string, CollaborativeGroup> = new Map();
  // Simulated member financial data cache for group comparisons
  private memberDataCache: Map<string, RawMemberFinancialData> = new Map();

  constructor() {
    this.initializeDefaultDemoGroup();
  }

  private initializeDefaultDemoGroup(): void {
    const demoGroupId = 'group-bangalore-housemates';
    const initialGroup: CollaborativeGroup = {
      id: demoGroupId,
      name: 'Indiranagar Housemates',
      description: 'Shared household rent, groceries, electricity, and utilities split',
      createdBy: 'demo-customer-uuid-001',
      members: [
        {
          customerId: 'demo-customer-uuid-001',
          fullName: 'Alex Rivera',
          email: 'alex.rivera@example.com',
          role: 'admin',
          visibility: 'category_only', // Default privacy tier
          joinedAt: '2026-09-01T00:00:00Z',
        },
        {
          customerId: 'member-rahul-002',
          fullName: 'Rahul Sharma',
          email: 'rahul.sharma@example.com',
          role: 'member',
          visibility: 'total_only', // Total-only privacy tier
          joinedAt: '2026-09-02T00:00:00Z',
        },
        {
          customerId: 'member-priya-003',
          fullName: 'Priya Verma',
          email: 'priya.verma@example.com',
          role: 'member',
          visibility: 'hidden', // Completely hidden tier
          joinedAt: '2026-09-05T00:00:00Z',
        },
      ],
      sharedExpenses: [
        {
          id: 'exp-001',
          groupId: demoGroupId,
          title: 'BESCOM Electricity Bill October',
          amount: 3600,
          paidBy: 'demo-customer-uuid-001',
          splitType: 'equal',
          splits: [
            { customerId: 'demo-customer-uuid-001', amount: 1200 },
            { customerId: 'member-rahul-002', amount: 1200 },
            { customerId: 'member-priya-003', amount: 1200 },
          ],
          date: '2026-10-05',
          category: 'Utilities',
          isSettled: false,
          createdAt: '2026-10-05T10:00:00Z',
        },
        {
          id: 'exp-002',
          groupId: demoGroupId,
          title: 'Nature Basket Grocery Run',
          amount: 4500,
          paidBy: 'member-rahul-002',
          splitType: 'equal',
          splits: [
            { customerId: 'demo-customer-uuid-001', amount: 1500 },
            { customerId: 'member-rahul-002', amount: 1500 },
            { customerId: 'member-priya-003', amount: 1500 },
          ],
          date: '2026-10-08',
          category: 'Groceries',
          isSettled: false,
          createdAt: '2026-10-08T14:30:00Z',
        },
      ],
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-10-08T14:30:00Z',
    };

    this.groups.set(demoGroupId, initialGroup);

    // Mock realistic financial data for members
    this.setMemberData('demo-customer-uuid-001', {
      monthlyTotalSpending: 42500,
      monthlyIncome: 145000,
      savingsRate: 70.7,
      categoryBreakdown: [
        { category: 'Housing & Rent', amount: 25000, percentage: 58.8 },
        { category: 'Utilities & Bills', amount: 4800, percentage: 11.3 },
        { category: 'Groceries & Dining', amount: 8200, percentage: 19.3 },
        { category: 'Transport', amount: 4500, percentage: 10.6 },
      ],
      transactions: [],
    });

    this.setMemberData('member-rahul-002', {
      monthlyTotalSpending: 38000,
      monthlyIncome: 110000,
      savingsRate: 65.5,
      categoryBreakdown: [
        { category: 'Housing & Rent', amount: 25000, percentage: 65.8 },
        { category: 'Groceries & Dining', amount: 7500, percentage: 19.7 },
        { category: 'Entertainment', amount: 5500, percentage: 14.5 },
      ],
      transactions: [],
    });

    this.setMemberData('member-priya-003', {
      monthlyTotalSpending: 51000,
      monthlyIncome: 160000,
      savingsRate: 68.1,
      categoryBreakdown: [
        { category: 'Housing & Rent', amount: 25000, percentage: 49.0 },
        { category: 'Shopping', amount: 16000, percentage: 31.4 },
        { category: 'Dining', amount: 10000, percentage: 19.6 },
      ],
      transactions: [],
    });
  }

  public setMemberData(customerId: string, data: RawMemberFinancialData): void {
    this.memberDataCache.set(customerId, data);
  }

  public getGroup(groupId: string): CollaborativeGroup | null {
    return this.groups.get(groupId) || null;
  }

  public listGroupsForCustomer(customerId: string): CollaborativeGroup[] {
    return Array.from(this.groups.values()).filter((g) =>
      g.members.some((m) => m.customerId === customerId)
    );
  }

  public createGroup(
    creatorCustomerId: string,
    creatorName: string,
    creatorEmail: string,
    name: string,
    description?: string
  ): CollaborativeGroup {
    const id = `group-${Date.now()}`;
    const newGroup: CollaborativeGroup = {
      id,
      name,
      description,
      createdBy: creatorCustomerId,
      members: [
        {
          customerId: creatorCustomerId,
          fullName: creatorName,
          email: creatorEmail,
          role: 'admin',
          visibility: 'category_only',
          joinedAt: new Date().toISOString(),
        },
      ],
      sharedExpenses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.groups.set(id, newGroup);
    return newGroup;
  }

  public addMember(
    groupId: string,
    adminCustomerId: string,
    newMember: { customerId: string; fullName: string; email: string; visibility?: GroupVisibilityTier }
  ): CollaborativeGroup {
    const group = this.groups.get(groupId);
    if (!group) throw new Error('Group not found.');

    const admin = group.members.find((m) => m.customerId === adminCustomerId);
    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only group admins can add new members.');
    }

    if (group.members.some((m) => m.customerId === newMember.customerId)) {
      throw new Error('Member is already part of this group.');
    }

    group.members.push({
      customerId: newMember.customerId,
      fullName: newMember.fullName,
      email: newMember.email,
      role: 'member',
      visibility: newMember.visibility || 'category_only',
      joinedAt: new Date().toISOString(),
    });
    group.updatedAt = new Date().toISOString();

    return group;
  }

  public removeMember(groupId: string, requestingCustomerId: string, targetCustomerId: string): CollaborativeGroup {
    const group = this.groups.get(groupId);
    if (!group) throw new Error('Group not found.');

    const reqMember = group.members.find((m) => m.customerId === requestingCustomerId);
    if (!reqMember) throw new Error('Unauthorized: Requesting user is not a member of this group.');

    const isSelfRemoval = requestingCustomerId === targetCustomerId;
    const isAdmin = reqMember.role === 'admin';

    if (!isSelfRemoval && !isAdmin) {
      throw new Error('Unauthorized: Only group admins can remove other members.');
    }

    group.members = group.members.filter((m) => m.customerId !== targetCustomerId);
    group.updatedAt = new Date().toISOString();

    return group;
  }

  public updateVisibilityTier(
    groupId: string,
    customerId: string,
    tier: GroupVisibilityTier
  ): CollaborativeGroup {
    const group = this.groups.get(groupId);
    if (!group) throw new Error('Group not found.');

    const member = group.members.find((m) => m.customerId === customerId);
    if (!member) throw new Error('Member not found in group.');

    member.visibility = tier;
    group.updatedAt = new Date().toISOString();

    return group;
  }

  public addSharedExpense(
    groupId: string,
    customerId: string,
    expenseData: { title: string; amount: number; category: string; date?: string; splits?: Array<{ customerId: string; amount: number }> }
  ): SharedExpense {
    const group = this.groups.get(groupId);
    if (!group) throw new Error('Group not found.');

    if (!group.members.some((m) => m.customerId === customerId)) {
      throw new Error('Unauthorized: User is not a member of this group.');
    }

    const defaultSplits =
      expenseData.splits ||
      group.members.map((m) => ({
        customerId: m.customerId,
        amount: Math.round((expenseData.amount / group.members.length) * 100) / 100,
      }));

    const expense: SharedExpense = {
      id: `exp-${Date.now()}`,
      groupId,
      title: expenseData.title,
      amount: expenseData.amount,
      paidBy: customerId,
      splitType: expenseData.splits ? 'custom' : 'equal',
      splits: defaultSplits,
      date: expenseData.date || new Date().toISOString().split('T')[0],
      category: expenseData.category,
      isSettled: false,
      createdAt: new Date().toISOString(),
    };

    group.sharedExpenses.push(expense);
    group.updatedAt = new Date().toISOString();

    return expense;
  }

  /**
   * Retrieves group snapshot with STRICT authorization and visibility enforcement.
   * Throws Error if requesting user is not a member.
   * Sanitizes all peer data using configured visibility tiers.
   */
  public getGroupSnapshot(groupId: string, requestingCustomerId: string): GroupSnapshot {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error('Group not found.');
    }

    // STRICT SERVER-SIDE AUTHORIZATION: Requesting user MUST be an active member
    const isMember = group.members.some((m) => m.customerId === requestingCustomerId);
    if (!isMember) {
      throw new Error('Forbidden: You are not authorized to view this collaborative group.');
    }

    // Sanitize each member's financial snapshot according to their configured tier
    const memberSnapshots = group.members.map((member) => {
      const rawData = this.memberDataCache.get(member.customerId) || {
        monthlyTotalSpending: 0,
        monthlyIncome: 0,
        savingsRate: 0,
        categoryBreakdown: [],
        transactions: [],
      };

      return sanitizeMemberSnapshot(member, rawData, requestingCustomerId);
    });

    // Compute settlements
    const settlementResult = calculateGroupSettlements(group.sharedExpenses, group.members);

    return {
      groupId: group.id,
      groupName: group.name,
      requestingCustomerId,
      members: group.members,
      memberSnapshots,
      sharedExpenses: group.sharedExpenses,
      activeSettlements: settlementResult.transfers,
      groupTotalSharedSpend: settlementResult.totalGroupSpend,
      createdAt: group.createdAt,
    };
  }
}

export const groupsStore = new CollaborativeGroupsStore();
