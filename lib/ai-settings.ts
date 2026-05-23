/**
 * AI provider preference (Settings UI + env default).
 */

export type AIProvider = 'gemini' | 'openai' | 'auto';

const STORAGE_KEY = 'settings_ai_provider';

function envDefault(): AIProvider {
  const raw = (process.env.AI_PROVIDER || 'auto').trim().toLowerCase();
  if (raw === 'gemini' || raw === 'openai' || raw === 'auto') {
    return raw;
  }
  return 'auto';
}

export function getAIProvider(): AIProvider {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'gemini' || saved === 'openai' || saved === 'auto') {
      return saved;
    }
  }
  return envDefault();
}

export function setAIProvider(provider: AIProvider): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, provider);
  }
}

export function getAIProviderLabel(provider?: AIProvider): string {
  const p = provider ?? getAIProvider();
  switch (p) {
    case 'gemini':
      return 'Gemini';
    case 'openai':
      return 'OpenAI';
    case 'auto':
    default:
      return 'Auto';
  }
}

export function getActiveProviderDisplayName(providerId: 'gemini' | 'openai' | null): string {
  if (providerId === 'gemini') return 'Gemini';
  if (providerId === 'openai') return 'OpenAI';
  return 'AI';
}
