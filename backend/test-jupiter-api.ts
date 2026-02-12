/**
 * Test script untuk Jupiter API endpoints
 * Run: ts-node test-jupiter-api.ts
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:4000';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];

async function testEndpoint(name: string, url: string, method: string = 'GET', data?: any) {
  const startTime = Date.now();
  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   URL: ${method} ${url}`);
    
    const response = method === 'GET' 
      ? await axios.get(url, { timeout: 15000 })
      : await axios.post(url, data, { timeout: 15000 });
    
    const duration = Date.now() - startTime;
    
    console.log(`   ✅ Success (${duration}ms)`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2).substring(0, 500));
    
    results.push({
      name,
      success: true,
      duration,
      data: response.data
    });
    
    return response.data;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMsg = error.response?.data?.error || error.message;
    
    console.log(`   ❌ Failed (${duration}ms)`);
    console.log(`   Error:`, errorMsg);
    
    results.push({
      name,
      success: false,
      duration,
      error: errorMsg
    });
    
    return null;
  }
}

async function testJupiterIntegration() {
  console.log('🚀 Starting Jupiter API Integration Tests\n');
  console.log('=' .repeat(60));
  
  // Test 1: Health check
  await testEndpoint(
    'Health Check',
    `${BASE_URL}/health`
  );
  
  // Test 2: Reserve state (may use Jupiter for pricing)
  await testEndpoint(
    'Reserve State',
    `${BASE_URL}/api/v1/reserve/state`
  );
  
  // Test 3: ILI current (uses Jupiter for token prices)
  await testEndpoint(
    'ILI Current',
    `${BASE_URL}/api/v1/ili/current`
  );
  
  // Test 4: ILI history
  await testEndpoint(
    'ILI History',
    `${BASE_URL}/api/v1/ili/history`
  );
  
  // Test 5: ICR current (uses Jupiter for collateral pricing)
  await testEndpoint(
    'ICR Current',
    `${BASE_URL}/api/v1/icr/current`
  );
  
  // Test 6: Reserve history
  await testEndpoint(
    'Reserve History',
    `${BASE_URL}/api/v1/reserve/history`
  );
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary\n');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Average Duration: ${avgDuration.toFixed(0)}ms\n`);
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name} (${result.duration}ms)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Direct Jupiter API test
async function testJupiterDirectAPI() {
  console.log('\n🔍 Testing Jupiter API Directly\n');
  console.log('=' .repeat(60));
  
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  
  // Test Jupiter Price API (v2 - public endpoint)
  await testEndpoint(
    'Jupiter Price API v2 - SOL',
    `https://price.jup.ag/v4/price?ids=${SOL_MINT}`
  );
  
  // Test Jupiter Quote API (public)
  await testEndpoint(
    'Jupiter Quote API - SOL to USDC',
    `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=1000000000&slippageBps=50`
  );
}

// Run tests
async function main() {
  try {
    // Test direct Jupiter API first
    await testJupiterDirectAPI();
    
    // Then test backend endpoints
    await testJupiterIntegration();
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

main();
