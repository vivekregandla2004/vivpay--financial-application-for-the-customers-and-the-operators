/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert';
import {
  EMBEDDING_DIMENSION,
  generateEmbedding,
  cosineSimilarity,
  vectorNorm,
} from '../src/lib/rag/embeddings.ts';
import { chunkFinancialStatement } from '../src/lib/rag/chunker.ts';
import {
  globalVectorStore,
  hybridRetrieve,
  generateRAGAnswer,
  RAG_CONFIDENCE_THRESHOLD,
} from '../src/lib/rag/retrieval.ts';
import { CanonicalTransaction } from '../src/lib/finance/types.ts';

async function runRAGAskVivAudit() {
  console.log('================================================================');
  console.log('        PHASE 4 AUDIT: RAG & ASK VIV VERIFICATION SUITE         ');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Embedding Dimension and Mathematical Properties
  // --------------------------------------------------------------------------
  console.log('[TEST 1] Verifying Embedding Dimension and L2 Normalization...');
  const text1 = 'Salary credited from TechCorp Solutions ₹75,000';
  const text2 = 'TechCorp payroll salary direct deposit';
  const textUnrelated = 'Astrophysics galaxy rotational dynamics';

  const emb1 = generateEmbedding(text1);
  const emb2 = generateEmbedding(text2);
  const embUnrelated = generateEmbedding(textUnrelated);

  assert.strictEqual(emb1.length, EMBEDDING_DIMENSION, `Embedding dimension must be exactly ${EMBEDDING_DIMENSION}`);
  assert.strictEqual(emb1.length, 768, 'Embedding dimension must be 768');

  const norm1 = vectorNorm(emb1);
  assert(Math.abs(norm1 - 1.0) < 1e-5, `Embedding must be L2 normalized to unit length, got ${norm1}`);

  const simRelated = cosineSimilarity(emb1, emb2);
  const simUnrelated = cosineSimilarity(emb1, embUnrelated);

  console.log(`  - Dimension: ${emb1.length} (Verified text-embedding-004 matching)`);
  console.log(`  - L2 Unit Norm: ${norm1.toFixed(5)}`);
  console.log(`  - Related Cosine Similarity ("Salary credited" vs "TechCorp payroll"): ${simRelated.toFixed(4)}`);
  console.log(`  - Unrelated Cosine Similarity ("Salary" vs "Astrophysics"): ${simUnrelated.toFixed(4)}`);
  assert(simRelated > 0.55, 'Related financial concepts must yield high cosine similarity (>0.55)');
  assert(simUnrelated < 0.35, 'Unrelated domain terms must yield low cosine similarity (<0.35)');
  console.log('  -> PASS: Embedding dimensions and mathematical properties verified.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Document Chunking and Semantic Decomposition
  // --------------------------------------------------------------------------
  console.log('[TEST 2] Verifying Document Ingestion and Semantic Chunking...');
  const sampleTransactions: CanonicalTransaction[] = [
    {
      id: 'tx-001',
      date: '2026-10-01',
      description: 'Swiggy Bangalore Food Order',
      originalDescription: 'UPI/swiggy@kotak/Payment to Swiggy Bangalore/329482910',
      amount: 450,
      debit: 450,
      credit: 0,
      direction: 'debit',
      category: 'Food & Dining',
      balance: 49550,
      reference: '329482910',
      merchant: 'Swiggy',
      upiHandle: 'swiggy@kotak',
      paymentMethod: 'upi',
      confidence: 0.95,
      reviewRequired: false,
      sourceFile: 'Axis_Statement_Oct2026.xlsx',
      sourceSheet: 'Statement',
      sourceRow: 10,
    },
    {
      id: 'tx-002',
      date: '2026-10-02',
      description: 'Netflix Monthly Subscription',
      originalDescription: 'NETFLIX ENTERTAINMENT SERVICES MUMBAI IN',
      amount: 649,
      debit: 649,
      credit: 0,
      direction: 'debit',
      category: 'Entertainment',
      balance: 48901,
      reference: null,
      merchant: 'Netflix',
      upiHandle: null,
      paymentMethod: 'card',
      confidence: 0.92,
      reviewRequired: false,
      sourceFile: 'Axis_Statement_Oct2026.xlsx',
      sourceSheet: 'Statement',
      sourceRow: 11,
    },
    {
      id: 'tx-003',
      date: '2026-10-05',
      description: 'BESCOM Electricity Bill Bangalore',
      originalDescription: 'BIL/ONL/000928109/BESCOM Bangalore Electricity',
      amount: 1250,
      debit: 1250,
      credit: 0,
      direction: 'debit',
      category: 'Utilities',
      balance: 47651,
      reference: '000928109',
      merchant: 'BESCOM',
      upiHandle: null,
      paymentMethod: 'netbanking',
      confidence: 0.94,
      reviewRequired: false,
      sourceFile: 'Axis_Statement_Oct2026.xlsx',
      sourceSheet: 'Statement',
      sourceRow: 12,
    },
    {
      id: 'tx-004',
      date: '2026-10-10',
      description: 'TechCorp Salary Payout Oct 2026',
      originalDescription: 'NEFT/TECHCORP GLOBAL PAYOUT/SALARY OCT 2026',
      amount: 75000,
      debit: 0,
      credit: 75000,
      direction: 'credit',
      category: 'Salary',
      balance: 122651,
      reference: 'NEFT928104',
      merchant: 'TechCorp Global',
      upiHandle: null,
      paymentMethod: 'netbanking',
      confidence: 0.98,
      reviewRequired: false,
      sourceFile: 'Axis_Statement_Oct2026.xlsx',
      sourceSheet: 'Statement',
      sourceRow: 13,
    },
  ];

  const aliceId = 'cust-alice-test-001';
  const aliceDocId = 'doc-axis-oct-alice';
  const aliceChunks = chunkFinancialStatement({
    documentId: aliceDocId,
    customerId: aliceId,
    documentTitle: 'Axis Bank Statement October 2026',
    accountNumberMasked: '••1034',
    transactions: sampleTransactions,
    startingBalance: 50000,
    endingBalance: 122651,
  });

  assert(aliceChunks.length >= 3, `Expected at least 3 chunks (Metadata, Category, Transactions), got ${aliceChunks.length}`);
  const metaChunk = aliceChunks.find((c) => c.title.includes('Metadata') || c.title.includes('Summary'));
  assert(metaChunk, 'Must generate statement summary/metadata chunk');
  assert(metaChunk.content.includes('₹75,000'), 'Metadata chunk must include inflow totals');
  assert(metaChunk.metadata.totalCredits === 75000, 'Metadata totalCredits must be 75000');

  globalVectorStore.addChunks(aliceId, aliceChunks);
  console.log(`  - Generated Chunks count: ${aliceChunks.length}`);
  console.log(`  - Chunk 0: "${aliceChunks[0].title}"`);
  console.log(`  - Chunk 1: "${aliceChunks[1].title}"`);
  console.log(`  - Chunk 2: "${aliceChunks[2].title}"`);
  console.log('  -> PASS: Document chunking and metadata preservation verified.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Hybrid Retrieval and Source Chunk Citations
  // --------------------------------------------------------------------------
  console.log('[TEST 3] Verifying Hybrid Retrieval and Exact Source Chunk Citations...');
  const query = 'How much was my electricity bill from BESCOM?';
  const retrievalResults = hybridRetrieve({
    customerId: aliceId,
    text: query,
    topK: 3,
    minConfidence: RAG_CONFIDENCE_THRESHOLD,
  });

  assert(retrievalResults.length > 0, 'Should retrieve matching chunks for BESCOM electricity query');
  const topResult = retrievalResults[0];
  console.log(`  - Top Chunk: "${topResult.chunk.title}"`);
  console.log(`  - Vector Score: ${topResult.vectorScore.toFixed(4)}`);
  console.log(`  - Keyword Score: ${topResult.keywordScore.toFixed(4)}`);
  console.log(`  - Hybrid Score: ${topResult.hybridScore.toFixed(4)}`);
  console.log(`  - isConfident: ${topResult.isConfident}`);
  assert(topResult.isConfident, 'BESCOM query should be confident');
  assert(topResult.chunk.content.includes('BESCOM'), 'Chunk content must contain BESCOM');

  const ragAnswer = generateRAGAnswer(query, aliceId);
  console.log(`  - RAG Answer Mode: ${ragAnswer.mode}`);
  console.log(`  - Citations Count: ${ragAnswer.citations.length}`);
  assert.strictEqual(ragAnswer.mode, 'grounded_document_facts', 'Should be grounded document facts mode');
  assert(ragAnswer.citations.length > 0, 'Must include source chunk citations');
  assert.strictEqual(ragAnswer.citations[0].chunkId, topResult.chunk.id, 'Citation chunkId must match retrieved chunk id');
  assert(ragAnswer.reply.includes('Axis Bank Statement'), 'Reply must reference document title');
  console.log('  -> PASS: Grounded chunk citations verified.\n');

  // --------------------------------------------------------------------------
  // TEST 4: Low-Confidence Retrieval and Zero Fabricated Citations Guarantee
  // --------------------------------------------------------------------------
  console.log('[TEST 4] Verifying Low-Confidence Retrieval & Zero Fabricated Citations...');
  const unrelatedQuery = 'What is the quantum spin of a neutrino?';
  const lowConfAnswer = generateRAGAnswer(unrelatedQuery, aliceId);

  console.log(`  - Query: "${unrelatedQuery}"`);
  console.log(`  - Mode: ${lowConfAnswer.mode}`);
  console.log(`  - Confidence: ${lowConfAnswer.confidence.toFixed(4)} (Threshold: ${RAG_CONFIDENCE_THRESHOLD})`);
  console.log(`  - Citations Count: ${lowConfAnswer.citations.length}`);
  assert.strictEqual(lowConfAnswer.mode, 'general_guidance', 'Must fall back to general guidance');
  assert.strictEqual(lowConfAnswer.citations.length, 0, 'MUST NOT fabricate citations on low confidence or irrelevant queries');
  console.log('  -> PASS: Zero fabricated citations verified on low confidence.\n');

  // --------------------------------------------------------------------------
  // TEST 5: Strict User Isolation (Zero Cross-Tenant Leakage)
  // --------------------------------------------------------------------------
  console.log('[TEST 5] Verifying Strict Multi-User Isolation & Anti-Leakage Firewall...');
  const bobId = 'cust-bob-adversary-002';
  // Bob queries Alice's exact private merchant and transaction text
  const bobSnoopResults = hybridRetrieve({
    customerId: bobId, // Bob's ID
    text: 'BESCOM Bangalore Electricity bill 1250 NEFT TECHCORP',
    topK: 5,
    minConfidence: 0.1, // Even with ultra-low confidence threshold
  });

  console.log(`  - Bob querying Alice's exact private record keywords: returned ${bobSnoopResults.length} chunks`);
  assert.strictEqual(bobSnoopResults.length, 0, 'Bob MUST retrieve ZERO chunks belonging to Alice!');

  const bobAnswer = generateRAGAnswer('What was my TechCorp salary payout?', bobId);
  assert.strictEqual(bobAnswer.citations.length, 0, 'Bob must receive zero citations for Alice documents');
  assert.strictEqual(bobAnswer.mode, 'general_guidance', 'Bob must get general guidance, not Alice records');
  console.log('  -> PASS: Strict user isolation confirmed with zero cross-tenant leakage.\n');

  console.log('================================================================');
  console.log('     ALL RAG & ASK VIV VERIFICATION SUITE CHECKS PASSED         ');
  console.log('================================================================');
}

runRAGAskVivAudit().catch((err) => {
  console.error('RAG Audit failed with error:', err);
  process.exit(1);
});
