/**
 * Trading Hours Filter
 * Optimized for UK (GMT/BST) timezone
 */

export interface TradingSession {
  name: string;
  startHour: number; // UTC hour
  endHour: number;   // UTC hour
  bestPairs: string[];
  quality: 'PRIME' | 'GOOD' | 'AVERAGE' | 'POOR';
}

export interface TradingHoursAnalysis {
  currentSession: string;
  isOptimalTime: boolean;
  quality: 'PRIME' | 'GOOD' | 'AVERAGE' | 'POOR';
  recommendation: string;
  nextOptimalSession: string;
  hoursUntilOptimal: number;
  bestPairsNow: string[];
  warningMessage?: string;
}

// Trading sessions in UTC
const TRADING_SESSIONS: TradingSession[] = [
  {
    name: 'Sydney',
    startHour: 21, // 9 PM UTC (previous day)
    endHour: 6,    // 6 AM UTC
    bestPairs: ['AUDUSD', 'NZDUSD', 'AUDJPY', 'NZDJPY'],
    quality: 'AVERAGE',
  },
  {
    name: 'Tokyo',
    startHour: 0,  // 12 AM UTC
    endHour: 9,    // 9 AM UTC
    bestPairs: ['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY'],
    quality: 'GOOD',
  },
  {
    name: 'London',
    startHour: 8,  // 8 AM UTC
    endHour: 16,   // 4 PM UTC
    bestPairs: ['EURUSD', 'GBPUSD', 'EURGBP', 'USDCHF', 'EURJPY', 'GBPJPY'],
    quality: 'PRIME',
  },
  {
    name: 'New York',
    startHour: 13, // 1 PM UTC
    endHour: 22,   // 10 PM UTC
    bestPairs: ['EURUSD', 'GBPUSD', 'USDCAD', 'USDCHF', 'USDJPY'],
    quality: 'PRIME',
  },
];

// London-New York overlap (BEST time)
const OVERLAP_START = 13; // 1 PM UTC
const OVERLAP_END = 16;   // 4 PM UTC

export class TradingHoursFilter {
  
  /**
   * Analyze current trading conditions based on time
   */
  static analyze(symbol?: string): TradingHoursAnalysis {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcDay = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
    
    // Check for weekend
    if (utcDay === 0 || utcDay === 6) {
      return {
        currentSession: 'Weekend',
        isOptimalTime: false,
        quality: 'POOR',
        recommendation: 'Markets closed. Wait for Sunday 9 PM UTC.',
        nextOptimalSession: 'Sydney Open',
        hoursUntilOptimal: this.hoursUntilSundayOpen(now),
        bestPairsNow: [],
        warningMessage: '⚠️ Weekend - Forex markets are closed',
      };
    }
    
    // Check for Friday late session
    if (utcDay === 5 && utcHour >= 20) {
      return {
        currentSession: 'Friday Close',
        isOptimalTime: false,
        quality: 'POOR',
        recommendation: 'Avoid trading. Weekend gap risk.',
        nextOptimalSession: 'Monday London',
        hoursUntilOptimal: this.hoursUntilMondayLondon(now),
        bestPairsNow: [],
        warningMessage: '⚠️ Friday close - High weekend gap risk',
      };
    }
    
    // Check for London-New York overlap (BEST)
    if (utcHour >= OVERLAP_START && utcHour < OVERLAP_END) {
      return {
        currentSession: 'London-New York Overlap',
        isOptimalTime: true,
        quality: 'PRIME',
        recommendation: '🔥 PRIME TIME! Best liquidity and volatility.',
        nextOptimalSession: 'Current',
        hoursUntilOptimal: 0,
        bestPairsNow: ['EURUSD', 'GBPUSD', 'USDCHF', 'USDJPY', 'USDCAD'],
      };
    }
    
    // Check active sessions
    const activeSessions = this.getActiveSessions(utcHour);
    
    if (activeSessions.length === 0) {
      return {
        currentSession: 'Off-Hours',
        isOptimalTime: false,
        quality: 'POOR',
        recommendation: 'Low liquidity period. Consider waiting.',
        nextOptimalSession: this.getNextSession(utcHour),
        hoursUntilOptimal: this.hoursUntilNextSession(utcHour),
        bestPairsNow: [],
        warningMessage: '⚠️ Low liquidity - Wider spreads expected',
      };
    }
    
    // Get best session quality
    const bestSession = activeSessions.reduce((best, current) => 
      this.qualityScore(current.quality) > this.qualityScore(best.quality) ? current : best
    );
    
    // Collect best pairs from all active sessions
    const bestPairs = [...new Set(activeSessions.flatMap(s => s.bestPairs))];
    
    // Check if requested symbol is optimal for current session
    let warningMessage: string | undefined;
    if (symbol && !bestPairs.includes(symbol.toUpperCase())) {
      warningMessage = `⚠️ ${symbol} may have lower liquidity in current session`;
    }
    
    return {
      currentSession: activeSessions.map(s => s.name).join(' + '),
      isOptimalTime: bestSession.quality === 'PRIME' || bestSession.quality === 'GOOD',
      quality: bestSession.quality,
      recommendation: this.getRecommendation(bestSession.quality, activeSessions),
      nextOptimalSession: bestSession.quality === 'PRIME' ? 'Current' : 'London-NY Overlap',
      hoursUntilOptimal: bestSession.quality === 'PRIME' ? 0 : this.hoursUntilOverlap(utcHour),
      bestPairsNow: bestPairs,
      warningMessage,
    };
  }
  
