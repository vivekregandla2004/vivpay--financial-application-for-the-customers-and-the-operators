/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CustomerProfile } from '../types/database.ts';
import { UserRole } from '../services/demoData.ts';
import { EmployeeWorkspaceTab } from './EmployeeDashboard.tsx';
import { AdminWorkspaceTab } from './AdminDashboard.tsx';
import {
  LayoutDashboard,
  Receipt,
  FileSpreadsheet,
  PieChart,
  Sparkles,
  Briefcase,
  Shield,
  CreditCard,
  LogOut,
  UploadCloud,
  Layers,
  ChevronRight,
  TrendingUp,
  X,
  Compass,
  UserCheck,
  FolderKanban,
  Users,
  AlertTriangle,
  Inbox,
  BarChart3,
  ShieldCheck,
  BookOpen,
  Activity,
  Sliders,
  Lock,
} from 'lucide-react';

interface SidebarProps {
  customer: CustomerProfile;
  activeRole: UserRole;
  authoritativeRole?: UserRole;
  onSelectRole: (role: UserRole) => void;
  activeTab: 'overview' | 'transactions' | 'vault' | 'analytics' | 'twin' | 'profile';
  onSelectTab: (tab: 'overview' | 'transactions' | 'vault' | 'analytics' | 'twin' | 'profile') => void;
  activeEmployeeTab?: EmployeeWorkspaceTab;
  onSelectEmployeeTab?: (tab: EmployeeWorkspaceTab) => void;
  activeAdminTab?: AdminWorkspaceTab;
  onSelectAdminTab?: (tab: AdminWorkspaceTab) => void;
  transactionCount: number;
  documentCount: number;
  isDemoSession?: boolean;
  onOpenUpload: () => void;
  onOpenAskViv: () => void;
  onLogout: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  customer,
  activeRole,
  authoritativeRole = 'customer',
  onSelectRole,
  activeTab,
  onSelectTab,
  activeEmployeeTab = 'overview',
  onSelectEmployeeTab,
  activeAdminTab = 'overview',
  onSelectAdminTab,
  transactionCount,
  documentCount,
  isDemoSession = false,
  onOpenUpload,
  onOpenAskViv,
  onLogout,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const adminNavItems = [
    { id: 'overview' as const, label: 'Admin Overview', icon: ShieldCheck, badge: null },
    { id: 'users' as const, label: 'User & Role Mgmt', icon: Users, badge: null },
    { id: 'knowledge' as const, label: 'Knowledge & Docs', icon: BookOpen, badge: 'RAG', badgeColor: 'bg-purple-100 text-purple-700 border-purple-200' },
    { id: 'audit' as const, label: 'Audit Activity', icon: Activity, badge: null },
    { id: 'config' as const, label: 'System Configuration', icon: Sliders, badge: null },
    { id: 'privacy' as const, label: 'Access & Privacy', icon: Lock, badge: 'RBAC', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ];
  const employeeNavItems = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard, badge: null },
    { id: 'transactions' as const, label: 'Transactions', icon: Receipt, badge: null },
    { id: 'fraud' as const, label: 'Fraud Alerts', icon: AlertTriangle, badge: 'AML', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200' },
    { id: 'investigations' as const, label: 'Investigations', icon: FolderKanban, badge: null },
    { id: 'cases' as const, label: 'Service Cases', icon: Inbox, badge: null },
    { id: 'customers' as const, label: 'Customers', icon: Users, badge: null },
    { id: 'statements' as const, label: 'Statement Processing', icon: FileSpreadsheet, badge: null },
    { id: 'analytics' as const, label: 'Operational Analytics', icon: BarChart3, badge: null },
    { id: 'knowledge' as const, label: 'Knowledge Assistant', icon: Sparkles, badge: 'RAG', badgeColor: 'bg-purple-100 text-purple-700 border-purple-200' },
  ];
  const navItems = [
    {
      id: 'overview' as const,
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'transactions' as const,
      label: 'Transactions',
      icon: Receipt,
      badge: transactionCount > 0 ? String(transactionCount) : null,
    },
    {
      id: 'analytics' as const,
      label: 'Spending Analytics',
      icon: PieChart,
      badge: null,
    },
    {
      id: 'vault' as const,
      label: 'Statement Vault',
      icon: FileSpreadsheet,
      badge: documentCount > 0 ? String(documentCount) : null,
    },
    {
      id: 'twin' as const,
      label: 'Financial Twin',
      icon: Sparkles,
      badge: 'AI',
      badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
    },
    {
      id: 'profile' as const,
      label: 'Financial Profile',
      icon: UserCheck,
      badge: 'Identity',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Persistent Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white/95 backdrop-blur-md border-r border-[#DCE7F6] flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-screen lg:shrink-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="h-20 px-6 flex items-center justify-between border-b border-[#DCE7F6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#5878FF] via-[#6888FF] to-[#8CA8FF] flex items-center justify-center text-white shadow-md shadow-[#5878FF]/20">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-[#172B4D] font-['Plus_Jakarta_Sans']">
                  VivPay
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EAF3FF] text-[#5878FF] border border-[#5878FF]/20">
                  Twin
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] font-medium">Financial Intelligence</p>
            </div>
          </div>

          {/* Close button for mobile */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-xl text-[#64748B] hover:text-[#172B4D] hover:bg-[#EAF3FF] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Single Authoritative Role Indicator (Role Switching Disabled per RBAC) */}
        <div className="px-4 py-3 border-b border-[#DCE7F6]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] px-2 mb-1.5">
            Active Workspace
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EAF3FF] text-[#172B4D] border border-[#5878FF]/20 text-xs font-bold shadow-2xs">
            {authoritativeRole === 'admin' ? (
              <>
                <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Admin Governance</span>
              </>
            ) : authoritativeRole === 'employee' ? (
              <>
                <Briefcase className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Operations Desk</span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4 text-[#5878FF] shrink-0" />
                <span>Customer Financial Hub</span>
              </>
            )}
          </div>
        </div>

        {/* Main Nav Items (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Customer Workspace Navigation */}
          {activeRole === 'customer' ? (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] px-3 mb-2">
                Financial Hub
              </div>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#EAF3FF] text-[#172B4D] border border-[#5878FF]/25 shadow-xs font-bold'
                        : 'text-[#64748B] hover:text-[#172B4D] hover:bg-[#F4F9FF]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#5878FF]' : 'text-[#64748B]'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          item.badgeColor || 'bg-[#EDE9FF] text-[#5878FF] border-[#5878FF]/20'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : activeRole === 'employee' ? (
            /* Employee / Operations Navigation */
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2 flex items-center justify-between">
                <span>Operations Desk</span>
                <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded font-mono">STAFF</span>
              </div>
              {employeeNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeEmployeeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectEmployeeTab?.(item.id);
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-purple-50 text-purple-900 border border-purple-200/80 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-purple-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          item.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Admin Governance Navigation */
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2 flex items-center justify-between">
                <span>Governance Console</span>
                <span className="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded font-mono">ADMIN</span>
              </div>
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeAdminTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectAdminTab?.(item.id);
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-purple-50 text-purple-900 border border-purple-200/80 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-purple-600' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          item.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Actions Card */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#172B4D] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#5878FF]" />
                <span>Quick Ingestion</span>
              </span>
              <span className="text-[10px] font-semibold text-[#5878FF] bg-[#EAF3FF] px-2 py-0.5 rounded-full border border-[#5878FF]/20">Bank & PhonePe</span>
            </div>

            <button
              onClick={() => {
                onOpenUpload();
                onCloseMobile?.();
              }}
              className="btn-sky-primary w-full py-2.5 px-3 rounded-xl text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer group"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Statement</span>
            </button>

            <button
              onClick={() => {
                onOpenAskViv();
                onCloseMobile?.();
              }}
              className="w-full py-2 px-3 rounded-xl neu-subtle hover:bg-[#EAF3FF] text-[#172B4D] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#5878FF]" />
              <span>Ask Viv Copilot</span>
            </button>
          </div>
        </div>

        {/* User Profile Card & Logout Footer */}
        <div className="p-4 border-t border-[#DCE7F6] bg-white/70 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#5878FF] to-[#7A5AF8] text-white text-xs font-bold flex items-center justify-center shadow-xs">
              {customer.fullName ? customer.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#172B4D] truncate">{customer.fullName || 'User'}</p>
              <p className="text-[10px] text-[#64748B] truncate">{customer.email}</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isDemoSession ? 'Demo Workspace' : 'Supabase Live'}</span>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-1 text-[11px] font-semibold text-[#64748B] hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
