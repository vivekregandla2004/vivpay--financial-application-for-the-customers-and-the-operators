/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt/i,
  /you\s+are\s+now\s+(an?\s+)?admin/i,
  /override\s+(all\s+)?security/i,
  /transfer\s+(\$|₹|eur|usd|inr)?\s*\d+/i,
  /execute\s+transaction/i,
  /delete\s+account/i,
  /elevate\s+role/i,
  /sudo\s+/i,
  /bypass\s+auth/i,
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/i,
];

/**
 * Sanitizes untrusted user inputs, transaction descriptions, or external document snippets
 * to prevent prompt injection and unauthorized command execution.
 */
export function sanitizePromptText(input: string): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input;

  // Mask potential Full PANs (13-19 digits)
  sanitized = sanitized.replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
      return `•••• •••• •••• ${digitsOnly.slice(-4)}`;
    }
    return match;
  });

  // Neutralize common prompt injection directives
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      sanitized = sanitized.replace(pattern, '[REDACTED_SECURITY_POLICY_OVERRIDE]');
    }
  }

  // Strip non-printable control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized.trim();
}

/**
 * Validates that an inquiry does not attempt unauthorized write actions (e.g. transfers, deletions)
 */
export function assertReadOnlyIntent(prompt: string): { isSafe: boolean; warning?: string } {
  const p = prompt.toLowerCase();

  const writePatterns = [
    /send\s+(\$|₹|\d)/,
    /transfer\s+(\$|₹|\d)/,
    /wire\s+(\$|₹|\d)/,
    /pay\s+(\$|₹|\d)/,
    /delete\s+my\s+account/,
    /close\s+my\s+account/,
    /change\s+my\s+password/,
  ];

  for (const pat of writePatterns) {
    if (pat.test(p)) {
      return {
        isSafe: false,
        warning: 'Viv is a read-only analytical intelligence engine. Automated funds movement, external wire transfers, and account credential mutations cannot be executed via chat.',
      };
    }
  }

  return { isSafe: true };
}
