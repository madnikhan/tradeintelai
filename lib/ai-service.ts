/**
 * Unified AI service facade — single import for the app.
 */

import type {
  AIChatBody,
  AIExplanationResponse,
  AIProviderId,
  ChartAnalysis,
  StructureAnalysis,
} from '@/lib/ai-types';
import type { MarketAnalysis } from '@/lib/ai-trading-engine';
import { getAIProviderLabel, getActiveProviderDisplayName } from '@/lib/ai-settings';
import { withProvider, getLastActiveProvider } from '@/lib/ai-router';
import { ensureGeminiAvailable, isGeminiAvailableSync } from '@/lib/gemini-circuit-breaker';
import { ensureOpenAIAvailable, isOpenAIAvailableSync } from '@/lib/openai-circuit-breaker';
import * as geminiService from '@/lib/gemini-service';
import * as openaiService from '@/lib/openai-service';
import { convertToStructureAnalysis } from '@/lib/ai-structure-analysis';

export type { ChartAnalysis, StructureAnalysis, AIExplanationResponse };

export function getActiveAIProvider(): AIProviderId | null {
  return getLastActiveProvider();
}

export function getActiveAIProviderLabel(): string {
  const active = getLastActiveProvider();
  if (active) return getActiveProviderDisplayName(active);
  return getAIProviderLabel();
}

export function isAIConfigured(): boolean {
  const setting = (typeof window !== 'undefined'
    ? localStorage.getItem('settings_ai_provider')
    : process.env.AI_PROVIDER) || 'auto';

  if (setting === 'gemini') {
    return typeof window === 'undefined'
      ? !!process.env.GEMINI_API_KEY?.trim()
      : isGeminiAvailableSync();
  }
  if (setting === 'openai') {
    return typeof window === 'undefined'
      ? !!process.env.OPENAI_API_KEY?.trim()
      : isOpenAIAvailableSync();
  }

  if (typeof window === 'undefined') {
    return !!process.env.GEMINI_API_KEY?.trim() || !!process.env.OPENAI_API_KEY?.trim();
  }
  return isGeminiAvailableSync() || isOpenAIAvailableSync();
}

export async function generateAnalysisExplanation(
  analysis: MarketAnalysis,
  symbol: string
): Promise<AIExplanationResponse | null> {
  const result = await withProvider({
    gemini: () => geminiService.generateAnalysisExplanation(analysis, symbol),
    openai: () => openaiService.generateAnalysisExplanation(analysis, symbol),
  });
  if (result && getLastActiveProvider()) {
    return { ...result, provider: getLastActiveProvider()! };
  }
  return result;
}

export async function enhanceSentimentAnalysis(newsArticles: string[]): Promise<number | null> {
  return withProvider({
    gemini: () => geminiService.enhanceSentimentAnalysis(newsArticles),
    openai: () => openaiService.enhanceSentimentAnalysis(newsArticles),
  });
}

export async function analyzeChartImage(
  imageBase64: string,
  symbol: string,
  timeframe: string,
  currentPrice?: number
): Promise<ChartAnalysis | null> {
  return withProvider({
    gemini: () => geminiService.analyzeChartImage(imageBase64, symbol, timeframe, currentPrice),
    openai: () => openaiService.analyzeChartImage(imageBase64, symbol, timeframe, currentPrice),
  });
}

export async function callAITextChat(
  body: AIChatBody,
  authToken?: string | null
): Promise<string | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return withProvider({
    gemini: async () => {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.text || '';
    },
    openai: async () => {
      const response = await fetch('/api/openai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.text || '';
    },
  });
}

export { convertToStructureAnalysis };

/** @deprecated Use convertToStructureAnalysis */
export const convertToGeminiStructureAnalysis = convertToStructureAnalysis;

/** @deprecated Use convertToStructureAnalysis */
export const convertToGPTStructureAnalysis = convertToStructureAnalysis;

export function clearExplanationCache(): void {
  geminiService.clearExplanationCache();
  openaiService.clearExplanationCache();
}

export async function ensureAIAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return !!process.env.GEMINI_API_KEY?.trim() || !!process.env.OPENAI_API_KEY?.trim();
  }

  const saved = localStorage.getItem('settings_ai_provider');
  if (saved === 'gemini') return ensureGeminiAvailable();
  if (saved === 'openai') return ensureOpenAIAvailable();

  const geminiOk = await ensureGeminiAvailable();
  if (geminiOk) return true;
  return ensureOpenAIAvailable();
}
