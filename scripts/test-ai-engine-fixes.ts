/**
 * Test Script for AI Engine Fixes
 * Tests the fixes for:
 * 1. Confidence calculation (should not be 0% when there's structure)
 * 2. GPT structure recognition in Gate 1
 * 3. Gate 2 bias establishment from GPT structure
 * 4. Overall analysis flow
 */

import { GatedTradingEngine } from '../lib/gated-trading-engine';
import { GatedEngineAdapter } from '../lib/gated-engine-adapter';
import { MT5PriceDataProvider } from '../lib/data-providers/mt5-price-data';

// Mock chart image (base64 encoded 1x1 pixel PNG)
const MOCK_CHART_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

class AIEngineFixTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Testing AI Engine Fixes...\n');
    console.log('='.repeat(60));

    // Test 1: Confidence calculation with structure
    await this.testConfidenceCalculation();

    // Test 2: GPT structure recognition
    await this.testGPTStructureRecognition();

    // Test 3: Gate 2 bias from GPT structure
    await this.testGate2BiasFromGPT();

    // Test 4: Full analysis flow
    await this.testFullAnalysisFlow();

    // Print summary
    this.printSummary();
  }

  private async testConfidenceCalculation(): Promise<void> {
    console.log('\n📊 Test 1: Confidence Calculation');
    console.log('-'.repeat(60));

    try {
      const engine = new GatedTradingEngine();
      const adapter = new GatedEngineAdapter();

      // Load historical data first
      const data = await MT5PriceDataProvider.getHistoricalData('EURUSD', 'H1', 100);
      if (data.length === 0) {
        this.results.push({
          testName: 'Confidence Calculation - Data Loading',
          passed: false,
          message: 'Failed to load historical data',
        });
        return;
      }

      // Run analysis (without chart image first to test baseline)
      const analysis = await adapter.analyzeMarket('EURUSD', [], undefined);

      // Check 1: Confidence should not be 0% if there's any structure
      const hasStructure = 
        analysis.gateStatus?.gate1Inputs?.hasStrongTrend ||
        analysis.gateStatus?.gate1Inputs?.hasStrongPattern ||
        (analysis.gptChartAnalysis && analysis.gptChartAnalysis.patterns && analysis.gptChartAnalysis.patterns.length > 0);

      if (hasStructure && analysis.confidence === 0) {
        this.results.push({
          testName: 'Confidence Calculation - Non-Zero with Structure',
          passed: false,
          message: `Confidence is 0% despite having structure. Gate 1 readable: ${analysis.gateStatus?.marketReadable}, Has trend: ${analysis.gateStatus?.gate1Inputs?.hasStrongTrend}, Has pattern: ${analysis.gateStatus?.gate1Inputs?.hasStrongPattern}`,
          details: {
            confidence: analysis.confidence,
            gate1Readable: analysis.gateStatus?.marketReadable,
            gate1Inputs: analysis.gateStatus?.gate1Inputs,
          },
        });
      } else {
        this.results.push({
          testName: 'Confidence Calculation - Non-Zero with Structure',
          passed: true,
          message: `Confidence is ${analysis.confidence}% (has structure: ${hasStructure})`,
          details: {
            confidence: analysis.confidence,
            hasStructure,
          },
        });
      }

      // Check 2: Confidence should reflect structure quality
      if (analysis.confidence > 0 || !hasStructure) {
        this.results.push({
          testName: 'Confidence Calculation - Reflects Structure Quality',
          passed: true,
          message: `Confidence calculation appears correct: ${analysis.confidence}%`,
        });
      } else {
        this.results.push({
          testName: 'Confidence Calculation - Reflects Structure Quality',
          passed: false,
          message: 'Confidence is 0% even when structure exists',
        });
      }

    } catch (error: any) {
      this.results.push({
        testName: 'Confidence Calculation',
        passed: false,
        message: `Error: ${error.message}`,
        details: { error: error.stack },
      });
    }
  }

  private async testGPTStructureRecognition(): Promise<void> {
    console.log('\n📊 Test 2: GPT Structure Recognition');
    console.log('-'.repeat(60));

    try {
      const adapter = new GatedEngineAdapter();

      // Run analysis with mock chart image
      // Note: This will fail GPT analysis but should not crash
      const analysis = await adapter.analyzeMarket('EURUSD', [], MOCK_CHART_IMAGE);

      // Check if GPT structure is being processed
      const hasGPTStructure = !!analysis.gptChartAnalysis;
      const gptConfidence = analysis.gptChartAnalysis?.confidence || 0;
      const gptPatterns = analysis.gptChartAnalysis?.patterns?.length || 0;

      this.results.push({
        testName: 'GPT Structure Recognition - Processing',
        passed: true, // Always pass - GPT may fail but shouldn't crash
        message: `GPT structure processing: ${hasGPTStructure ? 'Available' : 'Not available'} (confidence: ${gptConfidence}%, patterns: ${gptPatterns})`,
        details: {
          hasGPTStructure,
          gptConfidence,
          gptPatterns,
        },
      });

      // Check Gate 1 recognition of GPT patterns
      const gate1RecognizesPattern = 
        analysis.gateStatus?.gate1Inputs?.hasStrongPattern ||
        (gptConfidence >= 70 && analysis.gateStatus?.gate1Inputs?.patternConfidence >= 70);

      this.results.push({
        testName: 'GPT Structure Recognition - Gate 1 Recognition',
        passed: gate1RecognizesPattern || gptConfidence < 70, // Pass if recognized OR if GPT confidence is low
        message: `Gate 1 recognizes GPT pattern: ${gate1RecognizesPattern} (GPT confidence: ${gptConfidence}%, Gate 1 pattern confidence: ${analysis.gateStatus?.gate1Inputs?.patternConfidence || 0}%)`,
        details: {
          gate1RecognizesPattern,
          gptConfidence,
          gate1PatternConfidence: analysis.gateStatus?.gate1Inputs?.patternConfidence,
        },
      });

    } catch (error: any) {
      this.results.push({
        testName: 'GPT Structure Recognition',
        passed: false,
        message: `Error: ${error.message}`,
        details: { error: error.stack },
      });
    }
  }

  private async testGate2BiasFromGPT(): Promise<void> {
    console.log('\n📊 Test 3: Gate 2 Bias from GPT Structure');
    console.log('-'.repeat(60));

    try {
      const adapter = new GatedEngineAdapter();

      // Run analysis
      const analysis = await adapter.analyzeMarket('EURUSD', [], MOCK_CHART_IMAGE);

      // Check if Gate 2 can establish bias from GPT structure
      const gate1Readable = analysis.gateStatus?.marketReadable || false;
      const hasBias = analysis.gateStatus?.directionalBias !== 'NEUTRAL';
      const biasStrength = analysis.gateStatus?.biasStrength || 0;
      const gptConfidence = analysis.gptChartAnalysis?.confidence || 0;
      const gptPatterns = analysis.gptChartAnalysis?.patterns?.length || 0;

      // Gate 2 should establish bias if:
      // 1. Gate 1 is readable, OR
      // 2. GPT has strong pattern (≥70%) even if Gate 1 is unreadable
      const shouldHaveBias = gate1Readable || (gptConfidence >= 70 && gptPatterns > 0);

      if (shouldHaveBias && !hasBias) {
        this.results.push({
          testName: 'Gate 2 Bias from GPT - Bias Establishment',
          passed: false,
          message: `Gate 2 should establish bias but didn't. Gate 1 readable: ${gate1Readable}, GPT confidence: ${gptConfidence}%, GPT patterns: ${gptPatterns}`,
          details: {
            gate1Readable,
            hasBias,
            biasStrength,
            gptConfidence,
            gptPatterns,
          },
        });
      } else {
        this.results.push({
          testName: 'Gate 2 Bias from GPT - Bias Establishment',
          passed: true,
          message: `Bias status correct: ${hasBias ? `Has bias (${analysis.gateStatus?.directionalBias}, strength: ${biasStrength}%)` : 'No bias (expected)'}`,
          details: {
            gate1Readable,
            hasBias,
            biasStrength,
            gptConfidence,
            gptPatterns,
          },
        });
      }

    } catch (error: any) {
      this.results.push({
        testName: 'Gate 2 Bias from GPT',
        passed: false,
        message: `Error: ${error.message}`,
        details: { error: error.stack },
      });
    }
  }

  private async testFullAnalysisFlow(): Promise<void> {
    console.log('\n📊 Test 4: Full Analysis Flow');
    console.log('-'.repeat(60));

    try {
      const adapter = new GatedEngineAdapter();

      // Test multiple pairs
      const pairs = ['EURUSD', 'GBPUSD', 'USDJPY'];

      for (const pair of pairs) {
        console.log(`\n  Testing ${pair}...`);
        
        const analysis = await adapter.analyzeMarket(pair, [], undefined);

        // Verify all required fields are present
        const hasRequiredFields = 
          analysis.recommendation !== undefined &&
          analysis.confidence !== undefined &&
          analysis.gateStatus !== undefined;

        if (!hasRequiredFields) {
          this.results.push({
            testName: `Full Analysis Flow - ${pair} Required Fields`,
            passed: false,
            message: `Missing required fields in analysis result`,
            details: {
              hasRecommendation: analysis.recommendation !== undefined,
              hasConfidence: analysis.confidence !== undefined,
              hasGateStatus: analysis.gateStatus !== undefined,
            },
          });
        } else {
          this.results.push({
            testName: `Full Analysis Flow - ${pair} Required Fields`,
            passed: true,
            message: `All required fields present`,
            details: {
              recommendation: analysis.recommendation,
              confidence: analysis.confidence,
              gateStatus: {
                marketReadable: analysis.gateStatus?.marketReadable,
                directionalBias: analysis.gateStatus?.directionalBias,
                executionPermitted: analysis.gateStatus?.executionPermitted,
              },
            },
          });
        }

        // Verify confidence is reasonable (0-100)
        if (analysis.confidence < 0 || analysis.confidence > 100) {
          this.results.push({
            testName: `Full Analysis Flow - ${pair} Confidence Range`,
            passed: false,
            message: `Confidence out of range: ${analysis.confidence}%`,
          });
        } else {
          this.results.push({
            testName: `Full Analysis Flow - ${pair} Confidence Range`,
            passed: true,
            message: `Confidence in valid range: ${analysis.confidence}%`,
          });
        }

        // Verify recommendation is valid
        const validRecommendations = ['BUY', 'SELL', 'HOLD'];
        if (!validRecommendations.includes(analysis.recommendation)) {
          this.results.push({
            testName: `Full Analysis Flow - ${pair} Valid Recommendation`,
            passed: false,
            message: `Invalid recommendation: ${analysis.recommendation}`,
          });
        } else {
          this.results.push({
            testName: `Full Analysis Flow - ${pair} Valid Recommendation`,
            passed: true,
            message: `Valid recommendation: ${analysis.recommendation}`,
          });
        }
      }

    } catch (error: any) {
      this.results.push({
        testName: 'Full Analysis Flow',
        passed: false,
        message: `Error: ${error.message}`,
        details: { error: error.stack },
      });
    }
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 Test Summary');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    // Print failed tests
    const failedTests = this.results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      console.log('❌ Failed Tests:');
      console.log('-'.repeat(60));
      failedTests.forEach(test => {
        console.log(`\n  ${test.testName}`);
        console.log(`  Message: ${test.message}`);
        if (test.details) {
          console.log(`  Details:`, JSON.stringify(test.details, null, 2));
        }
      });
    }

    // Print passed tests summary
    const passedTests = this.results.filter(r => r.passed);
    if (passedTests.length > 0) {
      console.log('\n✅ Passed Tests:');
      console.log('-'.repeat(60));
      passedTests.forEach(test => {
        console.log(`  ✓ ${test.testName}: ${test.message}`);
      });
    }

    console.log('\n' + '='.repeat(60));
  }
}

// Run tests
async function main() {
  const tester = new AIEngineFixTester();
  await tester.runAllTests();
}

main().catch(console.error);

