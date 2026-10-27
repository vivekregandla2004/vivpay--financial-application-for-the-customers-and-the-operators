/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed' | 'prefer_not_to_say';

export type EmploymentStatus =
  | 'salaried'
  | 'self-employed'
  | 'business-owner'
  | 'freelancer'
  | 'student'
  | 'retired';

export type IncomeFrequency = 'monthly' | 'bi-weekly' | 'weekly' | 'irregular';

export type GoalPriority = 'high' | 'medium' | 'low';

export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

export type DebtComfort = 'none' | 'low' | 'moderate' | 'high';

export type InvestmentExperience = 'beginner' | 'intermediate' | 'advanced';

// Evidence source taxonomy ensuring strict provenance separation
export type EvidenceTier = 'statement' | 'declared' | 'derived' | 'cognitive';

export interface PersonalInfo {
  fullName: string;
  city: string;
  occupation: string;
  maritalStatus: MaritalStatus;
  dependentsCount: number;
}

export interface EmploymentInfo {
  status: EmploymentStatus;
  employerName?: string;
  yearsExperience?: number;
}

export interface IncomeInfo {
  monthlyIncome: number;
  additionalIncome: number;
  frequency: IncomeFrequency;
  expectedSalaryDay?: number; // 1 to 31
}

export interface FinancialCommitments {
  rent: number;
  homeLoanEmi: number;
  vehicleLoanEmi: number;
  personalLoanEmi: number;
  creditCardCommitments: number;
  sipContributions: number;
  insurance: number;
  utilities: number;
  groceries: number;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string; // YYYY-MM-DD
  monthlyContribution: number;
  currentSavings: number;
  priority: GoalPriority;
  notes?: string;
  status?: 'active' | 'paused' | 'completed';
  isPaused?: boolean;
}

export interface RiskProfile {
  riskTolerance: RiskTolerance;
  debtComfort: DebtComfort;
  investmentExperience: InvestmentExperience;
}

// -----------------------------------------------------------------------------
// Behavioral Analytics Types (8 Dimensions & Archetypes)
// -----------------------------------------------------------------------------
export interface BehavioralDimensionScore {
  score: number; // 0 to 100, guaranteed not NaN or Infinity
  confidence: number; // 0.0 to 1.0
  evidenceCount: number;
  trend: 'improving' | 'stable' | 'deteriorating' | 'insufficient_data';
  justification: string;
  factors: {
    label: string;
    value: string | number;
    impact: 'positive' | 'negative' | 'neutral';
  }[];
}

export interface EightDimensionalBehavior {
  shoppingDiscipline: BehavioralDimensionScore;
  savingsVelocity: BehavioralDimensionScore;
  incomeStability: BehavioralDimensionScore;
  loanRepaymentEmiLoad: BehavioralDimensionScore;
  subscriptionDiscretionaryLoad: BehavioralDimensionScore;
  billPaymentDiscipline: BehavioralDimensionScore;
  cashWithdrawalFrequency: BehavioralDimensionScore;
  investmentRatio: BehavioralDimensionScore;
  overallFinancialDiscipline: number; // 0 to 100
  dataSufficiency: 'sufficient' | 'partial' | 'insufficient';
  totalTransactionsEvaluated: number;
  observationPeriodMonths: number;
}

export type BehavioralArchetype =
  | 'excellent_saver'
  | 'impulse_spender'
  | 'high_emi_load'
  | 'stable_income'
  | 'irregular_income'
  | 'subscription_heavy'
  | 'investment_focused';

export interface ArchetypeEvaluation {
  archetype: BehavioralArchetype;
  label: string;
  description: string;
  matched: boolean;
  confidence: number; // 0.0 to 1.0
  evidence: string;
  thresholdMetDescription: string;
}

// -----------------------------------------------------------------------------
// Layer 3: Cognitive AI Profile
// -----------------------------------------------------------------------------
export type InteractionTone = 'analytical' | 'encouraging' | 'direct' | 'cautious' | 'collaborative';
export type FinancialLiteracy = 'beginner' | 'intermediate' | 'advanced';
export type DecisionStyle = 'deliberative' | 'analytical' | 'heuristic' | 'impulsive' | 'delegating';

