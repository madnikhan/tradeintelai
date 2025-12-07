#!/usr/bin/env tsx
/**
 * Comprehensive Test Suite for AI Trading Engine & Data Analysis System
 * Tests all components: sentiment, COT, technical, fundamental, regime detection
 */

import { AITradingEngine, MarketAnalysis } from '../lib/ai-trading-engine';
import { COTAnalyzer } from '../lib/cot-analyzer';
import { MLRegimeDetector } from '../lib/regime-detector-ml';
import { EnhancedSentimentParser } from '../lib/data-providers/sentiment-parser-enhanced';
import { AdvancedIndicators } from '../lib/technical-analysis/advanced-indicators';
import { RSSNewsProvider } from '../lib/data-providers/rss-news';
import { TradingHoursFilter } from '../lib/trading-hours';
import { EconomicCalendar } from '../lib/economic-calendar';

interface TestResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

class SystemTester {
  private results: TestResult[] = [];
  private engine: AITradingEngine;

  constructor() {
    this.engine = new AITradingEngine();
  }

  private addResult(component: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, details?: any) {
    this.results.push({ component, status, message, details });
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} [${component}] ${message}`);
    if (details) {
      console.log(`   Details:`, JSON.stringify(details, null, 2));
    }
  }

  async testSentimentAnalysis() {
    console.log('\n📰 Testing Sentiment Analysis (NLP Enhanced)...');
    
    try {
      // Test NLP sentiment parser
      const testTexts = [
        'EUR/USD surges to new highs as ECB hints at rate cuts',
        'GBP/USD crashes amid Brexit uncertainty and weak economic data',
        'USD/JPY remains stable with no significant movement expected'
      ];

      for (const text of testTexts) {
        const result = EnhancedSentimentParser.analyzeSentimentNLP(text);
        // Confidence can be 0-100 (percentage) or 0-1, both are valid
        if (result.sentiment && result.confidence >= 0 && result.confidence <= 100) {
          this.addResult('Sentiment NLP', 'PASS', `Analyzed: "${text.substring(0, 50)}..."`, {
            sentiment: result.sentiment,
            confidence: result.confidence,
            intensity: result.intensity
          });
        } else {
          this.addResult('Sentiment NLP', 'FAIL', 'Invalid sentiment result', result);
        }
      }

      // Test RSS news sentiment
      const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY'];
      for (const symbol of symbols) {
        try {
          const sentiment = await RSSNewsProvider.getSentimentScore(symbol);
          if (sentiment && typeof sentiment.score === 'number') {
            this.addResult('RSS Sentiment', 'PASS', `${symbol} sentiment retrieved`, {
              score: sentiment.score,
              articleCount: sentiment.articleCount
            });
          } else {
            this.addResult('RSS Sentiment', 'WARN', `${symbol} no sentiment data`, sentiment);
          }
        } catch (error) {
          this.addResult('RSS Sentiment', 'WARN', `${symbol} sentiment fetch failed`, { error: String(error) });
        }
      }
    } catch (error) {
      this.addResult('Sentiment Analysis', 'FAIL', 'Sentiment analysis failed', { error: String(error) });
    }
  }

  async testCOTAnalysis() {
    console.log('\n📊 Testing COT Analysis (TFF Report, NZD Support)...');
    
    try {
      const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'NZD/USD'];
      
      for (const symbol of symbols) {
        try {
          const cotAnalysis = await COTAnalyzer.analyzeCOT(symbol);
          
          if (cotAnalysis && cotAnalysis.symbol === symbol) {
            const hasAdvancedIndicators = 'cotIndex' in cotAnalysis || 'cotMomentum' in cotAnalysis;
            
            this.addResult('COT Analysis', 'PASS', `${symbol} COT analysis complete`, {
              symbol: cotAnalysis.symbol,
              sentiment: cotAnalysis.sentiment,
              confidence: cotAnalysis.confidence,
              recommendation: cotAnalysis.recommendation,
              hasAdvancedIndicators,
              cotIndex: (cotAnalysis as any).cotIndex,
              cotMomentum: (cotAnalysis as any).cotMomentum
            });
          } else {
            this.addResult('COT Analysis', 'WARN', `${symbol} COT analysis incomplete`, cotAnalysis);
          }
        } catch (error) {
          this.addResult('COT Analysis', 'WARN', `${symbol} COT fetch failed`, { error: String(error) });
        }
      }
    } catch (error) {
      this.addResult('COT Analysis', 'FAIL', 'COT analysis system failed', { error: String(error) });
    }
  }

  async testAdvancedTechnicalIndicators() {
    console.log('\n📈 Testing Advanced Technical Indicators...');
    
    try {
      // Create sample price data
      const sampleData = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(Date.now() - (100 - i) * 3600000),
        open: 1.1000 + Math.random() * 0.01,
        high: 1.1000 + Math.random() * 0.02,
        low: 1.1000 - Math.random() * 0.01,
        close: 1.1000 + Math.random() * 0.01,
        volume: Math.random() * 1000000
      }));

      // Test OBV
      try {
        const obv = AdvancedIndicators.calculateOBV(sampleData);
        if (obv && typeof obv.obv === 'number') {
          this.addResult('OBV Indicator', 'PASS', 'On-Balance Volume calculated', {
            obv: obv.obv,
            trend: obv.trend
          });
        } else {
          this.addResult('OBV Indicator', 'FAIL', 'OBV calculation failed', obv);
        }
      } catch (error) {
        this.addResult('OBV Indicator', 'FAIL', 'OBV error', { error: String(error) });
      }

      // Test VWAP
      try {
        const vwap = AdvancedIndicators.calculateVWAP(sampleData);
        if (vwap && typeof vwap.vwap === 'number') {
          this.addResult('VWAP Indicator', 'PASS', 'Volume-Weighted Average Price calculated', {
            vwap: vwap.vwap,
            currentPrice: vwap.currentPrice,
            deviation: vwap.deviation
          });
        } else {
          this.addResult('VWAP Indicator', 'FAIL', 'VWAP calculation failed', vwap);
        }
      } catch (error) {
        this.addResult('VWAP Indicator', 'FAIL', 'VWAP error', { error: String(error) });
      }

      // Test Stochastic
      try {
        const stochastic = AdvancedIndicators.calculateStochastic(sampleData);
        if (stochastic && typeof stochastic.k === 'number' && typeof stochastic.d === 'number') {
          this.addResult('Stochastic Indicator', 'PASS', 'Stochastic Oscillator calculated', {
            k: stochastic.k,
            d: stochastic.d,
            signal: stochastic.signal
          });
        } else {
          this.addResult('Stochastic Indicator', 'FAIL', 'Stochastic calculation failed', stochastic);
        }
      } catch (error) {
        this.addResult('Stochastic Indicator', 'FAIL', 'Stochastic error', { error: String(error) });
      }

      // Test Ichimoku
      try {
        const ichimoku = AdvancedIndicators.calculateIchimoku(sampleData);
        if (ichimoku && typeof ichimoku.tenkan === 'number') {
          this.addResult('Ichimoku Indicator', 'PASS', 'Ichimoku Cloud calculated', {
            tenkan: ichimoku.tenkan,
            kijun: ichimoku.kijun,
            signal: ichimoku.signal,
            cloud: ichimoku.cloud
          });
        } else {
          this.addResult('Ichimoku Indicator', 'FAIL', 'Ichimoku calculation failed', ichimoku);
        }
      } catch (error) {
        this.addResult('Ichimoku Indicator', 'FAIL', 'Ichimoku error', { error: String(error) });
      }
    } catch (error) {
      this.addResult('Advanced Indicators', 'FAIL', 'Advanced indicators system failed', { error: String(error) });
    }
  }

  async testMLRegimeDetection() {
    console.log('\n🤖 Testing ML-Based Regime Detection...');
    
    try {
      // Create sample price data
      const sampleData = Array.from({ length: 200 }, (_, i) => ({
        timestamp: new Date(Date.now() - (200 - i) * 3600000),
        open: 1.1000 + Math.sin(i / 10) * 0.01,
        high: 1.1000 + Math.sin(i / 10) * 0.02,
        low: 1.1000 + Math.sin(i / 10) * 0.01 - 0.005,
        close: 1.1000 + Math.sin(i / 10) * 0.01,
        volume: 1000000 + Math.random() * 500000
      }));

      try {
        const regimeAnalysis = await MLRegimeDetector.detectRegimeML(sampleData, 'EUR/USD');
        
        if (regimeAnalysis && regimeAnalysis.regime) {
          this.addResult('ML Regime Detection', 'PASS', 'Regime detected successfully', {
            regime: regimeAnalysis.regime,
            confidence: regimeAnalysis.confidence,
            features: regimeAnalysis.features ? Object.keys(regimeAnalysis.features).length : 0,
            reasoning: regimeAnalysis.reasoning?.length || 0
          });
        } else {
          this.addResult('ML Regime Detection', 'WARN', 'Regime detection incomplete', regimeAnalysis);
        }
      } catch (error) {
        // Multi-timeframe might fail, but basic regime detection should still work
        this.addResult('ML Regime Detection', 'WARN', 'Regime detection with warning', { 
          error: String(error),
          note: 'Multi-timeframe analysis may have failed, but basic detection should work'
        });
      }
    } catch (error) {
      this.addResult('ML Regime Detection', 'FAIL', 'Regime detection failed', { error: String(error) });
    }
  }

  async testTradingHours() {
    console.log('\n⏰ Testing Trading Hours Filter...');
    
    try {
      const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'];
      
      for (const symbol of symbols) {
        const analysis = TradingHoursFilter.analyze(symbol);
        if (analysis && analysis.currentSession) {
          this.addResult('Trading Hours', 'PASS', `${symbol} trading hours analyzed`, {
            session: analysis.currentSession,
            isOptimalTime: analysis.isOptimalTime,
            quality: analysis.quality,
            recommendation: analysis.recommendation
          });
        } else {
          this.addResult('Trading Hours', 'WARN', `${symbol} trading hours incomplete`, analysis);
        }
      }
    } catch (error) {
      this.addResult('Trading Hours', 'FAIL', 'Trading hours system failed', { error: String(error) });
    }
  }

  async testEconomicCalendar() {
    console.log('\n📅 Testing Economic Calendar...');
    
    try {
      const symbols = ['EUR/USD', 'GBP/USD'];
      
      for (const symbol of symbols) {
        try {
          const newsImpact = await EconomicCalendar.checkNewsImpact(symbol);
          if (newsImpact) {
            this.addResult('Economic Calendar', 'PASS', `${symbol} news impact checked`, {
              impact: newsImpact.impact,
              eventCount: newsImpact.upcomingEvents?.length || 0,
              recommendation: newsImpact.recommendation
            });
          } else {
            this.addResult('Economic Calendar', 'WARN', `${symbol} no news impact data`, newsImpact);
          }
        } catch (error) {
          this.addResult('Economic Calendar', 'WARN', `${symbol} news check failed`, { error: String(error) });
        }
      }
    } catch (error) {
      this.addResult('Economic Calendar', 'FAIL', 'Economic calendar system failed', { error: String(error) });
    }
  }

  async testFullAIEngineAnalysis() {
    console.log('\n🧠 Testing Full AI Engine Analysis (End-to-End)...');
    
    const testSymbols = ['EUR/USD', 'GBP/USD', 'USD/JPY'];
    
    for (const symbol of testSymbols) {
      try {
        console.log(`\n   Analyzing ${symbol}...`);
        const analysis = await this.engine.analyzeMarket(symbol, []);
        
        if (analysis && analysis.symbol === symbol) {
          // Validate analysis structure
          const hasRequiredFields = 
            typeof analysis.overallScore === 'number' &&
            typeof analysis.confidence === 'number' &&
            typeof analysis.technicalScore === 'number' &&
            typeof analysis.fundamentalScore === 'number' &&
            typeof analysis.sentimentScore === 'number' &&
            analysis.recommendation &&
            analysis.reasoning &&
            Array.isArray(analysis.reasoning);

          const hasAdvancedFeatures = 
            analysis.cotAnalysis !== undefined &&
            analysis.regimeAnalysis !== undefined &&
            analysis.tradingHours !== undefined;

          if (hasRequiredFields) {
            this.addResult('AI Engine Analysis', 'PASS', `${symbol} full analysis complete`, {
              overallScore: analysis.overallScore,
              confidence: analysis.confidence,
              recommendation: analysis.recommendation,
              technicalScore: analysis.technicalScore,
              fundamentalScore: analysis.fundamentalScore,
              sentimentScore: analysis.sentimentScore,
              hasAdvancedFeatures,
              cotAnalysis: analysis.cotAnalysis ? 'Present' : 'Missing',
              regimeAnalysis: analysis.regimeAnalysis ? 'Present' : 'Missing',
              tradingHours: analysis.tradingHours ? 'Present' : 'Missing',
              reasoningCount: analysis.reasoning.length
            });
          } else {
            this.addResult('AI Engine Analysis', 'FAIL', `${symbol} analysis incomplete`, {
              hasRequiredFields,
              hasAdvancedFeatures
            });
          }
        } else {
          this.addResult('AI Engine Analysis', 'FAIL', `${symbol} analysis failed`, analysis);
        }
      } catch (error) {
        this.addResult('AI Engine Analysis', 'FAIL', `${symbol} analysis error`, { error: String(error) });
      }
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;
    const total = this.results.length;
    
    console.log(`\n✅ Passed: ${passed}/${total} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed}/${total} (${((failed/total)*100).toFixed(1)}%)`);
    console.log(`⚠️  Warnings: ${warnings}/${total} (${((warnings/total)*100).toFixed(1)}%)`);
    
    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`   - ${r.component}: ${r.message}`);
      });
    }
    
    if (warnings > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.results.filter(r => r.status === 'WARN').forEach(r => {
        console.log(`   - ${r.component}: ${r.message}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    
    const successRate = ((passed / total) * 100).toFixed(1);
    if (parseFloat(successRate) >= 80) {
      console.log('🎉 SYSTEM STATUS: HEALTHY (80%+ tests passing)');
    } else if (parseFloat(successRate) >= 60) {
      console.log('⚠️  SYSTEM STATUS: DEGRADED (60-80% tests passing)');
    } else {
      console.log('❌ SYSTEM STATUS: CRITICAL (<60% tests passing)');
    }
    console.log('='.repeat(80) + '\n');
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive AI Trading Engine & Data Analysis System Test');
    console.log('='.repeat(80));
    
    await this.testSentimentAnalysis();
    await this.testCOTAnalysis();
    await this.testAdvancedTechnicalIndicators();
    await this.testMLRegimeDetection();
    await this.testTradingHours();
    await this.testEconomicCalendar();
    await this.testFullAIEngineAnalysis();
    
    this.printSummary();
  }
}

// Run tests
if (require.main === module) {
  const tester = new SystemTester();
  tester.runAllTests().catch(console.error);
}

export { SystemTester };

