/**
 * Simple OpenAI GPT-5.1 Test
 * Quick test to verify GPT-5.1 is accessible
 */

const testGPT51 = async () => {
  console.log('🧪 Testing OpenAI GPT-5.1...\n');
  
  // Check if API key is set
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OpenAI API key not found!');
    console.log('Please add NEXT_PUBLIC_OPENAI_API_KEY to your .env.local file');
    process.exit(1);
  }
  
  console.log('✅ API Key found');
  console.log(`   Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);
  
  try {
    console.log('📡 Sending test request to OpenAI API...\n');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
            content: 'Say "Hello! GPT-5.1 is working correctly!" if you can read this message.',
          },
        ],
        max_completion_tokens: 50,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ API Request Failed!\n');
      console.error(`Status: ${response.status} ${response.statusText}`);
      console.error('Response:', JSON.stringify(data, null, 2));
      
      if (data.error) {
        const error = data.error;
        console.error(`\nError Type: ${error.type || 'Unknown'}`);
        console.error(`Error Message: ${error.message || 'Unknown error'}`);
        
        if (error.message?.includes('model') || error.message?.includes('not found')) {
          console.error('\n💡 GPT-5.1 model might not be available yet.');
          console.error('   Try using "gpt-4o" or "gpt-4-turbo" instead.');
        } else if (error.message?.includes('quota') || error.message?.includes('billing')) {
          console.error('\n💡 Quota or billing issue.');
          console.error('   Visit: https://platform.openai.com/account/billing');
        } else if (error.message?.includes('invalid') && error.message?.includes('key')) {
          console.error('\n💡 Invalid API key.');
          console.error('   Check your API key in .env.local');
        }
      }
      
      process.exit(1);
    }
    
    const message = data.choices?.[0]?.message?.content || 'No response';
    
    console.log('✅ SUCCESS! GPT-5.1 is working!\n');
    console.log('📝 Response:');
    console.log(`   ${message}\n`);
    console.log('📊 Model Info:');
    console.log(`   Model: ${data.model || 'Unknown'}`);
    console.log(`   Tokens Used: ${data.usage?.total_tokens || 'Unknown'}`);
    console.log('\n🎉 GPT-5.1 integration is working correctly!');
    
  } catch (error) {
    console.error('❌ Test Failed!\n');
    console.error('Error:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. Your API key is correct');
    console.error('   2. You have internet connection');
    console.error('   3. OpenAI API is accessible');
    process.exit(1);
  }
};

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Run test
testGPT51();

