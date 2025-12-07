/**
 * NewsData.io API Integration
 * Provides news and sentiment analysis for forex markets
 */

import { logger } from '@/lib/logger';
import { callProxyAPI } from '@/lib/api-proxy-client';

interface NewsArticle {
  title: string;
  description: string;
  content: string;
  pubDate: string;
  source_id: string;
  source_url: string;
  category: string[];
  country: string[];
  language: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

interface NewsResponse {
  status: string;
  totalResults: number;
  results: NewsArticle[];
}

export class NewsDataProvider {
  private static cache: Map<string, { data: any; timestamp: number }> = new Map();
  private static CACHE_TTL = 300000; // 5 minute cache

  /**
   * Get forex-related news
   */
  static async getForexNews(keywords?: string[]): Promise<NewsArticle[]> {
    const cacheKey = `forex_news_${keywords?.join('_') || 'all'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    try {
      const query = keywords?.length 
        ? keywords.join(' OR ')
        : 'forex OR currency OR "central bank" OR "interest rate" OR EUR OR USD OR GBP';
      
      const response = await callProxyAPI('newsdata', 'news', {
        q: query,
        language: 'en',
        category: 'business',
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          logger.warn('⚠️ NewsData API: Authentication required. Please sign in.');
        } else if (response.status === 403) {
          logger.warn('⚠️ NewsData API: 403 Forbidden - API key may be invalid or expired. Please check your environment variables.');
        } else if (response.status === 429) {
          logger.warn('⚠️ NewsData API: 429 Too Many Requests - Rate limit exceeded. Consider reducing scan frequency or upgrading API plan.');
        } else {
          logger.warn(`⚠️ NewsData API error: ${response.status} ${response.statusText}`);
        }
        return [];
      }
      
      const data: NewsResponse = await response.json();
      
      if (data.status !== 'success' || !data.results) {
        return [];
      }
      
      // Add sentiment analysis
      const articlesWithSentiment = data.results.map(article => ({
        ...article,
        sentiment: this.analyzeSentiment(article.title + ' ' + (article.description || '')),
      }));
      
      this.cache.set(cacheKey, { data: articlesWithSentiment, timestamp: Date.now() });
      logger.debug(`✅ NewsData: Loaded ${articlesWithSentiment.length} news articles`);
      
      return articlesWithSentiment;
    } catch (error) {
      logger.warn('⚠️ NewsData getForexNews error:', error);
      return [];
    }
  }

  /**
   * Get news for specific currency pair
   */
  static async getCurrencyNews(baseCurrency: string, quoteCurrency: string): Promise<NewsArticle[]> {
    const keywords = [
      baseCurrency,
      quoteCurrency,
      `${baseCurrency}/${quoteCurrency}`,
      this.currencyToCountry(baseCurrency),
      this.currencyToCountry(quoteCurrency),
    ].filter(Boolean);
    
    return this.getForexNews(keywords);
  }

  /**
   * Calculate overall sentiment score from news
   */
  static async getSentimentScore(symbol: string): Promise<{
    score: number; // -100 to 100
    bullish: number;
    bearish: number;
    neutral: number;
    articleCount: number;
  }> {
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    
    const news = await this.getCurrencyNews(base, quote);
    
    if (news.length === 0) {
      return { score: 0, bullish: 0, bearish: 0, neutral: 100, articleCount: 0 };
    }
    
    let bullish = 0;
    let bearish = 0;
    let neutral = 0;
    
    for (const article of news) {
      switch (article.sentiment) {
        case 'positive':
          bullish++;
          break;
        case 'negative':
          bearish++;
          break;
        default:
          neutral++;
      }
    }
    
    const total = news.length;
    const score = ((bullish - bearish) / total) * 100;
    
    return {
      score: Math.round(score),
      bullish: Math.round((bullish / total) * 100),
      bearish: Math.round((bearish / total) * 100),
      neutral: Math.round((neutral / total) * 100),
      articleCount: total,
    };
  }

  /**
   * Simple sentiment analysis based on keywords
   */
  private static analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const lowerText = text.toLowerCase();
    
    const positiveWords = [
      'rise', 'rises', 'rising', 'gain', 'gains', 'up', 'higher', 'bullish',
      'strong', 'strength', 'rally', 'surge', 'boost', 'growth', 'positive',
      'improve', 'recovery', 'optimistic', 'beat', 'exceed', 'hawkish',
    ];
    
    const negativeWords = [
      'fall', 'falls', 'falling', 'drop', 'drops', 'down', 'lower', 'bearish',
      'weak', 'weakness', 'decline', 'slump', 'crash', 'loss', 'negative',
      'worsen', 'recession', 'pessimistic', 'miss', 'below', 'dovish',
      'crisis', 'concern', 'fear', 'risk',
    ];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const word of positiveWords) {
      if (lowerText.includes(word)) positiveCount++;
    }
    
    for (const word of negativeWords) {
      if (lowerText.includes(word)) negativeCount++;
    }
    
    if (positiveCount > negativeCount + 1) return 'positive';
    if (negativeCount > positiveCount + 1) return 'negative';
    return 'neutral';
  }

  /**
   * Map currency to country/region name
   */
  private static currencyToCountry(currency: string): string {
    const map: Record<string, string> = {
      'USD': 'United States',
      'EUR': 'European Union',
      'GBP': 'United Kingdom',
      'JPY': 'Japan',
      'AUD': 'Australia',
      'CAD': 'Canada',
      'CHF': 'Switzerland',
      'NZD': 'New Zealand',
    };
    return map[currency] || '';
  }
}

