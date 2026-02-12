/**
 * Test script for external DeFi APIs
 * Tests Jupiter, Meteora, and Kamino integrations
 */

const axios = require('axios');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logSection(message) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(message, 'blue');
  log('='.repeat(60), 'blue');
}

// Test Jupiter Price API V3
async function testJupiterPriceAPI() {
  logSection('Testing Jupiter Price API V3');
  
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
  
  try {
    // Test 1: Single token price
    logInfo('Test 1: Get SOL price');
    const response1 = await axios.get('https://api.jup.ag/price/v3/price', {
      params: { ids: SOL_MINT },
      timeout: 10000,
    });
    
    if (response1.data.data && response1.data.data[SOL_MINT]) {
      const solPrice = response1.data.data[SOL_MINT].price;
      logSuccess(`SOL Price: $${solPrice}`);
    } else {
      logError('SOL price not found in response');
    }
    
    // Test 2: Multiple token prices
    logInfo('\nTest 2: Get multiple token prices (SOL, USDC, USDT)');
    const response2 = await axios.get('https://api.jup.ag/price/v3/price', {
      params: { ids: `${SOL_MINT},${USDC_MINT},${USDT_MINT}` },
      timeout: 10000,
    });
    
    if (response2.data.data) {
      const prices = response2.data.data;
      logSuccess(`SOL: $${prices[SOL_MINT]?.price || 'N/A'}`);
      logSuccess(`USDC: $${prices[USDC_MINT]?.price || 'N/A'}`);
      logSuccess(`USDT: $${prices[USDT_MINT]?.price || 'N/A'}`);
    } else {
      logError('Price data not found in response');
    }
    
    // Test 3: Response time
    logInfo('\nTest 3: Check response time');
    const startTime = Date.now();
    await axios.get('https://api.jup.ag/price/v3/price', {
      params: { ids: SOL_MINT },
      timeout: 10000,
    });
    const responseTime = Date.now() - startTime;
    
    if (responseTime < 1000) {
      logSuccess(`Response time: ${responseTime}ms (Excellent)`);
    } else if (responseTime < 3000) {
      logWarning(`Response time: ${responseTime}ms (Acceptable)`);
    } else {
      logError(`Response time: ${responseTime}ms (Slow)`);
    }
    
    return { success: true, api: 'Jupiter Price API V3' };
  } catch (error) {
    logError(`Jupiter Price API failed: ${error.message}`);
    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Response: ${JSON.stringify(error.response.data)}`);
    }
    return { success: false, api: 'Jupiter Price API V3', error: error.message };
  }
}

// Test Jupiter Token List API
async function testJupiterTokenListAPI() {
  logSection('Testing Jupiter Token List API');
  
  try {
    logInfo('Test: Get verified token list');
    const response = await axios.get('https://tokens.jup.ag/tokens', {
      params: { tags: 'verified' },
      timeout: 10000,
    });
    
    if (Array.isArray(response.data) && response.data.length > 0) {
      logSuccess(`Found ${response.data.length} verified tokens`);
      
      // Show first 5 tokens
      logInfo('\nFirst 5 tokens:');
      response.data.slice(0, 5).forEach((token, index) => {
        console.log(`  ${index + 1}. ${token.symbol} - ${token.name}`);
      });
    } else {
      logError('No tokens found in response');
    }
    
    return { success: true, api: 'Jupiter Token List API' };
  } catch (error) {
    logError(`Jupiter Token List API failed: ${error.message}`);
    if (error.response) {
      logError(`Status: ${error.response.status}`);
    }
    return { success: false, api: 'Jupiter Token List API', error: error.message };
  }
}

// Test Meteora DLMM API
async function testMeteoraAPI() {
  logSection('Testing Meteora DLMM API');
  
  try {
    // Test 1: Get all pairs
    logInfo('Test 1: Get all DLMM pairs');
    const response1 = await axios.get('https://dlmm-api.meteora.ag/pair/all', {
      timeout: 10000,
    });
    
    if (response1.data) {
      if (response1.data.groups && Array.isArray(response1.data.groups)) {
        const totalPairs = response1.data.groups.reduce((sum, group) => {
          return sum + (group.pairs ? group.pairs.length : 0);
        }, 0);
        logSuccess(`Found ${response1.data.groups.length} groups with ${totalPairs} total pairs`);
        
        // Show first group
        if (response1.data.groups[0]) {
          const firstGroup = response1.data.groups[0];
          logInfo(`\nFirst group: ${firstGroup.name || 'Unnamed'}`);
          if (firstGroup.pairs && firstGroup.pairs.length > 0) {
            logInfo(`First pair in group: ${firstGroup.pairs[0].name || 'Unnamed'}`);
            logInfo(`  Address: ${firstGroup.pairs[0].address || 'N/A'}`);
            logInfo(`  TVL: $${firstGroup.pairs[0].liquidity || 'N/A'}`);
            logInfo(`  APY: ${firstGroup.pairs[0].apy || 'N/A'}%`);
          }
        }
      } else {
        logWarning('Unexpected response format from Meteora API');
        logInfo(`Response keys: ${Object.keys(response1.data).join(', ')}`);
      }
    } else {
      logError('No data in Meteora response');
    }
    
    return { success: true, api: 'Meteora DLMM API' };
  } catch (error) {
    logError(`Meteora API failed: ${error.message}`);
    if (error.response) {
      logError(`Status: ${error.response.status}`);
      logError(`Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    }
    return { success: false, api: 'Meteora DLMM API', error: error.message };
  }
}

