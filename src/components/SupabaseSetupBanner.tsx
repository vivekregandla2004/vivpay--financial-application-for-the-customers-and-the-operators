/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Key, ExternalLink, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';

interface SupabaseSetupBannerProps {
  status: {
    isConfigured: boolean;
    hasUrl: boolean;
    hasAnonKey: boolean;
    hasServiceRoleKey: boolean;
    missingVariables: string[];
    instructions?: {
      supabaseUrl: string;
      supabaseAnonKey: string;
      supabaseServiceRoleKey: string;
    };
  } | null;
  onRefresh: () => void;
}

export const SupabaseSetupBanner: React.FC<SupabaseSetupBannerProps> = ({ status, onRefresh }) => {
  const [expanded, setExpanded] = useState(false);
  const [oauthGuideOpen, setOauthGuideOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!status) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-fthkg6pxeicizxput2s2te-900710948364.asia-southeast1.run.app';
  const supabaseCallbackUrl = 'https://qkuasaeecakwjfeymtwv.supabase.co/auth/v1/callback';

  if (status.isConfigured) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-400 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Connected to Supabase PostgreSQL:</strong> Live database & Supabase Auth active.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOauthGuideOpen(!oauthGuideOpen)}
              className="flex items-center gap-1 hover:text-emerald-300 transition-colors cursor-pointer px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px]"
            >
              <ShieldCheck className="w-3 h-3" />
              <span>Email Auth & Redirect URLs</span>
              {oauthGuideOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 hover:text-emerald-300 transition-colors cursor-pointer px-2 py-1 rounded bg-emerald-500/10 text-[11px]"
              title="Re-check connection"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Check Status</span>
            </button>
          </div>
        </div>

        {oauthGuideOpen && (
          <div className="mt-2 pt-2.5 border-t border-emerald-500/20 text-zinc-300 text-xs space-y-3 bg-zinc-950/70 p-3.5 rounded-lg border">
            <div>
              <h5 className="font-semibold text-white flex items-center gap-1.5 text-xs">
                <span>Supabase Email Confirmation & URL Configuration Guide</span>
              </h5>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                To ensure confirmation emails redirect to this live app instead of <code>localhost:3000</code>:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div className="bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-lg space-y-1.5">
                <p className="font-semibold text-emerald-400">1. Required Redirect URLs:</p>
                <div className="space-y-1">
                  <p className="text-zinc-400">In Supabase Dashboard → <strong>Authentication</strong> → <strong>URL Configuration</strong> → <strong>Redirect URLs</strong>, add:</p>
                  <code className="block bg-black/60 px-2 py-1 rounded text-emerald-300 break-all select-all">{currentOrigin}/**</code>
                  <code className="block bg-black/60 px-2 py-1 rounded text-zinc-300 break-all select-all mt-1">{currentOrigin}</code>
                </div>
              </div>

              <div className="bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-lg space-y-1.5">
                <p className="font-semibold text-indigo-400">2. Site URL Configuration:</p>
                <div className="space-y-1">
                  <p className="text-zinc-400">In <strong>URL Configuration</strong> → <strong>Site URL</strong>, set your production origin:</p>
                  <code className="block bg-black/60 px-2 py-1 rounded text-indigo-300 break-all select-all">{currentOrigin}</code>
                  <p className="text-[10px] text-zinc-400 mt-1">This prevents confirmation links from falling back to <code>localhost:3000</code>.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-xl text-amber-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm text-amber-300">
              Supabase Project Connection Pending
            </h4>
            <p className="text-xs text-amber-200/90 mt-0.5">
              The application backend is configured for Supabase. To connect to your database and authentication, add your project keys in Google AI Studio.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Setup Guide</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            title="Refresh status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Check</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3.5 pt-3 border-t border-amber-500/20 text-xs space-y-2.5">
          <p className="text-amber-200">
            Open the <strong>Secrets / Environment Variables</strong> panel in the Google AI Studio UI and provide:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="bg-black/30 p-2.5 rounded-lg border border-amber-500/20">
              <span className="font-mono font-semibold text-amber-300 block">SUPABASE_URL</span>
              <span className="text-[11px] text-zinc-300 mt-1 block">
                Supabase Dashboard → Project Settings → API → Project URL
              </span>
            </div>
            <div className="bg-black/30 p-2.5 rounded-lg border border-amber-500/20">
              <span className="font-mono font-semibold text-amber-300 block">SUPABASE_ANON_KEY</span>
              <span className="text-[11px] text-zinc-300 mt-1 block">
                Supabase Dashboard → Project Settings → API → anon / public key
              </span>
            </div>
            <div className="bg-black/30 p-2.5 rounded-lg border border-amber-500/20">
              <span className="font-mono font-semibold text-amber-300 block">SUPABASE_SERVICE_ROLE_KEY</span>
              <span className="text-[11px] text-zinc-300 mt-1 block">
                Supabase Dashboard → Project Settings → API → service_role key
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-amber-300/80 mt-1">
            <ExternalLink className="w-3 h-3" />
            <span>Database SQL Migration is ready at: <code className="bg-black/40 px-1 py-0.5 rounded text-amber-200">migrations/supabase/001_initial_supabase_schema.sql</code></span>
          </div>
        </div>
      )}
    </div>
  );
};
