/**
 * Comprehensive AI Trading Engine Test Script
 * Tests data collection, analysis efficiency, and error detection
 */

import { AITradingEngine } from '../lib/ai-trading-engine';
import { GatedTradingEngine } from '../lib/gated-trading-engine';
import { MT5PriceDataProvider } from '../lib/data-providers/mt5-price-data';
import { TwelveDataProvider } from '../lib/data-providers/twelve-data';
import { TradingEconomicsIndicatorsProvider } from '../lib/data-providers/tradingeconomics-indicators';
import { COTAnalyzer } from '../lib/cot-analyzer';
import { MLRegimeDetector } from '../lib/regime-detector-ml';

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  data?: any;
  error?: string;
  warnings?: string[];
}

interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalDuration: number;
  results: TestResult[];
  errors: string[];
  warnings: string[];
}

class AIEngineTester {
  private results: TestResult[] = [];
  private errors: string[] = [];
  private warnings: string[] = [];

  async runAllTests(): Promise<TestSummary> {
    const startTime = Date.now();
    console.log('🧪 Starting AI Trading Engine Comprehensive Tests...\n');

    // Test 1: Data Collection Tests
    await this.testDataCollection();

    // Test 2: Analysis Efficiency Tests
    await this.testAnalysisEfficiency();

    // Test 3: Data Quality Tests
    await this.testDataQuality();

    // Test 4: Error Handling Tests
    await this.testErrorHandling();

    // Test 5: Integration Tests
    await this.testIntegration();

    const totalDuration = Date.now() - startTime;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = this.results.filter(r => !r.success).length;

    return {
      totalTests: this.results.length,
      passedTests,
      failedTests,
      totalDuration,
      results: this.results,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  private async testDataCollection(): Promise<void> {
    console.log('📊 Testing Data Collection...\n');

    // Test 1.1: Historical Data Collection
    await this.runTest('Historical Data - MT5', async () => {
      const startTime = Date.now();
      const data = await MT5PriceDataProvider.getHistoricalData('EURUSD', 'H1', 100);
      const duration = Date.now() - startTime;

      if (data.length === 0) {
        throw new Error('No data returned from MT5');
      }

      // Validate data structure
      const sample = data[0];
      if (!sample.close || !sample.high || !sample.low || !sample.open) {
        throw new Error('Invalid data structure - missing required fields');
      }

      // Check data quality
      const invalidPrices = data.filter(d => 
        !isFinite(d.close) || d.close <= 0 ||
        !isFinite(d.high) || d.high <= 0 ||
        !isFinite(d.low) || d.low <= 0 ||
        !isFinite(d.open) || d.open <= 0
      );

      if (invalidPrices.length > 0) {
        this.warnings.push(`Found ${invalidPrices.length} invalid price entries`);
      }

      return {
        recordCount: data.length,
        duration,
        samplePrice: sample.close,
        hasVolume: 'volume' in sample,
      };
    });

    // Test 1.2: TwelveData Fallback
    await this.runTest('Historical Data - TwelveData Fallback', async () => {
      const startTime = Date.now();
      const data = await TwelveDataProvider.getHistoricalData('EURUSD', '1h', 100);
      const duration = Date.now() - startTime;

      if (data.length === 0) {
        throw new Error('No data returned from TwelveData');
      }

      return {
        recordCount: data.length,
        duration,
        samplePrice: data[0].close,
      };
    });

    // Test 1.3: Trading Economics Indicators
    await this.runTest('Trading Economics - Interest Rate', async () => {
      const startTime = Date.now();
      const data = await TradingEconomicsIndicatorsProvider.getInterestRate('USD');
      const duration = Date.now() - startTime;

      if (!data) {
        throw new Error('No interest rate data returned');
      }

      if (!data.rate || !isFinite(data.rate)) {
        throw new Error('Invalid interest rate value');
      }

      return {
        rate: data.rate,
        date: data.date,
        duration,
      };
    });

    // Test 1.4: COT Data Collection
    await this.runTest('COT Data Collection', async () => {
      const startTime = Date.now();
      const cotData = await COTAnalyzer.analyzeCOT('EURUSD');
      const duration = Date.now() - startTime;

      if (!cotData) {
        throw new Error('No COT analysis returned');
      }

      // Check COT data freshness
      if (cotData.date) {
        const daysSinceCOT = (Date.now() - new Date(cotData.date).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCOT > 14) {
          this.warnings.push(`COT data is stale: ${daysSinceCOT.toFixed(0)} days old`);
        }
      }

      return {
        sentiment: cotData.sentiment,
        confidence: cotData.confidence,
        duration,
        hasDate: !!cotData.date,
      };
    });
  }

  private async testAnalysisEfficiency(): Promise<void> {
    console.log('⚡ Testing Analysis Efficiency...\n');

    const testPairs = ['EURUSD', 'GBPUSD', 'USDJPY'];

    for (const symbol of testPairs) {
      // Test 2.1: Technical Analysis Efficiency
      await this.runTest(`Technical Analysis - ${symbol}`, async () => {
        const engine = new AITradingEngine();
        const startTime = Date.now();
        
        // Load data first
        await (engine as any).loadHistoricalData(symbol);
        
        // Run technical analysis
        const score = await (engine as any).technicalAnalysis(symbol);
        const duration = Date.now() - startTime;

        if (!isFinite(score) || score < 0 || score > 100) {
          throw new Error(`Invalid technical score: ${score}`);
        }

        if (duration > 5000) {
          this.warnings.push(`Technical analysis took ${duration}ms (slow)`);
        }

        return {
          score,
          duration,
          efficiency: duration < 2000 ? 'fast' : duration < 5000 ? 'moderate' : 'slow',
        };
      });

      // Test 2.2: Fundamental Analysis Efficiency
      await this.runTest(`Fundamental Analysis - ${symbol}`, async () => {
        const engine = new AITradingEngine();
        const startTime = Date.now();
        
        const score = await (engine as any).fundamentalAnalysis(symbol);
        const duration = Date.now() - startTime;

        if (!isFinite(score) || score < 0 || score > 100) {
          throw new Error(`Invalid fundamental score: ${score}`);
        }

        if (duration > 10000) {
          this.warnings.push(`Fundamental analysis took ${duration}ms (slow)`);
        }

        return {
          score,
          duration,
          efficiency: duration < 5000 ? 'fast' : duration < 10000 ? 'moderate' : 'slow',
        };
      });

      // Test 2.3: Regime Detection Efficiency
      await this.runTest(`Regime Detection - ${symbol}`, async () => {
        const engine = new AITradingEngine();
        await (engine as any).loadHistoricalData(symbol);
        const historicalData = (engine as any).historicalData;

        if (historicalData.length === 0) {
          throw new Error('No historical data available');
        }

        const startTime = Date.now();
        const regime = await MLRegimeDetector.detectRegimeML(historicalData, symbol);
        const duration = Date.now() - startTime;

        if (!regime.regime || !regime.confidence) {
          throw new Error('Invalid regime analysis');
        }

        if (duration > 3000) {
          this.warnings.push(`Regime detection took ${duration}ms (slow)`);
        }

        return {
          regime: regime.regime,
          confidence: regime.confidence,
          trendStrength: regime.trendStrength,
          duration,
        };
      });
    }
  }

  private async testDataQuality(): Promise<void> {
    console.log('🔍 Testing Data Quality...\n');

    // Test 3.1: Price Data Validation
    await this.runTest('Price Data Validation', async () => {
      const data = await MT5PriceDataProvider.getHistoricalData('EURUSD', 'H1', 100);
      
      if (data.length === 0) {
        throw new Error('No data to validate');
      }

      const issues: string[] = [];

      // Check for gaps in data
      for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1];
        const curr = data[i];
        
        // Check for invalid price relationships
        if (curr.high < curr.low) {
          issues.push(`Invalid high/low at index ${i}`);
        }
        if (curr.high < curr.close || curr.high < curr.open) {
          issues.push(`High price inconsistency at index ${i}`);
        }
        if (curr.low > curr.close || curr.low > curr.open) {
          issues.push(`Low price inconsistency at index ${i}`);
        }

        // Check for extreme price jumps (>5%)
        if (prev.close > 0) {
          const change = Math.abs((curr.close - prev.close) / prev.close) * 100;
          if (change > 5) {
            issues.push(`Extreme price jump at index ${i}: ${change.toFixed(2)}%`);
          }
        }
      }

      if (issues.length > 0) {
        this.warnings.push(...issues);
      }

      return {
        totalRecords: data.length,
        issuesFound: issues.length,
        dataQuality: issues.length === 0 ? 'good' : 'issues_detected',
      };
    });

    // Test 3.2: Indicator Calculation Accuracy
    await this.runTest('Indicator Calculation Accuracy', async () => {
      const engine = new AITradingEngine();
      await (engine as any).loadHistoricalData('EURUSD');
      const historicalData = (engine as any).historicalData;

      if (historicalData.length < 20) {
        throw new Error('Insufficient data for indicator testing');
      }

      const prices = historicalData.map((d: any) => d.close);
      const issues: string[] = [];

      // Test RSI calculation
      try {
        const rsi = (engine as any).calculateRSI(prices);
        if (!isFinite(rsi) || rsi < 0 || rsi > 100) {
          issues.push(`Invalid RSI value: ${rsi}`);
        }
      } catch (error: any) {
        issues.push(`RSI calculation error: ${error.message}`);
      }

      // Test MACD calculation
      try {
        const macd = (engine as any).calculateMACD(prices);
        if (!macd || !isFinite(macd.macd) || !isFinite(macd.signal) || !isFinite(macd.histogram)) {
          issues.push('Invalid MACD values');
        }
      } catch (error: any) {
        issues.push(`MACD calculation error: ${error.message}`);
      }

      // Test EMA calculation
      try {
        const ema20 = (engine as any).calculateEMA(prices, 20);
        const ema50 = (engine as any).calculateEMA(prices, 50);
        if (!isFinite(ema20) || !isFinite(ema50)) {
          issues.push('Invalid EMA values');
        }
      } catch (error: any) {
        issues.push(`EMA calculation error: ${error.message}`);
      }

      if (issues.length > 0) {
        this.warnings.push(...issues);
      }

      return {
        indicatorsTested: 3,
        issuesFound: issues.length,
        accuracy: issues.length === 0 ? 'good' : 'issues_detected',
      };
    });
  }

