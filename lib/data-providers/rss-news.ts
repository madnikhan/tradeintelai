/**
 * RSS News Provider
 * Aggregates news from multiple free RSS feeds
 * Replaces NewsData for news sentiment
 * Enhanced with improved keyword matching and sentiment parsing
 */

import { logger } from '@/lib/logger';
import { ParserMonitor } from './parser-monitor';
import { SentimentParser } from './sentiment-parser';
import { EnhancedSentimentParser } from './sentiment-parser-enhanced';

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

// Free RSS feeds for forex/financial news
const RSS_FEEDS = [
  {
    name: 'Reuters Business',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    category: 'business',
  },
  {
    name: 'Financial Times',
    url: 'https://www.ft.com/?format=rss',
    category: 'business',
  },
  {
    name: 'Bloomberg Markets',
    url: 'https://feeds.bloomberg.com/markets/news.rss',
    category: 'business',
  },
  {
    name: 'ForexFactory News',
    url: 'https://www.forexfactory.com/news.php?format=rss',
    category: 'forex',
  },
  {
    name: 'MarketWatch',
    url: 'https://feeds.marketwatch.com/marketwatch/marketpulse/',
    category: 'business',
  },
  {
    name: 'CNBC Markets',
    url: 'https://feeds.nbcnews.com/nbcnews/public/world',
    category: 'business',
  },
  {
    name: 'WSJ Markets',
    url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    category: 'business',
  },
];

export class RSSNewsProvider {
  private static cache: Map<string, { data: NewsArticle[]; timestamp: number }> = new Map();
  private static CACHE_TTL = 300000; // 5 minute cache

  /**
   * Parse RSS feed XML
   */
  private static parseRSSFeed(xmlText: string, sourceName: string): NewsArticle[] {
    const articles: NewsArticle[] = [];
    
    try {
      const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);
      
      for (const match of itemMatches) {
        const itemXml = match[1];
        
        // Extract title
        const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
        if (!titleMatch) continue;
        
        const title = (titleMatch[1] || titleMatch[2] || '').trim();
        
        // Extract description
        const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
        const description = (descMatch ? (descMatch[1] || descMatch[2] || '') : '').trim();
        
        // Extract pubDate
        const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
        const pubDate = dateMatch ? dateMatch[1] : new Date().toISOString();
        
        // Extract link
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
        const link = linkMatch ? linkMatch[1] : '';
        
        // Simple sentiment analysis
        const sentiment = this.analyzeSentiment(title + ' ' + description);
        
        articles.push({
          title,
          description,
          content: description,
          pubDate,
          source_id: sourceName.toLowerCase().replace(/\s+/g, '_'),
          source_url: link,
          category: ['business', 'forex'],
          country: [],
          language: 'en',
          sentiment,
        });
      }
    } catch (error) {
      logger.warn(`⚠️ Error parsing RSS feed from ${sourceName}:`, error);
    }
    
