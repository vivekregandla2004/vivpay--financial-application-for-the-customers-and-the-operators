/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DocumentChunkMetadata {
  fileType?: string;
  dateRange?: { start: string; end: string };
  accountNumberMasked?: string;
  totalCredits?: number;
  totalDebits?: number;
  category?: string;
  rowCount?: number;
  statementPeriod?: string;
  sourceSheet?: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  customerId: string;
  chunkIndex: number;
  title: string;
  content: string;
  metadata: DocumentChunkMetadata;
  embedding: number[]; // 768-dimensional normalized embedding
  createdAt: string;
}

export interface RetrievalQuery {
  text: string;
  customerId: string;
  topK?: number;
  minConfidence?: number;
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  vectorScore: number;
  keywordScore: number;
  hybridScore: number;
  isConfident: boolean;
}

export interface Citation {
  type: 'document' | 'chunk' | 'transaction' | 'account' | 'kpi' | 'goal';
  id?: string;
  chunkId?: string;
  documentId?: string;
  label: string;
  documentTitle?: string;
  snippet?: string;
  confidence?: number;
  amount?: number;
}

export interface RAGAnswerResult {
  reply: string;
  citations: Citation[];
  mode: 'grounded_document_facts' | 'general_guidance' | 'hybrid';
  confidence: number;
  chunksRetrieved: number;
  topScore: number;
}
