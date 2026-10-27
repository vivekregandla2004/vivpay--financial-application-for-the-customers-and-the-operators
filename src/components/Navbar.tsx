/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CustomerProfile, Account } from '../types/database.ts';
import { UserRole } from '../services/demoData.ts';
import {
  CreditCard,
  Sparkles,
  LogOut,
  Wallet,
  User,
  PlusCircle,
  Shield,
  Briefcase,
  UserCheck,
  ChevronDown,
  Menu,
  X,
  Sun,
  Moon,
  ArrowRight,
} from 'lucide-react';

interface NavbarProps {
  customer: CustomerProfile | null;
  accounts: Account[];
  selectedAccountId: string | 'all';
  onSelectAccount: (id: string | 'all') => void;
  onOpenAddAccount?: () => void;
  onOpenAskViv: () => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  onOpenPortalAuth?: (role: UserRole, mode?: 'login' | 'register') => void;
  activeRole: UserRole;
  authoritativeRole?: UserRole;
  onSelectRole: (role: UserRole) => void;
  isDemoSession?: boolean;
  onScrollToSection?: (sectionId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  customer,
  accounts,
  selectedAccountId,
  onSelectAccount,
  onOpenAddAccount,
  onOpenAskViv,
  onLogout,
  onOpenAuth,
  onOpenPortalAuth,
  activeRole,
  authoritativeRole = 'customer',
  onSelectRole,
  isDemoSession = false,
  onScrollToSection,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginDropdownOpen, setLoginDropdownOpen] = useState(false);

  const handlePortalSelect = (portal: UserRole, mode: 'login' | 'register' = 'login') => {
    setLoginDropdownOpen(false);
    setMobileMenuOpen(false);
    if (onOpenPortalAuth) {
      onOpenPortalAuth(portal, mode);
    } else {
      onOpenAuth();
    }
  };

