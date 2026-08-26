/**
 * Security constraint (non-negotiable per spec): Stacks is NOT a secrets vault.
 * If input looks like a credential, we decline to file it rather than
 * transmitting it to the AI enrichment step.
 */

const CREDENTIAL_PATTERNS: RegExp[] = [
  // PEM private keys
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  // Common API key prefixes
  /\bsk-[A-Za-z0-9_-]{16,}\b/, // OpenAI-style
  /\bAKIA[0-9A-Z]{12,}\b/, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/, // GitHub tokens
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, // Slack tokens
  /\bAIza[0-9A-Za-z_-]{30,}\b/, // Google API keys
  /\bglpat-[A-Za-z0-9_-]{16,}\b/, // GitLab PATs
  // Labeled secrets ("password: hunter2", "api_key=...", "Authorization: Bearer ...")
  /\b(password|passwd|pwd|api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*\S+/i,
  /\bauthorization\s*:\s*bearer\b/i,
  // Long high-entropy hex or base64 blobs (likely tokens)
  /\b[A-Fa-f0-9]{40,}\b/,
];

export function looksLikeCredential(text: string): string | null {
  for (const pattern of CREDENTIAL_PATTERNS) {
    if (pattern.test(text)) {
      return "This looks like a password, API key, or other credential. Stacks isn't a secrets vault — saved notes get sent to an AI for enrichment, so please use a real password manager instead.";
    }
  }
  return null;
}
