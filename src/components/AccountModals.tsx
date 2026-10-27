/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Account } from '../types/database.ts';
import { api } from '../services/api.ts';
import {
  CreditCard,
  Building,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  X,
  Trash2,
  Edit3,
  Info,
  ShieldAlert,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newAccount: Account) => void;
  currency?: string;
  isDemo?: boolean;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currency = 'INR',
  isDemo = false,
}) => {
  const [accountName, setAccountName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [accountType, setAccountType] = useState('checking');
  const [accountNumber, setAccountNumber] = useState('');
  const [initialBalance, setInitialBalance] = useState('0');
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAccountName('');
      setInstitutionName('');
      setAccountType('checking');
      setAccountNumber('');
      setInitialBalance('0');
      setSelectedCurrency(currency);
      setError(null);
    }
  }, [isOpen, currency]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!accountName.trim()) {
      setError('Account name is required.');
      return;
    }
    if (!institutionName.trim()) {
      setError('Financial institution name is required.');
      return;
    }

    const balanceNum = parseFloat(initialBalance);
    if (isNaN(balanceNum) || !isFinite(balanceNum) || balanceNum < 0) {
      setError('Initial opening balance must be a non-negative number.');
      return;
    }

    setLoading(true);

    try {
      if (isDemo) {
        // Handle demo mode client-side creation
        const last4 = accountNumber.replace(/\D/g, '').slice(-4) || `${Math.floor(1000 + Math.random() * 9000)}`;
        const demoAccount: Account = {
          id: `demo-acc-${Date.now()}`,
          customerId: 'demo-customer',
          accountName: accountName.trim(),
          accountNumberMasked: `•••• ${last4}`,
          accountType: accountType as any,
          institutionName: institutionName.trim(),
          balance: balanceNum,
          currency: selectedCurrency.toUpperCase(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        onSuccess(demoAccount);
        onClose();
        return;
      }

      const res = await api.createAccount({
        accountName: accountName.trim(),
        institutionName: institutionName.trim(),
        accountType,
        accountNumber: accountNumber.trim(),
        initialBalance: balanceNum,
        currency: selectedCurrency.toUpperCase(),
      });

      if (res?.account) {
        onSuccess(res.account);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create account. Please verify input details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-[#DCE7F6] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#EEF4FC] bg-gradient-to-r from-[#F4F9FF] to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center shadow-xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172B4D]">Add New Account</h2>
              <p className="text-xs text-[#64748B]">Connect a manual checking, savings, or card account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#172B4D] hover:bg-[#EEF4FC] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172B4D]">
                Account Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Salary Checking"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6] text-[#172B4D] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#5878FF]/30 focus:border-[#5878FF]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172B4D]">
                Institution Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. HDFC Bank, Chase"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6] text-[#172B4D] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#5878FF]/30 focus:border-[#5878FF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172B4D]">Account Type</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6] text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#5878FF]/30 focus:border-[#5878FF] cursor-pointer"
              >
                <option value="checking">Checking / Current Account</option>
                <option value="savings">Savings Account</option>
                <option value="credit_card">Credit Card</option>
                <option value="investment">Investment / Demat Account</option>
                <option value="loan">Personal / Home Loan</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172B4D]">
                Account Number <span className="text-[#64748B] font-normal">(Last 4 or Full)</span>
              </label>
              <input
                type="text"
                placeholder="•••• 4984 or 4 digits"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6] text-[#172B4D] placeholder-[#94A3B8] font-mono focus:outline-none focus:ring-2 focus:ring-[#5878FF]/30 focus:border-[#5878FF]"
              />
              <p className="text-[10px] text-[#64748B]">Auto-masked to protect banking privacy</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172B4D]">Opening Balance</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6] text-[#172B4D] font-mono tnum focus:outline-none focus:ring-2 focus:ring-[#5878FF]/30 focus:border-[#5878FF]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172B4D]">Currency</label>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6] text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#5878FF]/30 focus:border-[#5878FF] cursor-pointer"
              >
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#EEF4FC]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#172B4D] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-sky-primary px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditAccountModalProps {
  isOpen: boolean;
  account: Account | null;
  onClose: () => void;
  onSuccess: (updatedAccount: Account) => void;
  isDemo?: boolean;
}

