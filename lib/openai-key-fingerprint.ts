export type OpenAIKeyFingerprint = {
  length: number;
  prefix: string;
  suffix: string;
  hasQuotes: boolean;
  hasWhitespace: boolean;
};

export function getOpenAIKeyFingerprint(rawKey: string | undefined): OpenAIKeyFingerprint | null {
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

export function getOpenAIKeyFromEnv(): string | undefined {
  const raw = process.env.OPENAI_API_KEY;
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

export function getOpenAITextModel(): string {
  return process.env.OPENAI_MODEL_TEXT?.trim() || 'gpt-4o-mini';
}

export function getOpenAIVisionModel(): string {
  return process.env.OPENAI_MODEL_VISION?.trim() || 'gpt-4o';
}