  /**
   * Check if current time is good for trading a specific pair
   */
  static isGoodTimeForPair(symbol: string): { isGood: boolean; reason: string } {
    const analysis = this.analyze(symbol);
    const upperSymbol = symbol.toUpperCase();
    
    if (!analysis.isOptimalTime) {
      return {
        isGood: false,
        reason: analysis.warningMessage || 'Not optimal trading hours',
      };
    }
    
    if (analysis.bestPairsNow.includes(upperSymbol)) {
      return {
        isGood: true,
        reason: `${symbol} is optimal for ${analysis.currentSession}`,
      };
    }
    
    return {
      isGood: true, // Still tradeable, just not optimal
      reason: `Tradeable, but ${symbol} may have lower volume`,
    };
  }
  
  /**
   * Get trading score multiplier based on time
   * Used to adjust AI confidence scores
   */
  static getTimeMultiplier(symbol?: string): number {
    const analysis = this.analyze(symbol);
    
    switch (analysis.quality) {
      case 'PRIME': return 1.0;    // No adjustment
      case 'GOOD': return 0.9;     // Slight reduction
      case 'AVERAGE': return 0.75; // Moderate reduction
      case 'POOR': return 0.5;     // Significant reduction
      default: return 0.75;
    }
  }
  
  /**
   * Get UK-friendly time display
   */
  static getUKTime(): string {
    const now = new Date();
    return now.toLocaleTimeString('en-GB', { 
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  /**
   * Get next optimal trading window for UK
   */
  static getNextOptimalWindow(): { start: string; end: string; description: string } {
    const now = new Date();
    const ukHour = parseInt(now.toLocaleTimeString('en-GB', { 
      timeZone: 'Europe/London',
      hour: '2-digit',
      hour12: false,
    }));
    
    // If before London open
    if (ukHour < 8) {
      return {
        start: '08:00',
        end: '17:00',
        description: 'London Session',
      };
    }
    
    // If during London but before overlap
    if (ukHour >= 8 && ukHour < 13) {
      return {
        start: '13:00',
        end: '17:00',
        description: 'London-NY Overlap (BEST)',
      };
    }
    
    // If during overlap
    if (ukHour >= 13 && ukHour < 17) {
      return {
        start: 'NOW',
        end: '17:00',
        description: '🔥 PRIME TIME NOW!',
      };
    }
    
    // After London close
    return {
      start: '08:00 (tomorrow)',
      end: '17:00',
      description: 'London Session (tomorrow)',
    };
  }
  
  // Helper methods
  private static getActiveSessions(utcHour: number): TradingSession[] {
    return TRADING_SESSIONS.filter(session => {
      if (session.startHour < session.endHour) {
        return utcHour >= session.startHour && utcHour < session.endHour;
      } else {
        // Session crosses midnight
        return utcHour >= session.startHour || utcHour < session.endHour;
      }
    });
  }
  
  private static qualityScore(quality: string): number {
    switch (quality) {
      case 'PRIME': return 4;
      case 'GOOD': return 3;
      case 'AVERAGE': return 2;
      case 'POOR': return 1;
      default: return 0;
    }
  }
  
  private static getRecommendation(quality: string, sessions: TradingSession[]): string {
    const sessionNames = sessions.map(s => s.name).join(' & ');
    switch (quality) {
      case 'PRIME':
        return `✅ Excellent time to trade. ${sessionNames} active.`;
      case 'GOOD':
        return `👍 Good trading conditions. ${sessionNames} active.`;
      case 'AVERAGE':
        return `⚠️ Average conditions. Consider waiting for London/NY.`;
      case 'POOR':
        return `❌ Poor conditions. Wait for better session.`;
      default:
        return 'Check market conditions.';
    }
  }
  
  private static getNextSession(utcHour: number): string {
    if (utcHour < 8) return 'London (8:00 UTC)';
    if (utcHour < 13) return 'London-NY Overlap (13:00 UTC)';
    if (utcHour < 21) return 'Sydney (21:00 UTC)';
    return 'Tokyo (0:00 UTC)';
  }
  
  private static hoursUntilNextSession(utcHour: number): number {
    if (utcHour < 8) return 8 - utcHour;
    if (utcHour < 13) return 13 - utcHour;
    if (utcHour < 21) return 21 - utcHour;
    return 24 - utcHour; // Until Tokyo
  }
  
  private static hoursUntilOverlap(utcHour: number): number {
    if (utcHour < OVERLAP_START) return OVERLAP_START - utcHour;
    if (utcHour >= OVERLAP_END) return (24 - utcHour) + OVERLAP_START;
    return 0;
  }
  
  private static hoursUntilSundayOpen(now: Date): number {
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    
    if (day === 0) return 21 - hour; // Sunday, wait until 9 PM
    if (day === 6) return (24 - hour) + 21; // Saturday
    return 0;
  }
  
  private static hoursUntilMondayLondon(now: Date): number {
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    
    // Friday evening to Monday 8 AM
    const hoursLeftFriday = 24 - hour;
    const saturdayHours = 24;
    const sundayHours = 24;
    const mondayUntilLondon = 8;
    
    return hoursLeftFriday + saturdayHours + sundayHours + mondayUntilLondon;
  }
}

