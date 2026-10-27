/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { UserCheck, Briefcase, Shield, ArrowRight, Sparkles, Lock, ShieldAlert } from 'lucide-react';
import { UserRole } from '../services/demoData.ts';

interface LoginPortalCardsProps {
  onSelectPortal: (portal: UserRole, mode?: 'login' | 'register') => void;
}

export const LoginPortalCards: React.FC<LoginPortalCardsProps> = ({ onSelectPortal }) => {
  return (
    <section id="login-portals" className="space-y-6 pt-4 pb-8">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF3FF] border border-[#5878FF]/20 text-[#5878FF] text-xs font-semibold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-[#5878FF]" />
          <span>Multi-Tenant Access Architecture</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#172B4D] tracking-tight">
          Select Your VivPay Workspace Portal
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
          Log in with your verified Supabase credentials into your designated role-based dashboard.
          Role permissions are cryptographically validated against authoritative database records.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
        {/* 1. CUSTOMER LOGIN CARD */}
        <div className="glass-card p-6 flex flex-col justify-between border-2 border-[#5878FF]/20 hover:border-[#5878FF]/50 transition-all shadow-md hover:shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#5878FF]/5 rounded-full blur-2xl -z-10 group-hover:scale-125 transition-transform" />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#5878FF] via-[#6888FF] to-[#8CA8FF] text-white flex items-center justify-center shadow-md shadow-[#5878FF]/20">
                <UserCheck className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#EAF3FF] text-[#5878FF] border border-[#5878FF]/20">
                Public Portal
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#172B4D] group-hover:text-[#5878FF] transition-colors">
                Customer Login
              </h3>
              <p className="text-xs text-[#5878FF] font-semibold mt-0.5">Personal Finance & Twin</p>
              <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
                Personal banking intelligence for individual account holders. Import statements, track expenses, and consult Ask Viv.
              </p>
            </div>

            <div className="pt-2 border-t border-[#DCE7F6] space-y-1.5 text-xs text-[#64748B]">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5878FF]" />
                <span>Multi-format bank statement ingestion</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5878FF]" />
                <span>Cash flow simulation & Financial Twin</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5878FF]" />
                <span>Autonomous AI financial copilot</span>
              </div>
            </div>
          </div>

          <div className="pt-6 space-y-2.5">
            <button
              onClick={() => onSelectPortal('customer', 'login')}
              className="w-full btn-sky-primary text-xs font-semibold py-3 px-4 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
            >
              <span>Customer Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="text-center">
              <button
                onClick={() => onSelectPortal('customer', 'register')}
                className="text-[11px] font-medium text-[#5878FF] hover:text-[#4868EF] transition-colors cursor-pointer"
              >
                New user? Create customer account
              </button>
            </div>
          </div>
        </div>

        {/* 2. EMPLOYEE LOGIN CARD */}
        <div className="card-luxury p-6 flex flex-col justify-between border-2 border-blue-100 hover:border-blue-300 transition-all shadow-md hover:shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -z-10 group-hover:scale-125 transition-transform" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Briefcase className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                Authorized Staff
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                Employee Login
              </h3>
              <p className="text-xs text-blue-600 font-semibold mt-0.5">Operations Desk & Triage</p>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Dedicated workspace for customer service specialists, dispute investigators, and AML compliance officers.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                <span>Service case triage & SLA resolution</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                <span>AML anomaly alerts & risk scoring</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                <span>Statement parsing telemetry queue</span>
              </div>
            </div>
          </div>

          <div className="pt-6 space-y-2.5">
            <button
              onClick={() => onSelectPortal('employee', 'login')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-3 px-4 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <span>Employee Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="text-center flex items-center justify-center gap-1 text-[11px] text-slate-400">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Requires provisioned staff credentials</span>
            </div>
          </div>
        </div>

        {/* 3. ADMIN LOGIN CARD */}
        <div className="card-luxury p-6 flex flex-col justify-between border-2 border-amber-100 hover:border-amber-300 transition-all shadow-md hover:shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -z-10 group-hover:scale-125 transition-transform" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Shield className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80">
                Privileged Access
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                Admin Login
              </h3>
              <p className="text-xs text-amber-600 font-semibold mt-0.5">Governance & System Security</p>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Privileged governance console for platform administrators and security engineers to manage RBAC and audit trails.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                <span>System user role & status provisioning</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                <span>Immutable append-only audit activity log</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                <span>PostgreSQL RLS security diagnostics</span>
              </div>
            </div>
          </div>

          <div className="pt-6 space-y-2.5">
            <button
              onClick={() => onSelectPortal('admin', 'login')}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-3 px-4 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <span>Admin Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="text-center flex items-center justify-center gap-1 text-[11px] text-slate-400">
              <ShieldAlert className="w-3 h-3 text-amber-500" />
              <span>Requires administrator credentials</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
