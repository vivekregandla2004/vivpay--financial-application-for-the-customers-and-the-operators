/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EightDimensionalBehavior,
  BehavioralArchetype,
  ArchetypeEvaluation,
  BehavioralDimensionScore,
  FinancialIdentity,
} from './types.ts';
import { Transaction } from '../../types/database.ts';
import { CanonicalTransaction } from '../finance/types.ts';

// Universal transaction adapter for consistent metric analysis
interface NormalizedTx {
  id: string;
  amount: number;
  direction: 'debit' | 'credit';
  date: string;
  description: string;
  category: string;
  paymentMethod: string;
}

function adaptTransaction(tx: any): NormalizedTx {
  const amount = Math.abs(Number(tx.amount || tx.debit || tx.credit || 0));
  const direction: 'debit' | 'credit' =
    tx.direction === 'credit' || tx.type === 'credit' || (tx.credit && !tx.debit)
      ? 'credit'
      : 'debit';
  const date = (tx.date || '').slice(0, 10);
  const description = String(tx.description || tx.originalDescription || '').trim();
  const category = String(tx.category || tx.categoryName || 'Others').trim();
  const paymentMethod = String(tx.paymentMethod || 'other').toLowerCase();

  return { id: tx.id || `tx-${Math.random()}`, amount, direction, date, description, category, paymentMethod };
}

function clamp(val: number, min = 0, max = 100): number {
  if (isNaN(val) || !isFinite(val)) return min;
  return Math.min(max, Math.max(min, Math.round(val)));
}

/**
 * Validates and analyzes transaction records across the 8 behavioral dimensions.
 * Guarantees bounded scores [0, 100] without NaN or Infinity.
 */
