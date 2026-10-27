/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuditLogEntry, SystemUser } from '../types/operations.ts';
import {
  ShieldCheck,
  Users,
  BookOpen,
  Activity,
  Sliders,
  Lock,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { AdminOverviewPage } from './admin/AdminOverviewPage.tsx';
import { UserRoleManagementPage } from './admin/UserRoleManagementPage.tsx';
import { KnowledgeDocumentManagementPage } from './admin/KnowledgeDocumentManagementPage.tsx';
import { AuditActivityPage } from './admin/AuditActivityPage.tsx';
import { SystemConfigurationPage } from './admin/SystemConfigurationPage.tsx';
import { AccessPrivacyPage } from './admin/AccessPrivacyPage.tsx';

export type AdminWorkspaceTab =
  | 'overview'
  | 'users'
  | 'knowledge'
  | 'audit'
  | 'config'
  | 'privacy';

interface AdminDashboardProps {
  systemUsers: SystemUser[];
  auditLogs: AuditLogEntry[];
  supabaseStatus: any;
  activeTab?: AdminWorkspaceTab;
  onSelectTab?: (tab: AdminWorkspaceTab) => void;
  onRefreshHealth?: () => void;
  onToggleUserStatus?: (userId: string) => Promise<void> | void;
  onUpdateUserRole?: (userId: string, role: SystemUser['role'], department?: string) => Promise<void> | void;
  onProvisionUser?: (data: { authUserId?: string; email?: string; name?: string; role: 'employee' | 'admin'; department?: string }) => Promise<void> | void;
  pendingUserIds?: Set<string>;
  adminNotification?: { type: 'error' | 'success'; message: string } | null;
  onDismissNotification?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  systemUsers,
  auditLogs,
  supabaseStatus,
  activeTab: externalActiveTab,
  onSelectTab: externalOnSelectTab,
  onRefreshHealth,
  onToggleUserStatus,
  onUpdateUserRole,
  onProvisionUser,
  pendingUserIds,
  adminNotification,
  onDismissNotification,
}) => {
  const [internalTab, setInternalTab] = useState<AdminWorkspaceTab>('overview');
  const activeTab = externalActiveTab || internalTab;

  const handleSelectTab = (tab: AdminWorkspaceTab) => {
    if (externalOnSelectTab) {
      externalOnSelectTab(tab);
    } else {
      setInternalTab(tab);
    }
  };

  const navTabs: { id: AdminWorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Admin Overview', icon: ShieldCheck },
    { id: 'users', label: 'User & Role Management', icon: Users },
    { id: 'knowledge', label: 'Knowledge & Docs', icon: BookOpen },
    { id: 'audit', label: 'Audit Activity', icon: Activity },
    { id: 'config', label: 'System Configuration', icon: Sliders },
    { id: 'privacy', label: 'Access & Privacy', icon: Lock },
  ];

  return (
    <div className="space-y-6 text-left">
      {/* Top Workspace Tab Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200/90 no-scrollbar">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-purple-50 text-purple-900 border border-purple-200/90 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-purple-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Admin Notification Banner */}
      {adminNotification && (
        <div
          className={`px-4 py-3 rounded-2xl flex items-center justify-between text-xs shadow-xs animate-in fade-in ${
            adminNotification.type === 'error'
              ? 'bg-rose-50 border border-rose-200/90 text-rose-900'
              : 'bg-emerald-50 border border-emerald-200/90 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {adminNotification.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span className="leading-relaxed font-medium">{adminNotification.message}</span>
          </div>
          {onDismissNotification && (
            <button
              onClick={onDismissNotification}
              className={`font-bold p-1 cursor-pointer shrink-0 ml-3 ${
                adminNotification.type === 'error'
                  ? 'text-rose-600 hover:text-rose-800'
                  : 'text-emerald-600 hover:text-emerald-800'
              }`}
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Render Active Admin Page */}
      {activeTab === 'overview' && (
        <AdminOverviewPage
          systemUsers={systemUsers}
          auditLogs={auditLogs}
          supabaseStatus={supabaseStatus}
          onNavigateTab={handleSelectTab}
          onRefreshHealth={onRefreshHealth}
        />
      )}

      {activeTab === 'users' && (
        <UserRoleManagementPage
          systemUsers={systemUsers}
          onToggleUserStatus={onToggleUserStatus}
          onUpdateUserRole={onUpdateUserRole}
          onProvisionUser={onProvisionUser}
          pendingUserIds={pendingUserIds}
        />
      )}

      {activeTab === 'knowledge' && <KnowledgeDocumentManagementPage />}

      {activeTab === 'audit' && <AuditActivityPage auditLogs={auditLogs} />}

      {activeTab === 'config' && (
        <SystemConfigurationPage supabaseStatus={supabaseStatus} onRefreshHealth={onRefreshHealth} />
      )}

      {activeTab === 'privacy' && <AccessPrivacyPage />}
    </div>
  );
};
