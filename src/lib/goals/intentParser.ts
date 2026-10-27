/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FinancialGoal, FinancialIdentity } from '../identity/types.ts';
import { loadIdentityFromStorage, saveIdentityToStorage } from '../identity/store.ts';
import { UserRole } from '../../services/demoData.ts';
import { calculateGoalFeasibility } from './feasibility.ts';

export interface ParsedGoalIntent {
  hasIntent: boolean;
  action: 'create' | 'update' | 'query' | 'none';
  goalName?: string;
  targetAmount?: number;
  targetDate?: string;
  monthlyContribution?: number;
  currentSavings?: number;
  notes?: string;
}

export interface GoalSyncResult {
  success: boolean;
  action: 'created' | 'updated' | 'queried' | 'none';
  goal: FinancialGoal | null;
  feasibility?: any;
  message: string;
}

/**
 * Extracts numeric money amounts from text like "500000", "5,00,000", "50k", "5 lakh"
 */
function extractAmount(text: string): number | null {
  const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)/i);
  if (lakhMatch) {
    return Math.round(parseFloat(lakhMatch[1]) * 100000);
  }

  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:k|thousand)/i);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]) * 1000);
  }

  const numMatch = text.match(/(?:₹|\$)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]+)?|[0-9]+)/);
  if (numMatch) {
    const clean = numMatch[1].replace(/,/g, '');
    const val = parseFloat(clean);
    if (!isNaN(val) && val > 0) return val;
  }

  return null;
}

/**
 * Parses natural language user prompts for goal creation, updates, and inquiries
 */
export function parseGoalIntent(prompt: string): ParsedGoalIntent {
  const p = prompt.toLowerCase();

  const isGoalQuery =
    p.includes('goal') ||
    p.includes('milestone') ||
    p.includes('target') ||
    p.includes('save for') ||
    p.includes('saving for');

  if (!isGoalQuery) {
    return { hasIntent: false, action: 'none' };
  }

  const isUpdate =
    p.includes('update') ||
    p.includes('change') ||
    p.includes('increase') ||
    p.includes('decrease') ||
    p.includes('add') ||
    p.includes('saved');

  const isCreate =
    p.includes('create') ||
    p.includes('set') ||
    p.includes('start') ||
    p.includes('new goal') ||
    p.includes('add goal') ||
    p.includes('plan for');

  // Identify candidate name
  let name = 'Financial Reserve';
  if (p.includes('emergency')) name = 'Emergency Reserve';
  else if (p.includes('car') || p.includes('ev') || p.includes('vehicle')) name = 'Vehicle Purchase';
  else if (p.includes('house') || p.includes('home') || p.includes('flat')) name = 'Home Downpayment';
  else if (p.includes('vacation') || p.includes('travel') || p.includes('trip')) name = 'Vacation & Travel';
  else if (p.includes('wedding')) name = 'Wedding Milestone';
  else if (p.includes('education') || p.includes('college')) name = 'Higher Education Fund';

  const amount = extractAmount(prompt);

  // Target date estimation (e.g. 2027, 2028, or 1 year)
  let targetDate = '2027-12-31';
  const yearMatch = prompt.match(/\b(202[5-9]|203[0-5])\b/);
  if (yearMatch) {
    targetDate = `${yearMatch[1]}-12-31`;
  }

  if (isUpdate && amount !== null) {
    const isTargetUpdate = p.includes('target') || p.includes('goal amount');
    return {
      hasIntent: true,
      action: 'update',
      goalName: name,
      targetAmount: isTargetUpdate ? amount : undefined,
      currentSavings: isTargetUpdate ? undefined : amount,
    };
  }

  if (isCreate && amount !== null) {
    return {
      hasIntent: true,
      action: 'create',
      goalName: name,
      targetAmount: amount,
      targetDate,
      monthlyContribution: Math.round(amount / 24), // 24 month default
    };
  }

  return {
    hasIntent: true,
    action: isCreate ? 'create' : isUpdate ? 'update' : 'query',
    goalName: name,
    targetAmount: amount || undefined,
  };
}

/**
 * Normalizes goal names for robust duplicate detection
 */