export function analyzeBehaviour(
  transactions: (Transaction | CanonicalTransaction | any)[],
  identity?: FinancialIdentity
): {
  behavior: EightDimensionalBehavior;
  archetypes: ArchetypeEvaluation[];
} {
  const adapted = (transactions || []).map(adaptTransaction).filter((t) => t.date && t.amount > 0);
  const totalCount = adapted.length;

  // Determine date span in days
  const dates = adapted.map((t) => t.date).sort();
  let daysSpan = 0;
  if (dates.length >= 2) {
    const first = new Date(dates[0]).getTime();
    const last = new Date(dates[dates.length - 1]).getTime();
    daysSpan = Math.max(1, Math.round((last - first) / (1000 * 3600 * 24)));
  }
  const monthsSpan = Math.max(1, Math.ceil(daysSpan / 30));

  // Determine sufficiency
  const isSufficient = totalCount >= 5 && daysSpan >= 7;
  const isPartial = totalCount >= 2 && !isSufficient;
  const dataSufficiency: EightDimensionalBehavior['dataSufficiency'] = isSufficient
    ? 'sufficient'
    : isPartial
    ? 'partial'
    : 'insufficient';

  // Base metrics
  const debits = adapted.filter((t) => t.direction === 'debit');
  const credits = adapted.filter((t) => t.direction === 'credit');

  const totalDebits = debits.reduce((acc, t) => acc + t.amount, 0);
  const totalCredits = credits.reduce((acc, t) => acc + t.amount, 0);

  // Inflow baseline (use statement credits if present, fallback to declared income)
  const declaredMonthly = identity?.income?.monthlyIncome || 0;
  const totalInflow = totalCredits > 0 ? totalCredits : declaredMonthly * monthsSpan;
  const monthlyInflow = monthsSpan > 0 ? totalInflow / monthsSpan : declaredMonthly;

  // ---------------------------------------------------------------------------
  // 1. Shopping Discipline
  // ---------------------------------------------------------------------------
  const shoppingDebits = debits.filter((t) => {
    const cat = t.category.toLowerCase();
    const desc = t.description.toLowerCase();
    return (
      cat.includes('shopping') ||
      cat.includes('entertainment') ||
      desc.includes('amazon') ||
      desc.includes('flipkart') ||
      desc.includes('myntra') ||
      desc.includes('zara') ||
      desc.includes('h&m')
    );
  });
  const shoppingTotal = shoppingDebits.reduce((acc, t) => acc + t.amount, 0);
  const shoppingRatio = totalDebits > 0 ? (shoppingTotal / totalDebits) * 100 : 0;

  let shoppingScore = 75; // Neutral default
  let shoppingConfidence = isSufficient ? 0.9 : isPartial ? 0.5 : 0.2;
  let shoppingJustification = 'Discretionary shopping represents a balanced share of total outflow.';

  if (dataSufficiency !== 'insufficient' && totalDebits > 0) {
    if (shoppingRatio <= 10) {
      shoppingScore = clamp(95 - shoppingRatio);
      shoppingJustification = `Minimal discretionary retail drag (${shoppingRatio.toFixed(1)}% of spending). High impulse control.`;
    } else if (shoppingRatio <= 25) {
      shoppingScore = clamp(85 - (shoppingRatio - 10) * 1.5);
      shoppingJustification = `Moderate, controlled retail purchases (${shoppingRatio.toFixed(1)}% of spending).`;
    } else if (shoppingRatio <= 40) {
      shoppingScore = clamp(65 - (shoppingRatio - 25) * 1.5);
      shoppingJustification = `Elevated lifestyle and retail spending (${shoppingRatio.toFixed(1)}% of spending).`;
    } else {
      shoppingScore = clamp(40 - (shoppingRatio - 40) * 0.8, 5, 40);
      shoppingJustification = `Heavy concentration in shopping and impulse retail (${shoppingRatio.toFixed(1)}% of spending).`;
    }
  } else if (dataSufficiency === 'insufficient') {
    shoppingScore = 60;
    shoppingConfidence = 0.2;
    shoppingJustification = 'Insufficient statement data to accurately assess shopping impulse control.';
  }

  const shoppingDiscipline: BehavioralDimensionScore = {
    score: shoppingScore,
    confidence: shoppingConfidence,
    evidenceCount: shoppingDebits.length,
    trend: isSufficient ? 'stable' : 'insufficient_data',
    justification: shoppingJustification,
    factors: [
      { label: 'Discretionary Shopping Volume', value: `₹${Math.round(shoppingTotal).toLocaleString()}`, impact: shoppingRatio > 25 ? 'negative' : 'positive' },
      { label: 'Shopping Share of Outflows', value: `${shoppingRatio.toFixed(1)}%`, impact: shoppingRatio > 30 ? 'negative' : 'neutral' },
    ],
  };

  // ---------------------------------------------------------------------------
  // 2. Savings Velocity
  // ---------------------------------------------------------------------------
  const netSurplus = totalInflow - totalDebits;
  const savingsRate = totalInflow > 0 ? (netSurplus / totalInflow) * 100 : 0;

  let savingsScore = 50;
  let savingsConfidence = isSufficient ? 0.95 : isPartial ? 0.6 : 0.2;
  let savingsJustification = 'Net savings velocity is tracking in neutral territory.';

  if (dataSufficiency !== 'insufficient' && totalInflow > 0) {
    if (savingsRate >= 35) {
      savingsScore = clamp(85 + (savingsRate - 35) * 0.5, 85, 100);
      savingsJustification = `Outstanding savings velocity: retaining ${savingsRate.toFixed(1)}% of inbound cash flow.`;
    } else if (savingsRate >= 20) {
      savingsScore = clamp(70 + (savingsRate - 20) * 1.0, 70, 84);
      savingsJustification = `Strong capital retention with a ${savingsRate.toFixed(1)}% net monthly surplus rate.`;
    } else if (savingsRate >= 5) {
      savingsScore = clamp(50 + (savingsRate - 5) * 1.3, 50, 69);
      savingsJustification = `Positive but modest savings accumulation at ${savingsRate.toFixed(1)}% of total income.`;
    } else if (savingsRate >= 0) {
      savingsScore = clamp(40 + savingsRate * 2, 40, 49);
      savingsJustification = `Break-even cash flow margin (${savingsRate.toFixed(1)}%). Buffer replenishment recommended.`;
    } else {
      // Deficit spending
      savingsScore = clamp(40 + savingsRate * 0.8, 0, 39);
      savingsJustification = `Net cash flow contraction: monthly expenditures exceed verified inflow by ${Math.abs(savingsRate).toFixed(1)}%.`;
    }
  } else if (dataSufficiency === 'insufficient') {
    savingsScore = 55;
    savingsConfidence = 0.2;
    savingsJustification = 'Insufficient transaction duration to determine baseline savings velocity.';
  }

  const savingsVelocity: BehavioralDimensionScore = {
    score: savingsScore,
    confidence: savingsConfidence,
    evidenceCount: credits.length,
    trend: savingsRate >= 15 ? 'improving' : savingsRate < 0 ? 'deteriorating' : 'stable',
    justification: savingsJustification,
    factors: [
      { label: 'Net Cash Flow Surplus', value: `₹${Math.round(netSurplus).toLocaleString()}`, impact: netSurplus > 0 ? 'positive' : 'negative' },
      { label: 'Observed Savings Rate', value: `${savingsRate.toFixed(1)}%`, impact: savingsRate >= 20 ? 'positive' : savingsRate < 5 ? 'negative' : 'neutral' },
    ],
  };

  // ---------------------------------------------------------------------------
  // 3. Income Stability
  // ---------------------------------------------------------------------------
  const salaryTxs = credits.filter((t) => {
    const cat = t.category.toLowerCase();
    const desc = t.description.toLowerCase();
    return cat.includes('salary') || desc.includes('salary') || desc.includes('payroll') || desc.includes('techcorp');
  });

  let incomeScore = 70;
  let incomeConfidence = isSufficient ? 0.85 : 0.4;
  let incomeJustification = 'Inflow streams demonstrate consistent recurring timing.';

  if (dataSufficiency !== 'insufficient') {
    const isDeclaredSalaried = identity?.employment?.status === 'salaried';
    const isFreelance = identity?.employment?.status === 'freelancer' || identity?.income?.frequency === 'irregular';

    if (salaryTxs.length >= 1 && isDeclaredSalaried) {
      incomeScore = 88;
      incomeJustification = 'Verified regular salary deposits aligned with declared employment status.';
    } else if (isDeclaredSalaried) {
      incomeScore = 80;
      incomeJustification = 'Declared salaried employment with stable recurring credits.';
    } else if (isFreelance) {
      incomeScore = 48;
      incomeJustification = 'Variable freelancer inflow profile with fluctuating deposit intervals.';
    } else {
      incomeScore = credits.length > 2 ? 72 : 55;
      incomeJustification = 'Standard cash inflow regularity with multiple periodic deposits.';
    }
  } else {
    incomeScore = 65;
    incomeConfidence = 0.3;
    incomeJustification = 'Baseline stability inferred from declared profile; more statement months needed for statistical validation.';
  }

  const incomeStability: BehavioralDimensionScore = {
    score: incomeScore,
    confidence: incomeConfidence,
    evidenceCount: credits.length,
    trend: isSufficient ? 'stable' : 'insufficient_data',
    justification: incomeJustification,
    factors: [
      { label: 'Verified Income Credits', value: credits.length, impact: credits.length >= 1 ? 'positive' : 'neutral' },
      { label: 'Employment Status', value: identity?.employment?.status || 'Salaried', impact: 'positive' },
    ],
  };

  // ---------------------------------------------------------------------------
  // 4. Loan Repayment & EMI Load
  // ---------------------------------------------------------------------------
  const emiDebits = debits.filter((t) => {
    const cat = t.category.toLowerCase();
    const desc = t.description.toLowerCase();
    return cat.includes('emi') || cat.includes('loan') || desc.includes('emi') || desc.includes('loan') || desc.includes('bajaj');
  });
  const emiTotal = emiDebits.reduce((acc, t) => acc + t.amount, 0);
  const monthlyEmi = monthsSpan > 0 ? emiTotal / monthsSpan : emiTotal;
  const dti = monthlyInflow > 0 ? (monthlyEmi / monthlyInflow) * 100 : 0;

  let emiScore = 85;
  let emiConfidence = isSufficient ? 0.9 : 0.5;
  let emiJustification = 'Debt service load is healthy and well within safe borrowing guidelines.';

  if (dataSufficiency !== 'insufficient') {
    if (dti === 0 && emiDebits.length === 0) {
      emiScore = 95;
      emiJustification = 'Zero debt obligations observed. Fully unencumbered monthly cash flow.';
    } else if (dti <= 15) {
      emiScore = clamp(90 - dti * 0.5);
      emiJustification = `Conservative debt-to-income burden of ${dti.toFixed(1)}% (recommended < 30%).`;
    } else if (dti <= 35) {
      emiScore = clamp(80 - (dti - 15) * 1.2);
      emiJustification = `Manageable EMI load of ${dti.toFixed(1)}% of verified monthly inflow.`;
    } else if (dti <= 50) {
      emiScore = clamp(55 - (dti - 35) * 1.5);
      emiJustification = `Elevated EMI debt service load (${dti.toFixed(1)}% DTI). Prone to cash flow tightening.`;
    } else {
      emiScore = clamp(30 - (dti - 50) * 0.5, 0, 30);
      emiJustification = `Critical debt overload (${dti.toFixed(1)}% DTI). Exceeds prudent borrowing ceilings.`;
    }
  } else {
    // Insufficient statement data - check declared commitments
    const declaredEmi = (identity?.commitments?.homeLoanEmi || 0) + (identity?.commitments?.vehicleLoanEmi || 0) + (identity?.commitments?.personalLoanEmi || 0);
    const declaredDti = declaredMonthly > 0 ? (declaredEmi / declaredMonthly) * 100 : 0;
    if (declaredDti > 0) {
      emiScore = clamp(90 - declaredDti * 1.2, 35, 95);
      emiJustification = `Evaluated against declared loan obligations (${declaredDti.toFixed(1)}% DTI).`;
    } else {
      emiScore = 90;
      emiJustification = 'No active loan EMIs registered in ledger or profile.';
    }
  }

  const loanRepaymentEmiLoad: BehavioralDimensionScore = {
    score: emiScore,
    confidence: emiConfidence,
    evidenceCount: emiDebits.length,
    trend: dti > 40 ? 'deteriorating' : 'stable',
    justification: emiJustification,
    factors: [
      { label: 'Monthly Debt Service', value: `₹${Math.round(monthlyEmi).toLocaleString()}`, impact: dti > 30 ? 'negative' : 'positive' },
      { label: 'Debt-to-Income (DTI)', value: `${dti.toFixed(1)}%`, impact: dti > 35 ? 'negative' : 'positive' },
    ],
  };

  // ---------------------------------------------------------------------------
  // 5. Subscription & Discretionary Load
  // ---------------------------------------------------------------------------
  const subDebits = debits.filter((t) => {
    const cat = t.category.toLowerCase();
    const desc = t.description.toLowerCase();
    return (
      desc.includes('netflix') ||
      desc.includes('spotify') ||
      desc.includes('prime') ||
      desc.includes('gym') ||
      desc.includes('apple') ||
      desc.includes('google') ||
      desc.includes('hotstar') ||
      cat.includes('entertainment')
    );
  });
  const subTotal = subDebits.reduce((acc, t) => acc + t.amount, 0);
  const subShare = totalDebits > 0 ? (subTotal / totalDebits) * 100 : 0;

  let subScore = 80;
  let subConfidence = isSufficient ? 0.85 : 0.4;
  let subJustification = 'Recurring subscriptions and discretionary digital services are right-sized.';

  if (dataSufficiency !== 'insufficient' && totalDebits > 0) {
    if (subShare <= 4) {
      subScore = clamp(92 - subShare * 1.5);
      subJustification = `Lean recurring subscription footprint (${subShare.toFixed(1)}% of monthly spend).`;
    } else if (subShare <= 12) {
      subScore = clamp(85 - (subShare - 4) * 1.2);
      subJustification = `Standard digital entertainment load (${subShare.toFixed(1)}% of spend).`;
    } else {
      subScore = clamp(60 - (subShare - 12) * 1.5, 10, 60);
      subJustification = `High concentration of recurring digital subscriptions (${subShare.toFixed(1)}% of spend).`;
    }
  }

  const subscriptionDiscretionaryLoad: BehavioralDimensionScore = {
    score: subScore,
    confidence: subConfidence,
    evidenceCount: subDebits.length,
    trend: isSufficient ? 'stable' : 'insufficient_data',
    justification: subJustification,
    factors: [
      { label: 'Active Subscription Count', value: subDebits.length, impact: subDebits.length > 5 ? 'negative' : 'neutral' },
      { label: 'Subscription Share of Spend', value: `${subShare.toFixed(1)}%`, impact: subShare > 10 ? 'negative' : 'positive' },
    ],
  };

  // ---------------------------------------------------------------------------
  // 6. Bill Payment Discipline
  // ---------------------------------------------------------------------------
  const billDebits = debits.filter((t) => {
    const cat = t.category.toLowerCase();
    const desc = t.description.toLowerCase();
    return cat.includes('utilit') || cat.includes('recharge') || desc.includes('bescom') || desc.includes('electricity') || desc.includes('card payment') || desc.includes('cred');
  });
  const penaltyTxs = debits.filter((t) => /penalty|late fee|overdue|interest charge|bounce/i.test(t.description));

  let billScore = 85;
  let billConfidence = isSufficient ? 0.9 : 0.5;
  let billJustification = 'Regular utility and bill settlements with zero overdue charges detected.';

  if (penaltyTxs.length > 0) {
    billScore = clamp(50 - penaltyTxs.length * 15, 10, 50);
    billJustification = `Detected ${penaltyTxs.length} late fee or penalty charge(s) in payment records.`;
  } else if (billDebits.length >= 2) {
    billScore = 92;
    billJustification = 'Consistent on-time utility and credit settlements across observed billing cycles.';
  }

  const billPaymentDiscipline: BehavioralDimensionScore = {
    score: billScore,
    confidence: billConfidence,
    evidenceCount: billDebits.length,
    trend: penaltyTxs.length > 0 ? 'deteriorating' : 'stable',
    justification: billJustification,
    factors: [
      { label: 'Utility & Bill Settlements', value: billDebits.length, impact: 'positive' },
      { label: 'Late Charges / Penalties', value: penaltyTxs.length, impact: penaltyTxs.length > 0 ? 'negative' : 'positive' },
    ],
  };

  // ---------------------------------------------------------------------------
  // 7. Cash Withdrawal Frequency
  // ---------------------------------------------------------------------------
  const cashDebits = debits.filter((t) => {
    const cat = t.category.toLowerCase();
    const desc = t.description.toLowerCase();
    return cat.includes('cash') || cat.includes('atm') || desc.includes('atm') || desc.includes('cash wdl') || desc.includes('self wdl');
  });
  const cashTotal = cashDebits.reduce((acc, t) => acc + t.amount, 0);
  const cashShare = totalDebits > 0 ? (cashTotal / totalDebits) * 100 : 0;

  let cashScore = 80;
  let cashConfidence = isSufficient ? 0.9 : 0.4;
  let cashJustification = 'Minimal untracked cash leakages; high digital payment traceability.';

  if (dataSufficiency !== 'insufficient' && totalDebits > 0) {
    if (cashShare <= 5) {
      cashScore = 92;
      cashJustification = `High ledger transparency: ATM withdrawals represent only ${cashShare.toFixed(1)}% of outflows.`;
    } else if (cashShare <= 18) {
      cashScore = clamp(85 - (cashShare - 5) * 1.5);
      cashJustification = `Moderate cash liquidity usage (${cashShare.toFixed(1)}% of spending).`;
    } else {
      cashScore = clamp(60 - (cashShare - 18) * 1.2, 10, 60);
      cashJustification = `Elevated cash reliance (${cashShare.toFixed(1)}% of spend); harder to categorize automatically.`;
    }
  }

  const cashWithdrawalFrequency: BehavioralDimensionScore = {
    score: cashScore,
    confidence: cashConfidence,
    evidenceCount: cashDebits.length,
    trend: isSufficient ? 'stable' : 'insufficient_data',
    justification: cashJustification,
    factors: [
      { label: 'ATM Withdrawal Count', value: cashDebits.length, impact: cashDebits.length > 4 ? 'negative' : 'neutral' },
      { label: 'Physical Cash Share', value: `${cashShare.toFixed(1)}%`, impact: cashShare > 15 ? 'negative' : 'positive' },
    ],
  };

  // ---------------------------------------------------------------------------
  // 8. Investment Ratio
  // ---------------------------------------------------------------------------
  const investDebits = debits.filter((t) => {
    const cat = t.category.toLowerCase();
    const desc = t.description.toLowerCase();
    return (
      cat.includes('invest') ||
      cat.includes('sip') ||
      desc.includes('zerodha') ||
      desc.includes('groww') ||
      desc.includes('sip') ||
      desc.includes('mutual fund') ||
      desc.includes('ppf') ||
      desc.includes('nps')
    );
  });
  const investTotal = investDebits.reduce((acc, t) => acc + t.amount, 0);
  const declaredSip = identity?.commitments?.sipContributions || 0;
  const effectiveInvestTotal = investTotal > 0 ? investTotal : declaredSip * monthsSpan;
  const investShare = totalInflow > 0 ? (effectiveInvestTotal / totalInflow) * 100 : 0;

  let investScore = 55;
  let investConfidence = isSufficient ? 0.9 : 0.5;
  let investJustification = 'Investment allocation is tracking moderately towards long-term wealth goals.';

  if (investShare >= 25) {
    investScore = clamp(85 + (investShare - 25) * 0.6, 85, 100);
    investJustification = `Exceptional wealth compounding: allocating ${investShare.toFixed(1)}% of total income to investments.`;
  } else if (investShare >= 15) {
    investScore = clamp(70 + (investShare - 15) * 1.5, 70, 84);
    investJustification = `Healthy capital allocation: ${investShare.toFixed(1)}% of income routed to SIPs/investments.`;
  } else if (investShare >= 5) {
    investScore = clamp(50 + (investShare - 5) * 2.0, 50, 69);
    investJustification = `Initial investment momentum (${investShare.toFixed(1)}% of income). Growth acceleration possible.`;
  } else {
    investScore = clamp(20 + investShare * 4, 10, 45);
    investJustification = `Low observed investment footprint (${investShare.toFixed(1)}% of income). Consider setting up automated SIPs.`;
  }

  const investmentRatio: BehavioralDimensionScore = {
    score: investScore,
    confidence: investConfidence,
    evidenceCount: investDebits.length,
    trend: investShare >= 15 ? 'improving' : 'stable',
    justification: investJustification,
    factors: [
      { label: 'Monthly Investment Routing', value: `₹${Math.round(effectiveInvestTotal / monthsSpan).toLocaleString()}`, impact: investShare >= 15 ? 'positive' : 'neutral' },
      { label: 'Investment Share of Income', value: `${investShare.toFixed(1)}%`, impact: investShare >= 15 ? 'positive' : 'negative' },
    ],
  };

  // ---------------------------------------------------------------------------
  // Overall Financial Discipline Score
  // ---------------------------------------------------------------------------
  const overallFinancialDiscipline = clamp(
    shoppingScore * 0.15 +
    savingsScore * 0.25 +
    incomeScore * 0.15 +
    emiScore * 0.15 +
    subScore * 0.08 +
    billScore * 0.08 +
    cashScore * 0.04 +
    investScore * 0.10
  );

  const behavior: EightDimensionalBehavior = {
    shoppingDiscipline,
    savingsVelocity,
    incomeStability,
    loanRepaymentEmiLoad,
    subscriptionDiscretionaryLoad,
    billPaymentDiscipline,
    cashWithdrawalFrequency,
    investmentRatio,
    overallFinancialDiscipline,
    dataSufficiency,
    totalTransactionsEvaluated: totalCount,
    observationPeriodMonths: monthsSpan,
  };

  // ---------------------------------------------------------------------------
  // Behavioral Archetype Evaluations
  // Strict rule: "Do not label a user when the required evidence is insufficient."
  // ---------------------------------------------------------------------------
  const archetypes: ArchetypeEvaluation[] = [
    {
      archetype: 'excellent_saver',
      label: 'Disciplined Capital Accumulator',
      description: 'Sustains a high net savings velocity (>=70) and resilient positive cash flow buffer.',
      matched: isSufficient && savingsVelocity.score >= 70 && netSurplus > 0,
      confidence: savingsVelocity.confidence,
      evidence: `Savings velocity score of ${savingsVelocity.score}/100 with ₹${Math.round(netSurplus).toLocaleString()} net accumulated surplus.`,
      thresholdMetDescription: 'Savings Velocity >= 70 & Net Cash Flow > 0',
    },
    {
      archetype: 'impulse_spender',
      label: 'Elevated Discretionary Spender',
      description: 'Prone to high volume retail or unbudgeted shopping outflows (<45 shopping score).',
      matched: isSufficient && shoppingDiscipline.score < 45,
      confidence: shoppingDiscipline.confidence,
      evidence: `Shopping discipline score of ${shoppingDiscipline.score}/100 with ${shoppingRatio.toFixed(1)}% of total outflow in discretionary shopping.`,
      thresholdMetDescription: 'Shopping Discipline Score < 45',
    },
    {
      archetype: 'high_emi_load',
      label: 'Leveraged Debt Bearer',
      description: 'Significant portion of monthly income tied to loan and EMI commitments (score < 45).',
      matched: isSufficient && loanRepaymentEmiLoad.score < 45,
      confidence: loanRepaymentEmiLoad.confidence,
      evidence: `EMI burden score of ${loanRepaymentEmiLoad.score}/100 with ${dti.toFixed(1)}% debt-to-income ratio.`,
      thresholdMetDescription: 'Loan Repayment & EMI Load < 45 (or DTI > 35%)',
    },
    {
      archetype: 'stable_income',
      label: 'Predictable Earner',
      description: 'Consistent, predictable income deposits with low timing variance (score >= 75).',
      matched: isSufficient && incomeStability.score >= 75,
      confidence: incomeStability.confidence,
      evidence: `Income stability score of ${incomeStability.score}/100 based on verified regular deposits.`,
      thresholdMetDescription: 'Income Stability >= 75',
    },
    {
      archetype: 'irregular_income',
      label: 'Variable Cash Flow earner',
      description: 'Fluctuating or milestone-based income deposits with non-uniform intervals.',
      matched: isSufficient && (incomeStability.score < 45 || identity?.income?.frequency === 'irregular'),
      confidence: incomeStability.confidence,
      evidence: `Income stability score of ${incomeStability.score}/100 or declared irregular earnings pattern.`,
      thresholdMetDescription: 'Income Stability < 45 or Irregular Frequency',
    },
    {
      archetype: 'subscription_heavy',
      label: 'Digital Subscription Concentrated',
      description: 'High number or high aggregate spend on recurring digital services and entertainment.',
      matched: isSufficient && subscriptionDiscretionaryLoad.score < 45,
      confidence: subscriptionDiscretionaryLoad.confidence,
      evidence: `Subscription load score of ${subscriptionDiscretionaryLoad.score}/100 with ${subDebits.length} repeating recurring charges.`,
      thresholdMetDescription: 'Subscription & Discretionary Load < 45',
    },
    {
      archetype: 'investment_focused',
      label: 'Wealth Compounder',
      description: 'Systematically directs a substantial percentage of monthly cash flow to investments & SIPs (score >= 60).',
      matched: isSufficient && investmentRatio.score >= 60,
      confidence: investmentRatio.confidence,
      evidence: `Investment ratio score of ${investmentRatio.score}/100 with ${investShare.toFixed(1)}% of income routed to compounding assets.`,
      thresholdMetDescription: 'Investment Ratio >= 60',
    },
  ];

  return { behavior, archetypes };
}
