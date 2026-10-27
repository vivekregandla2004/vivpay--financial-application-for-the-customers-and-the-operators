/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const EMBEDDING_DIMENSION = 768;

/**
 * Computes dot product between two vectors
 */
export function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Computes Euclidean norm (L2) of a vector
 */
export function vectorNorm(v: number[]): number {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) {
    sumSq += v[i] * v[i];
  }
  return Math.sqrt(sumSq);
}

/**
 * Normalizes a vector to unit length (L2 norm = 1.0)
 */
export function normalizeVector(v: number[]): number {
  const norm = vectorNorm(v);
  if (norm < 1e-12) return 0;
  for (let i = 0; i < v.length; i++) {
    v[i] /= norm;
  }
  return norm;
}

/**
 * Computes cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  const dot = dotProduct(a, b);
  const normA = vectorNorm(a);
  const normB = vectorNorm(b);
  if (normA < 1e-12 || normB < 1e-12) return 0;
  return dot / (normA * normB);
}

/**
 * Tokenize and normalize text into tokens
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s₹$€]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Generate 32-bit FNV-1a hash
 */
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

/**
 * Generates deterministic 768-dimensional normalized semantic vector embedding.
 * Matches standard 768-dim space of text-embedding-004 while guaranteeing
 * offline testability, zero network latency, and reproducible cosine similarity.
 */
export function generateEmbedding(text: string): number[] {
  const embedding = new Array<number>(EMBEDDING_DIMENSION).fill(0);
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    // Return unit vector along first dimension if empty
    embedding[0] = 1.0;
    return embedding;
  }

  // Domain concept weight mapping for financial intelligence
  const financialConceptWeights: Record<string, number> = {
    balance: 2.5,
    income: 2.2,
    salary: 2.5,
    expense: 2.2,
    spending: 2.0,
    credit: 2.0,
    debit: 2.0,
    cashflow: 2.4,
    savings: 2.4,
    rate: 1.8,
    investment: 2.2,
    recurring: 2.2,
    subscription: 2.3,
    rent: 2.2,
    emi: 2.4,
    loan: 2.2,
    statement: 2.0,
    axis: 2.5,
    hdfc: 2.5,
    sbi: 2.5,
    phonepe: 2.5,
    paytm: 2.5,
    swiggy: 2.2,
    zomato: 2.2,
    netflix: 2.2,
    bescom: 2.2,
    flipkart: 2.2,
    blinkit: 2.2,
    emergency: 2.2,
    buffer: 2.0,
    goal: 2.2,
    target: 2.0,
  };

  const conceptSynonyms: Record<string, string> = {
    payroll: 'salary',
    compensation: 'salary',
    stipend: 'salary',
    spending: 'expense',
    outflow: 'expense',
    inflow: 'income',
    earnings: 'income',
    bills: 'utilities',
    electricity: 'utilities',
  };

  for (let i = 0; i < tokens.length; i++) {
    const rawToken = tokens[i];
    const token = conceptSynonyms[rawToken] || rawToken;
    const weight = financialConceptWeights[token] || financialConceptWeights[rawToken] || 1.0;

    // Hash token to primary indices in 768-dim space
    const hash1 = fnv1a(token);
    const idx1 = hash1 % EMBEDDING_DIMENSION;
    const sign1 = (hash1 & 0x1000) === 0 ? 1 : -1;
    embedding[idx1] += sign1 * weight;

    // Also project raw token if it had a synonym
    if (token !== rawToken) {
      const hashRaw = fnv1a(rawToken);
      const idxRaw = hashRaw % EMBEDDING_DIMENSION;
      const signRaw = (hashRaw & 0x1000) === 0 ? 1 : -1;
      embedding[idxRaw] += signRaw * weight * 0.7;
    }

    // Character 3-grams for morphological/stemming overlap
    if (token.length >= 3) {
      for (let j = 0; j <= token.length - 3; j++) {
        const tri = token.slice(j, j + 3);
        const hashTri = fnv1a(tri);
        const idxTri = hashTri % EMBEDDING_DIMENSION;
        const signTri = (hashTri & 0x2000) === 0 ? 1 : -1;
        embedding[idxTri] += signTri * 0.45 * weight;
      }
    }

    // Bi-gram tokens with previous word for phrase semantics
    if (i > 0) {
      const bigram = `${tokens[i - 1]}_${token}`;
      const hashBi = fnv1a(bigram);
      const idxBi = hashBi % EMBEDDING_DIMENSION;
      const signBi = (hashBi & 0x4000) === 0 ? 1 : -1;
      embedding[idxBi] += signBi * 0.8 * weight;
    }
  }

  // Normalize to unit length
  normalizeVector(embedding);

  return embedding;
}
