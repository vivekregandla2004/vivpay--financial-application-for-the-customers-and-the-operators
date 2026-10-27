/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import {
  parseGoalIntent,
  synchronizeGoalFromIntent,
} from '../src/lib/goals/intentParser.ts';
import {
  calculateGoalFeasibility,
  calculatePortfolioGoalsFeasibility,
} from '../src/lib/goals/feasibility.ts';
import {
  loadIdentityFromStorage,
  saveIdentityToStorage,
} from '../src/lib/identity/store.ts';
import { FinancialGoal } from '../src/lib/identity/types.ts';

async function runGoalsIdentityAudit() {
  console.log('================================================================');
  console.log('    PHASE 4 AUDIT: GOALS & FINANCIAL IDENTITY VERIFICATION      ');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Authoritative Identity Goal Representation & Baseline
  // --------------------------------------------------------------------------
  console.log('[TEST 1] Verifying Single Authoritative Persisted Goal Store...');
  const initialIdentity = loadIdentityFromStorage('customer');
  assert(Array.isArray(initialIdentity.goals), 'Identity must contain goals array');
  const initialGoalCount = initialIdentity.goals.length;
  console.log(`  - Baseline goals registered: ${initialGoalCount}`);
  initialIdentity.goals.forEach((g) => {
    console.log(`    • [${g.id}] "${g.name}" | Target: ₹${g.targetAmount} | Saved: ₹${g.currentSavings} | Planned: ₹${g.monthlyContribution}/mo`);
  });
  console.log('  -> PASS: Authoritative store structure verified.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Repeated Intent Detection & Deduplication Guarantee
  // --------------------------------------------------------------------------
  console.log('[TEST 2] Verifying Deduplication on Repeated Natural Language Intents...');
  
  // Prompt 1: Initial creation/targeting of a new milestone
  const prompt1 = 'Viv, help me set a goal for Vacation in Bali with target ₹1,20,000 by 2027';
  const intent1 = parseGoalIntent(prompt1);
  assert(intent1.hasIntent, 'Must detect goal intent in prompt 1');
  assert.strictEqual(intent1.targetAmount, 120000, 'Must extract target amount ₹1,20,000');

  const res1 = synchronizeGoalFromIntent(intent1, 'customer', 60000);
  assert(res1.success, 'Sync 1 must succeed');
  assert.strictEqual(res1.action, 'created', 'First registration must be "created"');
  const vacationGoalId = res1.goal!.id;

  const countAfter1 = loadIdentityFromStorage('customer').goals.length;
  assert.strictEqual(countAfter1, initialGoalCount + 1, 'Goal count must increment by 1');
  console.log(`  - Pass 1 (Creation): Created "${res1.goal!.name}" [${vacationGoalId}] with target ₹${res1.goal!.targetAmount}`);

  // Prompt 2: Repeated intent updating the same goal
  const prompt2 = 'Viv, update my vacation goal savings to ₹35,000';
  const intent2 = parseGoalIntent(prompt2);
  assert(intent2.hasIntent, 'Must detect goal intent in prompt 2');

  const res2 = synchronizeGoalFromIntent(intent2, 'customer', 60000);
  assert(res2.success, 'Sync 2 must succeed');
  assert.strictEqual(res2.action, 'updated', 'Repeated intent must UPDATE existing goal rather than create duplicate');
  assert.strictEqual(res2.goal!.id, vacationGoalId, 'Must update the exact same goal ID');
  assert.strictEqual(res2.goal!.currentSavings, 35000, 'Must update current savings to ₹35,000');

  const countAfter2 = loadIdentityFromStorage('customer').goals.length;
  assert.strictEqual(countAfter2, countAfter1, 'Goal count MUST NOT increase on repeated intent update (ZERO DUPLICATES)');
  console.log(`  - Pass 2 (Repeated Intent): Correctly updated existing goal [${res2.goal!.id}]. Count remained ${countAfter2}`);

  // Prompt 3: Target revision of the same goal
  const prompt3 = 'Viv, increase my vacation milestone target to ₹1,50,000';
  const intent3 = parseGoalIntent(prompt3);
  const res3 = synchronizeGoalFromIntent(intent3, 'customer', 60000);
  assert.strictEqual(res3.action, 'updated');
  assert.strictEqual(res3.goal!.id, vacationGoalId);
  assert.strictEqual(res3.goal!.targetAmount, 150000);

  const countAfter3 = loadIdentityFromStorage('customer').goals.length;
  assert.strictEqual(countAfter3, countAfter1, 'Goal count MUST remain constant across repeated intent modifications');
  console.log(`  - Pass 3 (Target Revision): Updated target to ₹${res3.goal!.targetAmount}. Count remained ${countAfter3}`);
  console.log('  -> PASS: Deduplication invariant mathematically verified.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Feasibility Calculations Grounded in Available Cash Flow
  // --------------------------------------------------------------------------
  console.log('[TEST 3] Verifying Feasibility Calculations Against Net Cash Flow & Commitments...');
  const testGoal: FinancialGoal = {
    id: 'test-feasibility-goal',
    name: 'Electric SUV Downpayment',
    targetAmount: 360000,
    currentSavings: 120000,
    monthlyContribution: 20000,
    targetDate: '2027-10-31', // ~12 months away
    priority: 'high',
  };

  // Case A: Ample surplus cash flow (₹65,000/mo surplus vs ₹20,000/mo planned)
  const feasA = calculateGoalFeasibility(testGoal, 65000);
  console.log(`  - Case A (Ample Surplus ₹65,000 vs ₹20,000): Status = ${feasA.feasibilityStatus} (isFeasible: ${feasA.isFeasible})`);
  assert.strictEqual(feasA.feasibilityStatus, 'feasible');
  assert.strictEqual(feasA.isFeasible, true);

  // Case B: Tight surplus cash flow (₹23,000/mo surplus vs ₹20,000/mo planned -> consumes >80%)
  const feasB = calculateGoalFeasibility(testGoal, 23000);
  console.log(`  - Case B (Tight Surplus ₹23,000 vs ₹20,000): Status = ${feasB.feasibilityStatus} (isFeasible: ${feasB.isFeasible})`);
  assert.strictEqual(feasB.feasibilityStatus, 'tight');
  assert.strictEqual(feasB.isFeasible, true);

  // Case C: Deficit / Infeasible (₹12,000/mo surplus vs ₹20,000/mo planned)
  const feasC = calculateGoalFeasibility(testGoal, 12000);
  console.log(`  - Case C (Infeasible Surplus ₹12,000 vs ₹20,000): Status = ${feasC.feasibilityStatus} (isFeasible: ${feasC.isFeasible})`);
  assert.strictEqual(feasC.feasibilityStatus, 'unfeasible');
  assert.strictEqual(feasC.isFeasible, false);

  // Case D: Zero / Negative Cash Flow
  const feasD = calculateGoalFeasibility(testGoal, -5000);
  console.log(`  - Case D (Negative Cash Flow -₹5,000): Status = ${feasD.feasibilityStatus} (isFeasible: ${feasD.isFeasible})`);
  assert.strictEqual(feasD.feasibilityStatus, 'unfeasible');
  assert.strictEqual(feasD.isFeasible, false);

  // Portfolio Feasibility
  const portfolioFeas = calculatePortfolioGoalsFeasibility([testGoal], 65000);
  assert.strictEqual(portfolioFeas.netCashFlowAfterGoals, 45000, 'Net cash flow after goals must be ₹45,000');
  assert.strictEqual(portfolioFeas.isPortfolioFeasible, true);
  console.log('  -> PASS: Feasibility engine correctly evaluates all cash flow scenarios.\n');

  // --------------------------------------------------------------------------
  // TEST 4: Cleanup & Data Integrity Preservation
  // --------------------------------------------------------------------------
  console.log('[TEST 4] Verifying Goal Integrity and Cleanup...');
  // Restore original demo state
  const cleanedIdentity = loadIdentityFromStorage('customer');
  cleanedIdentity.goals = cleanedIdentity.goals.filter((g) => g.id !== vacationGoalId);
  saveIdentityToStorage('customer', cleanedIdentity);
  const finalCount = loadIdentityFromStorage('customer').goals.length;
  assert.strictEqual(finalCount, initialGoalCount, 'Must cleanly restore baseline goals');
  console.log('  -> PASS: Persistence and baseline restoration verified.\n');

  console.log('================================================================');
  console.log('     ALL GOALS & IDENTITY VERIFICATION SUITE CHECKS PASSED      ');
  console.log('================================================================');
}

runGoalsIdentityAudit().catch((err) => {
  console.error('Goals Audit failed with error:', err);
  process.exit(1);
});
