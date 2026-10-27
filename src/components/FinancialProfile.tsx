/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  User,
  Briefcase,
  Wallet,
  PiggyBank,
  Target,
  ShieldAlert,
  Edit3,
  Check,
  X,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  HelpCircle,
  FileSpreadsheet,
  ArrowRight,
  Info,
  Calendar,
  Activity,
  Brain,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useIdentity } from '../lib/identity/use-identity.ts';
import {
  PersonalInfo,
  EmploymentInfo,
  IncomeInfo,
  FinancialCommitments,
  FinancialGoal,
  RiskProfile,
  EmploymentStatus,
  MaritalStatus,
  IncomeFrequency,
  GoalPriority,
  RiskTolerance,
  DebtComfort,
  InvestmentExperience,
} from '../lib/identity/types.ts';
import { calculateGoalMetrics } from '../lib/identity/store.ts';
import { analyzeTransactionsForReconciliation } from '../lib/recurring/reconcile.ts';
import { analyzeBehaviour } from '../lib/identity/behavior.ts';
import { BehavioralAnalyticsView } from './profile/BehavioralAnalyticsView.tsx';
import { CognitivePersonaView } from './profile/CognitivePersonaView.tsx';
import { EvidenceProvenanceView } from './profile/EvidenceProvenanceView.tsx';
import { IdentityTimelineView } from './profile/IdentityTimelineView.tsx';
import { Transaction } from '../types/database.ts';
import { UserRole } from '../services/demoData.ts';

interface FinancialProfileProps {
  role?: UserRole;
  transactions?: Transaction[];
  onOpenUpload?: () => void;
}