  return (
    <header className="glass-nav sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#5878FF] via-[#6888FF] to-[#8CA8FF] flex items-center justify-center text-white shadow-md shadow-[#5878FF]/20">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-[#172B4D] flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
              VivPay
              {isDemoSession && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#EAF3FF] text-[#5878FF] border border-[#5878FF]/20">
                  Demo • {activeRole}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Center Navigation Links */}
        {!customer ? (
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#64748B]">
            <button
              onClick={() => onScrollToSection?.('features')}
              className="hover:text-[#5878FF] transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => onScrollToSection?.('login-portals')}
              className="hover:text-[#5878FF] transition-colors cursor-pointer"
            >
              Workspace Portals
            </button>
            <button
              onClick={() => onScrollToSection?.('security')}
              className="hover:text-[#5878FF] transition-colors cursor-pointer"
            >
              Security
            </button>
            <button
              onClick={() => onScrollToSection?.('product')}
              className="hover:text-[#5878FF] transition-colors cursor-pointer"
            >
              Product
            </button>
          </nav>
        ) : (
          /* Single Authoritative Role Badge (Role Switching Disabled per RBAC) */
          <div className="hidden sm:flex items-center text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-[#EAF3FF] text-[#172B4D] border border-[#5878FF]/20 gap-2 shadow-2xs">
            {authoritativeRole === 'admin' ? (
              <>
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span>Admin Console (Authorized)</span>
              </>
            ) : authoritativeRole === 'employee' ? (
              <>
                <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                <span>Operations Desk (Authorized)</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5 text-[#5878FF]" />
                <span>Customer Portal (Authorized)</span>
              </>
            )}
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex w-9 h-9 rounded-xl neu-subtle items-center justify-center text-[#64748B] hover:text-[#172B4D] transition-colors">
            <Sun className="w-4 h-4 text-amber-500" />
          </div>

          {!customer ? (
            <div className="flex items-center gap-3">
              {/* Three Clearly Separated Login Entry Points Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setLoginDropdownOpen(!loginDropdownOpen)}
                  className="text-sm font-semibold text-[#172B4D] hover:text-[#5878FF] px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 neu-subtle"
                >
                  <span>Sign In</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#64748B] transition-transform ${loginDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {loginDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 glass-panel z-50 p-2 space-y-1 animate-in fade-in slide-in-from-top-2">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      Choose Login Portal
                    </div>
                    <button
                      onClick={() => handlePortalSelect('customer')}
                      className="w-full p-2 rounded-xl hover:bg-[#EAF3FF] flex items-center gap-2.5 text-left transition-colors cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center shrink-0">
                        <UserCheck className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#172B4D] group-hover:text-[#5878FF]">Customer Login</p>
                        <p className="text-[10px] text-[#64748B]">Personal Accounts</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handlePortalSelect('employee')}
                      className="w-full p-2 rounded-xl hover:bg-[#EAF3FF] flex items-center gap-2.5 text-left transition-colors cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center shrink-0">
                        <Briefcase className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#172B4D] group-hover:text-[#5878FF]">Employee Login</p>
                        <p className="text-[10px] text-[#64748B]">Operations Desk</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handlePortalSelect('admin')}
                      className="w-full p-2 rounded-xl hover:bg-amber-50 flex items-center gap-2.5 text-left transition-colors cursor-pointer group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Shield className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#172B4D] group-hover:text-amber-700">Admin Login</p>
                        <p className="text-[10px] text-[#64748B]">System Governance</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => handlePortalSelect('customer', 'register')}
                className="btn-sky-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              {/* Account Dropdown in Customer View */}
              {activeRole === 'customer' && accounts.length > 0 && (
                <div className="hidden lg:flex items-center gap-1.5 neu-subtle rounded-xl px-2.5 py-1.5">
                  <Wallet className="w-4 h-4 text-[#5878FF]" />
                  <select
                    value={selectedAccountId}
                    onChange={(e) => onSelectAccount(e.target.value)}
                    className="bg-transparent text-xs text-[#172B4D] font-semibold focus:outline-none cursor-pointer pr-2"
                  >
                    <option value="all">All Accounts ({accounts.length})</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} (${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Ask Viv Button */}
              {activeRole === 'customer' && (
                <button
                  onClick={onOpenAskViv}
                  className="glass-pill flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 hover:bg-[#EAF3FF] text-[#172B4D] transition-all cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#5878FF]" />
                  <span className="hidden sm:inline">Ask Viv</span>
                </button>
              )}

              {/* Profile Card */}
              <div className="flex items-center gap-2 neu-subtle rounded-xl px-3 py-1.5">
                <div className="w-6 h-6 rounded-lg bg-[#5878FF] text-white text-xs font-bold flex items-center justify-center">
                  {customer.fullName ? customer.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="text-left hidden md:block">
                  <span className="text-xs font-bold text-[#172B4D] block leading-tight">{customer.fullName}</span>
                  <span className="text-[10px] text-[#64748B] block leading-tight uppercase font-bold">{activeRole}</span>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="p-2 rounded-xl neu-subtle hover:bg-rose-50 hover:text-rose-600 text-[#64748B] transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3 animate-in slide-in-from-top-2">
          {!customer ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  onScrollToSection?.('features');
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 text-sm text-slate-600 font-medium"
              >
                Features
              </button>
              <button
                onClick={() => {
                  onScrollToSection?.('login-portals');
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 text-sm text-slate-600 font-medium"
              >
                Workspace Portals
              </button>
              <button
                onClick={() => {
                  onScrollToSection?.('security');
                  setMobileMenuOpen(false);
                }}
                className="text-left py-2 text-sm text-slate-600 font-medium"
              >
                Security
              </button>
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Login Portal
                </div>
                <button
                  onClick={() => handlePortalSelect('customer')}
                  className="w-full p-2.5 rounded-xl bg-purple-50 text-purple-700 text-xs font-semibold flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    <span>Customer Login</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handlePortalSelect('employee')}
                  className="w-full p-2.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    <span>Employee Login</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handlePortalSelect('admin')}
                  className="w-full p-2.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>Admin Login</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handlePortalSelect('customer', 'register')}
                  className="w-full text-center py-2.5 rounded-xl btn-primary-gradient text-white text-xs font-semibold mt-1"
                >
                  Create Customer Account
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="px-3 py-2.5 rounded-xl bg-[#EAF3FF] border border-[#5878FF]/20 flex items-center gap-2 text-xs font-bold text-[#172B4D]">
                {authoritativeRole === 'admin' ? (
                  <>
                    <Shield className="w-4 h-4 text-amber-600" />
                    <span>Admin Governance (Authorized)</span>
                  </>
                ) : authoritativeRole === 'employee' ? (
                  <>
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    <span>Operations Desk (Authorized)</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 text-[#5878FF]" />
                    <span>Customer Financial Hub (Authorized)</span>
                  </>
                )}
              </div>
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-center py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
