/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AskVivIntentType =
  | 'financial_metrics'
  | 'spending_trends'
  | 'recurring_payments'
  | 'cash_flow_and_goals'
  | 'unusual_transactions'
  | 'general_knowledge'
  | 'hybrid_mixed';

export interface ExtractedParameters {
  category?: string;
  merchant?: string;
  accountId?: string;
  timeframe?: 'current_month' | 'previous_month' | 'all_time';
  targetAmount?: number;
  goalName?: string;
}

export interface IntentRoutingResult {
  primaryIntent: AskVivIntentType;
  confidence: number;
  requiresLedger: boolean;
  requiresKnowledgeRAG: boolean;
  isMixed: boolean;
  extractedParameters: ExtractedParameters;
  matchedKeywords: string[];
}

/**
 * Deterministic intent router for Ask Viv financial copilot.
 * Ensures strict security by determining data access pathways without granting
 * LLM arbitrary tool execution or ad-hoc query capabilities.
 */
export function routeUserIntent(prompt: string): IntentRoutingResult {
  const p = prompt.toLowerCase().trim();

  // Pattern detection for specific intent buckets
  const metricsKeywords = [
    'balance', 'net worth', 'how much money', 'how much do i have', 'available balance',
    'income', 'salary', 'earnings', 'total spent', 'pure expense', 'expenses',
    'net cash flow', 'cashflow', 'savings rate', 'burn rate', 'runway',
  ];

  const trendsKeywords = [
    'trend', 'month over month', 'mom', 'compared to last month', 'spending change',
    'increase', 'decrease', 'breakdown', 'top spending', 'top category', 'category',
    'categories', 'spending by', 'where did my money go', 'dining', 'groceries',
    'shopping', 'utilities', 'entertainment', 'travel', 'transport',
  ];

  const recurringKeywords = [
    'recurring', 'subscription', 'subscriptions', 'bill', 'bills', 'netflix',
    'spotify', 'gym', 'prime', 'amazon prime', 'autopay', 'mandate',
    'monthly fee', 'repeated', 'membership', 'confirmed recurring', 'potential recurring',
  ];

  const goalsKeywords = [
    'goal', 'goals', 'target', 'emergency fund', 'save up for', 'down payment',
    'vacation fund', 'feasibility', 'can i afford', 'on track', 'reach my goal',
    'monthly contribution', 'savings goal', 'reserve',
  ];

  const unusualKeywords = [
    'unusual', 'anomaly', 'anomalies', 'suspicious', 'spike', 'outlier',
    'unexpected', 'deviation', 'weird transaction', 'flagged', 'why was this charged',
  ];

  const policyAndKnowledgeKeywords = [
    'policy', 'limit', 'overdraft', 'terms', 'fee structure', 'interest rate',
    'dispute policy', 'wire fee', 'minimum balance', 'fdic', 'rbi', 'guidelines',
    'kyc', 'compliance', 'what is an emergency fund', 'what is a sip', 'how does interest work',
  ];

  const checkMatches = (keywords: string[]) => keywords.filter((kw) => p.includes(kw));

  const metricsMatches = checkMatches(metricsKeywords);
  const trendsMatches = checkMatches(trendsKeywords);
  const recurringMatches = checkMatches(recurringKeywords);
  const goalsMatches = checkMatches(goalsKeywords);
  const unusualMatches = checkMatches(unusualKeywords);
  const policyMatches = checkMatches(policyAndKnowledgeKeywords);

  // Extract parameters
  const extractedParameters: ExtractedParameters = {};

  // Check for categories
  const knownCategories = ['dining', 'food', 'groceries', 'entertainment', 'shopping', 'utilities', 'travel', 'transport', 'healthcare', 'education', 'rent'];
  for (const cat of knownCategories) {
    if (p.includes(cat)) {
      extractedParameters.category = cat;
      break;
    }
  }

  // Check for merchants
  const knownMerchants = ['netflix', 'spotify', 'amazon', 'uber', 'swiggy', 'zomato', 'starbucks', 'gym', 'bescom', 'airtel', 'cult.fit'];
  for (const m of knownMerchants) {
    if (p.includes(m)) {
      extractedParameters.merchant = m;
      break;
    }
  }

  // Timeframe detection
  if (p.includes('last month') || p.includes('previous month')) {
    extractedParameters.timeframe = 'previous_month';
  } else if (p.includes('this month') || p.includes('current month')) {
    extractedParameters.timeframe = 'current_month';
  } else {
    extractedParameters.timeframe = 'all_time';
  }

  // 1. Detect Hybrid Mixed Query:
  // Requires both ledger financial calculation AND knowledge retrieval
  // e.g. "Do my current checking transactions violate VivPay overdraft or withdrawal limits?"
  // or "Based on my income, what are VivPay's eligibility policies?"
  const hasCustomerLedgerClue =
    metricsMatches.length > 0 ||
    trendsMatches.length > 0 ||
    recurringMatches.length > 0 ||
    goalsMatches.length > 0 ||
    p.includes('account') ||
    p.includes('checking') ||
    p.includes('savings') ||
    p.includes('transaction') ||
    p.includes('my') ||
    p.includes('i ') ||
    p.includes('me') ||
    p.includes('mine');

  const hasPolicyOrKnowledgeClue =
    policyMatches.length > 0 ||
    p.includes('policy') ||
    p.includes('rule') ||
    p.includes('clause') ||
    p.includes('terms') ||
    p.includes('limit') ||
    p.includes('fee') ||
    p.includes('overdraft') ||
    p.includes('dispute');

  if (hasCustomerLedgerClue && hasPolicyOrKnowledgeClue) {
    return {
      primaryIntent: 'hybrid_mixed',
      confidence: 0.92,
      requiresLedger: true,
      requiresKnowledgeRAG: true,
      isMixed: true,
      extractedParameters,
      matchedKeywords: [...metricsMatches, ...policyMatches],
    };
  }

  // 2. Goal queries
  if (goalsMatches.length > 0) {
    return {
      primaryIntent: 'cash_flow_and_goals',
      confidence: Math.min(0.95, 0.7 + goalsMatches.length * 0.1),
      requiresLedger: true,
      requiresKnowledgeRAG: false,
      isMixed: false,
      extractedParameters,
      matchedKeywords: goalsMatches,
    };
  }

  // 3. Unusual transactions queries
  if (unusualMatches.length > 0) {
    return {
      primaryIntent: 'unusual_transactions',
      confidence: Math.min(0.95, 0.75 + unusualMatches.length * 0.1),
      requiresLedger: true,
      requiresKnowledgeRAG: false,
      isMixed: false,
      extractedParameters,
      matchedKeywords: unusualMatches,
    };
  }

  // 4. Recurring payment queries
  if (recurringMatches.length > 0) {
    return {
      primaryIntent: 'recurring_payments',
      confidence: Math.min(0.95, 0.75 + recurringMatches.length * 0.1),
      requiresLedger: true,
      requiresKnowledgeRAG: false,
      isMixed: false,
      extractedParameters,
      matchedKeywords: recurringMatches,
    };
  }

  // 5. Spending trends and category breakdown queries
  if (trendsMatches.length > 0) {
    return {
      primaryIntent: 'spending_trends',
      confidence: Math.min(0.95, 0.7 + trendsMatches.length * 0.1),
      requiresLedger: true,
      requiresKnowledgeRAG: false,
      isMixed: false,
      extractedParameters,
      matchedKeywords: trendsMatches,
    };
  }

  // 6. Financial metrics and exact calculations
  if (metricsMatches.length > 0) {
    return {
      primaryIntent: 'financial_metrics',
      confidence: Math.min(0.95, 0.75 + metricsMatches.length * 0.1),
      requiresLedger: true,
      requiresKnowledgeRAG: false,
      isMixed: false,
      extractedParameters,
      matchedKeywords: metricsMatches,
    };
  }

  // 7. General knowledge or policy
  if (policyMatches.length > 0 || p.includes('what is') || p.includes('explain') || p.includes('how does')) {
    return {
      primaryIntent: 'general_knowledge',
      confidence: 0.85,
      requiresLedger: false,
      requiresKnowledgeRAG: true,
      isMixed: false,
      extractedParameters,
      matchedKeywords: policyMatches,
    };
  }

  // Default fallback to financial metrics for the customer's ledger
  return {
    primaryIntent: 'financial_metrics',
    confidence: 0.6,
    requiresLedger: true,
    requiresKnowledgeRAG: false,
    isMixed: false,
    extractedParameters,
    matchedKeywords: [],
  };
}
