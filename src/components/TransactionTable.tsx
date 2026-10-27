/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Transaction, TransactionCategory, Account } from '../types/database.ts';
import { api } from '../services/api.ts';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  CreditCard,
  Check,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface TransactionTableProps {
  transactions: (Transaction & { categoryName: string; categoryColor: string })[];
  categories: TransactionCategory[];
  accounts: Account[];
  selectedAccountId: string | 'all';
  loading: boolean;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange: (newPage: number) => void;
  onFilterChange: (filters: {
    search?: string;
    categoryId?: string;
    type?: string;
    sortBy?: string;
    sortOrder?: string;
  }) => void;
  onRefresh: () => void;
  currency?: string;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  categories,
  accounts,
  selectedAccountId,
  loading,
  pagination,
  onPageChange,
  onFilterChange,
  onRefresh,
  currency = 'INR',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Manual Add Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addAccount, setAddAccount] = useState(accounts[0]?.id || '');
  const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0]);
  const [addDesc, setAddDesc] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addType, setAddType] = useState<'debit' | 'credit'>('debit');
  const [addCategory, setAddCategory] = useState(categories[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Inline Category Editing
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editCatId, setEditCatId] = useState<string>('');
  const [applyMerchantRule, setApplyMerchantRule] = useState<boolean>(true);
  const [updatingCategory, setUpdatingCategory] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      search: searchTerm,
      categoryId: selectedCategoryFilter,
      type: selectedTypeFilter,
      sortBy,
      sortOrder,
    });
  };

  const handleTypeChange = (type: string) => {
    setSelectedTypeFilter(type);
    onFilterChange({
      search: searchTerm,
      categoryId: selectedCategoryFilter,
      type,
      sortBy,
      sortOrder,
    });
  };

  const handleCategoryFilterChange = (catId: string) => {
    setSelectedCategoryFilter(catId);
    onFilterChange({
      search: searchTerm,
      categoryId: catId,
      type: selectedTypeFilter,
      sortBy,
      sortOrder,
    });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const parsedAmount = parseFloat(addAmount);
    if (!addAccount) {
      setAddError('Please select an account.');
      return;
    }
    if (!addDesc.trim()) {
      setAddError('Please provide a merchant/description.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAddError('Please enter a valid positive amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createTransaction({
        accountId: addAccount,
        date: addDate,
        description: addDesc.trim(),
        amount: parsedAmount,
        type: addType,
        categoryId: addCategory || undefined,
      });

      setIsAddOpen(false);
      setAddDesc('');
      setAddAmount('');
      onRefresh();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCategory = async (txId: string) => {
    if (!editCatId) return;
    setUpdatingCategory(true);
    try {
      await api.updateTransactionCategory(txId, editCatId, applyMerchantRule);
      setEditingTxId(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update category.');
    } finally {
      setUpdatingCategory(false);
    }
  };

  const handleDelete = async (txId: string, desc: string) => {
    if (!confirm(`Are you sure you want to delete "${desc}"?`)) return;
    try {
      await api.deleteTransaction(txId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete transaction.');
    }
  };

  const currencySymbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';

  return (
    <div className="card-flat-2 overflow-hidden text-left shadow-xs">
      {/* Header & Controls */}
      <div className="p-5 border-b border-[#DCE7F6] bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-[#172B4D] flex items-center gap-2">
            <span>Transaction Ledger</span>
            <span className="text-xs font-semibold text-[#5878FF] bg-[#EAF3FF] px-2.5 py-0.5 rounded-full border border-[#5878FF]/20">
              {pagination.total} records
            </span>
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            Verified, deduplicated transactions backed by Supabase PostgreSQL
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search merchant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#F4F9FF] border border-[#DCE7F6] focus:border-[#5878FF] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#172B4D] placeholder-[#64748B] focus:outline-none w-44 md:w-56 transition-colors shadow-2xs"
            />
          </form>

          {/* Type filter */}
          <div className="flex bg-[#F4F9FF] border border-[#DCE7F6] rounded-xl p-0.5 text-xs">
            <button
              onClick={() => handleTypeChange('')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                selectedTypeFilter === '' ? 'bg-[#5878FF] text-white font-semibold shadow-xs' : 'text-[#64748B] hover:text-[#172B4D]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleTypeChange('debit')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                selectedTypeFilter === 'debit' ? 'bg-rose-500 text-white font-semibold shadow-xs' : 'text-[#64748B] hover:text-[#172B4D]'
              }`}
            >
              Debits
            </button>
            <button
              onClick={() => handleTypeChange('credit')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                selectedTypeFilter === 'credit' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-[#64748B] hover:text-[#172B4D]'
              }`}
            >
              Credits
            </button>
          </div>

          {/* Category filter dropdown */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => handleCategoryFilterChange(e.target.value)}
            className="bg-[#F4F9FF] border border-[#DCE7F6] text-xs text-[#172B4D] rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-[#5878FF] cursor-pointer shadow-2xs"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Add Manual Transaction Button */}
          <button
            onClick={() => {
              setAddAccount(selectedAccountId !== 'all' ? selectedAccountId : accounts[0]?.id || '');
              setIsAddOpen(true);
            }}
            className="flex items-center gap-1 bg-[#EAF3FF] hover:bg-[#5878FF] text-[#5878FF] hover:text-white border border-[#5878FF]/30 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse table-flat">
          <thead>
            <tr className="border-b border-[#DCE7F6] bg-[#F4F9FF] text-[#64748B] uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4 font-semibold">Date</th>
              <th className="py-3 px-4 font-semibold">Description</th>
              <th className="py-3 px-4 font-semibold">Category</th>
              <th className="py-3 px-4 font-semibold text-right">Amount</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DCE7F6]/60">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-[#64748B]">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#5878FF] mb-2" />
                  Updating ledger from Supabase...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-[#64748B]">
                  No transactions recorded matching the selected filter.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const isDebit = tx.type === 'debit';
                const isEditing = editingTxId === tx.id;

                return (
                  <tr key={tx.id} className="hover:bg-[#F4F9FF]/70 transition-colors">
                    {/* Date */}
                    <td className="py-3.5 px-4 text-[#64748B] font-mono tnum whitespace-nowrap">
                      {tx.date}
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 font-semibold text-[#172B4D] max-w-xs truncate">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            isDebit ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {isDebit ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        </div>
                        <span title={tx.description}>{tx.description}</span>
                        {tx.isRecurring && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#EDE9FF] text-[#5878FF] border border-[#5878FF]/20 font-medium">
                            Recurring
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-[#5878FF]/40 shadow-xs">
                          <select
                            value={editCatId}
                            onChange={(e) => setEditCatId(e.target.value)}
                            className="bg-[#F4F9FF] text-xs text-[#172B4D] rounded-lg px-2 py-1 focus:outline-none"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-1 text-[11px] text-[#64748B] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={applyMerchantRule}
                              onChange={(e) => setApplyMerchantRule(e.target.checked)}
                              className="rounded border-[#DCE7F6] text-[#5878FF] focus:ring-0"
                            />
                            <span>Rule</span>
                          </label>
                          <button
                            onClick={() => handleSaveCategory(tx.id)}
                            disabled={updatingCategory}
                            className="p-1 rounded bg-[#5878FF] text-white hover:bg-[#4868EF] cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setEditingTxId(null)}
                            className="p-1 rounded bg-slate-200 text-[#64748B] hover:text-[#172B4D] cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingTxId(tx.id);
                            setEditCatId(tx.categoryId);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F4F9FF] hover:bg-[#EAF3FF] hover:text-[#5878FF] text-[#172B4D] transition-colors cursor-pointer border border-[#DCE7F6]"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tx.categoryColor || '#5878FF' }}
                          />
                          <span>{tx.categoryName || 'General'}</span>
                        </div>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 text-right font-mono tnum font-bold whitespace-nowrap">
                      <span className={isDebit ? 'text-[#172B4D]' : 'text-emerald-600'}>
                        {isDebit ? '-' : '+'}{currencySymbol}{Math.abs(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(tx.id, tx.description)}
                        className="p-1.5 text-[#64748B] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-[#DCE7F6] bg-[#F4F9FF]/40 flex items-center justify-between text-xs text-[#64748B]">
        <div>
          Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages || 1}</strong>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-1.5 rounded-lg border border-[#DCE7F6] bg-white hover:bg-[#F4F9FF] text-[#172B4D] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-1.5 rounded-lg border border-[#DCE7F6] bg-white hover:bg-[#F4F9FF] text-[#172B4D] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
