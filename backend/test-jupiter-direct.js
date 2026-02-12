const https = require('https');

const API_KEY = '40a97ca1-f337-49b5-9f82-49f95a13e217';
const SOL_MINT = 'So11111111111111111111111111111111111111112';

function testJupiterAPI(version, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.jup.ag',
      path: path,
      method: 'GET',
      headers: {
        'x-api-key': API_KEY,
        'User-Agent': 'ARS-Backend/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ version, status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ version, status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject({ version, error: error.message });
    });

    req.end();
  });
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           JUPITER API DIRECT TEST                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log(`API Key: ${API_KEY.substring(0, 20)}...`);
  console.log(`SOL Mint: ${SOL_MINT}\n`);

  // Test V2
  console.log('1. Testing Price API V2 (Deprecated)');
  try {
    const result = await testJupiterAPI('v2', `/price/v2?ids=${SOL_MINT}`);
    console.log(`   Status: ${result.status}`);
    if (result.status === 200) {
      const price = result.data.data?.[SOL_MINT]?.price;
      console.log(`   ✅ PASS - SOL Price: $${price}`);
    } else {
      console.log(`   ❌ FAIL - ${JSON.stringify(result.data).substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR - ${error.error}`);
  }

  // Test V3
  console.log('\n2. Testing Price API V3 (Current)');
  try {
    const result = await testJupiterAPI('v3', `/price/v3?ids=${SOL_MINT}`);
    console.log(`   Status: ${result.status}`);
    if (result.status === 200) {
      const priceData = result.data[SOL_MINT];
      console.log(`   ✅ PASS - SOL Price: $${priceData?.usdPrice}`);
      console.log(`   📊 Liquidity: $${priceData?.liquidity?.toLocaleString()}`);
      console.log(`   📊 24h Change: ${priceData?.priceChange24h?.toFixed(2)}%`);
    } else {
      console.log(`   ❌ FAIL - ${JSON.stringify(result.data).substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR - ${error.error}`);
  }

  // Test V3 with extra info
  console.log('\n3. Testing Price API V3 with Extra Info');
  try {
    const result = await testJupiterAPI('v3-extra', `/price/v3?ids=${SOL_MINT}&showExtraInfo=true`);
    console.log(`   Status: ${result.status}`);
    if (result.status === 200) {
      const priceData = result.data[SOL_MINT];
      console.log(`   ✅ PASS - SOL Price: $${priceData?.usdPrice}`);
      console.log(`   📊 Decimals: ${priceData?.decimals}`);
    } else {
      console.log(`   ❌ FAIL - ${JSON.stringify(result.data).substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR - ${error.error}`);
  }

  // Test multiple tokens
  console.log('\n4. Testing Multiple Tokens');
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  try {
    const result = await testJupiterAPI('v3-multi', `/price/v3?ids=${SOL_MINT},${USDC_MINT}`);
    console.log(`   Status: ${result.status}`);
    if (result.status === 200) {
      const solPrice = result.data[SOL_MINT]?.usdPrice;
      const usdcPrice = result.data[USDC_MINT]?.usdPrice;
      console.log(`   ✅ PASS`);
      console.log(`   📊 SOL: $${solPrice}`);
      console.log(`   📊 USDC: $${usdcPrice}`);
    } else {
      console.log(`   ❌ FAIL - ${JSON.stringify(result.data).substring(0, 100)}`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR - ${error.error}`);
  }

  console.log('\n');
}

runTests().catch(console.error);
