/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FinancialGoal, FinancialIdentity } from '../identity/types.ts';

export interface GoalFeasibilityResult {
  goalId: string;
  goalName: string;
  targetAmount: number;
  currentSavings: number;
  remainingAmount: number;
  monthlyContribution: number;
  requiredMonthlySavings: number;
  monthsRemaining: number;
  targetDate: string;
  isFeasible: boolean;
  feasibilityStatus: 'feasible' | 'tight' | 'unfeasible';
  feasibilityReason: string;
  cashFlowCoveragePercent: number;
}

export interface PortfolioGoalsFeasibility {
  totalMonthlyCommitment: number;
  availableMonthlyCashFlow: number;
  netCashFlowAfterGoals: number;
  isPortfolioFeasible: boolean;
  goals: GoalFeasibilityResult[];
}

/**
 * Computes canonical goal feasibility using available net cash flow and declared commitments.
 */
export function calculateGoalFeasibility(
  goal: FinancialGoal,
  availableMonthlyCashFlow: number
): GoalFeasibilityResult {
  const target = Math.max(0, goal.targetAmount || 0);
  const current = Math.max(0, goal.currentSavings || 0);
  const remaining = Math.max(0, target - current);

  // Calculate remaining months
  let monthsRemaining = 12; // default 1 year
  if (goal.targetDate) {
    const targetDate = new Date(goal.targetDate);
    const now = new Date();
    const diffMonths =
      (targetDate.getFullYear() - now.getFullYear()) * 12 +
      (targetDate.getMonth() - now.getMonth());
    monthsRemaining = Math.max(1, diffMonths);
  }

  const requiredMonthlySavings = Math.round(remaining / monthsRemaining);
  const plannedMonthly = goal.monthlyContribution > 0 ? goal.monthlyContribution : requiredMonthlySavings;

  // Feasibility assessment against available cash flow
  let isFeasible = true;
  let feasibilityStatus: 'feasible' | 'tight' | 'unfeasible' = 'feasible';
  let feasibilityReason = 'Goal contribution is fully covered by surplus cash flow.';
  let coveragePercent = 100;

  if (availableMonthlyCashFlow <= 0) {
    isFeasible = false;
    feasibilityStatus = 'unfeasible';
    feasibilityReason = 'Zero or negative net cash flow. Essential expenses consume entire income.';
    coveragePercent = 0;
  } else {
    coveragePercent = Math.round((availableMonthlyCashFlow / plannedMonthly) * 100);
    if (plannedMonthly > availableMonthlyCashFlow) {
      isFeasible = false;
      feasibilityStatus = 'unfeasible';
      feasibilityReason = `Requires ₹${plannedMonthly.toLocaleString('en-IN')}/mo which exceeds available surplus of ₹${availableMonthlyCashFlow.toLocaleString('en-IN')}/mo.`;
    } else if (plannedMonthly > availableMonthlyCashFlow * 0.8) {
      isFeasible = true;
      feasibilityStatus = 'tight';
      feasibilityReason = `Consumes ${Math.round((plannedMonthly / availableMonthlyCashFlow) * 100)}% of surplus cash flow, leaving low emergency buffer.`;
    }
  }

  return {
    goalId: goal.id,
    goalName: goal.name,
    targetAmount: target,
    currentSavings: current,
    remainingAmount: remaining,
    monthlyContribution: plannedMonthly,
    requiredMonthlySavings,
    monthsRemaining,
    targetDate: goal.targetDate,
    isFeasible,
    feasibilityStatus,
    feasibilityReason,
    cashFlowCoveragePercent: coveragePercent,
  };
}

/**
 * Evaluates the entire portfolio of goals against available cash flow
 */
export function calculatePortfolioGoalsFeasibility(
  goals: FinancialGoal[],
  availableMonthlyCashFlow: number
): PortfolioGoalsFeasibility {
  const goalResults = goals.map((g) => calculateGoalFeasibility(g, availableMonthlyCashFlow));
  const totalMonthlyCommitment = goalResults.reduce((sum, g) => sum + g.monthlyContribution, 0);
  const netCashFlowAfterGoals = availableMonthlyCashFlow - totalMonthlyCommitment;

  return {
    totalMonthlyCommitment,
    availableMonthlyCashFlow,
    netCashFlowAfterGoals,
    isPortfolioFeasible: netCashFlowAfterGoals >= 0,
    goals: goalResults,
  };
}
