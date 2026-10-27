/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ConversationThread, ChatMessage, CustomerProfile, Transaction, Account, FinancialSummary } from '../types/database.ts';
import { api } from '../services/api.ts';
import { loadIdentityFromStorage } from '../lib/identity/store.ts';
import { calculateNormalizedSummary, calculateCategoryBreakdown, calculateMonthlyTrends } from '../lib/analytics/financialEngine.ts';
import { generateFinancialInsights } from '../lib/analytics/financialInsightEngine.ts';
import { hybridRetrieve, extractChunkSnippet, RAG_CONFIDENCE_THRESHOLD, Citation } from '../lib/rag/index.ts';
import { parseGoalIntent, synchronizeGoalFromIntent } from '../lib/goals/index.ts';
import { analyzeBehaviour } from '../lib/identity/behavior.ts';
import { generateProactiveInsights } from '../lib/copilot/insights.ts';
import {
  Sparkles,
  X,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Loader2,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Tag,
  CreditCard,
} from 'lucide-react';

interface AskVivModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerProfile | null;
  isDemo?: boolean;
  transactions?: (Transaction & { categoryName?: string; categoryColor?: string })[];
  accounts?: Account[];
  summary?: FinancialSummary | null;
}

export const AskVivModal: React.FC<AskVivModalProps> = ({
  isOpen,
  onClose,
  customer,
  isDemo = false,
  transactions = [],
  accounts = [],
  summary: propSummary,
}) => {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [askingCopilot, setAskingCopilot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load threads on open
  useEffect(() => {
    if (!isOpen || !customer) return;

    if (isDemo) {
      // Demo session: initialize in-memory conversation grounded in customer data
      const demoThread: ConversationThread = {
        id: 'demo-thread-1',
        customerId: customer.id,
        title: 'Financial Copilot Consultation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setThreads([demoThread]);
      setActiveThreadId('demo-thread-1');
      setMessages([
        {
          id: 'msg-welcome',
          customerId: customer.id,
          threadId: 'demo-thread-1',
          role: 'assistant',
          content: `Hello ${customer.fullName || 'there'}! I am Viv, your personal financial copilot. I am actively analyzing your ledger (${transactions.length} verified transactions) and your declared financial identity. You can ask me about your savings rate, top spending categories, monthly cash flow, or declared goals!`,
          createdAt: new Date().toISOString(),
        },
      ]);
      setLoadingThreads(false);
      return;
    }

    let mounted = true;
    async function loadThreads() {
      setLoadingThreads(true);
      try {
        const res = await api.getConversations();
        if (mounted) {
          setThreads(res.threads || []);
          if (res.threads && res.threads.length > 0) {
            setActiveThreadId(res.threads[0].id);
          } else {
            // Create initial thread
            const newThread = await api.createConversation('Financial Planning Consultation');
            setThreads([newThread.thread]);
            setActiveThreadId(newThread.thread.id);
          }
        }
      } catch (err: any) {
        console.error('Error fetching threads:', err);
      } finally {
        if (mounted) setLoadingThreads(false);
      }
    }

    loadThreads();
    return () => {
      mounted = false;
    };
  }, [isOpen, customer, isDemo, transactions.length]);

  // Load messages whenever active thread changes
  useEffect(() => {
    if (!activeThreadId || isDemo) return;

    let mounted = true;
    async function loadMessages() {
      setLoadingMessages(true);
      setError(null);
      try {
        const res = await api.getConversation(activeThreadId!);
        if (mounted) {
          setMessages(res.messages || []);
        }
      } catch (err: any) {
        console.error('Error fetching conversation messages:', err);
        if (mounted) setError(err.message || 'Failed to load conversation messages.');
      } finally {
        if (mounted) setLoadingMessages(false);
      }
    }

    loadMessages();
    return () => {
      mounted = false;
    };
  }, [activeThreadId, isDemo]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, askingCopilot]);

  if (!isOpen) return null;

  const handleCreateNewThread = async () => {
    try {
      const newThread = await api.createConversation('Financial Inquiry');
      setThreads([newThread.thread, ...threads]);
      setActiveThreadId(newThread.thread.id);
      setMessages([]);
    } catch (err: any) {
      alert(err.message || 'Failed to create conversation thread.');
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    if (!confirm('Are you sure you want to delete this conversation thread?')) return;
    try {
      await api.deleteConversation(threadId);
      const remaining = threads.filter((t) => t.id !== threadId);
      setThreads(remaining);
      if (activeThreadId === threadId) {
        setActiveThreadId(remaining[0]?.id || null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete thread.');
    }
  };

  const handleSendMessage = async (promptToSend?: string) => {
    const text = (promptToSend || inputPrompt).trim();
    if (!text || !activeThreadId || askingCopilot) return;

    setInputPrompt('');
    setAskingCopilot(true);
    setError(null);

    // Optimistically show user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      customerId: customer?.id || '',
      threadId: activeThreadId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    if (isDemo) {
      setTimeout(() => {
        const p = text.toLowerCase();
        const activeSummary = propSummary || calculateNormalizedSummary(accounts, transactions, 'INR');
        const identity = loadIdentityFromStorage('customer');
        const categories = calculateCategoryBreakdown(transactions);

        let reply = '';
        const citations: any[] = [];

        // 1. Goal Intent Detection & Authoritative Identity Synchronization
        const goalIntent = parseGoalIntent(text);
        if (goalIntent.hasIntent) {
          const syncRes = synchronizeGoalFromIntent(
            goalIntent,
            'customer',
            activeSummary.netCashFlow > 0 ? activeSummary.netCashFlow : 50000
          );
          reply = `${syncRes.message} Cash flow feasibility: ${syncRes.feasibility?.feasibilityReason || 'Evaluated against surplus cash flow.'}`;
          if (syncRes.goal) {
            citations.push({
              type: 'goal',
              id: syncRes.goal.id,
              label: `${syncRes.goal.name} (Target: ₹${syncRes.goal.targetAmount.toLocaleString('en-IN')})`,
              amount: syncRes.goal.targetAmount,
            });
          }
        } else {
          // 2. Hybrid RAG Document Chunk Retrieval
          const customerId = customer?.id || 'demo-customer-uuid-001';
          const retrieved = hybridRetrieve({
            customerId,
            text,
            topK: 3,
            minConfidence: RAG_CONFIDENCE_THRESHOLD,
          });

          const confidentChunks = retrieved.filter((r) => r.isConfident);

          if (confidentChunks.length > 0) {
            const primary = confidentChunks[0].chunk;
            reply = `Based on your verified records in [${primary.title}]:\n${confidentChunks
              .map((c) => `• ${extractChunkSnippet(c.chunk.content, text)}`)
              .join('\n')}`;

            for (const c of confidentChunks) {
              citations.push({
                type: 'chunk',
                id: c.chunk.id,
                chunkId: c.chunk.id,
                documentId: c.chunk.documentId,
                documentTitle: c.chunk.title,
                label: c.chunk.title,
                snippet: extractChunkSnippet(c.chunk.content, text),
                confidence: Math.round(c.hybridScore * 100) / 100,
              });
            }
          } else if (p.includes('recurring') || p.includes('subscription') || p.includes('bill') || p.includes('autopay')) {
            const engineRes = generateFinancialInsights({
              customerId: customer?.id || 'demo-customer',
              transactions,
              accounts,
              currency: 'INR',
            });
            const recInsights = engineRes.insights.filter((i) => i.type === 'recurring_payment');
            const totalMonthly = recInsights.reduce((acc, i) => acc + (i.aggregateEvidence?.amount || 0), 0);
            recInsights.forEach((i) => {
              citations.push({
                type: 'kpi',
                label: `${i.title} (${i.isConfirmed ? 'Confirmed' : 'Potential'}, ₹${i.aggregateEvidence?.amount || 0}/mo)`,
              });
            });
            reply = `Recurring Payments Analysis: I detected ${recInsights.length} recurring candidates totaling ₹${totalMonthly.toLocaleString('en-IN')}/month. Candidates include: ${
              recInsights.map((i) => `${i.title} (₹${i.aggregateEvidence?.amount || 0}/mo, ${i.aggregateEvidence?.frequency || 'monthly'}, ${Math.round(i.confidence * 100)}% confidence, ${i.isConfirmed ? 'Confirmed' : 'Potential'})`).join('; ') || 'None'
            }. You can confirm them in your Financial Insights tab.`;
          } else if (p.includes('unusual') || p.includes('anomaly') || p.includes('spike') || p.includes('weird') || p.includes('flagged')) {
            const engineRes = generateFinancialInsights({
              customerId: customer?.id || 'demo-customer',
              transactions,
              accounts,
              currency: 'INR',
            });
            const unusualInsights = engineRes.insights.filter((i) => i.type === 'unusual_transaction');
            unusualInsights.forEach((i) => {
              citations.push({
                type: 'transaction',
                id: i.supportingTransactionIds?.[0] || i.id,
                label: `${i.title} (₹${i.aggregateEvidence?.amount || 0})`,
                amount: i.aggregateEvidence?.amount || 0,
              });
            });
            if (unusualInsights.length > 0) {
              reply = `Unusual Outflow Analysis: Detected ${unusualInsights.length} transaction(s) deviating mathematically from your historical baseline (> 2.5x mean or 2.5 standard deviations): ${
                unusualInsights.map((i) => `${i.title} (${i.detectionRule})`).join('; ')
              }. Note: flagged purely for financial review, not deemed fraudulent.`;
            } else {
              reply = 'No unusual outflows or statistical anomalies detected in your verified statement ledger history.';
            }
          } else if (p.includes('trend') || p.includes('month over month') || p.includes('mom') || p.includes('compared to')) {
            const trends = calculateMonthlyTrends(transactions);
            const latest = trends[trends.length - 1];
            const prev = trends.length >= 2 ? trends[trends.length - 2] : null;
            let momStr = '';
            if (latest && prev && prev.expenses > 0) {
              const diffPct = ((latest.expenses - prev.expenses) / prev.expenses) * 100;
              momStr = ` (${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}% vs ${prev.monthLabel})`;
            }
            reply = `Spending Trends: For ${latest?.monthLabel || 'current month'}, verified outflows were ₹${latest?.expenses.toLocaleString('en-IN') || 0}${momStr}. Top categories: ${categories.slice(0, 3).map((c) => `${c.categoryName} (${c.percentage}%)`).join(', ') || 'General'}.`;
            categories.slice(0, 3).forEach((c) => citations.push({ type: 'category', label: `${c.categoryName} (₹${c.totalAmount.toLocaleString('en-IN')})` }));
          } else if (p.includes('balance') || p.includes('how much') || p.includes('account')) {
            const accStr = accounts.map((a) => `${a.accountName}: ₹${a.balance.toLocaleString('en-IN')}`).join(', ');
            reply = `Your total confirmed balance is ₹${activeSummary.totalBalance.toLocaleString('en-IN')} across ${accounts.length} account(s) (${accStr || 'Primary Ledger'}).`;
            accounts.forEach((a) => citations.push({ type: 'account', label: `${a.accountName} (₹${a.balance.toLocaleString('en-IN')})` }));
          } else if (p.includes('saving') || p.includes('savings rate') || p.includes('cash flow') || p.includes('inflow') || p.includes('income')) {
            reply = `Your verified savings rate is ${activeSummary.savingsRate.toFixed(1)}%. Pure inflow stands at ₹${activeSummary.pureIncome.toLocaleString('en-IN')} against verified pure outflows of ₹${activeSummary.pureExpenses.toLocaleString('en-IN')}, leaving a net positive cash flow of ₹${activeSummary.netCashFlow.toLocaleString('en-IN')}.`;
            citations.push({ type: 'kpi', label: `Savings Rate: ${activeSummary.savingsRate.toFixed(1)}%` });
            citations.push({ type: 'kpi', label: `Net Cash Flow: ₹${activeSummary.netCashFlow.toLocaleString('en-IN')}` });
          } else if (p.includes('expense') || p.includes('spend') || p.includes('category') || p.includes('dining') || p.includes('groceries')) {
            const topCats = categories.slice(0, 3);
            const catStr = topCats.map((c) => `${c.categoryName}: ₹${c.totalAmount.toLocaleString('en-IN')} (${c.percentage}%)`).join(', ');
            reply = `Your total verified pure expenses are ₹${activeSummary.pureExpenses.toLocaleString('en-IN')} across ${transactions.length} transactions. Your top spending categories are: ${catStr || 'None recorded yet'}.`;
            topCats.forEach((c) => citations.push({ type: 'category', label: `${c.categoryName} (₹${c.totalAmount.toLocaleString('en-IN')})` }));
          } else if (p.includes('behavior') || p.includes('archetype') || p.includes('discipline') || p.includes('shopping discipline')) {
            const { behavior, archetypes } = analyzeBehaviour(transactions, identity);
            const activeMatched = archetypes.filter((a) => a.matched).map((a) => a.label);
            reply = `Your overall Financial Discipline score is ${behavior.overallFinancialDiscipline}/100. Shopping Discipline: ${behavior.shoppingDiscipline.score}/100, Savings Velocity: ${behavior.savingsVelocity.score}/100, EMI Load: ${behavior.loanRepaymentEmiLoad.score}/100, Investment Ratio: ${behavior.investmentRatio.score}/100. Active behavioral archetypes: ${activeMatched.length > 0 ? activeMatched.join(', ') : 'Balanced Earner'}.`;
            citations.push({ type: 'kpi', label: `Discipline: ${behavior.overallFinancialDiscipline}/100` });
            citations.push({ type: 'kpi', label: `Savings Velocity: ${behavior.savingsVelocity.score}/100` });
          } else if (p.includes('insight') || p.includes('nudge') || p.includes('recommendation') || p.includes('proactive') || p.includes('upcoming')) {
            const { behavior, archetypes } = analyzeBehaviour(transactions, identity);
            const proactiveInsights = generateProactiveInsights({
              identity,
              transactions,
              accounts,
              summary: activeSummary,
              behavior,
              archetypes,
            });
            const top = proactiveInsights.slice(0, 2);
            reply = `I have generated ${proactiveInsights.length} evidence-backed proactive insights: ${top.map((ins) => `[${ins.title}]: ${ins.explanation} Suggested Action: ${ins.suggestedAction}`).join(' ')}`;
            top.forEach((ins) => citations.push({ type: 'kpi', label: `${ins.title} (${ins.severity.toUpperCase()})` }));
          } else if (p.includes('emergency fund') || p.includes('what is') || p.includes('how to invest') || p.includes('sip')) {
            reply = 'General Financial Guidance: An emergency reserve typically covers 3 to 6 months of essential living expenses (rent, utilities, groceries, and debt obligations) held in liquid instruments. SIPs allow disciplined, periodic rupee-cost averaging into index funds.';
            // ZERO fabricated citations on general guidance
          } else {
            reply = `Based on your verified ledger data: Total Balance is ₹${activeSummary.totalBalance.toLocaleString('en-IN')}, Savings Rate is ${activeSummary.savingsRate.toFixed(1)}%, and you have ${transactions.length} recorded transactions. Your declared monthly salary is ₹${identity.income.monthlyIncome.toLocaleString('en-IN')}. How can I assist you with your cash flow or investments?`;
            citations.push({ type: 'kpi', label: `Total Balance: ₹${activeSummary.totalBalance.toLocaleString('en-IN')}` });
          }
        }

        const assistantMsg: ChatMessage = {
          id: `demo-msg-${Date.now()}`,
          customerId: customer?.id || '',
          threadId: activeThreadId,
          role: 'assistant',
          content: reply,
          groundingsJson: citations.length > 0 ? JSON.stringify(citations) : undefined,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setAskingCopilot(false);
      }, 400);
      return;
    }

    try {
      const res = await api.askCopilot(activeThreadId, text);

      const assistantMsg: ChatMessage = {
        id: res.messageId,
        customerId: customer?.id || '',
        threadId: activeThreadId,
        role: 'assistant',
        content: res.reply,
        groundingsJson: res.citations ? JSON.stringify(res.citations) : undefined,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Copilot request failed:', err);
      setError(err.message || 'Failed to get response from Viv copilot.');
    } finally {
      setAskingCopilot(false);
    }
  };

  const samplePrompts = [
    'What are my total balances, pure income, and net cash flow?',
    'How did my spending change compared to last month?',
    'What potential recurring payments or subscriptions did you detect?',
    'Are any of my transactions flagged as unusual outliers?',
    'Can I afford my 6-Month Emergency Reserve under my current savings velocity?',
    'What is VivPay\'s policy on transaction disputes and overdrafts?',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172B4D]/35 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="glass-panel bg-white/95 border border-[#5878FF]/20 rounded-3xl w-full max-w-4xl h-[88vh] flex flex-col md:flex-row overflow-hidden shadow-2xl text-[#172B4D]">
        {/* Sidebar / Threads */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#DCE7F6] bg-[#F4F9FF]/80 p-4 flex flex-col justify-between shrink-0">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#5878FF] via-[#6888FF] to-[#8CA8FF] text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm tracking-tight text-[#172B4D]">Ask Viv</span>
              </div>
              <button
                onClick={handleCreateNewThread}
                className="p-1.5 rounded-lg bg-white hover:bg-[#EAF3FF] border border-[#DCE7F6] text-[#64748B] hover:text-[#5878FF] transition-colors cursor-pointer shadow-2xs"
                title="New Conversation"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
              Recent Consultations
            </div>

            <div className="space-y-1.5 max-h-48 md:max-h-[55vh] overflow-y-auto pr-1">
              {loadingThreads ? (
                <div className="text-[#64748B] text-xs py-2 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5878FF]" /> Loading threads...
                </div>
              ) : threads.length === 0 ? (
                <div className="text-[#64748B] text-xs py-2">No threads yet</div>
              ) : (
                threads.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setActiveThreadId(t.id)}
                    className={`group flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                      activeThreadId === t.id
                        ? 'bg-[#5878FF]/12 text-[#5878FF] border border-[#5878FF]/30 font-semibold shadow-2xs'
                        : 'text-[#64748B] hover:bg-white/80 hover:text-[#172B4D]'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{t.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteThread(t.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#64748B] hover:text-rose-500 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[#DCE7F6] text-[11px] text-[#64748B]">
            <div className="flex items-center gap-1.5 text-[#64748B]">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Grounded in verified records</span>
            </div>
          </div>
        </div>

        {/* Chat Main Area */}
        <div className="flex-1 flex flex-col justify-between bg-white/70 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-[#DCE7F6] bg-white/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#5878FF] via-[#6888FF] to-[#8CA8FF] flex items-center justify-center text-white shadow-md shadow-[#5878FF]/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#172B4D] flex items-center gap-1.5">
                  <span>Viv AI Financial Copilot</span>
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded-md bg-[#EDE9FF] text-[#5878FF] border border-[#5878FF]/20">
                    Gemini 3.8
                  </span>
                </h4>
                <p className="text-[11px] text-[#64748B]">
                  Deterministic calculations & intelligent financial guidance
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#64748B] hover:text-[#172B4D] hover:bg-[#EAF3FF] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.length === 0 && !loadingMessages ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#EAF3FF] text-[#5878FF] border border-[#5878FF]/20 flex items-center justify-center shadow-xs">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div className="max-w-md">
                  <h4 className="font-bold text-base text-[#172B4D]">How can Viv assist your finances?</h4>
                  <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                    Ask questions about your accounts, calculate savings velocity, inspect recurring subscriptions, or model financial scenarios.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg pt-2">
                  {samplePrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(prompt)}
                      className="text-left text-xs bg-white hover:bg-[#EAF3FF]/80 border border-[#DCE7F6] hover:border-[#5878FF]/40 p-3 rounded-xl text-[#172B4D] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                    >
                      "{prompt}"
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                let parsedGroundings: any[] = [];
                if (msg.groundingsJson) {
                  try {
                    parsedGroundings = JSON.parse(msg.groundingsJson);
                  } catch {}
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 text-xs leading-relaxed ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-xl bg-[#EAF3FF] text-[#5878FF] border border-[#5878FF]/20 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl p-4 shadow-xs ${
                        isUser
                          ? 'bg-[#5878FF] text-white rounded-tr-none shadow-sm'
                          : 'bg-white border border-[#DCE7F6] text-[#172B4D] rounded-tl-none'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Verified Citations & Grounding tags */}
                      {!isUser && parsedGroundings.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-[#DCE7F6] flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] text-[#64748B] uppercase font-semibold">
                            Grounded in:
                          </span>
                          {parsedGroundings.map((c: any, idx: number) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 bg-[#EDE9FF] border border-[#5878FF]/20 text-[#5878FF] px-2 py-0.5 rounded-lg text-[10px] font-medium"
                            >
                              <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                              <span>{c.label || c}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className={`text-[10px] mt-1 text-right font-mono ${isUser ? 'text-white/70' : 'text-[#64748B]'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {askingCopilot && (
              <div className="flex gap-3 text-xs justify-start items-center">
                <div className="w-7 h-7 rounded-xl bg-[#EAF3FF] text-[#5878FF] border border-[#5878FF]/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white border border-[#DCE7F6] rounded-2xl rounded-tl-none px-4 py-3 text-[#64748B] flex items-center gap-2 shadow-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5878FF]" />
                  <span>Viv is analyzing your financial records...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl shadow-2xs">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Box */}
          <div className="p-4 border-t border-[#DCE7F6] bg-[#F4F9FF]/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask Viv about your spending, accounts, or savings..."
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                disabled={askingCopilot}
                className="flex-1 bg-white border border-[#DCE7F6] focus:border-[#5878FF] rounded-2xl px-4 py-3 text-xs text-[#172B4D] placeholder-[#64748B] focus:outline-none transition-colors shadow-2xs"
              />
              <button
                type="submit"
                disabled={!inputPrompt.trim() || askingCopilot}
                className="p-3 rounded-2xl bg-[#5878FF] hover:bg-[#4868EF] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all cursor-pointer shadow-md shadow-[#5878FF]/25 shrink-0"
              >
                {askingCopilot ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
