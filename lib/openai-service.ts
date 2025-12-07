/**
 * OpenAI AI Service
 * Handles OpenAI-powered analysis explanations and insights
 */

import { MarketAnalysis } from './ai-trading-engine';
import { getAuth } from 'firebase/auth';
import { getApp } from './firebase/config';

interface GPTExplanation {
  summary: string;
  keyPoints: string[];
  riskFactors: string[];
  recommendation: string;
}

interface GPTResponse {
  explanation: GPTExplanation;
  rawText: string;
}

interface ChartAnalysis {
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

// ENHANCED: Comprehensive caching system
const explanationCache = new Map<string, { data: GPTResponse; timestamp: number }>();
const sentimentCache = new Map<string, { data: number; timestamp: number }>();
const chartAnalysisCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const SENTIMENT_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (sentiment changes slower)
const CHART_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (charts change faster)

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured(): boolean {
  // Check server-side only (client will call API route)
  if (typeof window === 'undefined') {
    return !!process.env.OPENAI_API_KEY;
  }
  // Client-side: always assume configured (will fail gracefully if not)
  return true;
}

/**
 * Get Firebase Auth token for API authentication
 * Returns null if not authenticated (client-side only)
 */
async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    // Server-side: no token needed (handled by API route)
    return null;
  }

  try {
    // Get Firebase app and auth instance
    const app = getApp();
    if (!app) {
      console.warn('⚠️ Firebase not initialized - OpenAI API calls will fail');
      return null;
    }

    const auth = getAuth(app);
    const user = auth.currentUser;
    
    if (!user) {
      console.warn('⚠️ User not authenticated - Please sign in to use AI features');
      throw new Error('User not authenticated. Please sign in to use AI features.');
    }
    
    // Get fresh ID token
    const token = await user.getIdToken(true); // Force refresh
    return token;
  } catch (error: any) {
    console.error('Failed to get auth token:', error);
    // Re-throw authentication errors so they can be handled by the caller
    if (error.message?.includes('not authenticated')) {
      throw error;
    }
    return null;
  }
}

/**
 * Generate OpenAI explanation for market analysis
 */
