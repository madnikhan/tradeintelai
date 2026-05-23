/**
 * Server-side Gemini API key health check.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  getGeminiKeyFingerprint,
  getGeminiKeyFromEnv,
  getGeminiTextModel,
} from '@/lib/gemini-key-fingerprint';
import type { AIHealthReason } from '@/lib/ai-types';

export type GeminiHealthResult = {
  ok: boolean;
  message: string;
  httpStatus: number;
  reason: AIHealthReason;
  keyFingerprint: ReturnType<typeof getGeminiKeyFingerprint>;
};

function classifyGeminiError(message: string): AIHealthReason {
  const lower = message.toLowerCase();
  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
    return 'quota';
  }
  if (
    lower.includes('api key') ||
    lower.includes('permission') ||
    lower.includes('401')
  ) {
    return 'auth';
  }
  return 'error';
}

export async function checkGeminiKeyHealth(): Promise<GeminiHealthResult> {
  const apiKey = getGeminiKeyFromEnv();
  const keyFingerprint = getGeminiKeyFingerprint(process.env.GEMINI_API_KEY);

  if (!apiKey) {
    return {
      ok: false,
      message: 'GEMINI_API_KEY missing in .env.local',
      httpStatus: 500,
      reason: 'missing',
      keyFingerprint,
    };
  }

  if (keyFingerprint?.hasQuotes) {
    return {
      ok: false,
      message: 'GEMINI_API_KEY has quotes in .env.local',
      httpStatus: 500,
      reason: 'missing',
      keyFingerprint,
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: getGeminiTextModel() });
    const result = await model.generateContent('Reply with exactly: OK');
    const text = result.response.text()?.trim();

    if (text) {
      return {
        ok: true,
        message: 'API key valid',
        httpStatus: 200,
        reason: 'ok',
        keyFingerprint,
      };
    }

    return {
      ok: false,
      message: 'Gemini returned empty response',
      httpStatus: 502,
      reason: 'error',
      keyFingerprint,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    const reason = classifyGeminiError(message);
    return {
      ok: false,
      message,
      httpStatus: reason === 'quota' ? 429 : reason === 'auth' ? 401 : 500,
      reason,
      keyFingerprint,
    };
  }
}
