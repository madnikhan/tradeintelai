/**
 * Shared AI types used by Gemini, OpenAI, and the unified ai-service facade.
 */

export type AIProviderId = 'gemini' | 'openai';

export type AIHealthReason = 'ok' | 'missing' | 'auth' | 'quota' | 'error';

export interface AIExplanationContent {
  summary: string;
  keyPoints: string[];
  riskFactors: string[];
  recommendation: string;
}

export interface AIExplanationResponse {
  explanation: AIExplanationContent;
  rawText: string;
  provider?: AIProviderId;
}

export interface ChartAnalysis {
  patterns: {
    type: string;
    confidence: number;
    description: string;
    priceLevel?: number;
  }[];
  supportResistance: {
    support: number[];
    resistance: number[];
  };
  trend: {
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    description: string;
  };
  candlestickPatterns: {
    pattern: string;
    location: string;
    significance: string;
  }[];
  recommendation: string;
  keyLevels: {
    level: number;
    type: 'support' | 'resistance' | 'breakout';
    importance: 'high' | 'medium' | 'low';
  }[];
}

export interface StructureAnalysis {
  marketStructure: 'TREND_CONTINUATION' | 'REVERSAL' | 'RANGE' | 'INVALID';
  alignment: 'CONFIRMS' | 'CONTRADICTS' | 'NEUTRAL';
  confidence: number;
  trendStrength?: number;
  patterns: {
    type: string;
    confidence: number;
    priceLevel?: number;
  }[];
  supportResistance: {
    support: number[];
    resistance: number[];
  };
  reasoning: string;
}

export type AIChatBody = {
  mode?: 'text' | 'vision';
  system?: string;
  user: string;
  imageBase64?: string;
  json?: boolean;
};

export type AIHealthResponse = {
  ok: boolean;
  message: string;
  reason?: AIHealthReason;
  keyFingerprint?: {
    length: number;
    prefix: string;
    suffix: string;
    hasQuotes?: boolean;
    hasWhitespace?: boolean;
  } | null;
};