export const EditAccountModal: React.FC<EditAccountModalProps> = ({
  isOpen,
  account,
  onClose,
  onSuccess,
  isDemo = false,
}) => {
  const [accountName, setAccountName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [accountType, setAccountType] = useState('checking');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setAccountName(account.accountName);
      setInstitutionName(account.institutionName);
      setAccountType(account.accountType);
      setError(null);
    }
  }, [account]);

  if (!isOpen || !account) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!accountName.trim()) {
      setError('Account name cannot be empty.');
      return;
    }
    if (!institutionName.trim()) {
      setError('Financial institution name cannot be empty.');
      return;
    }

    setLoading(true);

    try {
      if (isDemo) {
        const updated: Account = {
          ...account,
          accountName: accountName.trim(),
          institutionName: institutionName.trim(),
          accountType: accountType as any,
          updatedAt: new Date().toISOString(),
        };
        onSuccess(updated);
        onClose();
        return;
      }

      const res = await api.updateAccount(account.id, {
        accountName: accountName.trim(),
        institutionName: institutionName.trim(),
        accountType,
      });

      if (res?.account) {
        onSuccess(res.account);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update account metadata.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-[#DCE7F6] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#EEF4FC] bg-gradient-to-r from-[#F4F9FF] to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172B4D]">Edit Account</h2>
              <p className="text-xs text-[#64748B]">Update display name, institution, or account classification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#172B4D] hover:bg-[#EEF4FC] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#172B4D]">Account Display Name</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6] text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#5878FF]/30 focus:border-[#5878FF]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172B4D]">Institution Name</label>
              <input
                type="text"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6] text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#5878FF]/30 focus:border-[#5878FF]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#172B4D]">Account Type</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[#F8FBFF] border border-[#DCE7F6] text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#5878FF]/30 focus:border-[#5878FF] cursor-pointer"
              >
                <option value="checking">Checking / Current Account</option>
                <option value="savings">Savings Account</option>
                <option value="credit_card">Credit Card</option>
                <option value="investment">Investment / Demat</option>
                <option value="loan">Loan Account</option>
              </select>
            </div>
          </div>

          {/* Immutable Fields Notice */}
          <div className="p-3.5 rounded-xl bg-[#F4F9FF] border border-[#DCE7F6] space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[#172B4D]">
              <Info className="w-3.5 h-3.5 text-[#5878FF]" />
              <span>Financial Invariants & Ledger Protection</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#64748B]">
              <div>
                <span className="block font-semibold text-[#172B4D]">Account ID:</span>
                <span className="font-mono">{account.id.slice(0, 12)}...</span>
              </div>
              <div>
                <span className="block font-semibold text-[#172B4D]">Masked Number:</span>
                <span className="font-mono">{account.accountNumberMasked}</span>
              </div>
              <div className="col-span-2">
                <span className="block font-semibold text-[#172B4D]">Current Balance:</span>
                <span className="font-mono font-bold text-[#172B4D]">
                  {account.currency} {account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <p className="text-[10px] text-[#64748B] mt-0.5">
                  Balances are calculated directly from verified transaction records and cannot be silently adjusted.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#EEF4FC]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#172B4D] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-sky-primary px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface AccountDetailsModalProps {
  isOpen: boolean;
  account: Account | null;
  transactionsCount?: number;
  currency?: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const AccountDetailsModal: React.FC<AccountDetailsModalProps> = ({
  isOpen,
  account,
  transactionsCount = 0,
  currency = 'INR',
  onClose,
  onEdit,
  onDelete,
}) => {
  if (!isOpen || !account) return null;

  const currencySymbol = account.currency === 'INR' ? '₹' : account.currency === 'EUR' ? '€' : account.currency === 'GBP' ? '£' : '$';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-[#DCE7F6] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#EEF4FC] bg-gradient-to-r from-[#F4F9FF] to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF3FF] text-[#5878FF] flex items-center justify-center shadow-xs">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172B4D]">{account.accountName}</h2>
              <p className="text-xs text-[#64748B]">{account.institutionName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#172B4D] hover:bg-[#EEF4FC] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Main Balance Display */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#F4F9FF] to-white border border-[#DCE7F6] text-center space-y-1">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
              Current Available Balance
            </span>
            <div className="text-2xl font-black text-[#172B4D] font-mono tnum">
              {currencySymbol}{account.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full inline-block border border-emerald-200">
              Active & Verified
            </span>
          </div>

          {/* Details Table */}
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#EEF4FC]">
              <span className="text-[#64748B]">Account Type</span>
              <span className="font-bold text-[#172B4D] uppercase text-[11px] tracking-wider bg-[#F4F9FF] px-2 py-0.5 rounded border border-[#DCE7F6]">
                {account.accountType.replace('_', ' ')}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#EEF4FC]">
              <span className="text-[#64748B]">Masked Identifier</span>
              <span className="font-mono font-bold text-[#172B4D]">{account.accountNumberMasked}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#EEF4FC]">
              <span className="text-[#64748B]">Currency Code</span>
              <span className="font-bold text-[#172B4D]">{account.currency}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#EEF4FC]">
              <span className="text-[#64748B]">Associated Transactions</span>
              <span className="font-bold text-[#172B4D]">{transactionsCount} entries in ledger</span>
            </div>
            {account.createdAt && (
              <div className="flex justify-between py-1.5 border-b border-[#EEF4FC]">
                <span className="text-[#64748B]">Provisioned On</span>
                <span className="text-[#172B4D]">{new Date(account.createdAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              onClick={() => {
                onClose();
                onDelete();
              }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3 py-2 text-xs font-semibold text-[#64748B] hover:text-[#172B4D] transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onClose();
                  onEdit();
                }}
                className="btn-sky-primary px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DeleteAccountModalProps {
  isOpen: boolean;
  account: Account | null;
  hasTransactions: boolean;
  isOnlyAccount: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
  error?: string | null;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  account,
  hasTransactions,
  isOnlyAccount,
  onClose,
  onConfirm,
  isDeleting,
  error,
}) => {
  if (!isOpen || !account) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-rose-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-rose-100 bg-rose-50/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Delete Account Confirmation</h2>
            <p className="text-xs text-slate-500">Permanent financial account removal check</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 text-sm">{account.accountName}</div>
            <div className="text-slate-500 font-mono">
              {account.institutionName} • {account.accountNumberMasked}
            </div>
          </div>

          {/* Rule 1: Only account restriction */}
          {isOnlyAccount ? (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Primary Account Required</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                You cannot delete your only account. VivPay customer accounts must retain at least one active primary financial account for ledger operations.
              </p>
            </div>
          ) : hasTransactions ? (
            /* Rule 2: Account has transactions */
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Account Has Linked Ledger Transactions</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This account cannot be deleted because it is linked to verified statement transactions. To preserve financial history, statements, and audit trails, delete or reassign associated transactions first.
              </p>
            </div>
          ) : (
            <p className="text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this account? It currently has 0 linked transactions. This action cannot be reversed.
            </p>
          )}

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting || hasTransactions || isOnlyAccount}
              className="px-4 py-2 font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Confirm Deletion</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