export const FinancialProfile: React.FC<FinancialProfileProps> = ({
  role = 'customer',
  transactions = [],
  onOpenUpload,
}) => {
  const {
    identity,
    completeness,
    isSaving,
    saveSuccessMessage,
    errorMessage,
    clearError,
    updatePersonal,
    updateEmployment,
    updateIncome,
    updateCommitments,
    addGoal,
    updateGoal,
    deleteGoal,
    updateRisk,
  } = useIdentity(role);

  // Active Profile Sub-view (Declared Profile vs 8-D Behavior vs Cognitive AI vs Evidence Provenance vs Audit Timeline)
  const [activeProfileTab, setActiveProfileTab] = useState<'declared' | 'behavior' | 'cognitive' | 'evidence' | 'timeline'>('declared');

  // Unified behavioral dimensions & archetypes calculation
  const { behavior, archetypes } = useMemo(() => {
    return analyzeBehaviour(transactions, identity);
  }, [transactions, identity]);

  // Active edit states per section
  const [editingSection, setEditingSection] = useState<string | null>(null);

  // Draft form states
  const [personalDraft, setPersonalDraft] = useState<PersonalInfo>(identity.personal);
  const [employmentDraft, setEmploymentDraft] = useState<EmploymentInfo>(identity.employment);
  const [incomeDraft, setIncomeDraft] = useState<IncomeInfo>(identity.income);
  const [commitmentsDraft, setCommitmentsDraft] = useState<FinancialCommitments>(identity.commitments);
  const [riskDraft, setRiskDraft] = useState<RiskProfile>(identity.risk);

  // Goal modal/editor state
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState<Omit<FinancialGoal, 'id'>>({
    name: '',
    targetAmount: 100000,
    targetDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
    monthlyContribution: 5000,
    currentSavings: 0,
    priority: 'medium',
    notes: '',
  });

  // Local validation error message
  const [validationError, setValidationError] = useState<string | null>(null);

  // Start editing a section
  const handleStartEdit = (section: string) => {
    clearError();
    setValidationError(null);
    if (section === 'personal') setPersonalDraft({ ...identity.personal });
    if (section === 'employment') setEmploymentDraft({ ...identity.employment });
    if (section === 'income') setIncomeDraft({ ...identity.income });
    if (section === 'commitments') setCommitmentsDraft({ ...identity.commitments });
    if (section === 'risk') setRiskDraft({ ...identity.risk });
    setEditingSection(section);
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setValidationError(null);
    clearError();
  };

  // Section Save Handlers
  const handleSavePersonal = () => {
    try {
      setValidationError(null);
      updatePersonal(personalDraft);
      setEditingSection(null);
    } catch (err: any) {
      setValidationError(err.message);
    }
  };

  const handleSaveEmployment = () => {
    try {
      setValidationError(null);
      updateEmployment(employmentDraft);
      setEditingSection(null);
    } catch (err: any) {
      setValidationError(err.message);
    }
  };

  const handleSaveIncome = () => {
    try {
      setValidationError(null);
      updateIncome(incomeDraft);
      setEditingSection(null);
    } catch (err: any) {
      setValidationError(err.message);
    }
  };

  const handleSaveCommitments = () => {
    try {
      setValidationError(null);
      updateCommitments(commitmentsDraft);
      setEditingSection(null);
    } catch (err: any) {
      setValidationError(err.message);
    }
  };

  const handleSaveRisk = () => {
    try {
      setValidationError(null);
      updateRisk(riskDraft);
      setEditingSection(null);
    } catch (err: any) {
      setValidationError(err.message);
    }
  };

  // Goal Handlers
  const handleOpenAddGoal = () => {
    setEditingGoalId(null);
    setGoalDraft({
      name: '',
      targetAmount: 100000,
      targetDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
      monthlyContribution: 5000,
      currentSavings: 0,
      priority: 'medium',
      notes: '',
    });
    setGoalModalOpen(true);
  };

  const handleOpenEditGoal = (goal: FinancialGoal) => {
    setEditingGoalId(goal.id);
    setGoalDraft({
      name: goal.name,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
      monthlyContribution: goal.monthlyContribution,
      currentSavings: goal.currentSavings,
      priority: goal.priority,
      notes: goal.notes || '',
    });
    setGoalModalOpen(true);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setValidationError(null);
      if (editingGoalId) {
        updateGoal(editingGoalId, goalDraft);
      } else {
        addGoal(goalDraft);
      }
      setGoalModalOpen(false);
      setEditingGoalId(null);
    } catch (err: any) {
      setValidationError(err.message);
    }
  };

  // Reconciliation Analysis against imported transactions
  const reconciliation = analyzeTransactionsForReconciliation(
    transactions,
    identity.income,
    identity.commitments
  );

  // Helper INR formatter
  const formatInr = (val: number | undefined | null) => {
    const num = val || 0;
    return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  // Calculate sum of commitments
  const totalMonthlyCommitments =
    (identity.commitments.rent || 0) +
    (identity.commitments.homeLoanEmi || 0) +
    (identity.commitments.vehicleLoanEmi || 0) +
    (identity.commitments.personalLoanEmi || 0) +
    (identity.commitments.creditCardCommitments || 0) +
    (identity.commitments.sipContributions || 0) +
    (identity.commitments.insurance || 0) +
    (identity.commitments.utilities || 0) +
    (identity.commitments.groceries || 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Confirmation / Notification */}
      {saveSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{saveSuccessMessage}</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">Demo State Saved</span>
        </div>
      )}

      {(errorMessage || validationError) && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-2xl flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-semibold">{validationError || errorMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="card-luxury p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight font-['Plus_Jakarta_Sans']">
                Financial Profile & Identity
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Declare your personal parameters, salary cycles, recurring liabilities, and financial milestones.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto bg-slate-50 border border-slate-200/90 px-3.5 py-2 rounded-2xl">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-slate-700">Currency:</span>
          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
            INR (₹)
          </span>
        </div>
      </div>

      {/* 5-Sub-view Navigation for Unified User Model */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200/80 scrollbar-none">
        <button
          onClick={() => setActiveProfileTab('declared')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeProfileTab === 'declared'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/70'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Declared Profile & Goals</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeProfileTab === 'declared' ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-700'}`}>
            {completeness.totalPercentage}%
          </span>
        </button>

        <button
          onClick={() => setActiveProfileTab('behavior')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeProfileTab === 'behavior'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/70'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>8-D Behavioral Analytics</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeProfileTab === 'behavior' ? 'bg-purple-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
            {behavior.overallFinancialDiscipline}/100
          </span>
        </button>

        <button
          onClick={() => setActiveProfileTab('cognitive')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeProfileTab === 'cognitive'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/70'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Cognitive AI Persona</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeProfileTab === 'cognitive' ? 'bg-purple-500 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
            {identity.cognitive?.detectedBiases?.length || 1} Biases
          </span>
        </button>

        <button
          onClick={() => setActiveProfileTab('evidence')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeProfileTab === 'evidence'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/70'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Evidence Provenance</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeProfileTab === 'evidence' ? 'bg-purple-500 text-white' : 'bg-blue-100 text-blue-700'}`}>
            4 Tiers
          </span>
        </button>

        <button
          onClick={() => setActiveProfileTab('timeline')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeProfileTab === 'timeline'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/70'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Identity Timeline</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeProfileTab === 'timeline' ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {identity.timeline?.length || 4} Events
          </span>
        </button>
      </div>

      {/* VIEW 1: DECLARED PROFILE & COMMITMENTS */}
      {activeProfileTab === 'declared' && (
        <>
          {/* 1. Identity Completeness Card */}
          <div className="card-luxury p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-900">Identity Completeness</h3>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                {completeness.completedSectionsCount} of {completeness.totalSectionsCount} Sections Ready
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Completeness is calculated based on applicable profile dimensions. Non-applicable fields are not penalized.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-extrabold text-purple-700">
                {completeness.totalPercentage}%
              </span>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Profile Score</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${completeness.totalPercentage}%` }}
          />
        </div>

        {/* Section Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
          {completeness.sections.map((sec) => (
            <div
              key={sec.sectionKey}
              onClick={() => handleStartEdit(sec.sectionKey)}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                sec.completed
                  ? 'bg-purple-50/50 border-purple-200/80 hover:bg-purple-100/50'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-800 truncate">{sec.title}</span>
                {sec.completed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                )}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold">
                {sec.score}% complete
              </div>
            </div>
          ))}
        </div>

        {/* Missing applicable fields actionable checklist */}
        {completeness.missingOptionalOrApplicable.length > 0 && (
          <div className="p-4 bg-amber-50/60 border border-amber-200/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-900">Missing Recommended Fields</p>
                <p className="text-[11px] text-amber-800/80">
                  {completeness.missingOptionalOrApplicable.map((m) => `${m.field} (${m.section})`).join(' • ')}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleStartEdit(completeness.missingOptionalOrApplicable[0].sectionKey)}
              className="text-xs font-bold text-amber-900 bg-white hover:bg-amber-100/60 border border-amber-300 px-3 py-1.5 rounded-xl shadow-xs shrink-0 cursor-pointer"
            >
              Complete Now
            </button>
          </div>
        )}
      </div>

      {/* 2-Column Grid for Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Personal Information */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-sm text-slate-900">Personal Information</h3>
            </div>

            {editingSection !== 'personal' ? (
              <button
                onClick={() => handleStartEdit('personal')}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 bg-purple-50 hover:bg-purple-100/70 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCancelEdit}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSavePersonal}
                  disabled={isSaving}
                  className="btn-primary-gradient text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            )}
          </div>

          {editingSection !== 'personal' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Full Name</span>
                <span className="font-bold text-slate-800 mt-0.5 block">{identity.personal.fullName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">City / Location</span>
                <span className="font-bold text-slate-800 mt-0.5 block">{identity.personal.city || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Occupation</span>
                <span className="font-bold text-slate-800 mt-0.5 block">{identity.personal.occupation || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Marital Status</span>
                <span className="font-bold text-slate-800 mt-0.5 capitalize block">
                  {identity.personal.maritalStatus.replace('_', ' ')}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 block font-medium">Number of Dependents</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {identity.personal.dependentsCount} dependent(s)
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Full Name *</label>
                <input
                  type="text"
                  value={personalDraft.fullName}
                  onChange={(e) => setPersonalDraft({ ...personalDraft, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                  placeholder="e.g. Alex Rivera"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">City *</label>
                  <input
                    type="text"
                    value={personalDraft.city}
                    onChange={(e) => setPersonalDraft({ ...personalDraft, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                    placeholder="e.g. Bengaluru, Karnataka"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Occupation *</label>
                  <input
                    type="text"
                    value={personalDraft.occupation}
                    onChange={(e) => setPersonalDraft({ ...personalDraft, occupation: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                    placeholder="e.g. Software Engineer"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Marital Status</label>
                  <select
                    value={personalDraft.maritalStatus}
                    onChange={(e) =>
                      setPersonalDraft({ ...personalDraft, maritalStatus: e.target.value as MaritalStatus })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 bg-white"
                  >
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Dependents Count</label>
                  <input
                    type="number"
                    min={0}
                    value={personalDraft.dependentsCount}
                    onChange={(e) =>
                      setPersonalDraft({ ...personalDraft, dependentsCount: Math.max(0, parseInt(e.target.value) || 0) })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Employment */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-sm text-slate-900">Employment Details</h3>
            </div>

            {editingSection !== 'employment' ? (
              <button
                onClick={() => handleStartEdit('employment')}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 bg-purple-50 hover:bg-purple-100/70 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCancelEdit}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSaveEmployment}
                  disabled={isSaving}
                  className="btn-primary-gradient text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            )}
          </div>

          {editingSection !== 'employment' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Employment Status</span>
                <span className="font-bold text-slate-800 mt-0.5 capitalize block">
                  {identity.employment.status.replace('-', ' ')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Employer / Entity</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {identity.employment.employerName ||
                    (['student', 'retired'].includes(identity.employment.status)
                      ? 'Not applicable'
                      : 'Self / Unspecified')}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 block font-medium">Experience</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {identity.employment.yearsExperience !== undefined
                    ? `${identity.employment.yearsExperience} Year(s)`
                    : 'Not specified'}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Employment Status *</label>
                <select
                  value={employmentDraft.status}
                  onChange={(e) =>
                    setEmploymentDraft({
                      ...employmentDraft,
                      status: e.target.value as EmploymentStatus,
                      // Clear employer name if student/retired
                      employerName: ['student', 'retired'].includes(e.target.value)
                        ? ''
                        : employmentDraft.employerName,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 bg-white"
                >
                  <option value="salaried">Salaried Employee</option>
                  <option value="self-employed">Self-Employed Professional</option>
                  <option value="business-owner">Business Owner / Enterprise</option>
                  <option value="freelancer">Freelancer / Independent Contractor</option>
                  <option value="student">Student</option>
                  <option value="retired">Retired</option>
                </select>
              </div>

              {!['student', 'retired'].includes(employmentDraft.status) && (
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">
                    Employer / Organization Name *
                  </label>
                  <input
                    type="text"
                    value={employmentDraft.employerName || ''}
                    onChange={(e) =>
                      setEmploymentDraft({ ...employmentDraft, employerName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                    placeholder="e.g. TechCorp Solutions"
                  />
                </div>
              )}

              <div>
                <label className="text-slate-600 font-semibold block mb-1">
                  Years of Experience {['student', 'retired'].includes(employmentDraft.status) && '(Optional)'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={employmentDraft.yearsExperience ?? 0}
                  onChange={(e) =>
                    setEmploymentDraft({
                      ...employmentDraft,
                      yearsExperience: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Income and Salary */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-sm text-slate-900">Income & Salary Schedule</h3>
            </div>

            {editingSection !== 'income' ? (
              <button
                onClick={() => handleStartEdit('income')}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 bg-purple-50 hover:bg-purple-100/70 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCancelEdit}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSaveIncome}
                  disabled={isSaving}
                  className="btn-primary-gradient text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            )}
          </div>

          {editingSection !== 'income' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Monthly Primary Income</span>
                <span className="font-extrabold text-emerald-600 text-sm mt-0.5 block">
                  {formatInr(identity.income.monthlyIncome)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Additional Income</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {formatInr(identity.income.additionalIncome)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Income Frequency</span>
                <span className="font-bold text-slate-800 mt-0.5 capitalize block">
                  {identity.income.frequency}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Expected Salary Day</span>
                <span className="font-bold text-purple-700 mt-0.5 block">
                  {identity.income.expectedSalaryDay
                    ? `Day ${identity.income.expectedSalaryDay} of month`
                    : 'Variable'}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Monthly Income (₹) *</label>
                  <input
                    type="number"
                    min={0}
                    value={incomeDraft.monthlyIncome}
                    onChange={(e) =>
                      setIncomeDraft({ ...incomeDraft, monthlyIncome: Math.max(0, parseFloat(e.target.value) || 0) })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Additional Income (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={incomeDraft.additionalIncome}
                    onChange={(e) =>
                      setIncomeDraft({
                        ...incomeDraft,
                        additionalIncome: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Income Frequency</label>
                  <select
                    value={incomeDraft.frequency}
                    onChange={(e) =>
                      setIncomeDraft({ ...incomeDraft, frequency: e.target.value as IncomeFrequency })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 bg-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="bi-weekly">Bi-Weekly</option>
                    <option value="weekly">Weekly</option>
                    <option value="irregular">Irregular / Project-based</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Salary Day (1–31)</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={incomeDraft.expectedSalaryDay ?? 1}
                    onChange={(e) =>
                      setIncomeDraft({
                        ...incomeDraft,
                        expectedSalaryDay: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Risk Profile */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-sm text-slate-900">Risk Profile</h3>
            </div>

            {editingSection !== 'risk' ? (
              <button
                onClick={() => handleStartEdit('risk')}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 bg-purple-50 hover:bg-purple-100/70 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCancelEdit}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSaveRisk}
                  disabled={isSaving}
                  className="btn-primary-gradient text-white text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            )}
          </div>

          {editingSection !== 'risk' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 block font-medium">Risk Tolerance</span>
                <span className="font-extrabold text-purple-800 mt-1 capitalize block">
                  {identity.risk.riskTolerance}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 block font-medium">Debt Comfort</span>
                <span className="font-extrabold text-slate-800 mt-1 capitalize block">
                  {identity.risk.debtComfort}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 block font-medium">Experience</span>
                <span className="font-extrabold text-slate-800 mt-1 capitalize block">
                  {identity.risk.investmentExperience}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Risk Tolerance</label>
                <select
                  value={riskDraft.riskTolerance}
                  onChange={(e) =>
                    setRiskDraft({ ...riskDraft, riskTolerance: e.target.value as RiskTolerance })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 bg-white"
                >
                  <option value="conservative">Conservative (Preservation of capital)</option>
                  <option value="moderate">Moderate (Balanced risk & inflation beating)</option>
                  <option value="aggressive">Aggressive (High growth & equity appetite)</option>
                </select>
              </div>
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Debt Comfort</label>
                <select
                  value={riskDraft.debtComfort}
                  onChange={(e) =>
                    setRiskDraft({ ...riskDraft, debtComfort: e.target.value as DebtComfort })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 bg-white"
                >
                  <option value="none">Zero debt preference</option>
                  <option value="low">Low debt (Emergency only)</option>
                  <option value="moderate">Moderate (Mortgage / Asset creation)</option>
                  <option value="high">High (Comfortable with leverage)</option>
                </select>
              </div>
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Investment Experience</label>
                <select
                  value={riskDraft.investmentExperience}
                  onChange={(e) =>
                    setRiskDraft({
                      ...riskDraft,
                      investmentExperience: e.target.value as InvestmentExperience,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 bg-white"
                >
                  <option value="beginner">Beginner (Fixed deposits & savings)</option>
                  <option value="intermediate">Intermediate (Mutual funds, ETFs, Stocks)</option>
                  <option value="advanced">Advanced (Multi-asset, derivatives, angel)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 5: Financial Commitments (Full Width Table / Grid) */}
      <div className="card-luxury p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <PiggyBank className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Monthly Financial Commitments</h3>
                <p className="text-xs text-slate-500">
                  Fixed liabilities and statutory contributions you pay each month.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-medium">Total Monthly Liabilities</span>
              <span className="text-lg sm:text-xl font-extrabold text-purple-700">
                {formatInr(totalMonthlyCommitments)} / mo
              </span>
            </div>

            {editingSection !== 'commitments' ? (
              <button
                onClick={() => handleStartEdit('commitments')}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1 bg-purple-50 hover:bg-purple-100/70 px-3 py-2 rounded-xl transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Liabilities</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCancelEdit}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 p-2 rounded-xl hover:bg-slate-100 cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSaveCommitments}
                  disabled={isSaving}
                  className="btn-primary-gradient text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save All</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {editingSection !== 'commitments' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {[
              { label: 'House Rent', amount: identity.commitments.rent },
              { label: 'Home Loan EMI', amount: identity.commitments.homeLoanEmi },
              { label: 'Vehicle Loan EMI', amount: identity.commitments.vehicleLoanEmi },
              { label: 'Personal Loan EMI', amount: identity.commitments.personalLoanEmi },
              { label: 'Credit Card Commitments', amount: identity.commitments.creditCardCommitments },
              { label: 'SIP & Investments', amount: identity.commitments.sipContributions },
              { label: 'Insurance Premiums', amount: identity.commitments.insurance },
              { label: 'Utility Bills', amount: identity.commitments.utilities },
              { label: 'Groceries & Household', amount: identity.commitments.groceries },
            ].map((item, idx) => (
              <div key={idx} className="p-3.5 bg-slate-50/70 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">{item.label}</span>
                <span className={`text-xs font-bold ${item.amount > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                  {formatInr(item.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
            {[
              { key: 'rent' as const, label: 'House Rent (₹)' },
              { key: 'homeLoanEmi' as const, label: 'Home Loan EMI (₹)' },
              { key: 'vehicleLoanEmi' as const, label: 'Vehicle Loan EMI (₹)' },
              { key: 'personalLoanEmi' as const, label: 'Personal Loan EMI (₹)' },
              { key: 'creditCardCommitments' as const, label: 'Credit Card (₹)' },
              { key: 'sipContributions' as const, label: 'SIP Contributions (₹)' },
              { key: 'insurance' as const, label: 'Insurance (₹)' },
              { key: 'utilities' as const, label: 'Utility Bills (₹)' },
              { key: 'groceries' as const, label: 'Groceries (₹)' },
            ].map(({ key, label }) => (
              <div key={key} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">{label}</label>
                <input
                  type="number"
                  min={0}
                  value={commitmentsDraft[key]}
                  onChange={(e) =>
                    setCommitmentsDraft({
                      ...commitmentsDraft,
                      [key]: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-purple-500 bg-white text-xs font-semibold text-slate-900"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 6: Financial Goals */}
      <div className="card-luxury p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Financial Goals & Milestones</h3>
                <p className="text-xs text-slate-500">
                  Target amounts, monthly SIP allocations, and estimated timelines.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenAddGoal}
            className="btn-primary-gradient text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Goal</span>
          </button>
        </div>

        {/* Goals List */}
        {identity.goals.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50">
            <Target className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No Financial Goals Defined Yet</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              Add milestones like emergency reserve, down payment, or travel fund to estimate necessary monthly savings.
            </p>
            <button
              onClick={handleOpenAddGoal}
              className="mt-3 btn-primary-gradient text-white text-xs font-semibold px-4 py-1.5 rounded-xl cursor-pointer"
            >
              Add First Goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {identity.goals.map((goal) => {
              const metrics = calculateGoalMetrics(goal);
              return (
                <div
                  key={goal.id}
                  className="p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-purple-200 hover:shadow-md transition-all space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900">{goal.name}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            goal.priority === 'high'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : goal.priority === 'medium'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {goal.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Target: {goal.targetDate || 'Not specified'}</span>
                        <span className="text-slate-300">•</span>
                        <span>{metrics.monthsRemaining} month(s) to go</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditGoal(goal)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                        title="Edit Goal"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteGoal(goal.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Delete Goal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Ring / Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        Saved: <strong className="text-slate-900">{formatInr(goal.currentSavings)}</strong>
                      </span>
                      <span className="font-bold text-purple-700">{metrics.progressPercentage}%</span>
                    </div>

                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-purple-600 h-full rounded-full transition-all"
                        style={{ width: `${metrics.progressPercentage}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Target: {formatInr(goal.targetAmount)}</span>
                      <span>Remaining: {formatInr(metrics.remainingAmount)}</span>
                    </div>
                  </div>

                  {/* Required contribution projection */}
                  <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        Estimated Required Contribution
                      </span>
                      <span className="font-extrabold text-purple-900">
                        {formatInr(metrics.estimatedRequiredMonthly)} / mo
                      </span>
                    </div>
                    <span className="text-[10px] text-purple-700 font-semibold bg-purple-100/70 px-2 py-0.5 rounded-lg">
                      Estimate Only
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 7: PhonePe Ingestion vs Declared Identity Reconciliation */}
      <div className="card-luxury p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  PhonePe Statement vs. Declared Profile Comparison
                </h3>
                <p className="text-xs text-slate-500">
                  Transparent separation between your self-declared parameters and statement evidence.
                </p>
              </div>
            </div>
          </div>

          {onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100/80 px-3 py-1.5 rounded-xl border border-purple-200 transition-all cursor-pointer self-start sm:self-auto"
            >
              Upload PhonePe Statement
            </button>
          )}
        </div>

        {/* Comparison KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
            <span className="text-slate-400 font-medium block">Declared Monthly Inflow</span>
            <span className="text-xl font-extrabold text-slate-900 block">
              {formatInr(reconciliation.declaredIncome)}
            </span>
            <span className="text-[10px] text-slate-500">From self-declared profile</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
            <span className="text-slate-400 font-medium block">Statement Credits Evidence</span>
            <span className="text-xl font-extrabold text-emerald-600 block">
              {formatInr(reconciliation.detectedIncome)}
            </span>
            <span className="text-[10px] text-slate-500">From uploaded PhonePe entries</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
            <span className="text-slate-400 font-medium block">Declared Commitments</span>
            <span className="text-xl font-extrabold text-slate-900 block">
              {formatInr(reconciliation.declaredCommitmentsTotal)}
            </span>
            <span className="text-[10px] text-slate-500">Declared monthly liabilities</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
            <span className="text-slate-400 font-medium block">Detected Recurring Debits</span>
            <span className="text-xl font-extrabold text-purple-700 block">
              {formatInr(reconciliation.detectedCommitmentsTotal)}
            </span>
            <span className="text-[10px] text-slate-500">Auto-detected recurring candidates</span>
          </div>
        </div>

        {/* Candidate Recurring Debits Breakdown */}
        {reconciliation.detectedCandidates.length > 0 ? (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold text-slate-700">
              Detected Recurring Payment Candidates in Statement ({reconciliation.detectedCandidates.length}):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {reconciliation.detectedCandidates.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-slate-800 block truncate">{c.description}</span>
                    <span className="text-[10px] text-slate-400 block">
                      {c.category} • {c.occurrences}x detected
                    </span>
                  </div>
                  <span className="font-extrabold text-slate-900 shrink-0">
                    {formatInr(c.averageAmount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-500 text-center">
            Upload an Excel or CSV statement to cross-reference your declared commitments with historical ledger debit patterns.
          </div>
        )}

        <div className="p-3 bg-slate-50/80 border border-slate-200/70 rounded-xl flex items-center gap-2 text-[11px] text-slate-500">
          <Info className="w-4 h-4 text-purple-600 shrink-0" />
          <span>
            <strong>Audit Guarantee:</strong> Transaction evidence does not modify your financial identity automatically. You retain full authoritative ownership of all declared inputs.
          </span>
        </div>
      </div>
        </>
      )}

      {/* VIEW 2: 8-DIMENSIONAL BEHAVIORAL ANALYTICS & ARCHETYPES */}
      {activeProfileTab === 'behavior' && (
        <BehavioralAnalyticsView behavior={behavior} archetypes={archetypes} />
      )}

      {/* VIEW 3: COGNITIVE AI PERSONA, BIASES & PREFERENCES */}
      {activeProfileTab === 'cognitive' && (
        <CognitivePersonaView identity={identity} />
      )}

      {/* VIEW 4: FOUR-TIER EVIDENCE PROVENANCE & ANTI-HALLUCINATION */}
      {activeProfileTab === 'evidence' && (
        <EvidenceProvenanceView identity={identity} transactions={transactions} />
      )}

      {/* VIEW 5: CHRONOLOGICAL IDENTITY AUDIT TIMELINE */}
      {activeProfileTab === 'timeline' && (
        <IdentityTimelineView identity={identity} />
      )}

      {/* Goal Add/Edit Modal */}
      {goalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200/90 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingGoalId ? 'Edit Financial Goal' : 'Add Financial Goal'}
              </h3>
              <button
                onClick={() => setGoalModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Goal Name *</label>
                <input
                  type="text"
                  required
                  value={goalDraft.name}
                  onChange={(e) => setGoalDraft({ ...goalDraft, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                  placeholder="e.g. Down Payment for Home"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Target Amount (₹) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={goalDraft.targetAmount}
                    onChange={(e) =>
                      setGoalDraft({
                        ...goalDraft,
                        targetAmount: Math.max(1, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Current Savings (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={goalDraft.currentSavings}
                    onChange={(e) =>
                      setGoalDraft({
                        ...goalDraft,
                        currentSavings: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Target Date *</label>
                  <input
                    type="date"
                    required
                    value={goalDraft.targetDate}
                    onChange={(e) => setGoalDraft({ ...goalDraft, targetDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">Priority</label>
                  <select
                    value={goalDraft.priority}
                    onChange={(e) =>
                      setGoalDraft({ ...goalDraft, priority: e.target.value as GoalPriority })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 bg-white"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Monthly Contribution (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={goalDraft.monthlyContribution}
                  onChange={(e) =>
                    setGoalDraft({
                      ...goalDraft,
                      monthlyContribution: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Notes / Plan</label>
                <input
                  type="text"
                  value={goalDraft.notes || ''}
                  onChange={(e) => setGoalDraft({ ...goalDraft, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500"
                  placeholder="e.g. Allocation via monthly SIP"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-gradient px-4 py-2 rounded-xl text-white font-semibold shadow-xs cursor-pointer"
                >
                  {editingGoalId ? 'Update Goal' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
