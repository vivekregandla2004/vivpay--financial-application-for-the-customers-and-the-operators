/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CanonicalTransaction,
  MonthlySummary,
  BehavioralMetrics,
  RecurringSubscriptionCandidate,
  FinancialHealthResult,
  HealthFactorResult,
  HealthGrade,
} from '../types.ts';

/**
 * Calculates a comprehensive Financial Health and Risk score using the canonical
 * ten-factor model (maximum 100 points):
 *
 * 1. Savings Rate (25 pts)
 * 2. Cash Flow (15 pts)
 * 3. Emergency Buffer (10 pts)
 * 4. Income Stability (10 pts)
 * 5. Expense Stability (10 pts)
 * 6. Debt/EMI Burden (10 pts)
 * 7. Investment Ratio (7 pts)
 * 8. Subscription Load (5 pts)
 * 9. Discretionary Spending (5 pts)
 * 10. Recurring Bills (3 pts)
 */
export function computeFinancialHealthScore(
  transactions: CanonicalTransaction[],
  monthlySummaries: MonthlySummary[],
  metrics: BehavioralMetrics,
  recurringCandidates: RecurringSubscriptionCandidate[] = []
): FinancialHealthResult {
  const isShortDataset = monthlySummaries.length < 2 || metrics.totalCalendarDays < 45;
  const factors: HealthFactorResult[] = [];

  let totalMaxPoints = 100;
  let totalAwardedPoints = 0;
  let evaluatableMaxPoints = 0;

  const debits = transactions.filter((t) => t.direction === 'debit');
  const credits = transactions.filter((t) => t.direction === 'credit');

  const totalIncome = monthlySummaries.reduce((sum, m) => sum + m.income, 0);
  const totalExpenses = monthlySummaries.reduce((sum, m) => sum + m.expenses, 0);
  const avgMonthlyIncome = monthlySummaries.length > 0 ? totalIncome / monthlySummaries.length : 0;
  const avgMonthlyExpenses = monthlySummaries.length > 0 ? totalExpenses / monthlySummaries.length : 0;

  // -------------------------------------------------------------
  // FACTOR 1: Savings Rate (Max 25 pts)
  // -------------------------------------------------------------
  const avgSavingsRate =
    monthlySummaries.length > 0
      ? monthlySummaries
          .map((m) => m.savingsRate || 0)
          .reduce((a, b) => a + b, 0) / monthlySummaries.length
      : 0;

  let f1Points = 0;
  let f1Sufficiency: 'sufficient' | 'partial' | 'insufficient' = 'sufficient';
  if (totalIncome <= 0 || monthlySummaries.length === 0) {
    f1Sufficiency = 'insufficient';
    f1Points = 0;
  } else if (avgSavingsRate >= 30) {
    f1Points = 25;
  } else if (avgSavingsRate >= 20) {
    f1Points = 20;
  } else if (avgSavingsRate >= 10) {
    f1Points = 14;
  } else if (avgSavingsRate >= 0) {
    f1Points = 8;
  } else {
    f1Points = 0;
  }

  totalAwardedPoints += f1Points;
  evaluatableMaxPoints += 25;
  factors.push({
    factorKey: 'savings_rate',
    name: 'Savings Rate',
    maxPoints: 25,
    awardedPoints: f1Points,
    measuredValue: totalIncome > 0 ? `${Math.round(avgSavingsRate)}% average savings rate` : 'N/A (No income credits)',
    numericValue: avgSavingsRate,
    explanation:
      avgSavingsRate >= 20
        ? 'Healthy operating surplus exceeding target wealth accumulation thresholds.'
        : avgSavingsRate >= 0
        ? 'Positive operating buffer, but below the recommended 20% savings margin.'
        : 'Expenses currently exceed or absorb incoming revenue.',
    dataSufficiency: f1Sufficiency,
    recommendation:
      avgSavingsRate < 20
        ? 'Target a minimum 20% savings margin by containing discretionary lifestyle outlays.'
        : 'Maintain automatic savings allocations toward long-term wealth assets.',
  });

  // -------------------------------------------------------------
  // FACTOR 2: Cash Flow (Max 15 pts)
  // -------------------------------------------------------------
  const positiveMonths = monthlySummaries.filter((m) => m.netCashFlow > 0).length;
  const cashFlowRatio = monthlySummaries.length > 0 ? positiveMonths / monthlySummaries.length : 0;

  let f2Points = 0;
  if (monthlySummaries.length === 0) {
    f2Points = 0;
  } else if (cashFlowRatio === 1) {
    f2Points = 15;
  } else if (cashFlowRatio >= 0.75) {
    f2Points = 11;
  } else if (cashFlowRatio >= 0.5) {
    f2Points = 7;
  } else if (totalIncome >= totalExpenses) {
    f2Points = 4;
  } else {
    f2Points = 0;
  }

  totalAwardedPoints += f2Points;
  evaluatableMaxPoints += 15;
  factors.push({
    factorKey: 'cash_flow',
    name: 'Cash Flow Surplus Consistency',
    maxPoints: 15,
    awardedPoints: f2Points,
    measuredValue: `${positiveMonths} of ${monthlySummaries.length} months in net positive cash flow`,
    numericValue: cashFlowRatio,
    explanation:
      cashFlowRatio >= 0.75
        ? 'Consistent month-over-month operating liquidity with minimal capital drawdowns.'
        : 'Intermittent negative net cash flow cycles strain cash liquidity.',
    dataSufficiency: monthlySummaries.length > 0 ? 'sufficient' : 'insufficient',
    recommendation: 'Ensure monthly outflows never breach inbound revenue streams.',
  });

  // -------------------------------------------------------------
  // FACTOR 3: Emergency Buffer (Max 10 pts)
  // -------------------------------------------------------------
  // Search for the latest non-null closing balance in transactions
  const txWithBalance = [...transactions].reverse().find((t) => t.balance !== null && t.balance !== undefined);
  const closingBalance = txWithBalance ? txWithBalance.balance : null;

  let f3Points: number | null = null;
  let f3Sufficiency: 'sufficient' | 'partial' | 'insufficient' = 'insufficient';
  let f3Measured = 'Unavailable (No balance column in statement)';
  let f3Exp = 'Statement source does not record running account balance.';

  if (closingBalance !== null && closingBalance !== undefined && avgMonthlyExpenses > 0) {
    const monthsRunway = closingBalance / avgMonthlyExpenses;
    f3Sufficiency = 'sufficient';
    f3Measured = `${monthsRunway.toFixed(1)} months of expenses (₹${Math.round(closingBalance).toLocaleString()})`;
    if (monthsRunway >= 6) {
      f3Points = 10;
      f3Exp = 'Outstanding liquid emergency reserve exceeding 6 months of burn rate.';
    } else if (monthsRunway >= 3) {
      f3Points = 7;
      f3Exp = 'Adequate emergency cushion covering 3 to 6 months of essential outlays.';
    } else if (monthsRunway >= 1) {
      f3Points = 4;
      f3Exp = 'Limited liquid buffer; covers under 3 months of baseline burn rate.';
    } else {
      f3Points = 1;
      f3Exp = 'Thin liquidity runway; vulnerable to short-term income disruptions.';
    }
  } else {
    f3Points = null; // Do not award unsupported points when data is unavailable!
  }

  if (f3Points !== null) {
    totalAwardedPoints += f3Points;
    evaluatableMaxPoints += 10;
  }
  factors.push({
    factorKey: 'emergency_buffer',
    name: 'Emergency Buffer & Liquidity',
    maxPoints: 10,
    awardedPoints: f3Points,
    measuredValue: f3Measured,
    explanation: f3Exp,
    dataSufficiency: f3Sufficiency,
    recommendation: 'Target holding 3 to 6 months of mandatory living outlays in liquid interest-bearing accounts.',
  });

  // -------------------------------------------------------------
  // FACTOR 4: Income Stability (Max 10 pts)
  // -------------------------------------------------------------
  const salaryTxs = transactions.filter((t) => t.category === 'Salary');
  const distinctIncomeMonths = new Set(credits.map((t) => t.date.slice(0, 7))).size;

  let f4Points = 0;
  if (salaryTxs.length > 0) {
    f4Points = 10;
  } else if (distinctIncomeMonths >= 2) {
    f4Points = 7;
  } else if (credits.length > 0) {
    f4Points = 4;
  } else {
    f4Points = 0;
  }

  totalAwardedPoints += f4Points;
  evaluatableMaxPoints += 10;
  factors.push({
    factorKey: 'income_stability',
    name: 'Income Stability',
    maxPoints: 10,
    awardedPoints: f4Points,
    measuredValue: salaryTxs.length > 0 ? 'Verified Recurring Payroll / Salary' : `${credits.length} inflow credits`,
    explanation:
      salaryTxs.length > 0
        ? 'Verified predictable corporate payroll or structured recurring remuneration.'
        : 'Inflows exhibit variable timing without distinct corporate payroll coding.',
    dataSufficiency: 'sufficient',
    recommendation: 'Smooth freelance or business revenue with fixed monthly owner withdrawals.',
  });

  // -------------------------------------------------------------
  // FACTOR 5: Expense Stability (Max 10 pts)
  // -------------------------------------------------------------
  let f5Points = 5;
  let f5Sufficiency: 'sufficient' | 'partial' | 'insufficient' = 'partial';
  let f5Measured = 'Single billing cycle evaluated';

  if (metrics.monthlyExpenseVolatility !== null) {
    f5Sufficiency = 'sufficient';
    f5Measured = `${Math.round(metrics.monthlyExpenseVolatility * 100)}% coefficient of variation`;
    if (metrics.monthlyExpenseVolatility < 0.15) {
      f5Points = 10;
    } else if (metrics.monthlyExpenseVolatility < 0.3) {
      f5Points = 8;
    } else if (metrics.monthlyExpenseVolatility < 0.5) {
      f5Points = 5;
    } else {
      f5Points = 2;
    }
  }

  totalAwardedPoints += f5Points;
  evaluatableMaxPoints += 10;
  factors.push({
    factorKey: 'expense_stability',
    name: 'Expense Stability',
    maxPoints: 10,
    awardedPoints: f5Points,
    measuredValue: f5Measured,
    explanation:
      f5Points >= 8
        ? 'Predictable month-over-month burn rate with controlled ad-hoc swings.'
        : 'Variable spending swings create unpredictability across billing periods.',
    dataSufficiency: f5Sufficiency,
    recommendation: 'Pre-fund non-recurring seasonal commitments with dedicated sinking funds.',
  });

  // -------------------------------------------------------------
  // FACTOR 6: Debt / EMI Burden (Max 10 pts)
  // -------------------------------------------------------------
  let f6Points = 10;
  let f6Measured = '0% (No EMI obligation detected)';
  if (metrics.emiDebtBurden.available && metrics.emiDebtBurden.ratioToIncome !== null) {
    const foir = metrics.emiDebtBurden.ratioToIncome;
    f6Measured = `${foir}% FOIR (Fixed Obligation to Income)`;
    if (foir < 15) {
      f6Points = 10;
    } else if (foir < 30) {
      f6Points = 7;
    } else if (foir < 50) {
      f6Points = 4;
    } else {
      f6Points = 1;
    }
  }

  totalAwardedPoints += f6Points;
  evaluatableMaxPoints += 10;
  factors.push({
    factorKey: 'debt_burden',
    name: 'Debt & EMI Burden',
    maxPoints: 10,
    awardedPoints: f6Points,
    measuredValue: f6Measured,
    explanation:
      f6Points >= 7
        ? 'Debt servicing obligations remain comfortably below conservative financial thresholds.'
        : 'Elevated debt payments restrict discretionary flexibility.',
    dataSufficiency: 'sufficient',
    recommendation: 'Maintain total EMI repayments below 30% of verifiable take-home income.',
  });

  // -------------------------------------------------------------
  // FACTOR 7: Investment Ratio (Max 7 pts)
  // -------------------------------------------------------------
  const investSum = debits
    .filter((t) => t.category === 'Investment')
    .reduce((sum, t) => sum + t.amount, 0);
  const investRatio = avgMonthlyIncome > 0 ? ((investSum / (monthlySummaries.length || 1)) / avgMonthlyIncome) * 100 : 0;

  let f7Points = 0;
  if (investRatio >= 20) {
    f7Points = 7;
  } else if (investRatio >= 10) {
    f7Points = 5;
  } else if (investSum > 0) {
    f7Points = 3;
  } else {
    f7Points = 0;
  }

  totalAwardedPoints += f7Points;
  evaluatableMaxPoints += 7;
  factors.push({
    factorKey: 'investment_ratio',
    name: 'Investment Ratio',
    maxPoints: 7,
    awardedPoints: f7Points,
    measuredValue: investSum > 0 ? `${Math.round(investRatio)}% of income (₹${Math.round(investSum).toLocaleString()})` : '0% (No SIP / Investment entries)',
    explanation:
      f7Points >= 5
        ? 'Strong active capital compounding via mutual funds, equity SIPs, or systematic investments.'
        : 'Sub-optimal wealth creation allocation; surplus remains idle or unallocated.',
    dataSufficiency: 'sufficient',
    recommendation: 'Automate a minimum 15% SIP on payroll day into broad-market index vehicles.',
  });

  // -------------------------------------------------------------
  // FACTOR 8: Subscription Load (Max 5 pts)
  // -------------------------------------------------------------
  const totalSubMonthly = recurringCandidates.reduce((acc, c) => acc + c.estimatedMonthlyCost, 0);
  const subRatio = avgMonthlyExpenses > 0 ? (totalSubMonthly / avgMonthlyExpenses) * 100 : 0;

  let f8Points = 5;
  if (subRatio < 5) {
    f8Points = 5;
  } else if (subRatio <= 10) {
    f8Points = 3;
  } else {
    f8Points = 1;
  }

  totalAwardedPoints += f8Points;
  evaluatableMaxPoints += 5;
  factors.push({
    factorKey: 'subscription_load',
    name: 'Subscription Load',
    maxPoints: 5,
    awardedPoints: f8Points,
    measuredValue: `${Math.round(subRatio)}% of burn rate (₹${Math.round(totalSubMonthly).toLocaleString()}/mo)`,
    explanation:
      f8Points === 5
        ? 'Low recurring fixed subscription burden preserving agile cash flow.'
        : 'Repeating recurring services absorb a notable share of monthly disbursements.',
    dataSufficiency: 'sufficient',
    recommendation: 'Audit under-utilized streaming or digital memberships quarterly.',
  });

  // -------------------------------------------------------------
  // FACTOR 9: Discretionary Spending (Max 5 pts)
  // -------------------------------------------------------------
  const discretionaryCategories = ['Food & Dining', 'Shopping', 'Entertainment', 'Travel'];
  const discretionarySum = debits
    .filter((t) => discretionaryCategories.includes(t.category))
    .reduce((sum, t) => sum + t.amount, 0);
  const totalDebitSum = debits.reduce((sum, t) => sum + t.amount, 0);
  const discretionaryRatio = totalDebitSum > 0 ? (discretionarySum / totalDebitSum) * 100 : 0;

  let f9Points = 3;
  if (discretionaryRatio <= 30) {
    f9Points = 5;
  } else if (discretionaryRatio <= 45) {
    f9Points = 3;
  } else {
    f9Points = 1;
  }

  totalAwardedPoints += f9Points;
  evaluatableMaxPoints += 5;
  factors.push({
    factorKey: 'discretionary_spending',
    name: 'Discretionary Spending Ratio',
    maxPoints: 5,
    awardedPoints: f9Points,
    measuredValue: `${Math.round(discretionaryRatio)}% discretionary share`,
    explanation:
      f9Points === 5
        ? 'Disciplined lifestyle spending adhering closely to balanced personal finance benchmarks.'
        : 'Elevated lifestyle spending on dining, shopping, and entertainment absorbs surplus.',
    dataSufficiency: 'sufficient',
    recommendation: 'Keep discretionary lifestyle spending capped below 30% of net disbursements.',
  });

  // -------------------------------------------------------------
  // FACTOR 10: Recurring Bills (Max 3 pts)
  // -------------------------------------------------------------
  const billCategories = ['Utilities', 'Recharge', 'Rent', 'Insurance'];
  const billTxs = debits.filter((t) => billCategories.includes(t.category));

  let f10Points = 0;
  if (billTxs.length >= 2) {
    f10Points = 3;
  } else if (billTxs.length === 1) {
    f10Points = 2;
  } else {
    f10Points = 1;
  }

  totalAwardedPoints += f10Points;
  evaluatableMaxPoints += 3;
  factors.push({
    factorKey: 'recurring_bills',
    name: 'Recurring Bills & Overhead',
    maxPoints: 3,
    awardedPoints: f10Points,
    measuredValue: `${billTxs.length} utility / overhead bills serviced`,
    explanation:
      f10Points === 3
        ? 'Active, on-time servicing of essential utility, electricity, or telecom overhead.'
        : 'Few or intermittent recurring overhead transactions recorded in statement.',
    dataSufficiency: 'sufficient',
    recommendation: 'Consolidate recurring utility payments with automatic debit authorization.',
  });

  // -------------------------------------------------------------
  // Composite Score & Coverage Calculation
  // -------------------------------------------------------------
  // Normalize composite score out of evaluatable points to prevent penalizing missing balance
  const normalizedScore = evaluatableMaxPoints > 0
    ? Math.round((totalAwardedPoints / evaluatableMaxPoints) * 100)
    : 0;

  const coveragePercentage = Math.round((evaluatableMaxPoints / totalMaxPoints) * 100);

  let grade: HealthGrade = 'C';
  if (normalizedScore >= 88) grade = 'A+';
  else if (normalizedScore >= 78) grade = 'A';
  else if (normalizedScore >= 65) grade = 'B';
  else if (normalizedScore >= 50) grade = 'C';
  else if (normalizedScore >= 35) grade = 'D';
  else grade = 'F';

  let summary = '';
  if (grade === 'A+' || grade === 'A') {
    summary = `Top-tier financial health (${normalizedScore}/100, Grade ${grade}). High savings margin, controlled fixed debt, and resilient cash flow management across all 10 evaluation factors.`;
  } else if (grade === 'B') {
    summary = `Solid financial standing (${normalizedScore}/100, Grade ${grade}). Steady operating surplus and manageable liabilities, with opportunity to optimize discretionary burn and expand emergency buffers.`;
  } else if (grade === 'C') {
    summary = `Moderate financial resilience (${normalizedScore}/100, Grade ${grade}). Positive operating cash flow, but savings rate and variable spending leave limited buffer for financial shocks.`;
  } else {
    summary = `Constrained financial resilience (${normalizedScore}/100, Grade ${grade}). High outflow burn rate and low savings margin require systematic budget recalibration.`;
  }

  return {
    compositeScore: normalizedScore,
    grade,
    coveragePercentage,
    isProvisional: isShortDataset || coveragePercentage < 100,
    factors,
    summary,
  };
}
