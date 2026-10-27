/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

/**
 * Generate a cryptographically secure random salt
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash a password using PBKDF2 with SHA-512
 */
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
}

/**
 * Verify a plaintext password against a stored hash and salt in constant time
 */
export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const hash = hashPassword(password, salt);
  const hashBuffer = Buffer.from(hash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');
  if (hashBuffer.length !== storedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(hashBuffer, storedBuffer);
}

/**
 * Generate a secure session token (256-bit hex)
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a session token using SHA-256 for secure database lookup
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a deterministic checksum for transaction deduplication
 */
export function generateTransactionChecksum(
  customerId: string,
  accountId: string,
  date: string,
  amount: number,
  description: string
): string {
  const normalizedDesc = description.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedAmount = amount.toFixed(2);
  const raw = `${customerId}|${accountId}|${date}|${normalizedAmount}|${normalizedDesc}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Generate a unique ID (UUID v4)
 */
export function generateId(): string {
  return crypto.randomUUID();
}
