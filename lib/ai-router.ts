/**
 * Route AI calls to Gemini, OpenAI, or Auto with fallback.
 */

import type { AIProviderId } from '@/lib/ai-types';
import { getAIProvider } from '@/lib/ai-settings';
import { ensureGeminiAvailable } from '@/lib/gemini-circuit-breaker';
import { ensureOpenAIAvailable } from '@/lib/openai-circuit-breaker';

let lastActiveProvider: AIProviderId | null = null;

export function getLastActiveProvider(): AIProviderId | null {
  return lastActiveProvider;
}

export function setLastActiveProvider(provider: AIProviderId | null): void {
  lastActiveProvider = provider;
}

function isFallbackableError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('401') ||
    msg.includes('api key') ||
    msg.includes('permission') ||
    msg.includes('unavailable')
  );
}

async function providerAvailable(id: AIProviderId): Promise<boolean> {
  if (typeof window === 'undefined') {
    if (id === 'gemini') return !!process.env.GEMINI_API_KEY?.trim();
    return !!process.env.OPENAI_API_KEY?.trim();
  }
  return id === 'gemini' ? ensureGeminiAvailable() : ensureOpenAIAvailable();
}

export async function withProvider<T>(
  fns: {
    gemini: () => Promise<T | null>;
    openai: () => Promise<T | null>;
  }
): Promise<T | null> {
  const setting = getAIProvider();
  const order: AIProviderId[] =
    setting === 'openai'
      ? ['openai']
      : setting === 'gemini'
        ? ['gemini']
        : ['gemini', 'openai'];

  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const isLast = i === order.length - 1;

    if (!(await providerAvailable(id))) {
      continue;
    }

    try {
      const result = id === 'gemini' ? await fns.gemini() : await fns.openai();
      if (result !== null) {
        setLastActiveProvider(id);
        return result;
      }
    } catch (error) {
      if (setting !== 'auto' || isLast || !isFallbackableError(error)) {
        throw error;
      }
    }
  }

  return null;
}
