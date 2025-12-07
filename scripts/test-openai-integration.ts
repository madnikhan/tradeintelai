/**
 * Comprehensive OpenAI Integration Test
 * Tests all OpenAI features and their impact on the system
 */

import { isOpenAIConfigured, generateAnalysisExplanation, analyzeChartImage, enhanceSentimentAnalysis } from '../lib/openai-service';
import { MarketAnalysis } from '../lib/ai-trading-engine';

// Mock data for testing
const mockAnalysis: MarketAnalysis = {
  overallScore: 75,
  recommendation: 'BUY',
  confidence: 80,
  technicalScore: 80,
  fundamentalScore: 70,
  sentimentScore: 75,
  riskLevel: 'MEDIUM',
  suggestedStopLoss: '1.0850',
  suggestedTakeProfit: '1.0950',
  suggestedPositionSize: 0.1,
  reasoning: [
    'Strong bullish trend detected',
    'RSI indicates oversold conditions',
    'Support level at 1.0800',
  ],
  detailedReasoning: {
    technical: ['RSI: 35 (oversold)', 'MACD: Bullish crossover', 'EMA: Price above 50 EMA'],
    fundamental: ['Interest rate differential favorable', 'Economic data positive'],
    sentiment: ['News sentiment: 65% bullish', 'Market sentiment: Positive'],
    risk: ['Current Price: 1.0900', 'Stop Loss: 1.0850', 'Risk/Reward: 1:2'],
  },
  cotAnalysis: {
    summary: 'Large specs are net long',
    largeSpecPosition: 50000,
    commercialPosition: -30000,
    largeSpecPercentile: 75,
    commercialPercentile: 25,
    sentiment: 'BULLISH',
    recommendation: 'BUY signal',
    reasoning: ['Large specs increasing long positions', 'Commercials reducing shorts'],
  },
  regimeAnalysis: {
    regime: 'TRENDING_UP',
    suggestedStrategy: 'TREND_FOLLOWING',
    volatility: 'MEDIUM',
    confidence: 75,
    reasoning: ['Strong uptrend detected', 'Volatility within normal range'],
  },
};

const mockNewsArticles = [
  'EUR/USD rises on positive economic data',
  'European Central Bank maintains interest rates',
  'Strong employment figures boost EUR sentiment',
];

// Mock base64 image (small test image)
const mockChartImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  impact?: string;
  performance?: {
    time: number;
    tokens?: number;
  };
}

const results: TestResult[] = [];

async function testConfiguration() {
  console.log('\n🔍 Testing OpenAI Configuration...\n');
  
  const isConfigured = isOpenAIConfigured();
  results.push({
    name: 'OpenAI Configuration',
    status: isConfigured ? 'pass' : 'fail',
    message: isConfigured ? 'OpenAI is properly configured' : 'OpenAI API key not found',
    impact: isConfigured ? 'System can use AI features' : 'AI features will be disabled',
  });
  
  return isConfigured;
}

