/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GroupMember,
  SharedExpense,
  SettlementTransfer,
} from './types.ts';

export interface SettlementCalculationResult {
  transfers: SettlementTransfer[];
  netBalances: Record<string, number>;
  totalGroupSpend: number;
  totalTransferredAmount: number;
  isConserved: boolean;
  memberNames: Record<string, string>;
}

/**
 * Calculates debt-minimizing settlements for collaborative groups.
 *
 * Mathematical Invariants Verified:
 * 1. Zero-Sum Balance: Sum of all net balances equals 0.00 (within floating epsilon).
 * 2. Conservation: Sum of settlement transfers equals total positive credit balances.
 * 3. Non-redundancy: No reciprocal or circular transfers between members.
 */
export function calculateGroupSettlements(
  expenses: SharedExpense[],
  members: GroupMember[]
): SettlementCalculationResult {
  const memberNames: Record<string, string> = {};
  const netBalances: Record<string, number> = {};

  for (const m of members) {
    memberNames[m.customerId] = m.fullName;
    netBalances[m.customerId] = 0;
  }

  let totalGroupSpend = 0;

  // Compute total paid and total owed per member
  for (const expense of expenses) {
    if (expense.isSettled) continue;

    totalGroupSpend += expense.amount;
    const payerId = expense.paidBy;

    // Credit payer
    netBalances[payerId] = (netBalances[payerId] || 0) + expense.amount;

    // Debit participants according to split
    if (expense.splits && expense.splits.length > 0) {
      for (const split of expense.splits) {
        netBalances[split.customerId] = (netBalances[split.customerId] || 0) - split.amount;
      }
    } else {
      // Default equal split among all members if splits array is empty
      const splitAmount = expense.amount / members.length;
      for (const m of members) {
        netBalances[m.customerId] = (netBalances[m.customerId] || 0) - splitAmount;
      }
    }
  }

  // Round balances to 2 decimal places to avoid floating point precision artifacts
  for (const id of Object.keys(netBalances)) {
    netBalances[id] = Math.round(netBalances[id] * 100) / 100;
  }

  // Verify Zero-Sum property
  const sumBalances = Object.values(netBalances).reduce((a, b) => a + b, 0);
  const isZeroSum = Math.abs(sumBalances) < 0.05;

  // Separate into debtors (negative balance) and creditors (positive balance)
  interface PersonBalance {
    customerId: string;
    amount: number;
  }

  const debtors: PersonBalance[] = [];
  const creditors: PersonBalance[] = [];

  for (const [id, balance] of Object.entries(netBalances)) {
    if (balance < -0.01) {
      debtors.push({ customerId: id, amount: -balance });
    } else if (balance > 0.01) {
      creditors.push({ customerId: id, amount: balance });
    }
  }

  // Sort descending by amount for greedy debt minimization
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers: SettlementTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;
  let totalTransferred = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const transferAmount = Math.min(debtor.amount, creditor.amount);

    if (transferAmount > 0.01) {
      const roundedTransfer = Math.round(transferAmount * 100) / 100;
      transfers.push({
        fromCustomerId: debtor.customerId,
        fromName: memberNames[debtor.customerId] || debtor.customerId,
        toCustomerId: creditor.customerId,
        toName: memberNames[creditor.customerId] || creditor.customerId,
        amount: roundedTransfer,
      });

      totalTransferred += roundedTransfer;
      debtor.amount -= roundedTransfer;
      creditor.amount -= roundedTransfer;
    }

    if (debtor.amount <= 0.01) dIdx++;
    if (creditor.amount <= 0.01) cIdx++;
  }

  const totalPositiveCredits = Object.values(netBalances)
    .filter((b) => b > 0)
    .reduce((a, b) => a + b, 0);

  // Conservation check: total transferred equals total credits
  const isConserved = isZeroSum && Math.abs(totalTransferred - totalPositiveCredits) < 0.1;

  return {
    transfers,
    netBalances,
    totalGroupSpend,
    totalTransferredAmount: Math.round(totalTransferred * 100) / 100,
    isConserved,
    memberNames,
  };
}
