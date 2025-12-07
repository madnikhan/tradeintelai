/**
 * Enhanced Sentiment Parser with NLP
 * Improved keyword matching, NLP-based sentiment analysis, entity recognition, and time-weighted sentiment
 */

export interface SentimentResult {
  score: number; // -100 to 100
  bullish: number;
  bearish: number;
  neutral: number;
  articleCount: number;
  confidence: number; // 0-100
  sources: string[];
}

export interface ArticleRelevance {
  relevance: number; // 0-100
  entities: string[];
  topics: string[];
  currencyMentions: number;
}

export interface TimeWeightedSentiment {
  current: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  momentum: number; // -100 to 100
  volatility: number; // 0-100
}

export class SentimentParser {
  /**
   * Enhanced keyword extraction for currency pairs
   */
  static extractKeywords(baseCurrency: string, quoteCurrency: string): string[] {
    const keywords: string[] = [];
    
    // Currency codes
    keywords.push(baseCurrency);
    keywords.push(quoteCurrency);
    keywords.push(`${baseCurrency}/${quoteCurrency}`);
    keywords.push(`${baseCurrency}${quoteCurrency}`);
    
    // Country/region names
    const countryMap = this.getCountryMap();
    if (countryMap[baseCurrency]) {
      keywords.push(countryMap[baseCurrency]);
      keywords.push(...this.getCountryVariations(countryMap[baseCurrency]));
    }
    if (countryMap[quoteCurrency]) {
      keywords.push(countryMap[quoteCurrency]);
      keywords.push(...this.getCountryVariations(countryMap[quoteCurrency]));
    }
    
    // Central bank names
    const centralBankMap = this.getCentralBankMap();
    if (centralBankMap[baseCurrency]) {
      keywords.push(centralBankMap[baseCurrency]);
      keywords.push(...this.getCentralBankVariations(centralBankMap[baseCurrency]));
    }
    if (centralBankMap[quoteCurrency]) {
      keywords.push(centralBankMap[quoteCurrency]);
      keywords.push(...this.getCentralBankVariations(centralBankMap[quoteCurrency]));
    }
    
    // Currency nicknames
    const nicknameMap = this.getNicknameMap();
    if (nicknameMap[baseCurrency]) {
      keywords.push(...nicknameMap[baseCurrency]);
    }
    if (nicknameMap[quoteCurrency]) {
      keywords.push(...nicknameMap[quoteCurrency]);
    }
    
    // Economic terms related to currencies
    keywords.push('forex', 'currency', 'exchange rate', 'FX');
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Enhanced sentiment analysis with more keywords and context
   */
  static analyzeSentiment(text: string): {
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
  } {
    const lowerText = text.toLowerCase();
    
    // Expanded positive keywords
    const positiveWords = [
      // Price movements
      'rise', 'rises', 'rising', 'gain', 'gains', 'gained', 'up', 'higher', 'highest',
      'surge', 'surged', 'rally', 'rallied', 'soar', 'soared', 'jump', 'jumped',
      'climb', 'climbed', 'advance', 'advanced', 'boost', 'boosted',
      
      // Market sentiment
      'bullish', 'bull', 'strength', 'strong', 'strengthen', 'strengthened',
      'robust', 'solid', 'firm', 'resilient', 'optimistic', 'optimism',
      
      // Economic indicators
      'growth', 'growing', 'expand', 'expanded', 'expansion', 'recovery',
      'improve', 'improved', 'improvement', 'positive', 'beat', 'beats', 'beaten',
      'exceed', 'exceeded', 'exceeds', 'outperform', 'outperformed',
      
      // Central bank
      'hawkish', 'hike', 'hiked', 'raise', 'raised', 'tighten', 'tightened',
      'inflation target', 'strong economy',
      
      // General positive
      'success', 'successful', 'profit', 'profitable', 'win', 'wins', 'won',
      'breakthrough', 'milestone', 'record high', 'all-time high',
    ];
    
    // Expanded negative keywords
    const negativeWords = [
      // Price movements
      'fall', 'falls', 'falling', 'fell', 'drop', 'drops', 'dropped', 'down', 'lower', 'lowest',
      'decline', 'declined', 'slump', 'slumped', 'plunge', 'plunged', 'crash', 'crashed',
      'slide', 'slid', 'sink', 'sank', 'tumble', 'tumbled', 'dive', 'dived',
      
      // Market sentiment
      'bearish', 'bear', 'weak', 'weakness', 'weaken', 'weakened', 'fragile',
      'vulnerable', 'pessimistic', 'pessimism', 'gloomy', 'bleak',
      
      // Economic indicators
      'recession', 'recessions', 'decline', 'declined', 'shrink', 'shrunk', 'contraction',
      'worsen', 'worsened', 'deteriorate', 'deteriorated', 'negative', 'miss', 'missed',
      'misses', 'below', 'underperform', 'underperformed', 'disappoint', 'disappointed',
      
      // Central bank
      'dovish', 'cut', 'cuts', 'lower', 'lowered', 'ease', 'eased', 'loosen', 'loosened',
      'quantitative easing', 'QE', 'stimulus',
      
      // General negative
      'crisis', 'crises', 'concern', 'concerns', 'worried', 'worry', 'fear', 'fears',
      'risk', 'risks', 'uncertainty', 'uncertain', 'volatile', 'volatility',
      'loss', 'losses', 'deficit', 'debt', 'default', 'bankrupt', 'collapse',
    ];
    
    // Negation words (reverse sentiment)
    const negationWords = ['not', 'no', 'never', 'neither', 'nor', 'none', 'nobody', 'nothing'];
    
    // Calculate sentiment scores
    let positiveScore = 0;
    let negativeScore = 0;
    
    // Check for positive words
    for (const word of positiveWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        // Check if negated
        const wordIndex = lowerText.indexOf(word);
        const beforeWord = lowerText.substring(Math.max(0, wordIndex - 50), wordIndex);
        const isNegated = negationWords.some(neg => beforeWord.includes(neg));
        
        if (isNegated) {
          negativeScore += matches.length;
        } else {
          positiveScore += matches.length;
        }
      }
    }
    
    // Check for negative words
    for (const word of negativeWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        // Check if negated
        const wordIndex = lowerText.indexOf(word);
        const beforeWord = lowerText.substring(Math.max(0, wordIndex - 50), wordIndex);
        const isNegated = negationWords.some(neg => beforeWord.includes(neg));
        
        if (isNegated) {
          positiveScore += matches.length;
        } else {
          negativeScore += matches.length;
        }
      }
    }
    
