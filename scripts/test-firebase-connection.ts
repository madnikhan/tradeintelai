#!/usr/bin/env tsx
/**
 * Test Firebase Connection
 * Quick script to verify Firebase is properly configured and connected
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { testFirebaseConnection, logFirebaseStatus } from '../lib/firebase/test-connection';

async function main() {
  console.log('🔥 Testing Firebase Connection...\n');
  
  // Log configuration status
  logFirebaseStatus();
  console.log('');
  
  // Test connection
  const result = await testFirebaseConnection();
  
  console.log('📊 Connection Test Results:');
  console.log('  Configured:', result.configured ? '✅ Yes' : '❌ No');
  console.log('  Connected:', result.connected ? '✅ Yes' : '❌ No');
  
  if (result.error) {
    console.log('  Error:', result.error);
  }
  
  console.log('');
  
  if (result.configured && result.connected) {
    console.log('🎉 Firebase is properly configured and connected!');
    console.log('✅ You can now use Firestore features.');
  } else if (result.configured && !result.connected) {
    console.log('⚠️  Firebase is configured but connection failed.');
    console.log('   Check your internet connection and Firestore security rules.');
  } else {
    console.log('❌ Firebase is not configured.');
    console.log('   Please add Firebase configuration to .env.local');
    console.log('   See FIRESTORE_SETUP_GUIDE.md for instructions.');
  }
  
  process.exit(result.configured && result.connected ? 0 : 1);
}

main().catch(console.error);

