/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FinancialIdentity,
  PersonalInfo,
  EmploymentInfo,
  IncomeInfo,
  FinancialCommitments,
  FinancialGoal,
  RiskProfile,
  IdentityCompleteness,
  CognitiveAIProfile,
  EightDimensionalBehavior,
  ArchetypeEvaluation,
  IdentityTimelineEvent,
} from './types.ts';
import {
  loadIdentityFromStorage,
  saveIdentityToStorage,
  calculateIdentityCompleteness,
  appendTimelineEvent,
} from './store.ts';
import { UserRole } from '../../services/demoData.ts';

export function useIdentity(role: UserRole = 'customer') {
  const [identity, setIdentity] = useState<FinancialIdentity>(() =>
    loadIdentityFromStorage(role)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedSection, setLastSavedSection] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state if role changes without leaking across roles
  useEffect(() => {
    const loaded = loadIdentityFromStorage(role);
    setIdentity(loaded);
    setLastSavedSection(null);
    setSaveSuccessMessage(null);
    setErrorMessage(null);
  }, [role]);

  // Persist helper
  const persist = useCallback(
    (newIdentity: FinancialIdentity, sectionName: string) => {
      setIsSaving(true);
      setErrorMessage(null);
      try {
        saveIdentityToStorage(role, newIdentity);
        setIdentity(newIdentity);
        setLastSavedSection(sectionName);
        setSaveSuccessMessage(`${sectionName} saved successfully.`);
        setTimeout(() => {
          setSaveSuccessMessage(null);
        }, 4000);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to save changes.');
      } finally {
        setIsSaving(false);
      }
    },
    [role]
  );

  const updatePersonal = useCallback(
    (personal: PersonalInfo) => {
      if (!personal.fullName?.trim()) {
        throw new Error('Full name is required.');
      }
      if (!personal.city?.trim()) {
        throw new Error('City is required.');
      }
      if (!personal.occupation?.trim()) {
        throw new Error('Occupation is required.');
      }
      if (personal.dependentsCount < 0) {
        throw new Error('Number of dependents cannot be negative.');
      }

      let updated: FinancialIdentity = {
        ...identity,
        personal,
        updatedAt: new Date().toISOString(),
      };

      updated = appendTimelineEvent(updated, {
        type: 'profile_created',
        title: 'Personal Profile Updated',
        description: `Updated name to ${personal.fullName}, occupation to ${personal.occupation}.`,
        actor: 'customer',
        evidenceSource: 'declared',
      });

      persist(updated, 'Personal Information');
    },
    [identity, persist]
  );

  const updateEmployment = useCallback(
    (employment: EmploymentInfo) => {
      if (!employment.status) {
        throw new Error('Employment status is required.');
      }
      if (
        ['salaried', 'business-owner'].includes(employment.status) &&
        !employment.employerName?.trim()
      ) {
        throw new Error('Employer / Company name is required for salaried or business owners.');
      }
      if (employment.yearsExperience !== undefined && employment.yearsExperience < 0) {
        throw new Error('Years of experience cannot be negative.');
      }

      let updated: FinancialIdentity = {
        ...identity,
        employment,
        updatedAt: new Date().toISOString(),
      };

      updated = appendTimelineEvent(updated, {
        type: 'commitment_updated',
        title: 'Employment Details Modified',
        description: `Status: ${employment.status}, Employer: ${employment.employerName || 'Self'}.`,
        actor: 'customer',
        evidenceSource: 'declared',
      });

      persist(updated, 'Employment Details');
    },
    [identity, persist]
  );

  const updateIncome = useCallback(
    (income: IncomeInfo) => {
      if (income.monthlyIncome === undefined || income.monthlyIncome < 0) {
        throw new Error('Monthly income must be a valid non-negative amount.');
      }
      if (income.additionalIncome !== undefined && income.additionalIncome < 0) {
        throw new Error('Additional income cannot be negative.');
      }
      if (
        income.expectedSalaryDay !== undefined &&
        (income.expectedSalaryDay < 1 || income.expectedSalaryDay > 31)
      ) {
        throw new Error('Salary day must be between 1 and 31.');
      }

      let updated: FinancialIdentity = {
        ...identity,
        income,
        updatedAt: new Date().toISOString(),
      };

      updated = appendTimelineEvent(updated, {
        type: 'commitment_updated',
        title: 'Declared Income Updated',
        description: `Declared monthly income adjusted to ₹${income.monthlyIncome.toLocaleString()}.`,
        actor: 'customer',
        evidenceSource: 'declared',
      });

      persist(updated, 'Income & Salary');
    },
    [identity, persist]
  );

  const updateCommitments = useCallback(
    (commitments: FinancialCommitments) => {
      const keys = Object.keys(commitments) as (keyof FinancialCommitments)[];
      for (const k of keys) {
        if (commitments[k] < 0) {
          throw new Error('Commitment amounts cannot be negative.');
        }
      }

      let updated: FinancialIdentity = {
        ...identity,
        commitments,
        updatedAt: new Date().toISOString(),
      };

      updated = appendTimelineEvent(updated, {
        type: 'commitment_updated',
        title: 'Financial Commitments Revised',
        description: `Adjusted rent, EMIs, or SIP allocations in profile.`,
        actor: 'customer',
        evidenceSource: 'declared',
      });

      persist(updated, 'Financial Commitments');
    },
    [identity, persist]
  );

  const addGoal = useCallback(
    (goalInput: Omit<FinancialGoal, 'id'>) => {
      if (!goalInput.name?.trim()) {
        throw new Error('Goal name is required.');
      }
      if (goalInput.targetAmount <= 0) {
        throw new Error('Target amount must be greater than zero.');
      }
      if (!goalInput.targetDate) {
        throw new Error('Target date is required.');
      }

      const newGoal: FinancialGoal = {
        ...goalInput,
        id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        currentSavings: Math.max(0, goalInput.currentSavings || 0),
        monthlyContribution: Math.max(0, goalInput.monthlyContribution || 0),
      };

      let updated: FinancialIdentity = {
        ...identity,
        goals: [...(identity.goals || []), newGoal],
        updatedAt: new Date().toISOString(),
      };

      updated = appendTimelineEvent(updated, {
        type: 'goal_added',
        title: `Goal Added: "${newGoal.name}"`,
        description: `Target amount: ₹${newGoal.targetAmount.toLocaleString()} by ${newGoal.targetDate}.`,
        actor: 'customer',
        evidenceSource: 'declared',
      });

      persist(updated, 'Financial Goals');
    },
    [identity, persist]
  );

  const updateGoal = useCallback(
    (id: string, goalPartial: Partial<FinancialGoal>) => {
      const updatedGoals = (identity.goals || []).map((g) => {
        if (g.id !== id) return g;
        return {
          ...g,
          ...goalPartial,
          targetAmount: Math.max(0, goalPartial.targetAmount ?? g.targetAmount),
          currentSavings: Math.max(0, goalPartial.currentSavings ?? g.currentSavings),
        };
      });

      let updated: FinancialIdentity = {
        ...identity,
        goals: updatedGoals,
        updatedAt: new Date().toISOString(),
      };

      updated = appendTimelineEvent(updated, {
        type: 'goal_updated',
        title: 'Goal Configuration Modified',
        description: `Updated progress or parameters for goal ID ${id}.`,
        actor: 'customer',
        evidenceSource: 'declared',
      });

      persist(updated, 'Financial Goals');
    },
    [identity, persist]
  );

  const deleteGoal = useCallback(
    (id: string) => {
      const deletedGoal = (identity.goals || []).find((g) => g.id === id);
      const updatedGoals = (identity.goals || []).filter((g) => g.id !== id);

      let updated: FinancialIdentity = {
        ...identity,
        goals: updatedGoals,
        updatedAt: new Date().toISOString(),
      };

      updated = appendTimelineEvent(updated, {
        type: 'goal_updated',
        title: `Goal Removed: "${deletedGoal?.name || id}"`,
        description: `De-linked target amount of ₹${deletedGoal?.targetAmount.toLocaleString() || 0}.`,
        actor: 'customer',
        evidenceSource: 'declared',
      });

      persist(updated, 'Financial Goals');
    },
    [identity, persist]
  );

  const updateRisk = useCallback(
    (risk: RiskProfile) => {
      let updated: FinancialIdentity = {
        ...identity,
        risk,
        updatedAt: new Date().toISOString(),
      };

      updated = appendTimelineEvent(updated, {
        type: 'risk_modified',
        title: 'Risk Profile Modified',
        description: `Tolerance: ${risk.riskTolerance}, Debt Comfort: ${risk.debtComfort}.`,
        actor: 'customer',
        evidenceSource: 'declared',
      });

      persist(updated, 'Risk Profile');
    },
    [identity, persist]
  );

  const updateCognitive = useCallback(
    (cognitive: CognitiveAIProfile) => {
      let updated: FinancialIdentity = {
        ...identity,
        cognitive,
        updatedAt: new Date().toISOString(),
      };

      updated = appendTimelineEvent(updated, {
        type: 'bias_identified',
        title: 'Cognitive Profile & Preferences Tuned',
        description: `Interaction style: ${cognitive.tone}, Literacy: ${cognitive.financialLiteracy}.`,
        actor: 'customer',
        evidenceSource: 'cognitive',
      });

      persist(updated, 'Cognitive Profile');
    },
    [identity, persist]
  );

  const updateBehaviorAndArchetypes = useCallback(
    (behavior: EightDimensionalBehavior, archetypes: ArchetypeEvaluation[]) => {
      const updated: FinancialIdentity = {
        ...identity,
        behavior,
        archetypes,
        updatedAt: new Date().toISOString(),
      };

      persist(updated, 'Behavioral Analysis');
    },
    [identity, persist]
  );

  const completeness: IdentityCompleteness = useMemo(() => {
    return calculateIdentityCompleteness(identity);
  }, [identity]);

  const togglePauseGoal = useCallback(
    (id: string) => {
      const target = (identity.goals || []).find((g) => g.id === id);
      if (!target) return;
      const isCurrentlyPaused = target.status === 'paused' || !!target.isPaused;
      const newStatus = isCurrentlyPaused ? 'active' : 'paused';
      updateGoal(id, {
        status: newStatus,
        isPaused: !isCurrentlyPaused,
      });
    },
    [identity.goals, updateGoal]
  );

  return {
    identity,
    completeness,
    isSaving,
    lastSavedSection,
    saveSuccessMessage,
    errorMessage,
    clearError: () => setErrorMessage(null),
    updatePersonal,
    updateEmployment,
    updateIncome,
    updateCommitments,
    addGoal,
    updateGoal,
    deleteGoal,
    togglePauseGoal,
    updateRisk,
    updateCognitive,
    updateBehaviorAndArchetypes,
  };
}
