/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  TrendingUp,
  CreditCard,
  Lock,
  Zap,
  CheckCircle2,
  PieChart,
  Bot,
  FileSpreadsheet,
  Briefcase,
  UserCheck,
  ChevronDown,
} from 'lucide-react';
import { UserRole } from '../services/demoData.ts';
import { LoginPortalCards } from './LoginPortalCards.tsx';

interface LandingHeroProps {
  onGetStarted: () => void;
  onTryDemo: (role?: 'customer' | 'employee' | 'admin') => void;
  onLogin: (role?: 'customer' | 'employee' | 'admin') => void;
  onSelectPortal?: (role: UserRole, mode?: 'login' | 'register') => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onGetStarted,
  onTryDemo,
  onLogin,
  onSelectPortal,
}) => {
  const [loginMenuOpen, setLoginMenuOpen] = useState(false);

  const handlePortalClick = (role: UserRole, mode: 'login' | 'register' = 'login') => {
    setLoginMenuOpen(false);
    if (onSelectPortal) {
      onSelectPortal(role, mode);
    } else {
      onLogin(role);
    }
  };

  return (
    <div className="relative space-y-16 py-6 md:py-12">
      {/* Background Radial Glow Elements for Sky Glass Atmosphere */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[640px] overflow-hidden -z-10 select-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#5878FF]/10 rounded-full blur-3xl" />
        <div className="absolute top-24 right-1/4 w-[30rem] h-[30rem] bg-[#EDE9FF]/65 rounded-full blur-3xl" />
        <div className="absolute top-52 left-1/2 -translate-x-1/2 w-[38rem] h-64 bg-[#EAF3FF]/80 rounded-full blur-2xl" />
      </div>

      {/* 1. Main Hero Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Headline and Call-to-Actions */}
        <div className="lg:col-span-7 space-y-8 text-left">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAF3FF] border border-[#5878FF]/20 text-[#5878FF] text-xs font-semibold shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-[#5878FF]" />
            <span>Autonomous Financial Intelligence</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#172B4D] leading-[1.12]">
            Don't just see where your money went.{' '}
            <span className="text-[#5878FF] block sm:inline">
              Know what to do next.
            </span>
          </h1>

          {/* Supporting Text */}
          <p className="text-base sm:text-lg text-[#64748B] max-w-xl leading-relaxed">
            VivPay connects bank statements, UPI apps, and ledgers into intelligent financial guidance,
            with dedicated workspaces for customers, operations teams, and platform administrators.
          </p>

          {/* Action Entry Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <button
              onClick={onGetStarted}
              className="btn-sky-primary text-sm sm:text-base font-semibold px-6 py-3.5 rounded-2xl shadow-lg shadow-[#5878FF]/20 flex items-center justify-center gap-2 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#5878FF] focus:ring-offset-2"
            >
              <span>Get Started (Customer)</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>

            {/* Quick Login Dropdown with Three Separated Options */}
            <div className="relative">
              <button
                onClick={() => setLoginMenuOpen(!loginMenuOpen)}
                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-white/85 backdrop-blur-xs hover:bg-white border border-[#DCE7F6] text-[#172B4D] text-sm sm:text-base font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#5878FF]/40"
              >
                <span>Sign In Portal</span>
                <ChevronDown className={`w-4 h-4 text-[#64748B] transition-transform ${loginMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {loginMenuOpen && (
                <div className="absolute left-0 sm:left-auto right-0 sm:right-auto mt-2 w-64 bg-white border border-[#DCE7F6] rounded-2xl shadow-xl z-30 p-2 space-y-1 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                    Select Workspace Login
                  </div>
                  <button
                    onClick={() => handlePortalClick('customer')}
                    className="w-full p-2.5 rounded-xl hover:bg-[#EAF3FF] flex items-center gap-2.5 text-left transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#172B4D] group-hover:text-[#5878FF]">Customer Login</p>
                      <p className="text-[10px] text-[#64748B]">Personal Banking & Twin</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handlePortalClick('employee')}
                    className="w-full p-2.5 rounded-xl hover:bg-blue-50 flex items-center gap-2.5 text-left transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#172B4D] group-hover:text-blue-700">Employee Login</p>
                      <p className="text-[10px] text-[#64748B]">Operations Desk & Triage</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handlePortalClick('admin')}
                    className="w-full p-2.5 rounded-xl hover:bg-amber-50 flex items-center gap-2.5 text-left transition-colors cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#172B4D] group-hover:text-amber-700">Admin Login</p>
                      <p className="text-[10px] text-[#64748B]">Security & RBAC Governance</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => onTryDemo('customer')}
              className="px-5 py-3.5 rounded-2xl bg-white/85 backdrop-blur-xs hover:bg-white border border-[#DCE7F6] text-[#172B4D] text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#5878FF]/40"
            >
              <span>Try Demo</span>
            </button>
          </div>

          {/* Feature indicators */}
          <div className="pt-4 grid grid-cols-3 gap-4 border-t border-[#DCE7F6] max-w-lg">
            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <CheckCircle2 className="w-4 h-4 text-[#5878FF] shrink-0" />
              <span>Customer Twin</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Operations Desk</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Admin Governance</span>
            </div>
          </div>
        </div>

        {/* Right Column: Reference Ask Viv Preview Card */}
        <div className="lg:col-span-5 relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-[#5878FF]/15 via-[#EDE9FF]/30 to-transparent rounded-3xl blur-2xl -z-10" />

          <div className="glass-hero-card p-6 sm:p-7 space-y-6">
            <div className="flex items-center justify-between border-b border-[#DCE7F6] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#5878FF] via-[#6888FF] to-[#8CA8FF] flex items-center justify-center text-white shadow-md shadow-[#5878FF]/25">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#172B4D] leading-tight">Ask Viv</h3>
                  <p className="text-xs text-[#64748B]">Autonomous Financial Copilot</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EAF3FF] border border-[#5878FF]/20 text-[#5878FF] text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-[#5878FF]" />
                <span>Verified Model</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-[#5878FF] text-white text-xs font-medium px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-xs shadow-xs">
                  "How much can I safely save this month after rent & planned investments?"
                </div>
              </div>

              <div className="flex justify-start">
                <div className="bg-white border border-[#DCE7F6] text-[#172B4D] text-xs px-4 py-3 rounded-2xl rounded-tl-sm max-w-sm space-y-2 leading-relaxed shadow-xs">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-[#5878FF]">
                    <Sparkles className="w-3 h-3" />
                    <span>Viv Financial Intelligence</span>
                  </div>
                  <p>
                    Based on verified cash inflows ($5,400.00) and fixed commitments, you have{' '}
                    <strong className="text-[#172B4D] font-bold">$1,420.00 discretionary surplus</strong>. Setting aside $850 into your liquid savings yields a healthy 28% savings rate.
                  </p>
                </div>
              </div>
            </div>

            {/* Three Compact Financial Insight Cards */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="bg-[#F4F9FF] border border-[#DCE7F6] p-3 rounded-xl text-left space-y-1">
                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                  Net Surplus
                </span>
                <span className="text-sm font-bold text-emerald-600 block font-mono tnum">+$1,420</span>
                <span className="text-[10px] text-[#64748B] block">+14% vs Aug</span>
              </div>

              <div className="bg-[#F4F9FF] border border-[#DCE7F6] p-3 rounded-xl text-left space-y-1">
                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                  Savings Rate
                </span>
                <span className="text-sm font-bold text-[#5878FF] block font-mono tnum">28.4%</span>
                <span className="text-[10px] text-[#64748B] block">Target: 20%</span>
              </div>

              <div className="bg-[#F4F9FF] border border-[#DCE7F6] p-3 rounded-xl text-left space-y-1">
                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block">
                  Fixed Bills
                </span>
                <span className="text-sm font-bold text-[#172B4D] block font-mono tnum">$2,314</span>
                <span className="text-[10px] text-[#64748B] block">3 Accounts</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => handlePortalClick('customer', 'login')}
                className="w-full py-2.5 px-4 rounded-xl bg-[#EAF3FF] hover:bg-[#5878FF] hover:text-white border border-[#5878FF]/30 text-[#5878FF] text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#5878FF]"
              >
                <span>Launch Customer Portal Login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THE THREE DISTINCT LOGIN ENTRY POINTS */}
      <LoginPortalCards onSelectPortal={handlePortalClick} />

      {/* 3. Features Grid */}
      <section id="features" className="space-y-10 pt-6 border-t border-[#DCE7F6]">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-3xl font-extrabold text-[#172B4D] tracking-tight">
            Financial Engineering, Built for Real Clarity.
          </h2>
          <p className="text-sm text-[#64748B]">
            Automated statement parsing, deterministic ledger calculation, and multi-tenant security
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {/* Feature 1 */}
          <div className="glass-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#172B4D]">Multi-Format Statement Ingestion</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Upload Excel (.xlsx, .xls), CSV, and PDF bank exports. Our in-browser parser autodetects columns, validates dates, and strips duplicate records automatically.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="glass-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#EDE9FF] text-[#5878FF] flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#172B4D]">Deterministic Financial Math</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Pure income and pure expense calculations filter internal card transfers and refunds so your cash flow, net savings, and category distributions remain authentic.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="glass-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#172B4D]">PostgreSQL Row-Level Security</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Cryptographically backed by Supabase Auth and PostgreSQL RLS policies ensuring customer accounts and records are isolated from other tenants.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
