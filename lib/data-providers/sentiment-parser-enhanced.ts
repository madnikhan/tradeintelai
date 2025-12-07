/**
 * Enhanced Sentiment Parser with Advanced NLP
 * Adds: Entity recognition, relevance scoring, time-weighted sentiment, context understanding
 */

import { SentimentParser, ArticleRelevance, TimeWeightedSentiment } from './sentiment-parser';

export class EnhancedSentimentParser {
  /**
   * Advanced NLP-based sentiment analysis with sentence-level parsing
   */
  static analyzeSentimentNLP(text: string): {
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
    intensity: number; // 0-100
    context: string[];
  } {
    // Split into sentences
    const sentences = this.splitIntoSentences(text);
    
    let totalPositive = 0;
    let totalNegative = 0;
    let totalIntensity = 0;
    const context: string[] = [];
    
    for (const sentence of sentences) {
      const sentenceAnalysis = this.analyzeSentence(sentence);
      
      if (sentenceAnalysis.sentiment === 'positive') {
        totalPositive += sentenceAnalysis.intensity;
        context.push(`Positive: ${sentence.substring(0, 50)}...`);
      } else if (sentenceAnalysis.sentiment === 'negative') {
        totalNegative += sentenceAnalysis.intensity;
        context.push(`Negative: ${sentence.substring(0, 50)}...`);
      }
      
      totalIntensity += sentenceAnalysis.intensity;
    }
    
    // Determine overall sentiment
    const totalScore = totalPositive + totalNegative;
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    let confidence = 0;
    const intensity = totalIntensity / sentences.length;
    
    if (totalScore === 0) {
      confidence = 0;
    } else if (totalPositive > totalNegative * 1.3) {
      sentiment = 'positive';
      confidence = Math.min(100, (totalPositive / totalScore) * 100);
    } else if (totalNegative > totalPositive * 1.3) {
      sentiment = 'negative';
      confidence = Math.min(100, (totalNegative / totalScore) * 100);
    } else {
      sentiment = 'neutral';
      confidence = 50 - Math.abs(totalPositive - totalNegative) / totalScore * 50;
    }
    
    return { sentiment, confidence: Math.round(confidence), intensity: Math.round(intensity), context };
  }

  /**
   * Analyze individual sentence with context understanding
   */
  private static analyzeSentence(sentence: string): {
    sentiment: 'positive' | 'negative' | 'neutral';
    intensity: number;
  } {
    const lowerSentence = sentence.toLowerCase();
    
    // Check for currency-specific context
    const currencyContext = this.extractCurrencyContext(lowerSentence);
    
    // Enhanced negation detection with context
    const negationPattern = /\b(not|no|never|neither|nor|none|nobody|nothing|without|lack|fail|unable|cannot|can't|won't|wouldn't|shouldn't|couldn't|isn't|aren't|wasn't|weren't)\b/gi;
    const hasNegation = negationPattern.test(lowerSentence);
    
    // Get base sentiment
    const baseSentiment = SentimentParser.analyzeSentiment(sentence);
    
    // Adjust for negation
    let sentiment = baseSentiment.sentiment;
    let intensity = baseSentiment.confidence;
    
    if (hasNegation && (sentiment === 'positive' || sentiment === 'negative')) {
      // Flip sentiment if negated
      sentiment = sentiment === 'positive' ? 'negative' : 'positive';
      intensity *= 0.8; // Reduce intensity for negated statements
    }
    
    // Boost intensity for currency-specific context
    if (currencyContext.found) {
      intensity = Math.min(100, intensity * 1.2);
    }
    
    return { sentiment, intensity: Math.round(intensity) };
  }

  /**
   * Extract currency context from sentence
   */
  private static extractCurrencyContext(text: string): {
    found: boolean;
    currency?: string;
    action?: string;
  } {
    const currencyPatterns = [
      /\b(usd|dollar|greenback)\b/gi,
      /\b(eur|euro)\b/gi,
      /\b(gbp|pound|sterling)\b/gi,
      /\b(jpy|yen)\b/gi,
      /\b(aud|aussie)\b/gi,
      /\b(cad|loonie)\b/gi,
      /\b(chf|swissie|swiss franc)\b/gi,
      /\b(nzd|kiwi)\b/gi,
    ];
    
    const actionPatterns = [
      /\b(rises?|gains?|strengthens?|climbs?|surges?|rallies?)\b/gi,
      /\b(falls?|drops?|weakens?|declines?|slumps?|plunges?)\b/gi,
    ];
    
    for (const pattern of currencyPatterns) {
      if (pattern.test(text)) {
        const currency = text.match(pattern)?.[0];
        const actionMatch = text.match(actionPatterns[0]) || text.match(actionPatterns[1]);
        return {
          found: true,
          currency: currency?.toUpperCase(),
          action: actionMatch?.[0],
        };
      }
    }
    
    return { found: false };
  }

  /**
   * Split text into sentences
   */
  private static splitIntoSentences(text: string): string[] {
    // Simple sentence splitting (can be enhanced)
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter very short fragments
  }

  /**
   * Entity Recognition - Extract relevant entities from text
   */
  static extractEntities(text: string, keywords: string[]): {
    entities: string[];
    currencyMentions: number;
    relevanceScore: number;
  } {
    const lowerText = text.toLowerCase();
    const entities: string[] = [];
    let currencyMentions = 0;
    
    // Extract currency mentions
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        entities.push(keyword);
        currencyMentions += matches.length;
      }
    }
    
