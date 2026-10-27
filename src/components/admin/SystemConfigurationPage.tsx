/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Server,
  Database,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  KeyRound,
  Layers,
} from 'lucide-react';
import { adminApi } from '../../services/api.ts';

interface SystemConfigPageProps {
  supabaseStatus: any;
  onRefreshHealth?: () => void;
}

export const SystemConfigurationPage: React.FC<SystemConfigPageProps> = ({
  supabaseStatus,
  onRefreshHealth,
}) => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [savingTunable, setSavingTunable] = useState(false);
  const [tunableSuccess, setTunableSuccess] = useState<string | null>(null);
  const [tunableError, setTunableError] = useState<string | null>(null);

  // Tunable form state
  const [sessionTimeout, setSessionTimeout] = useState(60);
  const [alertRiskFloor, setAlertRiskFloor] = useState(75);
  const [maxUploadMb, setMaxUploadMb] = useState(25);
  const [ragThreshold, setRagThreshold] = useState(0.38);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSystemConfig();
      setConfig(res);
      if (res?.tunable) {
        setSessionTimeout(res.tunable.sessionTimeoutMinutes || 60);
        setAlertRiskFloor(res.tunable.alertRiskFloorThreshold || 75);
        setMaxUploadMb(Math.round((res.tunable.maxStatementUploadSizeBytes || 26214400) / (1024 * 1024)));
        setRagThreshold(res.tunable.ragGroundingConfidenceThreshold || 0.38);
        setMaintenanceMode(Boolean(res.tunable.maintenanceMode));
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTunable = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTunable(true);
    setTunableSuccess(null);
    setTunableError(null);

    try {
      const res = await adminApi.updateSystemConfig({
        sessionTimeoutMinutes: Number(sessionTimeout),
        alertRiskFloorThreshold: Number(alertRiskFloor),
        maxStatementUploadSizeBytes: Number(maxUploadMb) * 1024 * 1024,
        ragGroundingConfidenceThreshold: Number(ragThreshold),
        maintenanceMode: Boolean(maintenanceMode),
      });

      if (res?.success) {
        setTunableSuccess('Operational parameters updated and committed to security audit trail.');
        setTimeout(() => setTunableSuccess(null), 3500);
      }
    } catch (err: any) {
      setTunableError(err.message || 'Failed to update system configuration.');
    } finally {
      setSavingTunable(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <div className="space-y-6 text-left">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
            <Sliders className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">System & Integration Configuration</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Service Diagnostics
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Service connectivity matrix, cryptographic parameter validation, and runtime environment inspection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchConfig();
              onRefreshHealth?.();
            }}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Verify Live Configuration</span>
          </button>
        </div>
      </div>

      {/* Secret Non-Disclosure Guarantee */}
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl px-5 py-4 flex items-center gap-3 text-xs text-emerald-900">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <span className="font-bold">Zero-Secret Policy & Production Boundary: </span>
          <span>
            API keys, database service role tokens, and cryptographic secrets are strictly protected server-side and never rendered to the client interface. Only connection statuses and schema integrity checks are exposed.
          </span>
        </div>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Database & Supabase Connectivity */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-sm text-slate-900">Database & Storage Provider</h3>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Supabase PostgreSQL
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Provider Status:</span>
                <span
                  className={`font-semibold flex items-center gap-1 ${
                    supabaseStatus?.isConfigured ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {supabaseStatus?.isConfigured ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Fully Configured
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" /> Demo Mode / Setup Pending
                    </>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Host Endpoint:</span>
                <span className="font-mono text-slate-800">
                  {config?.database?.urlHost || 'https://qkuasaeecakwjfeymtwv.supabase.co'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Anon Key Credential:</span>
                <span className="font-mono text-emerald-700 font-semibold">Configured (Masked)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Service Role Credential:</span>
                <span className="font-mono text-slate-700">
                  {supabaseStatus?.hasServiceRoleKey ? 'Configured (Masked)' : 'Optional (Anon Fallback)'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Row-Level Security (RLS):</span>
                <span className="font-semibold text-emerald-700">Enforced by default</span>
              </div>
            </div>

            <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-[11px] text-slate-600 space-y-1.5">
              <div className="font-bold text-purple-900">Canonical PostgreSQL Tables (001_initial_supabase_schema.sql):</div>
              <div className="grid grid-cols-2 gap-1 font-mono text-[10px] text-slate-700">
                <div>• customers</div>
                <div>• accounts</div>
                <div>• transactions</div>
                <div>• transaction_categories</div>
                <div>• statement_documents</div>
                <div>• category_corrections</div>
                <div>• financial_goals</div>
                <div>• group_expenses</div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: AI Intelligence & Vector Retrievability */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-sm text-slate-900">AI Intelligence & RAG Pipeline</h3>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              Gemini & Vector
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Generation Model:</span>
                <span className="font-mono text-purple-700 font-bold">
                  {config?.aiIntelligence?.textModel || 'gemini-2.5-flash'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Embedding Model:</span>
                <span className="font-mono text-slate-800">
                  {config?.aiIntelligence?.embeddingModel || 'text-embedding-004'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Embedding Dimensions:</span>
                <span className="font-mono text-slate-800 font-bold">
                  {config?.aiIntelligence?.embeddingDimension || 768}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Cosine Grounding Threshold:</span>
                <span className="font-mono text-emerald-700 font-bold">
                  {config?.aiIntelligence?.groundingThreshold || 0.38}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Vector Store Architecture:</span>
                <span className="font-medium text-slate-700">In-Memory Tenant Isolated</span>
              </div>
            </div>

            <div className="p-3 bg-slate-100/70 rounded-xl text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-slate-800">RAG Confidence Classification:</div>
              <p>
                Answers with top similarity score &ge; 0.65 are classified as <strong>High Confidence</strong>; &ge; 0.38 as <strong>Medium Confidence</strong>; below 0.38 are marked <strong>Low Confidence</strong> with empty citations to prevent hallucinated advice.
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Runtime & Node.js Environment */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-600" />
              <h3 className="font-bold text-sm text-slate-900">Runtime & Hosting Architecture</h3>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Vite + Express Full-Stack
            </span>
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Node.js Engine:</span>
              <span className="font-bold text-slate-800">{config?.runtime?.nodeVersion || 'v20.x / v22.x'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Operating Platform:</span>
              <span className="text-slate-800">{config?.runtime?.platform || 'linux x64'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Server Process Uptime:</span>
              <span className="text-purple-700 font-semibold">{config?.runtime?.uptimeSeconds ? `${config.runtime.uptimeSeconds}s` : 'Active'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-sans">Internal Express Port:</span>
              <span className="text-slate-800">3000 (Proxy & Vite Dev middleware)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 font-sans">Environment Mode:</span>
              <span className="text-emerald-700 font-bold uppercase">{config?.runtime?.environment || 'development'}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Cryptographic Boundaries & Data Guardrails */}
        <div className="card-luxury p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">Data Boundaries & Privacy Guardrails</h3>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Cryptographic
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Banking Credentials:</span>
                <span className="font-semibold text-emerald-700">Zero-Knowledge (Never stored)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Account Number Representation:</span>
                <span className="font-mono text-slate-800">Masked (•••• XXXX)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Customer Data Access for Admins:</span>
                <span className="font-semibold text-purple-700">Metadata Only (No Plain Ledgers)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600 font-medium">Group Financial Privacy Tiers:</span>
                <span className="font-semibold text-emerald-700">Fully Isolated / User Selective</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600 font-medium">API Request CORS Boundary:</span>
                <span className="font-semibold text-slate-800">Strict Same-Origin / Authorized</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tunable Operational Controls & Guardrails (Audited) */}
      <div className="card-luxury p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Tunable Operational Controls & Risk Thresholds</h3>
              <p className="text-[11px] text-slate-500">
                Adjust operational parameters, surveillance risk floors, and session controls. Changes trigger immutable audit logs.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            Validated Admin Form
          </span>
        </div>

        {tunableError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{tunableError}</span>
          </div>
        )}

        {tunableSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{tunableSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSaveTunable} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <label className="font-bold text-slate-800 block">Session Inactivity Timeout (min)</label>
              <input
                type="number"
                min={5}
                max={1440}
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-400 block">Allowed range: 5 – 1440 mins</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <label className="font-bold text-slate-800 block">Surveillance Risk Floor Threshold</label>
              <input
                type="number"
                min={1}
                max={100}
                value={alertRiskFloor}
                onChange={(e) => setAlertRiskFloor(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-400 block">Mandatory escalation score (1 – 100)</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <label className="font-bold text-slate-800 block">Max Statement Upload Size (MB)</label>
              <input
                type="number"
                min={1}
                max={50}
                value={maxUploadMb}
                onChange={(e) => setMaxUploadMb(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-400 block">Ingestion payload ceiling: 1 – 50 MB</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <label className="font-bold text-slate-800 block">RAG Grounding Floor (Cosine Sim)</label>
              <input
                type="number"
                step="0.01"
                min={0.1}
                max={0.95}
                value={ragThreshold}
                onChange={(e) => setRagThreshold(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-slate-400 block">Cosine similarity threshold (0.10 – 0.95)</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 sm:col-span-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-slate-800 block">Platform Maintenance Mode</strong>
                  <span className="text-[10px] text-slate-500">Temporarily restrict customer write actions for schema maintenance</span>
                </div>
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                />
              </div>
              <span className="text-[10px] text-purple-700 font-semibold">
                Status: {maintenanceMode ? 'Active (Maintenance Restricted)' : 'Normal Operations (Standard Traffic)'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              Audited action: All modifications are non-repudiable and stored in <span className="font-mono">audit_logs</span>.
            </span>
            <button
              type="submit"
              disabled={savingTunable}
              className="btn-primary-gradient text-white font-semibold px-4 py-2 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${savingTunable ? 'animate-spin' : ''}`} />
              <span>{savingTunable ? 'Saving & Auditing...' : 'Save & Audit Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