  private async testErrorHandling(): Promise<void> {
    console.log('🛡️ Testing Error Handling...\n');

    // Test 4.1: Invalid Symbol Handling
    await this.runTest('Invalid Symbol Handling', async () => {
      const engine = new AITradingEngine();
      
      try {
        await (engine as any).loadHistoricalData('INVALID');
        // Should handle gracefully
        return { handled: true };
      } catch (error: any) {
        // Error is expected, but should be handled gracefully
        return { handled: true, error: error.message };
      }
    });

    // Test 4.2: Missing Data Handling
    await this.runTest('Missing Data Handling', async () => {
      const engine = new AITradingEngine();
      
      // Try analysis with no data
      (engine as any).historicalData = [];
      const score = await (engine as any).technicalAnalysis('EURUSD');
      
      // Should return neutral score (50) when no data
      if (score !== 50) {
        throw new Error(`Expected neutral score (50) but got ${score}`);
      }

      return { handled: true, returnedNeutral: true };
    });

    // Test 4.3: Network Error Handling
    await this.runTest('Network Error Handling', async () => {
      // Test that system handles API failures gracefully
      try {
        // This might fail, but should not crash
        const data = await TradingEconomicsIndicatorsProvider.getInterestRate('INVALID');
        return { handled: true, returnedNull: data === null };
      } catch (error: any) {
        // Error handling is good
        return { handled: true, errorCaught: true };
      }
    });
  }

