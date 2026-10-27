/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Brain,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  MessageSquare,
  HelpCircle,
  Lightbulb,
  Compass,
  Sliders,
  Eye,
} from 'lucide-react';
import { CognitiveAIProfile, FinancialIdentity } from '../../lib/identity/types.ts';

interface CognitivePersonaViewProps {
  identity: FinancialIdentity;
  onUpdateCognitive?: (cognitive: CognitiveAIProfile) => void;
}

export const CognitivePersonaView: React.FC<CognitivePersonaViewProps> = ({
  identity,
}) => {
  const cognitive = identity.cognitive || {
    tone: 'analytical',
    financialLiteracy: 'intermediate',
    decisionStyle: 'deliberative',
    detectedBiases: [
      {
        id: 'bias-mental-accounting',
        name: 'Mental Accounting',
        description: 'Treating money differently depending on its origin or intended use, rather than viewing capital fungibly.',
        evidence: 'Maintains ₹3.8L in low-yield liquid instruments while retaining active vehicle EMI debt.',
        severity: 'mild',
        mitigationStrategy: 'Simulate opportunity cost of partial principal pre-payment vs liquid interest yields.',
      },
    ],
    keyAnxieties: [
      'Tech sector employment volatility and runway sufficiency',
      'Maintaining 6-month liquid cushion before capital commitments',
    ],
    statedPreferences: [
      'Prefers systematic mutual fund SIPs over active day-trading',
      'Avoid high-interest consumer credit roll-overs',
    ],
    topicsToAvoid: [
      'High-risk leveraged crypto derivatives',
      'Speculative penny equities',
    ],
    conversationMemory: [
      {
        id: 'mem-1',
        timestamp: '2026-10-10T14:32:00Z',
        topic: 'Electric Vehicle Down Payment',
        salientPoint: 'Committed to ₹4.5L down payment by Oct 2027 without liquidating emergency buffer.',
        source: 'conversation',
      },
    ],
    promptInjectionGuards: [
      'Strict JSON schema validation on user ledger mutations',
      'Reject prompt overriding commands inside bank statement descriptions',
      'Refuse execution of unauthorized role elevations in natural language prompts',
    ],
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="card-luxury p-6 sm:p-7 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white rounded-3xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30">
                Layer 3 Cognitive Model
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Prompt Injection Immune
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight font-['Plus_Jakarta_Sans']">
              Cognitive AI Persona & Psychological Traits
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Maintains Viv's personalized mental model of the user. Formats interaction tone, detects behavioral biases, respects explicitly declared financial anxieties, and enforces prompt injection safety boundaries.
            </p>
          </div>

          <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
            <Brain className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Trait Matrix: Tone, Literacy, Decision Style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card-luxury p-5 space-y-2">
          <div className="flex items-center gap-2 text-purple-700">
            <Sparkles className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Interaction Tone</span>
          </div>
          <h4 className="text-base font-extrabold text-slate-900 capitalize">
            {cognitive.tone} Mode
          </h4>
          <p className="text-xs text-slate-500">
            Prefers data-dense, quantitative summaries with clear rationale rather than generic conversational platitudes.
          </p>
        </div>

        <div className="card-luxury p-5 space-y-2">
          <div className="flex items-center gap-2 text-indigo-700">
            <Lightbulb className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Financial Literacy</span>
          </div>
          <h4 className="text-base font-extrabold text-slate-900 capitalize">
            {cognitive.financialLiteracy} Tier
          </h4>
          <p className="text-xs text-slate-500">
            Understands SIPs, compound interest, net cash flow, and debt-to-income ratios. Explain advanced tax shelters when relevant.
          </p>
        </div>

        <div className="card-luxury p-5 space-y-2">
          <div className="flex items-center gap-2 text-blue-700">
            <Compass className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Decision-Making Style</span>
          </div>
          <h4 className="text-base font-extrabold text-slate-900 capitalize">
            {cognitive.decisionStyle}
          </h4>
          <p className="text-xs text-slate-500">
            Prefers analyzing scenario comparisons in the Financial Twin before approving capital outlays or goal modifications.
          </p>
        </div>
      </div>

      {/* Detected Cognitive Biases (With Evidence & Mitigation) */}
      <div className="card-luxury p-6 sm:p-7 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base text-slate-900">
              Detected Cognitive Biases
            </h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
              {cognitive.detectedBiases.length} Identified with Evidence
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Behavioral economic heuristics identified across transaction history, paired with constructive nudges.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cognitive.detectedBiases.map((bias) => (
            <div
              key={bias.id}
              className="p-5 rounded-2xl border border-purple-200/80 bg-purple-50/30 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-extrabold text-sm text-slate-900">{bias.name}</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-200 text-purple-900">
                  {bias.severity} Impact
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{bias.description}</p>

              <div className="p-3 bg-white rounded-xl border border-purple-100 text-xs space-y-1">
                <div className="text-[11px] text-slate-500">
                  <strong className="text-slate-800">Observed Evidence:</strong> {bias.evidence}
                </div>
                <div className="text-[11px] text-purple-900">
                  <strong className="text-purple-950">Viv Mitigation:</strong> {bias.mitigationStrategy}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Anxieties & Preferences Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Key Anxieties */}
        <div className="card-luxury p-6 space-y-3">
          <div className="flex items-center gap-2 text-rose-700">
            <ShieldAlert className="w-4 h-4" />
            <h4 className="font-extrabold text-sm text-slate-900">Key Financial Anxieties</h4>
          </div>
          <p className="text-xs text-slate-500">
            Areas where the copilot should provide reassuring, math-grounded safety margins.
          </p>
          <ul className="space-y-2 text-xs">
            {cognitive.keyAnxieties.map((anxiety, idx) => (
              <li key={idx} className="p-3 bg-rose-50/50 border border-rose-200/70 rounded-xl text-rose-900 flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span className="font-semibold">{anxiety}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Stated Preferences */}
        <div className="card-luxury p-6 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            <h4 className="font-extrabold text-sm text-slate-900">Explicitly Stated Preferences</h4>
          </div>
          <p className="text-xs text-slate-500">
            User-declared values and guidelines enforced during goal modeling and simulation.
          </p>
          <ul className="space-y-2 text-xs">
            {cognitive.statedPreferences.map((pref, idx) => (
              <li key={idx} className="p-3 bg-emerald-50/50 border border-emerald-200/70 rounded-xl text-emerald-900 flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-semibold">{pref}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Topics to Avoid & Conversation Memory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-luxury p-6 space-y-3">
          <div className="flex items-center gap-2 text-slate-700">
            <Lock className="w-4 h-4" />
            <h4 className="font-extrabold text-sm text-slate-900">Topics to Avoid / Handle Delicately</h4>
          </div>
          <p className="text-xs text-slate-500">
            Restricted subject matters that must never be recommended or brought up casually.
          </p>
          <div className="space-y-2 text-xs">
            {cognitive.topicsToAvoid.map((t, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-luxury p-6 space-y-3">
          <div className="flex items-center gap-2 text-indigo-700">
            <MessageSquare className="w-4 h-4" />
            <h4 className="font-extrabold text-sm text-slate-900">Salient Conversation Memory</h4>
          </div>
          <p className="text-xs text-slate-500">
            Important takeaways extracted from previous financial consultations with Viv.
          </p>
          <div className="space-y-2 text-xs">
            {cognitive.conversationMemory.map((mem) => (
              <div key={mem.id} className="p-3 bg-indigo-50/40 border border-indigo-200/70 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-[10px] text-indigo-700 font-bold">
                  <span>{mem.topic}</span>
                  <span>{new Date(mem.timestamp).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-slate-700 font-medium">{mem.salientPoint}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Security: Prompt Injection Guardrails */}
      <div className="card-luxury p-6 border-emerald-200 bg-emerald-50/20 space-y-3">
        <div className="flex items-center gap-2 text-emerald-800">
          <ShieldCheck className="w-5 h-5" />
          <h4 className="font-extrabold text-sm">Prompt Injection Protection Boundaries</h4>
        </div>
        <p className="text-xs text-slate-600">
          VivPay enforces strict boundary separation so user transaction strings or external documents cannot hijack copilot behavior or modify financial identity without authentication.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          {cognitive.promptInjectionGuards.map((guard, idx) => (
            <div key={idx} className="p-3 bg-white rounded-xl border border-emerald-200 text-emerald-950 font-semibold flex items-start gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{guard}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
