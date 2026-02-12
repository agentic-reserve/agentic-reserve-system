/**
 * Simple API test - Direct HTTP calls
 */

const https = require('https');
const http = require('http');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    }).on('error', reject);
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    }).on('error', reject);
  });
}

async function testAll() {
  console.log('\n=== TESTING EXTERNAL APIs ===\n');
  
  // Test 1: Jupiter Price API V3
  console.log('1. Jupiter Price API V3');
  try {
    const SOL = 'So11111111111111111111111111111111111111112';
    const result = await httpsGet(`https://api.jup.ag/price/v3/price?ids=${SOL}`);
    console.log(`   Status: ${result.status}`);
    if (result.status === 200 && result.data.data) {
      const price = result.data.data[SOL]?.price;
      console.log(`   ✅ SOL Price: $${price}`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(result.data).substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 2: Jupiter Token List
  console.log('\n2. Jupiter Token List API');
  try {
    const result = await httpsGet('https://tokens.jup.ag/tokens?tags=verified');
    console.log(`   Status: ${result.status}`);
    if (result.status === 200 && Array.isArray(result.data)) {
      console.log(`   ✅ Found ${result.data.length} tokens`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(result.data).substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 3: Meteora DLMM API
  console.log('\n3. Meteora DLMM API');
  try {
    const result = await httpsGet('https://dlmm-api.meteora.ag/pair/all');
    console.log(`   Status: ${result.status}`);
    if (result.status === 200 && result.data.groups) {
      const totalPairs = result.data.groups.reduce((sum, g) => sum + (g.pairs?.length || 0), 0);
      console.log(`   ✅ Found ${result.data.groups.length} groups, ${totalPairs} pairs`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(result.data).substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 4: Backend Health
  console.log('\n4. Backend Health Check');
  try {
    const result = await httpGet('http://localhost:4000/api/v1/health');
    console.log(`   Status: ${result.status}`);
    if (result.status === 200) {
      console.log(`   ✅ Status: ${result.data.status}`);
      if (result.data.redis) {
        console.log(`   ✅ Redis: ${result.data.redis.status} (${result.data.redis.type})`);
      }
    } else {
      console.log(`   ⚠️  Status ${result.status}: ${JSON.stringify(result.data).substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 5: Backend ILI
  console.log('\n5. Backend ILI Endpoint');
  try {
    const result = await httpGet('http://localhost:4000/api/v1/ili/current');
    console.log(`   Status: ${result.status}`);
    if (result.status === 200) {
      console.log(`   ✅ ILI: ${result.data.ili}`);
      console.log(`   ✅ Volatility: ${result.data.components.volatility}%`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(result.data).substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 6: Backend Reserve
  console.log('\n6. Backend Reserve State');
  try {
    const result = await httpGet('http://localhost:4000/api/v1/reserve/state');
    console.log(`   Status: ${result.status}`);
    if (result.status === 200) {
      console.log(`   ✅ VHR: ${result.data.vhr}`);
      console.log(`   ✅ Total Reserves: $${result.data.totalReserves || 'N/A'}`);
    } else {
      console.log(`   ❌ Failed: ${JSON.stringify(result.data).substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  console.log('\n=== TEST COMPLETE ===\n');
}

testAll().catch(console.error);