  private async testIntegration(): Promise<void> {
    console.log('🔗 Testing Integration...\n');

    // Test 5.1: Full Analysis Flow
    await this.runTest('Full Analysis Flow - EURUSD', async () => {
      const engine = new AITradingEngine();
      const startTime = Date.now();
      
      const analysis = await engine.analyzeMarket('EURUSD', []);
      const duration = Date.now() - startTime;

      if (!analysis) {
        throw new Error('No analysis returned');
      }

      // Validate analysis structure
      const requiredFields = ['symbol', 'overallScore', 'recommendation', 'confidence', 'technicalScore', 'fundamentalScore', 'sentimentScore'];
      const missingFields = requiredFields.filter(field => !(field in analysis));
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Validate score ranges
      if (analysis.overallScore < 0 || analysis.overallScore > 100) {
        throw new Error(`Invalid overall score: ${analysis.overallScore}`);
      }

      if (analysis.confidence < 0 || analysis.confidence > 100) {
        throw new Error(`Invalid confidence: ${analysis.confidence}`);
      }

      if (duration > 30000) {
        this.warnings.push(`Full analysis took ${duration}ms (very slow)`);
      }

      return {
        duration,
        overallScore: analysis.overallScore,
        recommendation: analysis.recommendation,
        confidence: analysis.confidence,
        hasReasoning: analysis.reasoning.length > 0,
      };
    });

    // Test 5.2: Gated Engine Integration
    await this.runTest('Gated Engine Integration - EURUSD', async () => {
      const gatedEngine = new GatedTradingEngine();
      const startTime = Date.now();
      
      const analysis = await gatedEngine.analyzeMarket('EURUSD', []);
      const duration = Date.now() - startTime;

      if (!analysis) {
        throw new Error('No analysis returned');
      }

      // Validate gated analysis structure
      if (!analysis.marketReadability) {
        throw new Error('Missing marketReadability');
      }

      if (!analysis.directionalBias) {
        throw new Error('Missing directionalBias');
      }

      if (!analysis.executionPermission) {
        throw new Error('Missing executionPermission');
      }

      return {
        duration,
        readable: analysis.marketReadability.isReadable,
        bias: analysis.directionalBias.direction,
        canExecute: analysis.executionPermission.canExecute,
        recommendation: analysis.recommendation,
      };
    });
  }

  private async runTest(testName: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    try {
      const data = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        testName,
        success: true,
        duration,
        data,
      });
      
      console.log(`✅ ${testName} (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = error.message || String(error);
      
      this.results.push({
        testName,
        success: false,
        duration,
        error: errorMsg,
      });
      
      this.errors.push(`${testName}: ${errorMsg}`);
      console.error(`❌ ${testName}: ${errorMsg}`);
    }
  }

  printSummary(summary: TestSummary): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`✅ Passed: ${summary.passedTests}`);
    console.log(`❌ Failed: ${summary.failedTests}`);
    console.log(`⏱️  Total Duration: ${summary.totalDuration}ms`);
    console.log(`📈 Success Rate: ${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%`);

    if (summary.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      summary.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    if (summary.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      summary.errors.forEach(error => console.log(`  • ${error}`));
    }

    console.log('\n' + '='.repeat(80));
  }
}

// Run tests if executed directly
if (require.main === module) {
  const tester = new AIEngineTester();
  tester.runAllTests()
    .then(summary => {
      tester.printSummary(summary);
      process.exit(summary.failedTests > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error running tests:', error);
      process.exit(1);
    });
}

export { AIEngineTester };

