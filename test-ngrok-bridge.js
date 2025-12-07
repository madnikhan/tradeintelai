#!/usr/bin/env node
/**
 * Test script to verify ngrok bridge connection
 * Run this to test if your bridge is accessible via ngrok
 */

const https = require('https');
const http = require('http');

async function getNgrokUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const tunnels = json.tunnels || [];
          const httpsTunnel = tunnels.find(t => t.public_url.startsWith('https://'));
          if (httpsTunnel) {
            resolve(httpsTunnel.public_url);
          } else {
            reject(new Error('No HTTPS tunnel found'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function testBridge(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: '/health',
      method: 'GET',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function main() {
  console.log('🔍 Testing ngrok bridge connection...\n');

  try {
    // Get ngrok URL
    console.log('1. Getting ngrok URL...');
    const ngrokUrl = await getNgrokUrl();
    console.log(`   ✅ ngrok URL: ${ngrokUrl}\n`);

    // Test bridge
    console.log('2. Testing bridge via ngrok...');
    const result = await testBridge(`${ngrokUrl}/health`);
    console.log(`   ✅ Status: ${result.status}`);
    console.log(`   ✅ Response:`, JSON.stringify(result.data, null, 2));
    console.log('\n✅ Bridge is accessible via ngrok!');
    console.log(`\n📋 Set this in Vercel:`);
    console.log(`   NEXT_PUBLIC_BRIDGE_URL=${ngrokUrl}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Make sure ngrok is running: ngrok http 8080');
    console.log('   2. Make sure bridge is running: npm run bridge');
    console.log('   3. Check ngrok web interface: http://127.0.0.1:4040');
    process.exit(1);
  }
}

main();

