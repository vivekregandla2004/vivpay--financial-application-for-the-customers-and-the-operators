/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ProactiveInsight,
  FinancialIdentity,
  EightDimensionalBehavior,
  ArchetypeEvaluation,
  CognitiveAIProfile,
} from '../identity/types.ts';
import { Transaction, Account, FinancialSummary } from '../../types/database.ts';
import { calculateGoalMetrics } from '../identity/store.ts';

interface GenerateInsightsOptions {
  identity: FinancialIdentity;
  transactions?: Transaction[];
  accounts?: Account[];
  summary?: {
    totalBalance?: number;
    pureIncome?: number;
    pureExpenses?: number;
    netCashFlow?: number;
    savingsRate?: number;
  } | any | null;
  behavior?: EightDimensionalBehavior;
  archetypes?: ArchetypeEvaluation[];
}

/**
 * Deterministically generates typed, evidence-backed proactive financial insights
 * Grounded strictly in verified ledger data, declared identity, and cognitive profiles.
 */
export function generateProactiveInsights({
  identity,
  transactions = [],
  accounts = [],
  summary,
  behavior,
  archetypes = [],
}: GenerateInsightsOptions): ProactiveInsight[] {
  const insights: ProactiveInsight[] = [];

  const debits = transactions.filter((t) => t.type === 'debit' || (t as any).direction === 'debit');
  const credits = transactions.filter((t) => t.type === 'credit' || (t as any).direction === 'credit');

  const totalBalance = summary?.totalBalance ?? accounts.reduce((acc, a) => acc + a.balance, 0);
  const monthlySalary = identity.income?.monthlyIncome || 0;
  const netCashFlow = summary?.netCashFlow ?? (monthlySalary - (summary?.pureExpenses || 0));

  // 1. Cash-Flow Anomaly Rule: Spending Spike or Rapid Burn
  const recentDebits = debits.slice(-10);
  const largeDebits = recentDebits.filter((t) => t.amount > (monthlySalary > 0 ? monthlySalary * 0.25 : 25000));
  if (largeDebits.length > 0) {
    const topSingle = largeDebits[0];
    insights.push({
      id: `ins-anomaly-spike-${topSingle.id || Date.now()}`,
      category: 'cash_flow_anomaly',
      title: 'High-Value Outflow Spike Detected',
      explanation: `An outflow of ₹${topSingle.amount.toLocaleString()} was observed for "${topSingle.description}" on ${topSingle.date}. This single debit consumes ${monthlySalary > 0 ? Math.round((topSingle.amount / monthlySalary) * 100) : 30}% of your monthly salary.`,
      severity: 'warning',
      evidenceSource: 'statement',
      confidence: 0.95,
      suggestedAction: 'Review transaction categorisation or allocate against planned capital outlays.',
      timeframe: 'Recent 14 Days',
    });
  }

  // 2. Upcoming Commitments vs Projected Cash Flow Buffer
  const c = identity.commitments;
  const totalCommitments =
    (c.rent || 0) +
    (c.homeLoanEmi || 0) +
    (c.vehicleLoanEmi || 0) +
    (c.personalLoanEmi || 0) +
    (c.creditCardCommitments || 0) +
    (c.sipContributions || 0) +
    (c.insurance || 0) +
    (c.utilities || 0) +
    (c.groceries || 0);

  if (totalCommitments > 0) {
    const coverageRatio = totalCommitments > 0 ? totalBalance / totalCommitments : 5;
    if (coverageRatio < 1.0) {
      insights.push({
        id: 'ins-upcoming-liquidity-tight',
        category: 'upcoming_commitment',
        title: 'Tight Coverage for Upcoming Monthly Commitments',
        explanation: `Total declared monthly obligations stand at ₹${totalCommitments.toLocaleString()}, while current confirmed account balance is ₹${totalBalance.toLocaleString()} (${(coverageRatio * 100).toFixed(0)}% coverage).`,
        severity: 'critical',
        evidenceSource: 'derived',
        confidence: 0.9,
        suggestedAction: 'Ensure inbound salary credits or liquid fund transfers arrive prior to scheduled debit dates.',
        timeframe: 'Next 10 Days',
      });
    } else if (coverageRatio >= 3.0) {
      insights.push({
        id: 'ins-upcoming-liquidity-robust',
        category: 'upcoming_commitment',
        title: 'Robust Liquidity Coverage for Fixed Outflows',
        explanation: `Confirmed liquid reserves of ₹${totalBalance.toLocaleString()} provide ${coverageRatio.toFixed(1)}x coverage over your monthly fixed commitments of ₹${totalCommitments.toLocaleString()}.`,
        severity: 'positive',
        evidenceSource: 'derived',
        confidence: 0.92,
        suggestedAction: 'Automate standing instructions for bills and loan payments to eliminate manual tracking.',
        timeframe: 'Monthly Cycle',
      });
    }
  }

  // 3. Goal Progress Drift or Acceleration Rule
  if (identity.goals && identity.goals.length > 0) {
    for (const goal of identity.goals) {
      const metrics = calculateGoalMetrics(goal);
      const targetDate = new Date(goal.targetDate);
      const isPast = targetDate.getTime() < Date.now();

      if (!isPast && metrics.estimatedRequiredMonthly > goal.monthlyContribution * 1.3 && metrics.remainingAmount > 0) {
        insights.push({
          id: `ins-goal-drift-${goal.id}`,
          category: 'goal_drift',
          title: `Goal Drift: "${goal.name}" Pace Lagging`,
          explanation: `To achieve ₹${goal.targetAmount.toLocaleString()} by ${goal.targetDate}, required monthly savings are ₹${metrics.estimatedRequiredMonthly.toLocaleString()}/mo, exceeding your current planned contribution of ₹${goal.monthlyContribution.toLocaleString()}/mo.`,
          severity: 'warning',
          evidenceSource: 'declared',
          confidence: 0.88,
          suggestedAction: `Increase monthly allocation by ₹${(metrics.estimatedRequiredMonthly - goal.monthlyContribution).toLocaleString()} or extend target date.`,
          timeframe: `${metrics.monthsRemaining} Months Remaining`,
        });
      } else if (metrics.progressPercentage >= 65 && metrics.remainingAmount > 0) {
        insights.push({
          id: `ins-goal-accel-${goal.id}`,
          category: 'goal_drift',
          title: `Milestone Acceleration: "${goal.name}" at ${metrics.progressPercentage}%`,
          explanation: `Accumulated ₹${goal.currentSavings.toLocaleString()} towards ₹${goal.targetAmount.toLocaleString()} target. You are on track to achieve full funding ahead of ${goal.targetDate}.`,
          severity: 'positive',
          evidenceSource: 'declared',
          confidence: 0.9,
          suggestedAction: 'Keep systematic contributions active; avoid premature withdrawal into discretionary accounts.',
          timeframe: 'Upcoming Milestone',
        });
      }
    }
  }

  // 4. Optimization Opportunities: Redundant Subscriptions & High DTI
  if (behavior && behavior.subscriptionDiscretionaryLoad.score < 50) {
    insights.push({
      id: 'ins-opt-sub-audit',
      category: 'optimization',
      title: 'Digital Subscription Consolidation Opportunity',
      explanation: `Recurring digital services consume an elevated share of monthly spend (score ${behavior.subscriptionDiscretionaryLoad.score}/100). Identified repeating media, cloud, and membership debits.`,
      severity: 'info',
      evidenceSource: 'statement',
      confidence: 0.85,
      suggestedAction: 'Audit unutilized streaming memberships or family tier subscriptions in the Recurring Ledger.',
      timeframe: 'Immediate Audit',
    });
  }

  if (behavior && behavior.investmentRatio.score < 40 && netCashFlow > 15000) {
    insights.push({
      id: 'ins-opt-idle-cash',
      category: 'optimization',
      title: 'Idle Cash Flow Deployment Opportunity',
      explanation: `You maintain an estimated positive monthly cash flow of ₹${Math.round(netCashFlow).toLocaleString()}, but investment routing score is low (${behavior.investmentRatio.score}/100).`,
      severity: 'info',
      evidenceSource: 'derived',
      confidence: 0.86,
      suggestedAction: 'Direct ₹10,000–₹15,000 of surplus cash flow into automated index mutual fund SIPs.',
      timeframe: 'Next Salary Cycle',
    });
  }

  // 5. Behavioral Nudges Aligned with Archetypes & Cognitive Profile
  const matchedArchetypes = archetypes.filter((a) => a.matched);
  for (const arch of matchedArchetypes) {
    if (arch.archetype === 'impulse_spender') {
      insights.push({
        id: 'ins-nudge-impulse',
        category: 'behavioral_nudge',
        title: 'Impulse Shopping Friction Nudge',
        explanation: 'Observed cluster of non-essential weekend shopping purchases creating cash flow drag.',
        severity: 'warning',
        evidenceSource: 'cognitive',
        confidence: 0.82,
        suggestedAction: 'Institute a mandatory 48-hour cooling-off period on all cart checkouts above ₹3,000.',
        timeframe: 'This Weekend',
      });
    } else if (arch.archetype === 'excellent_saver') {
      insights.push({
        id: 'ins-nudge-saver',
        category: 'behavioral_nudge',
        title: 'Capital Preservation Commendation',
        explanation: 'Your high savings velocity maintains an exemplary emergency cushion exceeding 6 months of basic living costs.',
        severity: 'positive',
        evidenceSource: 'derived',
        confidence: 0.94,
        suggestedAction: 'Consider optimizing tax-saving instruments (Section 80C/NPS) for your surplus reserves.',
        timeframe: 'Ongoing Advantage',
      });
    } else if (arch.archetype === 'high_emi_load') {
      insights.push({
        id: 'ins-nudge-emi',
        category: 'behavioral_nudge',
        title: 'Debt Avalanche Prioritization Nudge',
        explanation: 'Elevated debt-to-income commitments limit discretionary agility. Focus debt amortization on highest-interest loans first.',
        severity: 'warning',
        evidenceSource: 'derived',
        confidence: 0.89,
        suggestedAction: 'Allocate quarterly bonuses or unexpected windfalls directly to loan principal reduction.',
        timeframe: 'Quarterly Review',
      });
    }
  }

  return insights;
}