export async function generateAnalysisExplanation(
  analysis: MarketAnalysis,
  symbol: string
): Promise<GPTResponse | null> {
  if (!isOpenAIConfigured()) {
    console.warn('⚠️ OpenAI not configured - skipping AI explanation');
    return null;
  }

  // Check cache
  const cacheKey = `${symbol}_${analysis.overallScore}_${analysis.recommendation}`;
  const cached = explanationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Get auth token for API authentication
    let authToken: string | null = null;
    try {
      authToken = await getAuthToken();
    } catch (authError: any) {
      // If auth error, throw it with a user-friendly message
      throw new Error(authError.message || 'Authentication required. Please sign in to use AI features.');
    }

    if (!authToken) {
      throw new Error('User not authenticated. Please sign in to use AI features.');
    }

    // Build prompt
    const prompt = buildAnalysisPrompt(analysis, symbol);

    // Call OpenAI API via Next.js API route (with authentication)
    const response = await fetch('/api/openai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.1', // OpenAI GPT-5.1 model
        messages: [
          {
            role: 'system',
            content: 'You are an expert forex trading analyst. Provide clear, concise, and actionable market analysis explanations. Focus on practical insights traders can use.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_completion_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const errorMessage = errorData.error?.message || errorData.error || 'Unknown error';
      console.error('OpenAI API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      // Handle specific error cases
      if (response.status === 401) {
        throw new Error('Authentication failed. Please sign in again to use AI features.');
      }
      
      if (response.status === 429) {
        if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
          throw new Error('OpenAI quota exceeded. Please add billing details or credits to your OpenAI account at https://platform.openai.com/account/billing');
        } else {
          throw new Error('OpenAI rate limit exceeded. Please wait a few minutes and try again.');
        }
      }
      
      throw new Error(`OpenAI API error (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    const gptText = data.choices[0]?.message?.content || '';
    
    // Parse OpenAI response
    const explanation = parseGPTResponse(gptText, analysis);

    const result: GPTResponse = {
      explanation,
      rawText: gptText,
    };

    // Cache the result
    explanationCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  } catch (error: any) {
    console.error('❌ OpenAI explanation generation failed:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
    });
    return null;
  }
}

/**
 * Build prompt for OpenAI analysis
 */
function buildAnalysisPrompt(analysis: MarketAnalysis, symbol: string): string {
  const pair = symbol.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');
  
  return `Analyze this forex trading opportunity for ${pair}:

**Overall Score:** ${analysis.overallScore}/100
**Recommendation:** ${analysis.recommendation}
**Confidence:** ${analysis.confidence}%

**Technical Analysis Score:** ${analysis.technicalScore}/100
**Fundamental Analysis Score:** ${analysis.fundamentalScore}/100
**Sentiment Score:** ${analysis.sentimentScore}/100

**Risk Level:** ${analysis.riskLevel}
**Suggested Stop Loss:** ${analysis.suggestedStopLoss}
**Suggested Take Profit:** ${analysis.suggestedTakeProfit}
**Suggested Position Size:** ${analysis.suggestedPositionSize} lots

**Key Reasoning:**
${analysis.reasoning.map(r => `- ${r}`).join('\n')}

${analysis.detailedReasoning ? `
**Detailed Analysis:**
Technical: ${analysis.detailedReasoning.technical.join('; ')}
Fundamental: ${analysis.detailedReasoning.fundamental.join('; ')}
Sentiment: ${analysis.detailedReasoning.sentiment.join('; ')}
Risk: ${analysis.detailedReasoning.risk.join('; ')}
` : ''}

${analysis.cotAnalysis ? `
**COT Analysis:**
${analysis.cotAnalysis.reasoning || 'COT data analyzed'}
` : ''}

${analysis.regimeAnalysis ? `
**Market Regime:** ${analysis.regimeAnalysis.regime}
**Regime Confidence:** ${analysis.regimeAnalysis.confidence}%
` : ''}

Provide a clear, concise explanation in this format:

**Summary:** [1-2 sentence overview]

**Key Points:**
- [Point 1]
- [Point 2]
- [Point 3]

**Risk Factors:**
- [Risk 1]
- [Risk 2]

**Recommendation:** [Actionable trading recommendation]`;
}

/**
 * Parse OpenAI response into structured format
 */
function parseGPTResponse(text: string, analysis: MarketAnalysis): GPTExplanation {
  const pair = analysis.recommendation.includes('EUR') ? 'EUR/USD' : 'Currency pair';
  
  // Extract summary
  const summaryMatch = text.match(/\*\*Summary:\*\*\s*([\s\S]+?)(?=\*\*|$)/i);
  const summary = summaryMatch ? summaryMatch[1].trim() : `Based on the analysis, ${analysis.recommendation} is recommended with ${analysis.confidence}% confidence. Overall score: ${analysis.overallScore}/100.`;

  // Extract key points
  const keyPointsMatch = text.match(/\*\*Key Points:\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
  const keyPoints = keyPointsMatch
    ? keyPointsMatch[1]
        .split('\n')
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 5)
    : analysis.reasoning.slice(0, 3);

  // Extract risk factors
  const riskMatch = text.match(/\*\*Risk Factors:\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
  const riskFactors = riskMatch
    ? riskMatch[1]
        .split('\n')
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 3)
    : analysis.detailedReasoning?.risk?.slice(0, 2) || ['Market volatility', 'Unexpected news events'];

  // Extract recommendation
  const recommendationMatch = text.match(/\*\*Recommendation:\*\*\s*([\s\S]+?)(?=\*\*|$)/i);
  const recommendation = recommendationMatch
    ? recommendationMatch[1].trim()
    : `${analysis.recommendation} ${pair} with stop loss at ${analysis.suggestedStopLoss} and take profit at ${analysis.suggestedTakeProfit}.`;

  return {
    summary,
    keyPoints,
    riskFactors,
    recommendation,
  };
}

/**
 * Clear explanation cache
 */
export function clearExplanationCache(): void {
  explanationCache.clear();
}

/**
 * Generate enhanced sentiment analysis using OpenAI
 */
export async function enhanceSentimentAnalysis(newsArticles: string[]): Promise<number | null> {
  if (!isOpenAIConfigured() || newsArticles.length === 0) {
    return null;
  }

  try {
    // Get auth token for API authentication
    let authToken: string | null = null;
    try {
      authToken = await getAuthToken();
    } catch (authError) {
      // Fail silently for sentiment analysis if not authenticated
      return null;
    }

    if (!authToken) {
      return null; // Fail silently if not authenticated
    }

    // ENHANCED: Check cache first
    const cacheKey = newsArticles.slice(0, 3).join('|').substring(0, 100); // Use first 3 articles as key
    const cached = sentimentCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SENTIMENT_CACHE_DURATION) {
      return cached.data;
    }

    const articlesText = newsArticles.slice(0, 5).join('\n\n');
    const prompt = `Analyze the sentiment of these forex news articles. Provide a sentiment score from 0-100 where 50 is neutral, above 50 is bullish, and below 50 is bearish.

Articles:
${articlesText}

Provide:
1. Overall sentiment score (0-100, where 50 is neutral)
2. Brief explanation (1-2 sentences)

Format: "Score: X\nExplanation: Y"`;

    // Call OpenAI API via Next.js API route (with authentication)
    const response = await fetch('/api/openai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.1', // Use GPT-5.1 model
        messages: [
          {
            role: 'system',
            content: 'You are a forex market sentiment analyst. Analyze news sentiment and provide scores.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_completion_tokens: 150,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';
    
    const scoreMatch = text.match(/Score:\s*(\d+)/);
    const explanationMatch = text.match(/Explanation:\s*(.+)/);

    if (scoreMatch && explanationMatch) {
      const score = parseInt(scoreMatch[1], 10);
      
      // ENHANCED: Cache the result
      sentimentCache.set(cacheKey, {
        data: score,
        timestamp: Date.now(),
      });
      
      // Clean old cache entries (keep only last 100)
      if (sentimentCache.size > 100) {
        const oldestKey = sentimentCache.keys().next().value;
        sentimentCache.delete(oldestKey);
      }
      
      return score;
    }

    return null;
  } catch (error) {
    console.error('OpenAI sentiment enhancement failed:', error);
    return null;
  }
}

/**
 * Analyze chart image using OpenAI Vision
 */
export async function analyzeChartImage(
  imageBase64: string,
  symbol: string,
  timeframe: string,
  currentPrice?: number
): Promise<ChartAnalysis | null> {
  if (!isOpenAIConfigured()) {
    console.warn('⚠️ OpenAI not configured - skipping chart vision analysis');
    return null;
  }

  // Check cache
  const cacheKey = `chart_${symbol}_${timeframe}_${Math.floor(Date.now() / (5 * 60 * 1000))}`;
  const cached = explanationCache.get(cacheKey);
  if (cached && cached.data && 'chartAnalysis' in cached.data) {
    return cached.data.chartAnalysis as ChartAnalysis;
  }

  try {
    // Get auth token for API authentication
    let authToken: string | null = null;
    try {
      authToken = await getAuthToken();
    } catch (authError: any) {
      // If auth error, throw it with a user-friendly message
      throw new Error(authError.message || 'Authentication required. Please sign in to use AI features.');
    }

    if (!authToken) {
      throw new Error('User not authenticated. Please sign in to use AI features.');
    }

    const pair = symbol.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');
    const prompt = `Analyze this forex chart for ${pair} (${timeframe} timeframe).

Current Price: ${currentPrice || 'Not provided'}

Please identify and analyze:

1. **Chart Patterns:**
   - Head & shoulders, triangles, flags, pennants, wedges, etc.
   - Pattern completion status (forming, complete, broken)
   - Confidence level (0-100%)
   - Price level where pattern is located

2. **Support and Resistance Levels:**
   - Key support levels (price where buying pressure is strong)
   - Key resistance levels (price where selling pressure is strong)
   - Strength of each level (strong, moderate, weak)

3. **Trend Analysis:**
   - Overall trend direction (bullish, bearish, neutral)
   - Trend strength (0-100%)
   - Trend description

4. **Candlestick Patterns:**
   - Recent candlestick patterns (doji, hammer, engulfing, etc.)
   - Location on chart
   - Significance for trading

5. **Key Price Levels:**
   - Important price levels to watch
   - Breakout levels
   - Entry/exit suggestions

6. **Trading Recommendation:**
   - Overall assessment
   - Suggested action (BUY, SELL, HOLD)
   - Risk factors

Format your response as JSON with this structure:
{
  "patterns": [
    {
      "type": "pattern name",
      "confidence": 85,
      "description": "pattern description",
      "priceLevel": 1.0850
    }
  ],
  "supportResistance": {
    "support": [1.0800, 1.0750],
    "resistance": [1.0900, 1.0950]
  },
  "trend": {
    "direction": "bullish",
    "strength": 75,
    "description": "Strong upward trend"
  },
  "candlestickPatterns": [
    {
      "pattern": "bullish engulfing",
      "location": "near support",
      "significance": "potential reversal"
    }
  ],
  "recommendation": "BUY - Strong bullish pattern with support at 1.0800",
  "keyLevels": [
    {
      "level": 1.0850,
      "type": "resistance",
      "importance": "high"
    }
  ]
}`;

    // Call OpenAI API via Next.js API route (with authentication)
    const response = await fetch('/api/openai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.1', // GPT-5.1 with vision capabilities
        messages: [
          {
            role: 'system',
            content: 'You are an expert forex technical analyst specializing in chart pattern recognition. Analyze charts and provide detailed, accurate pattern identification and trading insights. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent pattern recognition
        max_completion_tokens: 1000,
        response_format: { type: 'json_object' }, // Force JSON response
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      const errorMessage = errorData.error?.message || errorData.message || 'Unknown error';
      console.error('OpenAI Vision API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      if (response.status === 429) {
        if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
          throw new Error('OpenAI quota exceeded. Please add billing details or credits to your OpenAI account at https://platform.openai.com/account/billing');
        } else {
          throw new Error('OpenAI rate limit exceeded. Please wait a few minutes and try again.');
        }
      }
      
      throw new Error(`OpenAI Vision API error (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    const jsonText = data.choices[0]?.message?.content || '{}';
    
    try {
      const chartAnalysis: ChartAnalysis = JSON.parse(jsonText);
      
      // Ensure all required fields have default values and correct types
      const sanitizedAnalysis: ChartAnalysis = {
        patterns: (chartAnalysis.patterns || []).map(pattern => ({
          ...pattern,
          confidence: typeof pattern.confidence === 'number' ? pattern.confidence : parseFloat(String(pattern.confidence)) || 0,
          priceLevel: pattern.priceLevel ? (typeof pattern.priceLevel === 'number' ? pattern.priceLevel : parseFloat(String(pattern.priceLevel))) : undefined,
        })),
        supportResistance: chartAnalysis.supportResistance ? {
          support: (chartAnalysis.supportResistance.support || [])
            .map(level => typeof level === 'number' ? level : parseFloat(String(level)))
            .filter(level => level > 0 && !isNaN(level)), // Filter out 0 and invalid values
          resistance: (chartAnalysis.supportResistance.resistance || [])
            .map(level => typeof level === 'number' ? level : parseFloat(String(level)))
            .filter(level => level > 0 && !isNaN(level)), // Filter out 0 and invalid values
        } : {
          support: [],
          resistance: [],
        },
        trend: chartAnalysis.trend ? {
          ...chartAnalysis.trend,
          strength: typeof chartAnalysis.trend.strength === 'number' ? chartAnalysis.trend.strength : parseFloat(String(chartAnalysis.trend.strength)) || 0,
        } : {
          direction: 'neutral',
          strength: 0,
          description: 'No trend data available',
        },
        candlestickPatterns: chartAnalysis.candlestickPatterns || [],
        recommendation: chartAnalysis.recommendation || 'No recommendation available',
        keyLevels: (chartAnalysis.keyLevels || []).map(level => ({
          ...level,
          level: typeof level.level === 'number' ? level.level : parseFloat(String(level.level)) || 0,
        })),
      };
      
      // Cache the result
      explanationCache.set(cacheKey, {
        data: { chartAnalysis: sanitizedAnalysis } as any,
        timestamp: Date.now(),
      });

      return sanitizedAnalysis;
    } catch (parseError) {
      console.error('Failed to parse chart analysis JSON:', parseError);
      console.error('Raw response:', jsonText);
      return null;
    }
  } catch (error: any) {
    console.error('❌ Chart vision analysis failed:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
    });
    return null;
  }
}

