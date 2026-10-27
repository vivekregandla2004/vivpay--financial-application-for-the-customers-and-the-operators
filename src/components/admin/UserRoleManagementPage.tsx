/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserX,
  Shield,
  Briefcase,
  X,
  Edit2,
  Lock,
  UserPlus,
} from 'lucide-react';
import { SystemUser } from '../../types/operations.ts';
import { adminApi } from '../../services/api.ts';

interface UserRoleManagementPageProps {
  systemUsers: SystemUser[];
  onToggleUserStatus?: (userId: string) => Promise<void> | void;
  onUpdateUserRole?: (userId: string, role: SystemUser['role'], department?: string) => Promise<void> | void;
  onProvisionUser?: (data: {
    authUserId?: string;
    email?: string;
    name?: string;
    role: 'employee' | 'admin';
    department?: string;
  }) => Promise<void> | void;
  pendingUserIds?: Set<string>;
}

export const UserRoleManagementPage: React.FC<UserRoleManagementPageProps> = ({
  systemUsers,
  onToggleUserStatus,
  onUpdateUserRole,
  onProvisionUser,
  pendingUserIds,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [newRole, setNewRole] = useState<SystemUser['role']>('customer');
  const [newDept, setNewDept] = useState('');

  // Provisioning Modal State
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [provisionMode, setProvisionMode] = useState<'registered' | 'manual'>('registered');
  const [candidates, setCandidates] = useState<Array<{ id: string; email: string; name: string; createdAt: string }>>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [manualAuthUserId, setManualAuthUserId] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [provisionRole, setProvisionRole] = useState<'employee' | 'admin'>('employee');
  const [provisionDept, setProvisionDept] = useState('Operations & Customer Support');
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [provisionSuccess, setProvisionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const activeAdminsCount = systemUsers.filter((u) => u.role === 'admin' && u.status === 'active').length;

  const loadCandidates = async () => {
    setLoadingCandidates(true);
    try {
      const res = await adminApi.getEligibleCandidates();
      setCandidates(res.candidates || []);
      if (res.candidates && res.candidates.length > 0) {
        setSelectedCandidateId(res.candidates[0].id);
      }
    } catch (err: any) {
      console.warn('Could not load candidates:', err.message);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleOpenProvisionModal = () => {
    setIsProvisionOpen(true);
    setProvisionError(null);
    setProvisionSuccess(null);
    setProvisionRole('employee');
    setProvisionDept('Operations & Customer Support');
    loadCandidates();
  };

  const handleSaveProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisionLoading(true);
    setProvisionError(null);
    setProvisionSuccess(null);

    try {
      let targetAuthId = '';
      let targetEmail = '';
      let targetName = '';

      if (provisionMode === 'registered') {
        const candidate = candidates.find((c) => c.id === selectedCandidateId);
        if (!candidate) {
          throw new Error('Please select a registered account from the list, or switch to manual UUID entry.');
        }
        targetAuthId = candidate.id;
        targetEmail = candidate.email;
        targetName = candidate.name;
      } else {
        if (!manualAuthUserId.trim() && !manualEmail.trim()) {
          throw new Error('Please enter either a Supabase Auth UUID or a registered user email address.');
        }
        targetAuthId = manualAuthUserId.trim();
        targetEmail = manualEmail.trim();
        targetName = manualName.trim();
      }

      if (onProvisionUser) {
        await onProvisionUser({
          authUserId: targetAuthId || undefined,
          email: targetEmail || undefined,
          name: targetName || undefined,
          role: provisionRole,
          department: provisionDept.trim() || undefined,
        });
      } else {
        await adminApi.provisionUser({
          authUserId: targetAuthId || undefined,
          email: targetEmail || undefined,
          name: targetName || undefined,
          role: provisionRole,
          department: provisionDept.trim() || undefined,
        });
      }

      setProvisionSuccess(`Successfully provisioned ${targetEmail || targetAuthId} as ${provisionRole.toUpperCase()}.`);
      setTimeout(() => {
        setIsProvisionOpen(false);
        setProvisionSuccess(null);
      }, 1500);
    } catch (err: any) {
      setProvisionError(err.message || 'Failed to provision system user.');
    } finally {
      setProvisionLoading(false);
    }
  };

  const filtered = systemUsers.filter((u) => {
    const matchesSearch =
      searchTerm === '' ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleOpenEdit = (user: SystemUser) => {
    setActionError(null);
    setActionSuccess(null);
    setEditingUser(user);
    setNewRole(user.role);
    setNewDept(user.department || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setActionError(null);
    setActionSuccess(null);
    const targetUserId = editingUser.id;
    try {
      await onUpdateUserRole?.(targetUserId, newRole, newDept.trim() || undefined);
      setActionSuccess(`Role for '${editingUser.email}' updated successfully to ${newRole.toUpperCase()}.`);
      setEditingUser(null);
    } catch (err: any) {
      const msg = err?.code === 'CANNOT_LOCKOUT_LAST_ADMIN'
        ? 'Cannot demote the last active Administrator account. Promote another active administrator first to prevent system lockout.'
        : err?.message || 'Failed to update user role.';
      setActionError(msg);
    }
  };

  const handleToggleClick = async (userId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await onToggleUserStatus?.(userId);
    } catch (err: any) {
      const msg = err?.code === 'CANNOT_LOCKOUT_LAST_ADMIN'
        ? 'Cannot suspend the last active Administrator account. Promote another active administrator first to prevent system lockout.'
        : err?.message || 'Failed to update user status.';
      setActionError(msg);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Control Banner */}
      <div className="card-luxury p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">User Directory & Role-Based Access Control (RBAC)</h3>
            <p className="text-xs text-slate-500">
              Manage identity profiles, operational duty separation, and account quarantine states
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
              Total Identities: <span className="font-bold text-purple-700">{systemUsers.length}</span>
            </div>
            <button
              onClick={handleOpenProvisionModal}
              className="btn-primary-gradient text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer hover:opacity-95"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Provision Staff Access</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="customer">Customers</option>
            <option value="employee">Operations Staff</option>
            <option value="admin">System Administrators</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="all">All Account Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* User Directory Feedback Alerts */}
      {actionError && (
        <div className="bg-rose-50 border border-rose-200/90 px-4 py-3 rounded-2xl flex items-center justify-between text-xs text-rose-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="leading-relaxed font-medium">{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-600 hover:text-rose-800 font-bold p-1 cursor-pointer shrink-0 ml-3"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200/90 px-4 py-3 rounded-2xl flex items-center justify-between text-xs text-emerald-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="leading-relaxed font-medium">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold p-1 cursor-pointer shrink-0 ml-3"
            aria-label="Dismiss success"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="card-luxury p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">User & Contact</th>
                <th className="py-2.5 px-3">Role Tier</th>
                <th className="py-2.5 px-3">Department / Scope</th>
                <th className="py-2.5 px-3">Account Status</th>
                <th className="py-2.5 px-3">Created / Active</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => {
                const isPending = pendingUserIds?.has(u.id);
                const createdDateStr = u.createdAt
                  ? new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                  : null;
                return (
                  <tr key={u.id} className="hover:bg-purple-50/20 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 block">{u.name}</span>
                        {u.department?.includes('Profile Missing') && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">Unlinked Auth</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                        <span>{u.email}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-400 bg-slate-100 px-1 py-0.2 rounded" title={`Full UUID: ${u.id}`}>
                          ID: {u.id.length > 18 ? `${u.id.slice(0, 8)}...${u.id.slice(-4)}` : u.id}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase inline-flex items-center gap-1 ${
                          u.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : u.role === 'employee'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.role === 'admin' && <Shield className="w-3 h-3" />}
                        {u.role === 'employee' && <Briefcase className="w-3 h-3" />}
                        <span>{u.role}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700">{u.department || 'Retail Customer Account'}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : u.status === 'suspended'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      <div>{u.lastActive}</div>
                      {createdDateStr && (
                        <div className="text-[10px] text-slate-400 mt-0.5">Joined: {createdDateStr}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap space-x-2">
                      <button
                        disabled={isPending}
                        onClick={() => handleOpenEdit(u)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                          isPending
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
                        }`}
                      >
                        Assign Role
                      </button>
                      {onToggleUserStatus && (
                        u.role === 'admin' && u.status === 'active' && activeAdminsCount <= 1 ? (
                          <span
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-block cursor-help"
                            title="Sole active Administrator account is protected against accidental suspension to prevent system lockout."
                          >
                            Protected Admin
                          </span>
                        ) : (
                          <button
                            disabled={isPending}
                            onClick={() => handleToggleClick(u.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              isPending
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : u.status === 'active'
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer'
                            }`}
                          >
                            {isPending ? 'Updating...' : u.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-sm text-slate-900">Modify Role & Department Assignment</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 border border-slate-200">
                <div className="text-slate-500">Target User:</div>
                <div className="font-bold text-slate-900 text-sm">{editingUser.name}</div>
                <div className="text-[11px] text-slate-600 font-mono">{editingUser.email}</div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Assigned Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="customer">Customer (Individual Account Owner)</option>
                  <option value="employee">Employee (Operations Specialist & Fraud Triage)</option>
                  <option value="admin">System Administrator (Root Governance & Security)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Department / Business Unit</label>
                <input
                  type="text"
                  placeholder="e.g. Financial Operations & Fraud Triage"
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                />
              </div>

              {editingUser.role === 'admin' && activeAdminsCount <= 1 && newRole !== 'admin' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block">Lockout Protection Active:</strong>
                    <span>Cannot demote the last active Administrator account. Promote another active administrator before revoking admin access for this account.</span>
                  </div>
                </div>
              )}

              <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl text-[11px] text-purple-800">
                Updates are tracked in the security audit trail and applied to the active runtime session.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editingUser.role === 'admin' && activeAdminsCount <= 1 && newRole !== 'admin'}
                  className={`font-semibold px-4 py-2 rounded-xl cursor-pointer shadow-xs ${
                    editingUser.role === 'admin' && activeAdminsCount <= 1 && newRole !== 'admin'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'btn-primary-gradient text-white'
                  }`}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Provision Staff Member Modal */}
      {isProvisionOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Provision Staff Member</h3>
                  <p className="text-[11px] text-slate-500">Authorize elevated Employee or Admin role in public.system_users</p>
                </div>
              </div>
              <button
                onClick={() => setIsProvisionOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {provisionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{provisionError}</span>
              </div>
            )}

            {provisionSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{provisionSuccess}</span>
              </div>
            )}

            {/* Mode selection tabs */}
            <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setProvisionMode('registered')}
                className={`pb-2 border-b-2 cursor-pointer transition-colors ${
                  provisionMode === 'registered'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Select Registered Customer
              </button>
              <button
                type="button"
                onClick={() => setProvisionMode('manual')}
                className={`pb-2 border-b-2 cursor-pointer transition-colors ${
                  provisionMode === 'manual'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Specify Auth UUID / Email
              </button>
            </div>

            <form onSubmit={handleSaveProvision} className="space-y-4">
              {provisionMode === 'registered' ? (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Select Registered Account {loadingCandidates && '(Loading...)'}
                  </label>
                  {candidates.length > 0 ? (
                    <select
                      value={selectedCandidateId}
                      onChange={(e) => setSelectedCandidateId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none cursor-pointer"
                    >
                      {candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email}) — UUID: {c.id.substring(0, 8)}...
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-[11px]">
                      No unassigned registered accounts discovered. Switch to &quot;Specify Auth UUID / Email&quot; tab to provision by Auth user ID.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Supabase Auth User UUID</label>
                    <input
                      type="text"
                      placeholder="e.g. a72bffdb-4efb-47f5-8e83-ce9ff88aaaab"
                      value={manualAuthUserId}
                      onChange={(e) => setManualAuthUserId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono text-[11px] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="staff.member@company.com"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                      <input
                        type="text"
                        placeholder="Staff Member Name"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Role selection */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Authorized Role Tier</label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => {
                      setProvisionRole('employee');
                      setProvisionDept('Operations & Customer Support');
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      provisionRole === 'employee'
                        ? 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-400/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-0.5">
                      <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                      <span>Employee</span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Operations dashboard, dispute investigation, KYC approval, and SOP assistant.
                    </p>
                  </div>

                  <div
                    onClick={() => {
                      setProvisionRole('admin');
                      setProvisionDept('Executive Governance & Administration');
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      provisionRole === 'admin'
                        ? 'border-purple-500 bg-purple-50/60 ring-2 ring-purple-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-0.5">
                      <Shield className="w-3.5 h-3.5 text-purple-600" />
                      <span>Administrator</span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Full governance, RBAC role assignment, security audit logs, and system config.
                    </p>
                  </div>
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Department / Business Unit</label>
                <input
                  type="text"
                  value={provisionDept}
                  onChange={(e) => setProvisionDept(e.target.value)}
                  placeholder="e.g. Fraud Investigation & AML"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                />
              </div>

              {/* Security policy note */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-purple-600" />
                  <span>Security Policy Invariant</span>
                </div>
                <p>
                  Public signup strictly creates Customer accounts. Staff privileges are solely governed by trusted records in <code className="font-mono text-purple-700">public.system_users</code>. Self-promotion via client calls is blocked.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProvisionOpen(false)}
                  disabled={provisionLoading}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisionLoading}
                  className="btn-primary-gradient text-white font-semibold px-4 py-2 rounded-xl cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {provisionLoading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <span>Confirm Provisioning</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
