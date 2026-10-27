/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalVectorStore } from '../rag/retrieval.ts';
import { chunkDocument } from '../rag/chunker.ts';
import { generateRAGAnswer } from '../rag/retrieval.ts';
import { RAGAnswerResult } from '../rag/types.ts';
import { OPERATIONAL_SOP_DOCS } from '../../services/demoData.ts';

export const OPS_KNOWLEDGE_TENANT = 'ops-knowledge-base';

let initialized = false;

/**
 * Initializes the Operations SOP and Compliance Knowledge Base in the RAG vector store.
 * Chunks documents and registers them under the isolated ops knowledge tenant.
 */
export function initializeOpsKnowledgeBase(): void {
  if (initialized) return;

  for (const doc of OPERATIONAL_SOP_DOCS) {
    const chunks = chunkDocument(doc.id, OPS_KNOWLEDGE_TENANT, doc.title, doc.content, {
      fileType: 'Operations SOP',
    });
    globalVectorStore.addChunks(OPS_KNOWLEDGE_TENANT, chunks);
  }

  initialized = true;
}

/**
 * Queries the Operations Knowledge Base using the authoritative RAG engine.
 * Guarantees grounded responses with exact SOP chunk citations and low-confidence fallback.
 */
export function queryOpsKnowledge(queryText: string): RAGAnswerResult {
  initializeOpsKnowledgeBase();
  return generateRAGAnswer(queryText, OPS_KNOWLEDGE_TENANT, {
    topK: 3,
    minConfidence: 0.38,
  });
}

export function getOpsKnowledgeChunkCount(): number {
  initializeOpsKnowledgeBase();
  return globalVectorStore.totalChunksCount();
}
