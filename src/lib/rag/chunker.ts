/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DocumentChunk, DocumentChunkMetadata } from './types.ts';
import { generateEmbedding } from './embeddings.ts';
import { CanonicalTransaction } from '../finance/types.ts';

export interface ChunkStatementInput {
  documentId: string;
  customerId: string;
  documentTitle: string;
  fileType?: string;
  accountNumberMasked?: string;
  statementPeriod?: string;
  transactions: CanonicalTransaction[];
  startingBalance?: number;
  endingBalance?: number;
}

/**
 * Ingests financial statements and decomposes them into semantic,
 * high-signal chunks with metadata and embeddings.
 */
export function chunkFinancialStatement(input: ChunkStatementInput): DocumentChunk[] {
  const {
    documentId,
    customerId,
    documentTitle,
    fileType = 'xlsx',
    accountNumberMasked = '••••',
    statementPeriod,
    transactions,
    startingBalance,
    endingBalance,
  } = input;

  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  // Calculate high-level aggregates
  const totalCredits = transactions
    .filter((t) => t.direction === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebits = transactions
    .filter((t) => t.direction === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  const netCashFlow = totalCredits - totalDebits;
  const dates = transactions
    .map((t) => t.date)
    .filter(Boolean)
    .sort();
  const dateRange = {
    start: dates[0] || 'Unknown',
    end: dates[dates.length - 1] || 'Unknown',
  };

  // 1. Executive Summary & Statement Metadata Chunk
  const metadataContent = [
    `Statement Document: ${documentTitle}`,
    `Account: ${accountNumberMasked}`,
    `Statement Period: ${statementPeriod || `${dateRange.start} to ${dateRange.end}`}`,
    `Total Transactions: ${transactions.length}`,
    `Total Inflow (Credits): ₹${totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `Total Outflow (Debits): ₹${totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    `Net Cash Flow: ₹${netCashFlow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    startingBalance !== undefined ? `Starting Balance: ₹${startingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : null,
    endingBalance !== undefined ? `Ending Closing Balance: ₹${endingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const metaChunk: DocumentChunk = {
    id: `chunk-${documentId}-${chunkIndex}`,
    documentId,
    customerId,
    chunkIndex: chunkIndex++,
    title: `${documentTitle} — Executive Summary & Metadata`,
    content: metadataContent,
    metadata: {
      fileType,
      dateRange,
      accountNumberMasked,
      totalCredits,
      totalDebits,
      rowCount: transactions.length,
      statementPeriod: statementPeriod || `${dateRange.start} to ${dateRange.end}`,
    },
    embedding: generateEmbedding(metadataContent),
    createdAt: new Date().toISOString(),
  };
  chunks.push(metaChunk);

  // 2. Category Aggregates Chunk
  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const t of transactions) {
    if (t.direction === 'debit') {
      const cat = t.category || 'General / Other';
      const prev = categoryMap.get(cat) || { total: 0, count: 0 };
      categoryMap.set(cat, { total: prev.total + t.amount, count: prev.count + 1 });
    }
  }

  const categoryEntries = Array.from(categoryMap.entries()).sort((a, b) => b[1].total - a[1].total);
  if (categoryEntries.length > 0) {
    const categoryContent = [
      `Expense Breakdown by Category for ${documentTitle}:`,
      ...categoryEntries.map(
        ([cat, data]) =>
          `- ${cat}: ₹${data.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })} across ${data.count} transaction(s)`
      ),
    ].join('\n');

    const catChunk: DocumentChunk = {
      id: `chunk-${documentId}-${chunkIndex}`,
      documentId,
      customerId,
      chunkIndex: chunkIndex++,
      title: `${documentTitle} — Category Breakdown`,
      content: categoryContent,
      metadata: {
        fileType,
        dateRange,
        accountNumberMasked,
        totalDebits,
        rowCount: categoryEntries.length,
      },
      embedding: generateEmbedding(categoryContent),
      createdAt: new Date().toISOString(),
    };
    chunks.push(catChunk);
  }

  // 3. Batch Transaction Chunks (5-7 transactions per chunk for dense semantic grounding)
  const BATCH_SIZE = 6;
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    const batchDateStart = batch[0].date;
    const batchDateEnd = batch[batch.length - 1].date;

    const txLines = batch.map((tx, idx) => {
      const typeStr = tx.direction.toUpperCase();
      const amtStr = `₹${tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      const merchant = tx.merchant ? ` [Merchant: ${tx.merchant}]` : '';
      const ref = tx.reference ? ` [Ref: ${tx.reference}]` : '';
      const bal = tx.balance !== null ? ` (Bal: ₹${tx.balance.toFixed(2)})` : '';
      return `${i + idx + 1}. [${tx.date}] ${typeStr} ${amtStr} - ${tx.description} | Cat: ${tx.category}${merchant}${ref}${bal}`;
    });

    const batchContent = [
      `Transactions (${i + 1} to ${i + batch.length}) from ${documentTitle} (${batchDateStart} to ${batchDateEnd}):`,
      ...txLines,
    ].join('\n');

    const batchChunk: DocumentChunk = {
      id: `chunk-${documentId}-${chunkIndex}`,
      documentId,
      customerId,
      chunkIndex: chunkIndex++,
      title: `${documentTitle} — Transactions [${i + 1}-${i + batch.length}]`,
      content: batchContent,
      metadata: {
        fileType,
        dateRange: { start: batchDateStart, end: batchDateEnd },
        accountNumberMasked,
        rowCount: batch.length,
      },
      embedding: generateEmbedding(batchContent),
      createdAt: new Date().toISOString(),
    };
    chunks.push(batchChunk);
  }

  return chunks;
}

/**
 * Decomposes unstructured or procedural documents (such as SOPs and policies) into semantic chunks.
 */
export function chunkDocument(
  documentId: string,
  customerId: string,
  title: string,
  content: string,
  metadata?: DocumentChunkMetadata
): DocumentChunk[] {
  const sections = content.split(/\n(?=Section\s+\d+:?)/i).filter((s) => s.trim().length > 0);
  const chunks: DocumentChunk[] = [];

  sections.forEach((section, idx) => {
    const chunkContent = `${title}\n${section.trim()}`;
    chunks.push({
      id: `chunk-${documentId}-${idx}`,
      documentId,
      customerId,
      chunkIndex: idx,
      title: `${title} — Section ${idx + 1}`,
      content: chunkContent,
      metadata: {
        fileType: 'Operations SOP',
        ...metadata,
      },
      embedding: generateEmbedding(chunkContent),
      createdAt: new Date().toISOString(),
    });
  });

  return chunks;
}