// Test Kamino (should show it's not available)
async function testKaminoAPI() {
  logSection('Testing Kamino API');
  
  logWarning('Kamino does NOT have a public REST API');
  logInfo('Kamino requires SDK integration: @kamino-finance/klend-sdk');
  logInfo('Current implementation returns mock data');
  
  try {
    // Try to hit the API anyway to confirm it doesn't exist
    logInfo('\nAttempting to call Kamino API endpoint...');
    await axios.get('https://api.kamino.finance/markets', {
      timeout: 5000,
    });
    
    logWarning('Unexpected: Kamino API responded (may have been added)');
    return { success: true, api: 'Kamino API', note: 'API exists but was not documented' };
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.response?.status === 404) {
      logSuccess('Confirmed: No public REST API (as expected)');
      logInfo('✓ Mock data implementation is correct approach');
      return { success: true, api: 'Kamino API', note: 'No REST API - using mock data' };
    } else {
      logError(`Unexpected error: ${error.message}`);
      return { success: false, api: 'Kamino API', error: error.message };
    }
  }
}

// Test backend endpoints
async function testBackendEndpoints() {
  logSection('Testing Backend Endpoints');
  
  const baseUrl = 'http://localhost:4000';
  const results = [];
  
  // Test 1: Health check
  try {
    logInfo('Test 1: Health check');
    const response = await axios.get(`${baseUrl}/api/v1/health`, { timeout: 5000 });
    logSuccess(`Health: ${response.data.status}`);
    if (response.data.redis) {
      logInfo(`  Redis: ${response.data.redis.status} (${response.data.redis.type})`);
    }
    results.push({ endpoint: '/health', success: true });
  } catch (error) {
    logError(`Health check failed: ${error.message}`);
    results.push({ endpoint: '/health', success: false, error: error.message });
  }
  
  // Test 2: ILI endpoint
  try {
    logInfo('\nTest 2: ILI (Internet Liquidity Index)');
    const response = await axios.get(`${baseUrl}/api/v1/ili/current`, { timeout: 5000 });
    logSuccess(`ILI: ${response.data.ili}`);
    logInfo(`  Volatility: ${response.data.components.volatility}%`);
    logInfo(`  Avg Yield: ${response.data.components.avgYield}%`);
    logInfo(`  TVL: $${response.data.components.tvl}`);
    results.push({ endpoint: '/ili/current', success: true });
  } catch (error) {
    logError(`ILI endpoint failed: ${error.message}`);
    results.push({ endpoint: '/ili/current', success: false, error: error.message });
  }
  
  // Test 3: Reserve state
  try {
    logInfo('\nTest 3: Reserve State');
    const response = await axios.get(`${baseUrl}/api/v1/reserve/state`, { timeout: 5000 });
    logSuccess(`VHR: ${response.data.vhr}`);
    logInfo(`  Total Reserves: $${response.data.totalReserves}`);
    logInfo(`  Total Liabilities: $${response.data.totalLiabilities}`);
    results.push({ endpoint: '/reserve/state', success: true });
  } catch (error) {
    logError(`Reserve state failed: ${error.message}`);
    results.push({ endpoint: '/reserve/state', success: false, error: error.message });
  }
  
  return results;
}

// Main test runner
async function runAllTests() {
  log('\n' + '█'.repeat(60), 'blue');
  log('  EXTERNAL API INTEGRATION TEST SUITE', 'blue');
  log('█'.repeat(60) + '\n', 'blue');
  
  const results = [];
  
  // Test external APIs
  results.push(await testJupiterPriceAPI());
  results.push(await testJupiterTokenListAPI());
  results.push(await testMeteoraAPI());
  results.push(await testKaminoAPI());
  
  // Test backend endpoints
  const backendResults = await testBackendEndpoints();
  
  // Summary
  logSection('TEST SUMMARY');
  
  const externalApiResults = results.filter(r => r.success);
  const externalApiFailures = results.filter(r => !r.success);
  
  log(`\nExternal APIs:`, 'cyan');
  log(`  ✅ Passed: ${externalApiResults.length}/${results.length}`, 'green');
  if (externalApiFailures.length > 0) {
    log(`  ❌ Failed: ${externalApiFailures.length}/${results.length}`, 'red');
    externalApiFailures.forEach(r => {
      log(`     - ${r.api}: ${r.error}`, 'red');
    });
  }
  
  const backendPassed = backendResults.filter(r => r.success).length;
  const backendFailed = backendResults.filter(r => !r.success).length;
  
  log(`\nBackend Endpoints:`, 'cyan');
  log(`  ✅ Passed: ${backendPassed}/${backendResults.length}`, 'green');
  if (backendFailed > 0) {
    log(`  ❌ Failed: ${backendFailed}/${backendResults.length}`, 'red');
    backendResults.filter(r => !r.success).forEach(r => {
      log(`     - ${r.endpoint}: ${r.error}`, 'red');
    });
  }
  
  // Overall status
  const allPassed = externalApiFailures.length === 0 && backendFailed === 0;
  log('\n' + '='.repeat(60), 'blue');
  if (allPassed) {
    log('  🎉 ALL TESTS PASSED!', 'green');
  } else {
    log('  ⚠️  SOME TESTS FAILED - SEE DETAILS ABOVE', 'yellow');
  }
  log('='.repeat(60) + '\n', 'blue');
  
  // Recommendations
  logSection('RECOMMENDATIONS');
  
  results.forEach(result => {
    if (result.api === 'Kamino API' && result.note) {
      logInfo(`${result.api}:`);
      log(`  → ${result.note}`, 'yellow');
      log(`  → For production: Install @kamino-finance/klend-sdk`, 'yellow');
    }
  });
  
  if (backendFailed > 0) {
    logWarning('\nBackend Issues:');
    log('  → Ensure backend is running: npm run dev', 'yellow');
    log('  → Check .env configuration', 'yellow');
  }
}

// Run tests
runAllTests().catch(error => {
  logError(`\nFatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