async function testTextAnalysis() {
  console.log('📝 Testing GPT-5.1 Text Analysis...\n');
  
  const startTime = Date.now();
  
  try {
    const result = await generateAnalysisExplanation(mockAnalysis, 'EURUSD');
    const duration = Date.now() - startTime;
    
    if (result) {
      results.push({
        name: 'Text Analysis (Market Explanation)',
        status: 'pass',
        message: 'Successfully generated market analysis explanation',
        impact: 'Users get natural language explanations of trading signals',
        performance: {
          time: duration,
        },
      });
      
      console.log('✅ Text Analysis: SUCCESS');
      console.log(`   Summary: ${result.explanation.summary.substring(0, 80)}...`);
      console.log(`   Key Points: ${result.explanation.keyPoints.length}`);
      console.log(`   Response Time: ${duration}ms`);
      return true;
    } else {
      results.push({
        name: 'Text Analysis (Market Explanation)',
        status: 'fail',
        message: 'No response from OpenAI',
        impact: 'Users won\'t get AI explanations',
      });
      return false;
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'Text Analysis (Market Explanation)',
      status: 'fail',
      message: error.message || 'Unknown error',
      impact: 'AI explanation feature unavailable',
      performance: {
        time: duration,
      },
    });
    console.error('❌ Text Analysis: FAILED');
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function testSentimentEnhancement() {
  console.log('\n💭 Testing GPT-5.1 Sentiment Analysis...\n');
  
  const startTime = Date.now();
  
  try {
    const result = await enhanceSentimentAnalysis(mockNewsArticles);
    const duration = Date.now() - startTime;
    
    if (result !== null) {
      results.push({
        name: 'Sentiment Enhancement',
        status: 'pass',
        message: `Successfully analyzed sentiment: ${result}/100`,
        impact: 'Enhanced sentiment analysis for news articles',
        performance: {
          time: duration,
        },
      });
      
      console.log('✅ Sentiment Analysis: SUCCESS');
      console.log(`   Sentiment Score: ${result}/100`);
      console.log(`   Response Time: ${duration}ms`);
      return true;
    } else {
      results.push({
        name: 'Sentiment Enhancement',
        status: 'skip',
        message: 'Sentiment enhancement returned null (may be optional)',
        impact: 'Falls back to basic sentiment analysis',
      });
      return false;
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'Sentiment Enhancement',
      status: 'fail',
      message: error.message || 'Unknown error',
      impact: 'Sentiment enhancement unavailable',
      performance: {
        time: duration,
      },
    });
    console.error('❌ Sentiment Analysis: FAILED');
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function testChartVisionAnalysis() {
  console.log('\n🖼️  Testing GPT-5.1 Vision Analysis...\n');
  
  const startTime = Date.now();
  
  try {
    const result = await analyzeChartImage(mockChartImage, 'EURUSD', '1h', 1.0900);
    const duration = Date.now() - startTime;
    
    if (result) {
      results.push({
        name: 'Chart Vision Analysis',
        status: 'pass',
        message: 'Successfully analyzed chart patterns',
        impact: 'Users get AI-powered chart pattern recognition',
        performance: {
          time: duration,
        },
      });
      
      console.log('✅ Chart Vision Analysis: SUCCESS');
      console.log(`   Patterns Detected: ${result.patterns?.length || 0}`);
      console.log(`   Trend: ${result.trend?.direction || 'N/A'}`);
      console.log(`   Response Time: ${duration}ms`);
      return true;
    } else {
      results.push({
        name: 'Chart Vision Analysis',
        status: 'fail',
        message: 'No response from OpenAI Vision',
        impact: 'Chart pattern analysis unavailable',
      });
      return false;
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    results.push({
      name: 'Chart Vision Analysis',
      status: 'fail',
      message: error.message || 'Unknown error',
      impact: 'Chart vision analysis unavailable',
      performance: {
        time: duration,
      },
    });
    console.error('❌ Chart Vision Analysis: FAILED');
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

function analyzeSystemImpact() {
  console.log('\n📊 Analyzing System Impact...\n');
  
  const passedTests = results.filter(r => r.status === 'pass').length;
  const failedTests = results.filter(r => r.status === 'fail').length;
  const skippedTests = results.filter(r => r.status === 'skip').length;
  
  const avgResponseTime = results
    .filter(r => r.performance?.time)
    .reduce((sum, r) => sum + (r.performance?.time || 0), 0) / 
    results.filter(r => r.performance?.time).length;
  
  console.log('📈 Test Results Summary:');
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log(`   ⏭️  Skipped: ${skippedTests}`);
  console.log(`   ⏱️  Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
  
  console.log('\n🎯 OpenAI Integration Impact:\n');
  
  const impacts = [
    {
      feature: 'AI-Powered Analysis Component',
      impact: 'Provides natural language explanations of trading signals',
      dependency: 'Text Analysis',
      fallback: 'Basic analysis without explanations',
    },
    {
      feature: 'Chart Vision Analysis Component',
      impact: 'AI-powered chart pattern recognition and analysis',
      dependency: 'Chart Vision Analysis',
      fallback: 'Manual chart analysis only',
    },
    {
      feature: 'Sentiment Analysis Enhancement',
      impact: 'Enhanced sentiment scoring from news articles',
      dependency: 'Sentiment Enhancement',
      fallback: 'Basic sentiment analysis',
    },
    {
      feature: 'User Experience',
      impact: 'More intuitive and understandable trading insights',
      dependency: 'All OpenAI features',
      fallback: 'Technical analysis only',
    },
    {
      feature: 'System Performance',
      impact: `Average API response time: ${avgResponseTime.toFixed(0)}ms`,
      dependency: 'OpenAI API availability',
      fallback: 'No AI features, faster page load',
    },
  ];
  
  impacts.forEach((item, index) => {
    console.log(`${index + 1}. ${item.feature}`);
    console.log(`   Impact: ${item.impact}`);
    console.log(`   Dependency: ${item.dependency}`);
    console.log(`   Fallback: ${item.fallback}`);
    console.log('');
  });
  
  console.log('💡 Key Benefits:');
  console.log('   • Natural language explanations make trading signals more accessible');
  console.log('   • Chart pattern recognition helps identify trading opportunities');
  console.log('   • Enhanced sentiment analysis improves market understanding');
  console.log('   • Professional branding with OpenAI/GPT-5.1 logos');
  console.log('');
  
  console.log('⚠️  Considerations:');
  console.log('   • API costs per request');
  console.log('   • Response time adds latency to analysis');
  console.log('   • Requires internet connection');
  console.log('   • API rate limits may affect high-frequency usage');
  console.log('');
  
  return {
    passedTests,
    failedTests,
    skippedTests,
    avgResponseTime,
    impacts,
  };
}

async function runTests() {
  console.log('🧪 OpenAI Integration Comprehensive Test\n');
  console.log('='.repeat(60));
  
  const isConfigured = await testConfiguration();
  
  if (!isConfigured) {
    console.log('\n⚠️  OpenAI not configured. Skipping API tests.');
    analyzeSystemImpact();
    process.exit(1);
  }
  
  await testTextAnalysis();
  await testSentimentEnhancement();
  await testChartVisionAnalysis();
  
  const summary = analyzeSystemImpact();
  
  console.log('='.repeat(60));
  console.log('\n📋 Detailed Test Results:\n');
  
  results.forEach((result, index) => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️';
    console.log(`${index + 1}. ${icon} ${result.name}`);
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log(`   Message: ${result.message}`);
    if (result.impact) {
      console.log(`   Impact: ${result.impact}`);
    }
    if (result.performance) {
      console.log(`   Performance: ${result.performance.time}ms`);
    }
    console.log('');
  });
  
  const successRate = (summary.passedTests / (summary.passedTests + summary.failedTests)) * 100;
  
  console.log('='.repeat(60));
  console.log('\n🎯 Overall Assessment:\n');
  console.log(`Success Rate: ${successRate.toFixed(1)}%`);
  console.log(`System Status: ${successRate >= 75 ? '✅ Excellent' : successRate >= 50 ? '⚠️  Good' : '❌ Needs Attention'}`);
  console.log('');
  
  if (summary.passedTests === results.length - summary.skippedTests) {
    console.log('🎉 All critical tests passed! OpenAI integration is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the errors above.');
  }
  
  process.exit(summary.failedTests > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

