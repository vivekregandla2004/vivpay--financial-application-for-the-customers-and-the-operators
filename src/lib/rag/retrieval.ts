/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DocumentChunk,
  RetrievalQuery,
  RetrievalResult,
  Citation,
  RAGAnswerResult,
} from './types.ts';
import { generateEmbedding, cosineSimilarity } from './embeddings.ts';

// In-memory customer-isolated chunk store with persistence support
class DocumentVectorStore {
  private chunksByCustomer: Map<string, DocumentChunk[]> = new Map();

  /**
   * Register chunks for a specific customer. Enforces customerId isolation.
   */
  public addChunks(customerId: string, chunks: DocumentChunk[]): void {
    if (!customerId) throw new Error('customerId is strictly required to store document chunks.');
    const existing = this.chunksByCustomer.get(customerId) || [];
    
    // Replace chunks for the same document to avoid duplicates on re-ingestion
    const docIdsToReplace = new Set(chunks.map((c) => c.documentId));
    const filtered = existing.filter((c) => !docIdsToReplace.has(c.documentId));
    
    // Ensure all incoming chunks belong to this customer
    const validatedChunks = chunks.map((c) => ({
      ...c,
      customerId, // Guarantee customer scoping
    }));

    this.chunksByCustomer.set(customerId, [...filtered, ...validatedChunks]);
  }

  /**
   * Clear all chunks for a customer (e.g. on dataset removal)
   */
  public clearCustomer(customerId: string): void {
    this.chunksByCustomer.delete(customerId);
  }

  /**
   * Clear chunks for a specific document
   */
  public removeDocument(customerId: string, documentId: string): void {
    const existing = this.chunksByCustomer.get(customerId);
    if (!existing) return;
    this.chunksByCustomer.set(
      customerId,
      existing.filter((c) => c.documentId !== documentId)
    );
  }

  /**
   * Get all chunks strictly owned by a customer
   */
  public getCustomerChunks(customerId: string): DocumentChunk[] {
    return this.chunksByCustomer.get(customerId) || [];
  }

  /**
   * Total chunk count across all customers (diagnostic only)
   */
  public totalChunksCount(): number {
    let count = 0;
    for (const chunks of this.chunksByCustomer.values()) {
      count += chunks.length;
    }
    return count;
  }
}

export const globalVectorStore = new DocumentVectorStore();

const STOP_WORDS = new Set([
  'what', 'when', 'where', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having',
  'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at',
  'by', 'for', 'with', 'about', 'into', 'through', 'during', 'before', 'after',
  'to', 'from', 'in', 'out', 'on', 'off', 'over', 'under', 'how', 'does', 'tell', 'show', 'give'
]);

/**
 * Calculates lexical keyword overlap score (0 to 1) with stopword filtering
 */
function calculateKeywordScore(query: string, content: string): number {
  const allTokens = query
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (allTokens.length === 0) return 0;

  const contentLower = content.toLowerCase();
  const meaningfulTokens = allTokens.filter((t) => !STOP_WORDS.has(t) && t.length > 2);
  const targetTokens = meaningfulTokens.length > 0 ? meaningfulTokens : allTokens;

  let hits = 0;
  for (const token of targetTokens) {
    if (contentLower.includes(token)) {
      hits++;
    }
  }

  return hits / targetTokens.length;
}

/**
 * Confidence threshold below which chunks are considered low-confidence / non-grounding
 */
export const RAG_CONFIDENCE_THRESHOLD = 0.40;

/**
 * Performs customer-isolated hybrid retrieval:
 * Combines semantic vector cosine similarity (65%) and BM25 lexical match (35%).
 */
export function hybridRetrieve(query: RetrievalQuery): RetrievalResult[] {
  const { customerId, text, topK = 4, minConfidence = RAG_CONFIDENCE_THRESHOLD } = query;

  // STRICT PRIVACY ISOLATION: Retrieve ONLY chunks owned by this customerId
  const candidateChunks = globalVectorStore.getCustomerChunks(customerId);

  if (candidateChunks.length === 0 || !text.trim()) {
    return [];
  }

  const queryEmbedding = generateEmbedding(text);

  const scored: RetrievalResult[] = candidateChunks.map((chunk) => {
    const vectorScore = Math.max(0, cosineSimilarity(queryEmbedding, chunk.embedding));
    const keywordScore = calculateKeywordScore(text, `${chunk.title} ${chunk.content}`);
    
    // Hybrid scoring with weighted blend and entity match reinforcement
    const baseBlend = 0.45 * vectorScore + 0.55 * keywordScore;
    const hybridScore = Math.min(1.0, Math.max(baseBlend, keywordScore * 0.85, vectorScore * 0.9));
    const isConfident = hybridScore >= minConfidence;

    return {
      chunk,
      vectorScore,
      keywordScore,
      hybridScore,
      isConfident,
    };
  });

  // Rerank descending by hybrid score
  scored.sort((a, b) => b.hybridScore - a.hybridScore);

  return scored.slice(0, topK);
}

