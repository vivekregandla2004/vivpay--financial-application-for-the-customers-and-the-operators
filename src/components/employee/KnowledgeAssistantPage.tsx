/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  BookOpen,
  ShieldCheck,
  FileText,
  Send,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { RAGAnswerResult } from '../../lib/rag/types.ts';
import { queryOpsKnowledge } from '../../lib/operations/knowledge.ts';
import { operationsApi } from '../../services/api.ts';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  ragResult?: RAGAnswerResult;
}

export const KnowledgeAssistantPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: 'Hello Sarah! I am the VivPay Operations Knowledge Assistant. I am grounded in VivPay Standard Operating Procedures (SOPs), AML/BSA regulations, KYC protocols, statement parser rules, and privacy bounds. Ask me any procedural or compliance question.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const sampleQuestions = [
    'What is the procedure for Rule 409 velocity limit breach?',
    'How to verify Enhanced Due Diligence (EDD) Form BOI-3?',
    'What are the chargeback dispute deadlines under Visa/Mastercard?',
    'How does the PhonePe statement deduplication checksum work?',
    'What are employee privacy restrictions regarding customer credentials?',
  ];

  const handleSend = async (questionText?: string) => {
    const textToSend = (questionText || query).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      let ragResult: RAGAnswerResult;
      try {
        const apiRes = await operationsApi.askKnowledge(textToSend);
        ragResult = apiRes.answer;
      } catch {
        // Fallback to client-side RAG engine
        ragResult = queryOpsKnowledge(textToSend);
      }

      const assistantMsg: Message = {
        id: `msg-asst-${Date.now()}`,
        sender: 'assistant',
        text: ragResult.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ragResult,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'assistant',
          text: 'Error querying operations knowledge base: ' + (err.message || 'Unknown error'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card-luxury p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900">Operations Compliance & SOP Assistant</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                RAG Grounded
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified citations from VivPay Operations Manual, FinCEN regulatory guidance, and parser telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-medium">
            Threshold: <strong className="text-purple-700">0.38 Confidence Floor</strong>
          </span>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Suggested SOP Inquiries
        </span>
        <div className="flex flex-wrap gap-2">
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="text-xs px-3 py-1.5 bg-slate-50 hover:bg-purple-50/70 border border-slate-200 hover:border-purple-200 rounded-xl text-slate-700 hover:text-purple-900 font-medium transition-all cursor-pointer text-left shadow-2xs"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Container */}
      <div className="card-luxury p-6 flex flex-col h-[520px]">
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed space-y-2 ${
                  m.sender === 'user'
                    ? 'bg-purple-600 text-white rounded-br-xs'
                    : 'bg-slate-50 border border-slate-200/90 text-slate-800 rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-line">{m.text}</div>

                {/* Grounding Mode Badge */}
                {m.ragResult && (
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full ${
                        m.ragResult.mode === 'grounded_document_facts'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {m.ragResult.mode === 'grounded_document_facts'
                        ? 'Grounded SOP Facts'
                        : 'General Financial Guidance'}
                    </span>

                    <span className="text-slate-400 font-mono text-[10px]">
                      Confidence: {Math.round(m.ragResult.confidence * 100)}%
                    </span>
                  </div>
                )}

                {/* Source Citations Card */}
                {m.ragResult && m.ragResult.citations.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="font-bold text-[11px] text-slate-700 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-purple-600" />
                      <span>Verified Source SOP Chunks ({m.ragResult.citations.length}):</span>
                    </span>

                    <div className="space-y-1.5">
                      {m.ragResult.citations.map((cite, cIdx) => (
                        <div
                          key={cIdx}
                          className="bg-white border border-purple-200/80 rounded-xl p-2.5 text-[11px] space-y-1 shadow-2xs"
                        >
                          <div className="flex items-center justify-between font-bold text-purple-900">
                            <span>{cite.documentTitle}</span>
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded font-mono">
                              Chunk: {cite.chunkId.slice(-8)}
                            </span>
                          </div>
                          <p className="text-slate-600 italic leading-snug">
                            "{cite.snippet}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <span className="text-[10px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 p-3 rounded-2xl w-fit">
              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
              <span>Scanning Operations SOP Knowledge Base & retrieving vector chunks...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask procedural question (e.g. 'What is the SAR filing threshold?')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={loading}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !query.trim()}
            className="btn-primary-gradient text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ask</span>
          </button>
        </div>
      </div>
    </div>
  );
};