export interface DetectedCognitiveBias {
  id: string;
  name: string; // e.g. "Present Bias", "Loss Aversion", "Mental Accounting", "Sunk Cost", "Anchoring"
  description: string;
  evidence: string;
  severity: 'mild' | 'moderate' | 'strong';
  mitigationStrategy: string;
}

export interface MemorySnippet {
  id: string;
  timestamp: string;
  topic: string;
  salientPoint: string;
  source: 'conversation' | 'goal_event' | 'upload_reconciliation';
}

export interface CognitiveAIProfile {
  tone: InteractionTone;
  financialLiteracy: FinancialLiteracy;
  decisionStyle: DecisionStyle;
  detectedBiases: DetectedCognitiveBias[];
  keyAnxieties: string[];
  statedPreferences: string[];
  topicsToAvoid: string[];
  conversationMemory: MemorySnippet[];
  promptInjectionGuards: string[];
}

// -----------------------------------------------------------------------------
// Financial Health & Provable Metrics
// -----------------------------------------------------------------------------
export interface FinancialHealthMetrics {
  healthScore: number; // 0 to 100
  healthGrade: 'A+' | 'A' | 'B' | 'C' | 'D';
  emergencyBufferMonths: number;
  debtToIncomeRatio: number; // percentage (0-100+)
  savingsRatePercentage: number;
  discretionaryRatio: number;
  confidenceScore: number; // 0.0 to 1.0
  confidenceJustification: string;
  isAiInferredSalary: false; // Explicit guarantee: never guessed solely by AI
}

// -----------------------------------------------------------------------------
// Identity Timeline & Audit
// -----------------------------------------------------------------------------
export interface IdentityTimelineEvent {
  id: string;
  timestamp: string;
  type:
    | 'profile_created'
    | 'statement_verified'
    | 'goal_added'
    | 'goal_updated'
    | 'commitment_updated'
    | 'bias_identified'
    | 'risk_modified'
    | 'behavior_recalculated';
  title: string;
  description: string;
  actor: 'customer' | 'system' | 'copilot';
  evidenceSource: EvidenceTier;
}

// -----------------------------------------------------------------------------
// Proactive Insights Engine Types
// -----------------------------------------------------------------------------
export interface ProactiveInsight {
  id: string;
  title: string;
  explanation: string;
  severity: 'positive' | 'info' | 'warning' | 'critical';
  evidenceSource: EvidenceTier;
  confidence: number; // 0.0 to 1.0
  suggestedAction: string;
  timeframe: string; // e.g., 'Next 7 Days', 'Monthly Cycle', 'Q4 2026'
  category: 'cash_flow_anomaly' | 'upcoming_commitment' | 'goal_drift' | 'optimization' | 'behavioral_nudge';
}

// -----------------------------------------------------------------------------
// Canonical Unified User Model (Layer 2 & 3 Integrated)
// -----------------------------------------------------------------------------
export interface FinancialIdentity {
  version: number;
  id: string;
  customerId: string;
  personal: PersonalInfo;
  employment: EmploymentInfo;
  income: IncomeInfo;
  commitments: FinancialCommitments;
  goals: FinancialGoal[];
  risk: RiskProfile;
  updatedAt: string;
  isConfirmed: boolean;
  // Unified intelligence layers
  behavior?: EightDimensionalBehavior;
  archetypes?: ArchetypeEvaluation[];
  cognitive?: CognitiveAIProfile;
  health?: FinancialHealthMetrics;
  timeline?: IdentityTimelineEvent[];
  proactiveInsights?: ProactiveInsight[];
}

export interface SectionCompleteness {
  sectionKey: 'personal' | 'employment' | 'income' | 'commitments' | 'goals' | 'risk' | 'behavior' | 'cognitive';
  title: string;
  completed: boolean;
  score: number; // percentage of this section
  missingFields: string[];
}

export interface IdentityCompleteness {
  totalPercentage: number;
  completedSectionsCount: number;
  totalSectionsCount: number;
  sections: SectionCompleteness[];
  missingOptionalOrApplicable: { section: string; field: string; sectionKey: SectionCompleteness['sectionKey'] }[];
}