    // Extract economic terms
    const economicTerms = [
      'interest rate', 'inflation', 'gdp', 'unemployment', 'cpi',
      'central bank', 'federal reserve', 'ecb', 'boe', 'boj',
      'monetary policy', 'fiscal policy', 'trade balance',
    ];
    
    for (const term of economicTerms) {
      if (lowerText.includes(term)) {
        entities.push(term);
      }
    }
    
    // Calculate relevance score (0-100)
    const keywordDensity = currencyMentions / Math.max(1, text.split(/\s+/).length) * 100;
    const entityCount = entities.length;
    const relevanceScore = Math.min(100, (keywordDensity * 2 + entityCount * 10));
    
    return {
      entities: [...new Set(entities)],
      currencyMentions,
      relevanceScore: Math.round(relevanceScore),
    };
  }

  /**
   * Calculate article relevance score
   */
  static calculateRelevance(
    article: { title: string; description: string },
    keywords: string[]
  ): ArticleRelevance {
    const text = `${article.title} ${article.description}`;
    const entityData = this.extractEntities(text, keywords);
    
    // Position-based scoring (title mentions are more important)
    const titleMentions = keywords.filter(k => 
      article.title.toLowerCase().includes(k.toLowerCase())
    ).length;
    
    const positionScore = titleMentions * 20; // Title mentions worth more
    
    // Keyword density
    const keywordDensity = entityData.currencyMentions / Math.max(1, text.split(/\s+/).length) * 1000;
    
    // Final relevance score
    const relevance = Math.min(100, entityData.relevanceScore + positionScore + keywordDensity);
    
    // Extract topics
    const topics = this.extractTopics(text);
    
    return {
      relevance: Math.round(relevance),
      entities: entityData.entities,
      topics,
      currencyMentions: entityData.currencyMentions,
    };
  }

  /**
   * Extract topics from text
   */
  private static extractTopics(text: string): string[] {
    const lowerText = text.toLowerCase();
    const topics: string[] = [];
    
    const topicPatterns: Record<string, string[]> = {
      'monetary policy': ['interest rate', 'monetary policy', 'central bank', 'fed', 'ecb', 'boe'],
      'inflation': ['inflation', 'cpi', 'price level', 'deflation'],
      'employment': ['unemployment', 'jobs', 'employment', 'labor market'],
      'growth': ['gdp', 'growth', 'economic growth', 'expansion'],
      'trade': ['trade balance', 'exports', 'imports', 'trade deficit'],
      'geopolitics': ['war', 'conflict', 'sanctions', 'trade war'],
    };
    
    for (const [topic, patterns] of Object.entries(topicPatterns)) {
      if (patterns.some(pattern => lowerText.includes(pattern))) {
        topics.push(topic);
      }
    }
    
    return topics;
  }

  /**
   * Time-weighted sentiment calculation
   */
  static calculateTimeWeightedSentiment(
    articles: Array<{ pubDate: string; sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>
  ): TimeWeightedSentiment {
    if (articles.length === 0) {
      return {
        current: 0,
        trend: 'stable',
        momentum: 0,
        volatility: 0,
      };
    }
    
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    
    // Calculate time-weighted scores
    let weightedSum = 0;
    let totalWeight = 0;
    const recentScores: number[] = [];
    
    for (const article of articles) {
      const articleDate = new Date(article.pubDate).getTime();
      const age = now - articleDate;
      
      // Exponential decay: recent articles weighted more
      // Weight = e^(-age / decay_constant)
      const decayConstant = oneDay; // 1 day half-life
      const weight = Math.exp(-age / decayConstant);
      
      // Convert sentiment to score
      let score = 0;
      if (article.sentiment === 'positive') score = article.confidence;
      else if (article.sentiment === 'negative') score = -article.confidence;
      
      weightedSum += score * weight;
      totalWeight += weight;
      
      // Track recent scores (last 7 days) for trend calculation
      if (age < oneWeek) {
        recentScores.push(score);
      }
    }
    
    const current = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
    
    // Calculate trend
    if (recentScores.length < 2) {
      return { current, trend: 'stable', momentum: 0, volatility: 0 };
    }
    
    // Split into two halves
    const mid = Math.floor(recentScores.length / 2);
    const older = recentScores.slice(0, mid);
    const newer = recentScores.slice(mid);
    
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const newerAvg = newer.reduce((a, b) => a + b, 0) / newer.length;
    
    const momentum = newerAvg - olderAvg;
    const trend: 'increasing' | 'decreasing' | 'stable' = 
      momentum > 5 ? 'increasing' : momentum < -5 ? 'decreasing' : 'stable';
    
    // Calculate volatility (standard deviation)
    const mean = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    const variance = recentScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / recentScores.length;
    const volatility = Math.min(100, Math.sqrt(variance) * 10);
    
    return {
      current: Math.round(current),
      trend,
      momentum: Math.round(momentum),
      volatility: Math.round(volatility),
    };
  }

  /**
   * Source credibility weighting
   */
  static getSourceCredibility(source: string): number {
    const credibilityMap: Record<string, number> = {
      'reuters': 95,
      'bloomberg': 95,
      'financial times': 90,
      'ft': 90,
      'wall street journal': 90,
      'wsj': 90,
      'cnbc': 85,
      'marketwatch': 80,
      'forexfactory': 75,
    };
    
    const lowerSource = source.toLowerCase();
    for (const [key, score] of Object.entries(credibilityMap)) {
      if (lowerSource.includes(key)) {
        return score;
      }
    }
    
    return 70; // Default credibility
  }
}