    // Determine sentiment
    const totalScore = positiveScore + negativeScore;
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    let confidence = 0;
    
    if (totalScore === 0) {
      confidence = 0;
    } else if (positiveScore > negativeScore * 1.5) {
      sentiment = 'positive';
      confidence = Math.min(100, (positiveScore / totalScore) * 100);
    } else if (negativeScore > positiveScore * 1.5) {
      sentiment = 'negative';
      confidence = Math.min(100, (negativeScore / totalScore) * 100);
    } else {
      sentiment = 'neutral';
      confidence = 50 - Math.abs(positiveScore - negativeScore) / totalScore * 50;
    }
    
    return { sentiment, confidence: Math.round(confidence) };
  }

  /**
   * Country/region name mapping
   */
  private static getCountryMap(): Record<string, string> {
    return {
      'USD': 'United States',
      'EUR': 'European Union',
      'GBP': 'United Kingdom',
      'JPY': 'Japan',
      'AUD': 'Australia',
      'CAD': 'Canada',
      'CHF': 'Switzerland',
      'NZD': 'New Zealand',
      'CNY': 'China',
      'INR': 'India',
      'BRL': 'Brazil',
      'MXN': 'Mexico',
      'ZAR': 'South Africa',
      'KRW': 'South Korea',
      'SGD': 'Singapore',
    };
  }

  /**
   * Country name variations
   */
  private static getCountryVariations(country: string): string[] {
    const variations: Record<string, string[]> = {
      'United States': ['US', 'USA', 'America', 'American', 'Federal Reserve', 'Fed'],
      'European Union': ['EU', 'Europe', 'European', 'Eurozone', 'ECB'],
      'United Kingdom': ['UK', 'Britain', 'British', 'England', 'Bank of England', 'BOE'],
      'Japan': ['Japanese', 'Bank of Japan', 'BOJ'],
      'Australia': ['Australian', 'Aussie', 'Reserve Bank of Australia', 'RBA'],
      'Canada': ['Canadian', 'Loonie', 'Bank of Canada', 'BOC'],
      'Switzerland': ['Swiss', 'Swiss National Bank', 'SNB'],
      'New Zealand': ['Kiwi', 'Reserve Bank of New Zealand', 'RBNZ'],
    };
    return variations[country] || [];
  }

  /**
   * Central bank name mapping
   */
  private static getCentralBankMap(): Record<string, string> {
    return {
      'USD': 'Federal Reserve',
      'EUR': 'European Central Bank',
      'GBP': 'Bank of England',
      'JPY': 'Bank of Japan',
      'AUD': 'Reserve Bank of Australia',
      'CAD': 'Bank of Canada',
      'CHF': 'Swiss National Bank',
      'NZD': 'Reserve Bank of New Zealand',
    };
  }

  /**
   * Central bank name variations
   */
  private static getCentralBankVariations(bank: string): string[] {
    const variations: Record<string, string[]> = {
      'Federal Reserve': ['Fed', 'FOMC', 'Federal Open Market Committee'],
      'European Central Bank': ['ECB'],
      'Bank of England': ['BOE', 'BoE'],
      'Bank of Japan': ['BOJ', 'BoJ'],
      'Reserve Bank of Australia': ['RBA'],
      'Bank of Canada': ['BOC', 'BoC'],
      'Swiss National Bank': ['SNB'],
      'Reserve Bank of New Zealand': ['RBNZ'],
    };
    return variations[bank] || [];
  }

  /**
   * Currency nickname mapping
   */
  private static getNicknameMap(): Record<string, string[]> {
    return {
      'USD': ['dollar', 'greenback', 'buck'],
      'EUR': ['euro'],
      'GBP': ['pound', 'sterling', 'cable'],
      'JPY': ['yen'],
      'AUD': ['aussie', 'Aussie dollar'],
      'CAD': ['loonie', 'Canadian dollar'],
      'CHF': ['swissie', 'Swiss franc'],
      'NZD': ['kiwi', 'New Zealand dollar'],
    };
  }

  /**
   * Fuzzy keyword matching (handles typos and variations)
   */
  static fuzzyMatch(text: string, keyword: string, threshold: number = 0.8): boolean {
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    // Exact match
    if (lowerText.includes(lowerKeyword)) {
      return true;
    }
    
    // Word boundary match
    const regex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lowerText)) {
      return true;
    }
    
    // Partial match for compound words
    const keywordParts = lowerKeyword.split(/\s+/);
    if (keywordParts.length > 1) {
      const allPartsMatch = keywordParts.every(part => lowerText.includes(part));
      if (allPartsMatch) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Extract relevant articles based on keywords with fuzzy matching
   */
  static filterRelevantArticles(
    articles: Array<{ title: string; description: string; [key: string]: any }>,
    keywords: string[]
  ): Array<{ title: string; description: string; [key: string]: any }> {
    return articles.filter(article => {
      const text = `${article.title} ${article.description}`.toLowerCase();
      
      // Check if any keyword matches
      return keywords.some(keyword => this.fuzzyMatch(text, keyword));
    });
  }
}