    return articles;
  }

  /**
   * Enhanced sentiment analysis using SentimentParser
   */
  private static analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const result = SentimentParser.analyzeSentiment(text);
    return result.sentiment;
  }

  /**
   * Get forex-related news from RSS feeds
   * Enhanced with performance monitoring
   */
  static async getForexNews(keywords?: string[]): Promise<NewsArticle[]> {
    const cacheKey = `forex_news_rss_${keywords?.join('_') || 'all'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const startTime = Date.now();
    try {
      const allArticles: NewsArticle[] = [];
      
      // Fetch RSS feeds via Next.js API route (bypasses CORS)
      const params = new URLSearchParams();
      if (keywords && keywords.length > 0) {
        params.append('keywords', keywords.join(','));
      }
      
      const apiUrl = `/api/rss/news${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const executionTime = Date.now() - startTime;
        ParserMonitor.recordExecution('RSS-News', false, executionTime, 0, `HTTP ${response.status}`);
        logger.warn(`⚠️ RSS News API error: ${response.status}`);
        return [];
      }

      const data = await response.json();
      if (!data.success || !data.feeds) {
        const executionTime = Date.now() - startTime;
        ParserMonitor.recordExecution('RSS-News', false, executionTime, 0, 'No data returned');
        logger.warn(`⚠️ RSS News API returned no data: ${JSON.stringify(data)}`);
        return [];
      }

      const successfulFeeds = data.feeds.filter((feed: any) => feed.success && feed.xml);
      logger.debug(`✅ RSS News API: ${successfulFeeds.length}/${data.feeds.length} feeds successful`);

      // Parse RSS feeds from API response
      const feedPromises = successfulFeeds
        .map(async (feed: any) => {
          const articles = this.parseRSSFeed(feed.xml, feed.name);
          
          // Use fuzzy matching for better keyword filtering
          if (keywords && keywords.length > 0) {
            return SentimentParser.filterRelevantArticles(articles, keywords);
          }
          
          return articles;
        });

      const feedResults = await Promise.all(feedPromises);
      feedResults.forEach(articles => {
        allArticles.push(...articles);
      });

      // Sort by date (newest first)
      allArticles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

      // Limit to 100 most recent articles (increased from 50)
      const limitedArticles = allArticles.slice(0, 100);

      const executionTime = Date.now() - startTime;
      ParserMonitor.recordExecution('RSS-News', true, executionTime, limitedArticles.length);

      this.cache.set(cacheKey, { data: limitedArticles, timestamp: Date.now() });
      logger.debug(`✅ RSS News: Loaded ${limitedArticles.length} news articles from ${successfulFeeds.length} sources in ${executionTime}ms`);
      
      return limitedArticles;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      ParserMonitor.recordExecution('RSS-News', false, executionTime, 0, error.message);
      logger.warn('⚠️ RSS News getForexNews error:', error);
      return [];
    }
  }

  /**
   * Get news for specific currency pair
   * Enhanced with better keyword extraction
   */
  static async getCurrencyNews(baseCurrency: string, quoteCurrency: string): Promise<NewsArticle[]> {
    // Use enhanced keyword extraction
    const keywords = SentimentParser.extractKeywords(baseCurrency, quoteCurrency);
    
    const startTime = Date.now();
    try {
      const articles = await this.getForexNews(keywords);
      
      // Filter articles using fuzzy matching
      const filtered = SentimentParser.filterRelevantArticles(articles, keywords);
      
      // Ensure all articles match NewsArticle interface
      const relevantArticles: NewsArticle[] = filtered.map(article => ({
        title: article.title || '',
        description: article.description || '',
        content: (article as NewsArticle).content || article.description || '',
        pubDate: (article as NewsArticle).pubDate || new Date().toISOString(),
        source_id: (article as NewsArticle).source_id || 'unknown',
        source_url: (article as NewsArticle).source_url || '',
        category: (article as NewsArticle).category || [],
        country: (article as NewsArticle).country || [],
        language: (article as NewsArticle).language || 'en',
        sentiment: (article as NewsArticle).sentiment,
      }));
      
      const executionTime = Date.now() - startTime;
      ParserMonitor.recordExecution('RSS-News', true, executionTime, relevantArticles.length);
      
      logger.debug(`✅ RSS News: Found ${relevantArticles.length} relevant articles for ${baseCurrency}${quoteCurrency} in ${executionTime}ms`);
      
      return relevantArticles;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      ParserMonitor.recordExecution('RSS-News', false, executionTime, 0, error.message);
      logger.warn('⚠️ RSS News getCurrencyNews error:', error);
      return [];
    }
  }

  /**
   * Calculate overall sentiment score from news
   * Enhanced with confidence scoring
   */
  static async getSentimentScore(symbol: string): Promise<{
    score: number; // -100 to 100
    bullish: number;
    bearish: number;
    neutral: number;
    articleCount: number;
    confidence: number; // 0-100
  }> {
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    
    const news = await this.getCurrencyNews(base, quote);
    
    if (news.length === 0) {
      return { 
        score: 0, 
        bullish: 0, 
        bearish: 0, 
        neutral: 100, 
        articleCount: 0,
        confidence: 0,
      };
    }
    
    // Extract keywords for relevance scoring
    const keywords = SentimentParser.extractKeywords(base, quote);
    
    // Filter articles by relevance and calculate time-weighted sentiment
    const relevantArticles = news
      .map(article => {
        const relevance = EnhancedSentimentParser.calculateRelevance(article, keywords);
        return { ...article, relevance };
      })
      .filter(article => article.relevance.relevance > 30) // Filter low-relevance articles
      .sort((a, b) => b.relevance.relevance - a.relevance.relevance); // Sort by relevance
    
    if (relevantArticles.length === 0) {
      return { 
        score: 0, 
        bullish: 0, 
        bearish: 0, 
        neutral: 100, 
        articleCount: 0,
        confidence: 0,
      };
    }
    
    // Analyze with enhanced NLP + GPT-5.1 (if available)
    const sentimentData = await Promise.all(relevantArticles.map(async (article) => {
      const text = `${article.title} ${article.description}`;
      const nlpResult = EnhancedSentimentParser.analyzeSentimentNLP(text);
      const sourceCredibility = EnhancedSentimentParser.getSourceCredibility(article.source_id);
      
      // Try GPT-5.1 enhancement for better accuracy
      let gptEnhancedSentiment: { sentiment: 'positive' | 'negative' | 'neutral'; confidence: number } | null = null;
      try {
        if (typeof window !== 'undefined') {
          const { enhanceSentimentAnalysis } = await import('@/lib/openai-service');
          const gptScore = await enhanceSentimentAnalysis([text]);
          if (gptScore !== null) {
            // Convert GPT score (0-100) to sentiment
            if (gptScore > 60) {
              gptEnhancedSentiment = { sentiment: 'positive', confidence: (gptScore - 50) * 2 };
            } else if (gptScore < 40) {
              gptEnhancedSentiment = { sentiment: 'negative', confidence: (50 - gptScore) * 2 };
            } else {
              gptEnhancedSentiment = { sentiment: 'neutral', confidence: 50 - Math.abs(gptScore - 50) * 2 };
            }
          }
        }
      } catch (error) {
        // GPT-5.1 unavailable, use NLP result only
        console.debug('GPT-5.1 sentiment enhancement unavailable, using NLP only');
      }
      
      // Combine NLP and GPT-5.1 results (weighted average)
      let finalSentiment = nlpResult.sentiment;
      let finalConfidence = nlpResult.confidence;
      
      if (gptEnhancedSentiment) {
        // Weight: 60% GPT-5.1, 40% NLP (GPT-5.1 is more accurate)
        const gptWeight = 0.6;
        const nlpWeight = 0.4;
        
        // Combine sentiments
        if (gptEnhancedSentiment.sentiment === nlpResult.sentiment) {
          // Same sentiment - increase confidence
          finalConfidence = (gptEnhancedSentiment.confidence * gptWeight) + (nlpResult.confidence * nlpWeight);
        } else {
          // Different sentiments - use GPT-5.1 as primary (more accurate)
          finalSentiment = gptEnhancedSentiment.sentiment;
          finalConfidence = (gptEnhancedSentiment.confidence * gptWeight) + (nlpResult.confidence * nlpWeight * 0.5);
        }
      }
      
      // Weight sentiment by relevance and source credibility
      const weight = (article.relevance.relevance / 100) * (sourceCredibility / 100);
      
      return {
        sentiment: finalSentiment,
        confidence: finalConfidence * weight,
        intensity: nlpResult.intensity,
        pubDate: article.pubDate,
        relevance: article.relevance.relevance,
      };
    }));
    
    // Calculate time-weighted sentiment
    const timeWeighted = EnhancedSentimentParser.calculateTimeWeightedSentiment(
      sentimentData.map(d => ({
        pubDate: d.pubDate,
        sentiment: d.sentiment,
        confidence: d.confidence,
      }))
    );
    
    // Count sentiments
    let bullish = 0;
    let bearish = 0;
    let neutral = 0;
    let totalConfidence = 0;
    
    for (const data of sentimentData) {
      switch (data.sentiment) {
        case 'positive':
          bullish++;
          totalConfidence += data.confidence;
          break;
        case 'negative':
          bearish++;
          totalConfidence += data.confidence;
          break;
        default:
          neutral++;
          totalConfidence += data.confidence;
      }
    }
    
    const total = sentimentData.length;
    
    // Use time-weighted score if available, otherwise use simple average
    const baseScore = timeWeighted.current !== 0 ? timeWeighted.current : ((bullish - bearish) / total) * 100;
    
    // ENHANCED: Adjust for trend and momentum with better weighting
    let adjustedScore = baseScore;
    if (timeWeighted.trend === 'increasing' && baseScore > 0) {
      adjustedScore += timeWeighted.momentum * 0.5;
    } else if (timeWeighted.trend === 'decreasing' && baseScore < 0) {
      adjustedScore += timeWeighted.momentum * 0.5;
    }
    
    // ENHANCED: Boost confidence if GPT-5.1 was used for most articles
    const gptEnhancedCount = sentimentData.filter(d => d.confidence > 70).length;
    const gptEnhancementRatio = total > 0 ? gptEnhancedCount / total : 0;
    
    // ENHANCED: Adjust score based on article quality and source credibility
    const avgRelevance = sentimentData.reduce((sum, d) => sum + d.relevance, 0) / total;
    const qualityMultiplier = 1 + (avgRelevance / 100) * 0.1; // Up to 10% boost for high relevance
    adjustedScore = adjustedScore * qualityMultiplier;
    
    // ENHANCED: Boost confidence if multiple high-quality sources agree
    const avgConfidence = total > 0 ? totalConfidence / total : 0;
    const enhancedConfidence = avgConfidence * (1 + gptEnhancementRatio * 0.2); // Up to 20% boost if GPT-5.1 used
    
    return {
      score: Math.round(Math.max(-100, Math.min(100, adjustedScore))),
      bullish: Math.round((bullish / total) * 100),
      bearish: Math.round((bearish / total) * 100),
      neutral: Math.round((neutral / total) * 100),
      articleCount: relevantArticles.length,
      confidence: Math.round(enhancedConfidence),
    };
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


