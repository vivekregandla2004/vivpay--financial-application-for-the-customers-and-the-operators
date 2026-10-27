/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Database,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Shield,
  FileText,
  Filter,
} from 'lucide-react';
import { adminApi } from '../../services/api.ts';
import { queryOpsKnowledge, getOpsKnowledgeChunkCount } from '../../lib/operations/knowledge.ts';
import { RAGAnswerResult } from '../../lib/rag/types.ts';

interface DocItem {
  id: string;
  title: string;
  category: string;
  type: string;
  tenantId: string;
  lastUpdated: string;
  status: string;
  chunkCount: number;
  vectorDimensions: number;
}

export const KnowledgeDocumentManagementPage: React.FC = () => {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalChunks, setTotalChunks] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Interactive RAG query tester
  const [testQuery, setTestQuery] = useState('');
  const [testSearching, setTestSearching] = useState(false);
  const [testResult, setTestResult] = useState<RAGAnswerResult | null>(null);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getKnowledgeDocs();
      if (res && res.documents) {
        setDocs(res.documents);
        setTotalChunks(res.totalIndexedChunks || getOpsKnowledgeChunkCount());
      }
    } catch {
      // Fallback count
      setTotalChunks(getOpsKnowledgeChunkCount());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleTestSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;

    setTestSearching(true);
    try {
      const result = await queryOpsKnowledge(testQuery.trim());
      setTestResult(result);
    } catch (err) {
      console.error('Failed to run test retrieval:', err);
    } finally {
      setTestSearching(false);
    }
  };

  const filteredDocs = docs.filter((d) => {
    const matchesSearch =
      searchTerm === '' ||
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.tenantId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || d.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(docs.map((d) => d.category)));

  return (
    <div className="space-y-6 text-left">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Knowledge & Document Management</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                RAG Infrastructure
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect vector embeddings, tenant isolation boundaries, chunk indexes, and grounding confidence
            </p>
          </div>
        </div>

        <button
          onClick={fetchDocs}
          disabled={loading}
          className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 px-3.5 py-2 rounded-xl transition-colors cursor-pointer self-start md:self-auto shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Knowledge Matrix</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Indexed Documents</span>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{docs.length}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">SOPs & normalized statements</p>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Vector Chunks</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-indigo-600 tracking-tight">{totalChunks}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">In-memory vector store</p>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Embedding Model</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 tracking-tight">text-embedding-004</div>
          <p className="text-[11px] text-slate-500 mt-0.5">768 dimensions / normalized</p>
        </div>

        <div className="card-luxury p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenant Isolation</span>
            <Shield className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-lg font-bold text-emerald-700 tracking-tight">Enforced (RLS)</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Customer & Ops partitioned</p>
        </div>
      </div>

      {/* Persistence Note Banner */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl px-4 py-3 flex items-start gap-2.5 text-xs text-amber-900">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">In-Memory Vector Indexing Architecture (Phase 6)</p>
          <p className="text-slate-600">
            Document chunks and vector embeddings are indexed in the centralized in-memory vector store with strict tenant filtering. Full database persistence with Supabase pgvector embeddings will be implemented during the scheduled database migration phase.
          </p>
        </div>
      </div>

      {/* Interactive Vector Retrieval & Grounding Tester */}
      <div className="card-luxury p-6 space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Interactive Grounding & Retrieval Verification</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Test cosine similarity scoring, citation extraction, and confidence classification against the indexed knowledge base
          </p>
        </div>

        <form onSubmit={handleTestSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="e.g. What is the procedure for suspected fraud? or How are PhonePe statements parsed?"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            disabled={testSearching || !testQuery.trim()}
            className="btn-primary-gradient px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {testSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Test Retrieval</span>
          </button>
        </form>

        {testResult && (
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Retrieval Result:</span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                    testResult.confidence >= 0.65
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : testResult.confidence >= 0.38
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {testResult.confidence >= 0.65 ? 'High' : testResult.confidence >= 0.38 ? 'Medium' : 'Low'} Confidence ({(testResult.confidence * 100).toFixed(0)}%)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Mode: {testResult.mode === 'grounded_document_facts' ? 'Grounded Facts' : testResult.mode}
                </span>
              </div>
              <span className="text-xs text-purple-700 font-semibold font-mono">
                {testResult.citations.length} Citation{testResult.citations.length !== 1 ? 's' : ''} Retrieved
              </span>
            </div>

            <div className="text-xs text-slate-800 leading-relaxed bg-white p-3 rounded-lg border border-slate-200/60">
              {testResult.reply}
            </div>

            {testResult.citations.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Retrieved Source Chunks & Excerpts:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {testResult.citations.map((cite, i) => (
                    <div key={i} className="bg-white p-3 rounded-lg border border-purple-100 text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold text-purple-900">
                        <span>{cite.documentTitle || cite.label}</span>
                        {cite.confidence !== undefined && (
                          <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                            cos: {(cite.confidence * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      {cite.label && cite.label !== cite.documentTitle && (
                        <div className="text-[10px] text-slate-500 font-medium">Source: {cite.label}</div>
                      )}
                      {cite.snippet && (
                        <p className="text-[11px] text-slate-600 line-clamp-3 italic bg-slate-50 p-1.5 rounded">
                          "{cite.snippet}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document Catalog Table */}
      <div className="card-luxury p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Indexed Knowledge Documents Catalog</h3>
            <p className="text-xs text-slate-500">Registry of SOP manuals, regulatory guidelines, and normalized transaction documents</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Document Title</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Type / Format</th>
                <th className="py-2.5 px-3">Tenant Boundary</th>
                <th className="py-2.5 px-3">Chunks</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Vectors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-purple-50/20 transition-colors">
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-900 block">{doc.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {doc.id}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700 border border-purple-200">
                      {doc.category}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-medium">{doc.type}</td>
                  <td className="py-3 px-3">
                    <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {doc.tenantId}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-800">{doc.chunkCount}</td>
                  <td className="py-3 px-3">
                    <span className="text-emerald-700 text-[10px] font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 w-fit">
                      <CheckCircle2 className="w-3 h-3" /> {doc.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[10px] text-slate-500">
                    {doc.vectorDimensions}d unit
                  </td>
                </tr>
              ))}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No documents matching the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