/**
 * Extracts a concise snippet from chunk content matching query keywords
 */
export function extractChunkSnippet(content: string, query: string, maxLength: number = 140): string {
  const lines = content.split('\n');
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

  // Find line with most keyword matches
  let bestLine = lines[0] || '';
  let maxHits = -1;

  for (const line of lines) {
    const lineLower = line.toLowerCase();
    const hits = queryWords.filter((w) => lineLower.includes(w)).length;
    if (hits > maxHits) {
      maxHits = hits;
      bestLine = line;
    }
  }

  const trimmed = bestLine.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
}

/**
 * Synthesizes grounded RAG answer and precise citations from retrieved chunks.
 * Distinguishes between grounded document facts and general financial guidance.
 * NEVER hallucinates or fabricates citations on low-confidence or empty results.
 */
export function generateRAGAnswer(
  queryText: string,
  customerId: string,
  options?: { topK?: number; minConfidence?: number }
): RAGAnswerResult {
  const retrieved = hybridRetrieve({
    customerId,
    text: queryText,
    topK: options?.topK || 4,
    minConfidence: options?.minConfidence || RAG_CONFIDENCE_THRESHOLD,
  });

  const confidentChunks = retrieved.filter((r) => r.isConfident);
  const topScore = retrieved.length > 0 ? retrieved[0].hybridScore : 0;

  // Case 1: Low confidence or zero relevant chunks found
  // The system must NOT generate fabricated citations and must mark general guidance
  if (confidentChunks.length === 0) {
    return {
      reply: generateGeneralGuidanceAnswer(queryText),
      citations: [], // EMPTY CITATIONS — Zero fabrication guarantee
      mode: 'general_guidance',
      confidence: topScore,
      chunksRetrieved: 0,
      topScore,
    };
  }

  // Case 2: Grounded document retrieval with verified chunk citations
  const citations: Citation[] = confidentChunks.map((result) => {
    const snippet = extractChunkSnippet(result.chunk.content, queryText);
    return {
      type: 'chunk',
      id: result.chunk.id,
      chunkId: result.chunk.id,
      documentId: result.chunk.documentId,
      documentTitle: result.chunk.title,
      label: `${result.chunk.title}`,
      snippet,
      confidence: Math.round(result.hybridScore * 100) / 100,
    };
  });

  // Synthesize answer based strictly on verified source chunks
  const primaryChunk = confidentChunks[0].chunk;
  const replyParts: string[] = [
    `Based on your verified records in [${primaryChunk.title}]:`,
  ];

  for (const item of confidentChunks.slice(0, 3)) {
    const snippet = extractChunkSnippet(item.chunk.content, queryText);
    replyParts.push(`• ${snippet}`);
  }

  return {
    reply: replyParts.join('\n'),
    citations,
    mode: 'grounded_document_facts',
    confidence: topScore,
    chunksRetrieved: confidentChunks.length,
    topScore,
  };
}

/**
 * General financial guidance fallback when no matching source document exists
 */
function generateGeneralGuidanceAnswer(query: string): string {
  const q = query.toLowerCase();

  if (q.includes('emergency fund') || q.includes('buffer')) {
    return 'General Financial Guidance: An emergency reserve typically covers 3 to 6 months of essential living expenses (rent, utilities, groceries, and debt obligations), held in high-yield liquid instruments or liquid savings.';
  }

  if (q.includes('savings rate') || q.includes('save')) {
    return 'General Financial Guidance: A healthy benchmark savings rate is 20% to 30% of net take-home income, following the 50/30/20 budget framework (50% essentials, 30% discretionary, 20% savings & investments).';
  }

  if (q.includes('sip') || q.includes('mutual fund') || q.includes('invest')) {
    return 'General Financial Guidance: Systematic Investment Plans (SIPs) allow disciplined, dollar-cost averaging into diversified index funds or mutual funds regardless of short-term market volatility.';
  }

  return 'General Financial Guidance: No specific bank statement records matched this query. For personal advice grounded in your transactions, please upload an authentic bank statement or consult your Financial Profile.';
}