function normalizeGoalName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Synchronizes goal intent into the authoritative identity store.
 * GUARANTEES:
 * 1. Single authoritative persisted representation.
 * 2. Repeated intent detection DOES NOT create duplicate goals.
 * 3. Feasibility calculations use available cash flow.
 * 4. Safe recovery on storage failure.
 */
export function synchronizeGoalFromIntent(
  intent: ParsedGoalIntent,
  role: UserRole = 'customer',
  availableMonthlyCashFlow: number = 50000
): GoalSyncResult {
  if (!intent.hasIntent) {
    return { success: false, action: 'none', goal: null, message: 'No goal intent detected.' };
  }

  const identity: FinancialIdentity = loadIdentityFromStorage(role);
  const existingGoals = identity.goals || [];
  const searchNorm = normalizeGoalName(intent.goalName || '');

  // Find existing goal with matching semantic name
  const existingIndex = existingGoals.findIndex((g) => {
    const gNorm = normalizeGoalName(g.name);
    return gNorm.includes(searchNorm) || searchNorm.includes(gNorm);
  });

  if (intent.action === 'query' || (!intent.targetAmount && !intent.currentSavings)) {
    const found = existingIndex >= 0 ? existingGoals[existingIndex] : existingGoals[0] || null;
    const feasibility = found ? calculateGoalFeasibility(found, availableMonthlyCashFlow) : undefined;
    return {
      success: true,
      action: 'queried',
      goal: found,
      feasibility,
      message: found
        ? `Found goal "${found.name}": Target ₹${found.targetAmount.toLocaleString('en-IN')}, Saved ₹${found.currentSavings.toLocaleString('en-IN')}.`
        : 'No matching goals found in your Financial Profile.',
    };
  }

  let targetGoal: FinancialGoal;
  let actionTaken: 'created' | 'updated';

  if (existingIndex >= 0) {
    // UPDATE EXISTING GOAL — PREVENTS DUPLICATE ON REPEATED INTENT
    actionTaken = 'updated';
    const curr = existingGoals[existingIndex];
    targetGoal = {
      ...curr,
      targetAmount: intent.targetAmount !== undefined ? intent.targetAmount : curr.targetAmount,
      currentSavings: intent.currentSavings !== undefined ? intent.currentSavings : curr.currentSavings,
      monthlyContribution:
        intent.monthlyContribution !== undefined ? intent.monthlyContribution : curr.monthlyContribution,
      targetDate: intent.targetDate !== undefined ? intent.targetDate : curr.targetDate,
    };
    existingGoals[existingIndex] = targetGoal;
  } else {
    // CREATE NEW GOAL
    actionTaken = 'created';
    const newId = `goal-${Date.now()}`;
    targetGoal = {
      id: newId,
      name: intent.goalName || 'New Financial Milestone',
      targetAmount: intent.targetAmount || 100000,
      targetDate: intent.targetDate || '2027-12-31',
      monthlyContribution: intent.monthlyContribution || 5000,
      currentSavings: intent.currentSavings || 0,
      priority: 'medium',
      notes: 'Configured via Ask Viv Assistant',
    };
    existingGoals.push(targetGoal);
  }

  // Persist back to authoritative identity store
  try {
    identity.goals = existingGoals;
    saveIdentityToStorage(role, identity);
  } catch (err: any) {
    console.error('Failed to persist goal to identity storage:', err);
    // Recoverable in-memory return
    return {
      success: false,
      action: actionTaken,
      goal: targetGoal,
      message: 'Failed to persist goal to local storage, but kept in current session.',
    };
  }

  const feasibility = calculateGoalFeasibility(targetGoal, availableMonthlyCashFlow);

  return {
    success: true,
    action: actionTaken,
    goal: targetGoal,
    feasibility,
    message:
      actionTaken === 'updated'
        ? `Successfully updated "${targetGoal.name}". Target: ₹${targetGoal.targetAmount.toLocaleString('en-IN')}, Current Savings: ₹${targetGoal.currentSavings.toLocaleString('en-IN')}. Status: ${feasibility.feasibilityStatus.toUpperCase()}.`
        : `Successfully registered new goal "${targetGoal.name}". Target: ₹${targetGoal.targetAmount.toLocaleString('en-IN')}, Planned: ₹${targetGoal.monthlyContribution.toLocaleString('en-IN')}/mo. Status: ${feasibility.feasibilityStatus.toUpperCase()}.`,
  };
}
