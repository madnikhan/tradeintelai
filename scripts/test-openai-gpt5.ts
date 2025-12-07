/**
 * Test Script for OpenAI GPT-5.1 Integration
 * Tests if GPT-5.1 is accessible and working correctly
 */

import { isOpenAIConfigured, generateAnalysisExplanation } from '../lib/openai-service';
import { MarketAnalysis } from '../lib/ai-trading-engine';

// Mock market analysis for testing
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

async function testOpenAIConfiguration() {
  console.log('🔍 Testing OpenAI Configuration...\n');
  
  const isConfigured = isOpenAIConfigured();
  console.log(`✅ OpenAI Configured: ${isConfigured ? 'YES' : 'NO'}`);
  
  if (!isConfigured) {
    console.error('\n❌ OpenAI is not configured!');
    console.log('Please add NEXT_PUBLIC_OPENAI_API_KEY to your .env.local file');
    return false;
  }
  
  return true;
}

async function testGPT51TextAnalysis() {
  console.log('\n📝 Testing GPT-5.1 Text Analysis...\n');
  
  try {
    console.log('Sending test request to GPT-5.1...');
    const result = await generateAnalysisExplanation(mockAnalysis, 'EURUSD');
    
    if (result) {
      console.log('✅ GPT-5.1 Text Analysis: SUCCESS\n');
      console.log('📊 Response Summary:');
      console.log(`   Summary: ${result.explanation.summary.substring(0, 100)}...`);
      console.log(`   Key Points: ${result.explanation.keyPoints.length} points`);
      console.log(`   Risk Factors: ${result.explanation.riskFactors.length} factors`);
      console.log(`   Recommendation: ${result.explanation.recommendation.substring(0, 80)}...`);
      return true;
    } else {
      console.error('❌ GPT-5.1 Text Analysis: FAILED (No response)');
      return false;
    }
  } catch (error: any) {
    console.error('❌ GPT-5.1 Text Analysis: ERROR');
    console.error(`   Error: ${error.message}`);
    
    if (error.message.includes('quota') || error.message.includes('billing')) {
      console.error('\n💡 Solution: Add billing details or credits to your OpenAI account');
      console.error('   Visit: https://platform.openai.com/account/billing');
    } else if (error.message.includes('model')) {
      console.error('\n💡 Solution: GPT-5.1 might not be available yet. Try using "gpt-4o" instead.');
    } else if (error.message.includes('API key')) {
      console.error('\n💡 Solution: Check your API key in .env.local');
    }
    
    return false;
  }
}

async function testOpenAIAPIEndpoint() {
  console.log('\n🌐 Testing OpenAI API Endpoint...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/openai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.1',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.',
          },
          {
            role: 'user',
            content: 'Say "Hello, GPT-5.1 is working!" if you can read this.',
          },
        ],
        max_tokens: 50,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ API Endpoint: FAILED (Status: ${response.status})`);
      console.error(`   Error: ${JSON.stringify(errorData, null, 2)}`);
      return false;
    }
    
    const data = await response.json();
    const message = data.choices?.[0]?.message?.content || 'No response';
    
    console.log('✅ API Endpoint: SUCCESS');
    console.log(`   Response: ${message}`);
    return true;
  } catch (error: any) {
    console.error('❌ API Endpoint: ERROR');
    console.error(`   Error: ${error.message}`);
    console.error('\n💡 Make sure your Next.js dev server is running (npm run dev)');
    return false;
  }
}

async function runTests() {
  console.log('🧪 OpenAI GPT-5.1 Integration Test\n');
  console.log('=' .repeat(50));
  
  const configOk = await testOpenAIConfiguration();
  if (!configOk) {
    process.exit(1);
  }
  
  const endpointOk = await testOpenAIAPIEndpoint();
  if (!endpointOk) {
    console.log('\n⚠️  API endpoint test failed. Make sure dev server is running.');
    console.log('   Run: npm run dev\n');
  }
  
  const analysisOk = await testGPT51TextAnalysis();
  
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Test Results:');
  console.log(`   Configuration: ${configOk ? '✅' : '❌'}`);
  console.log(`   API Endpoint: ${endpointOk ? '✅' : '❌'}`);
  console.log(`   GPT-5.1 Analysis: ${analysisOk ? '✅' : '❌'}`);
  
  if (configOk && endpointOk && analysisOk) {
    console.log('\n🎉 All tests passed! GPT-5.1 is working correctly!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

