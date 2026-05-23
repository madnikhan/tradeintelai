/**
 * Safe Gemini API key fingerprint for diagnostics (never exposes full key).
 */

export type GeminiKeyFingerprint = {
  length: number;
  prefix: string;
  suffix: string;
  hasQuotes: boolean;
  hasWhitespace: boolean;
};

export function getGeminiKeyFingerprint(rawKey: string | undefined): GeminiKeyFingerprint | null {
  if (!rawKey?.trim()) return null;

  const trimmed = rawKey.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;

  return {
    length: unquoted.length,
    prefix: unquoted.slice(0, 7),
    suffix: unquoted.slice(-4),
    hasQuotes: trimmed !== unquoted,
    hasWhitespace: /\s/.test(unquoted),
  };
}

export function getGeminiKeyFromEnv(): string | undefined {
  const raw = process.env.GEMINI_API_KEY;
  if (!raw?.trim()) return undefined;

  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function getGeminiTextModel(): string {
  return process.env.GEMINI_MODEL_TEXT?.trim() || 'gemini-2.0-flash';
}

export function getGeminiVisionModel(): string {
  return (
    process.env.GEMINI_MODEL_VISION?.trim() ||
    process.env.GEMINI_MODEL_TEXT?.trim() ||
    'gemini-2.0-flash'
  );
}
