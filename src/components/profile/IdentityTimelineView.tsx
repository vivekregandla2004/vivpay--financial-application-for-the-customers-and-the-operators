/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Clock,
  User,
  ShieldCheck,
  Brain,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Filter,
  Layers,
  Sparkles,
} from 'lucide-react';
import { FinancialIdentity, IdentityTimelineEvent, EvidenceTier } from '../../lib/identity/types.ts';

interface IdentityTimelineViewProps {
  identity: FinancialIdentity;
}

export const IdentityTimelineView: React.FC<IdentityTimelineViewProps> = ({
  identity,
}) => {
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterActor, setFilterActor] = useState<string>('all');

  const events: IdentityTimelineEvent[] = identity.timeline || [
    {
      id: 'tl-default-1',
      timestamp: '2026-09-01T10:00:00Z',
      type: 'profile_created',
      title: 'Initial Financial Identity Declared',
      description: 'Profile initialized with declared salary ₹145,000 and core monthly commitments.',
      actor: 'customer',
      evidenceSource: 'declared',
    },
    {
      id: 'tl-default-2',
      timestamp: '2026-09-15T15:20:00Z',
      type: 'statement_verified',
      title: 'HDFC Statement Parsed & Reconciled',
      description: '142 canonical transactions validated; detected salary credits match declared income.',
      actor: 'system',
      evidenceSource: 'statement',
    },
    {
      id: 'tl-default-3',
      timestamp: '2026-10-02T11:45:00Z',
      type: 'goal_added',
      title: 'Electric Vehicle Goal Established',
      description: 'Target ₹450,000 by Oct 2027 added with monthly contribution ₹15,000.',
      actor: 'customer',
      evidenceSource: 'declared',
    },
    {
      id: 'tl-default-4',
      timestamp: '2026-10-12T16:00:00Z',
      type: 'bias_identified',
      title: 'Cognitive Trait Analyzed',
      description: 'Copilot detected mild Mental Accounting between vehicle debt and liquid emergency funds.',
      actor: 'copilot',
      evidenceSource: 'cognitive',
    },
  ];

  const filteredEvents = events.filter((e) => {
    if (filterSource !== 'all' && e.evidenceSource !== filterSource) return false;
    if (filterActor !== 'all' && e.actor !== filterActor) return false;
    return true;
  });

  const getSourceBadge = (source: EvidenceTier) => {
    switch (source) {
      case 'statement':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'declared':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'derived':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'cognitive':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-800 border-slate-200';
    }
  };

  const getActorIcon = (actor: string) => {
    switch (actor) {
      case 'customer':
        return User;
      case 'copilot':
        return Brain;
      default:
        return ShieldCheck;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="card-luxury p-6 sm:p-7 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30">
                Identity Audit Trail
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Immutable Provenance
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight font-['Plus_Jakarta_Sans']">
              Chronological Identity Event Timeline
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Maintains an immutable timeline of profile updates, statement verifications, goal declarations, and cognitive evaluations. Track who modified what and verify evidence sources.
            </p>
          </div>

          <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
            <Clock className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="card-luxury p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Filter className="w-4 h-4 text-purple-600" />
          <span>Filter Events:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Source Filter */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Evidence Tiers</option>
            <option value="statement">Statement Evidence</option>
            <option value="declared">User Declared</option>
            <option value="derived">Derived Analytics</option>
            <option value="cognitive">Cognitive Signals</option>
          </select>

          {/* Actor Filter */}
          <select
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Actors</option>
            <option value="customer">Customer</option>
            <option value="system">System Engine</option>
            <option value="copilot">Viv Copilot</option>
          </select>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="card-luxury p-6 sm:p-7 space-y-6">
        <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-100 space-y-8">
          {filteredEvents.map((event) => {
            const ActorIcon = getActorIcon(event.actor);
            const eventDate = new Date(event.timestamp);

            return (
              <div key={event.id} className="relative group">
                {/* Node indicator */}
                <div className="absolute -left-[33px] sm:-left-[41px] top-1 w-6 h-6 rounded-full bg-white border-2 border-purple-500 flex items-center justify-center shadow-xs">
                  <ActorIcon className="w-3 h-3 text-purple-600" />
                </div>

                <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all space-y-2 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{event.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSourceBadge(event.evidenceSource)}`}>
                        {event.evidenceSource}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold">
                      <span>{eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span>•</span>
                      <span>{eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {event.description}
                  </p>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span className="capitalize">
                      Actor: <strong className="text-slate-800">{event.actor}</strong>
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      ID: {event.id}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredEvents.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl">
            No identity timeline events match the selected filters.
          </div>
        )}
      </div>
    </div>
  );
};
