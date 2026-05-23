import {
  getOpenAIKeyFingerprint,
  getOpenAIKeyFromEnv,
} from '@/lib/openai-key-fingerprint';
import type { AIHealthReason } from '@/lib/ai-types';

export type OpenAIHealthResult = {
  ok: boolean;
  message: string;
  httpStatus: number;
  reason: AIHealthReason;
  keyFingerprint: ReturnType<typeof getOpenAIKeyFingerprint>;
};

function classifyError(status: number, message: string): AIHealthReason {
  const lower = message.toLowerCase();
  if (status === 429 || lower.includes('quota') || lower.includes('rate limit')) return 'quota';
  if (status === 401 || isOpenAIKeyErrorMessage(message)) return 'auth';
  return 'error';
}

function isOpenAIKeyErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('incorrect api key') || lower.includes('invalid api key');
}

export async function checkOpenAIKeyHealth(): Promise<OpenAIHealthResult> {
  const apiKey = getOpenAIKeyFromEnv();
  const keyFingerprint = getOpenAIKeyFingerprint(process.env.OPENAI_API_KEY);

  if (!apiKey) {
    return {
      ok: false,
      message: 'OPENAI_API_KEY missing in .env.local',
      httpStatus: 500,
      reason: 'missing',
      keyFingerprint,
    };
  }

  if (keyFingerprint?.hasQuotes) {
    return {
      ok: false,
      message: 'OPENAI_API_KEY has quotes in .env.local — use unquoted value',
      httpStatus: 500,
      reason: 'missing',
      keyFingerprint,
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 0 },
    });

    if (response.ok) {
      return {
        ok: true,
        message: 'API key valid',
        httpStatus: 200,
        reason: 'ok',
        keyFingerprint,
      };
    }

    const text = await response.text();
    let message = `HTTP ${response.status}`;
    try {
      const data = JSON.parse(text);
      message = data?.error?.message || message;
    } catch {
      if (text) message = text.slice(0, 300);
    }

    return {
      ok: false,
      message,
      httpStatus: response.status,
      reason: classifyError(response.status, message),
      keyFingerprint,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return {
      ok: false,
      message,
      httpStatus: 500,
      reason: 'error',
      keyFingerprint,
    };
  }
}
