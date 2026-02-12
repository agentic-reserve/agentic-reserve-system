/**
 * Test Jupiter API dengan endpoint yang benar
 */

const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    }).on('error', reject);
  });
}

async function testJupiter() {
  console.log('\n=== TESTING JUPITER APIs ===\n');
  
  const SOL = 'So11111111111111111111111111111111111111112';
  const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  
  // Test berbagai endpoint Jupiter
  const endpoints = [
    {
      name: 'Price API V2 (old)',
      url: `https://price.jup.ag/v4/price?ids=${SOL}`,
    },
    {
      name: 'Price API V6',
      url: `https://api.jup.ag/price/v2?ids=${SOL}`,
    },
    {
      name: 'Quote API V6',
      url: `https://quote-api.jup.ag/v6/quote?inputMint=${SOL}&outputMint=${USDC}&amount=1000000`,
    },
    {
      name: 'Token List (strict)',
      url: 'https://token.jup.ag/strict',
    },
    {
      name: 'Token List (all)',
      url: 'https://token.jup.ag/all',
    },
  ];
  
  for (const endpoint of endpoints) {
    console.log(`Testing: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url}`);
    try {
      const result = await httpsGet(endpoint.url);
      console.log(`Status: ${result.status}`);
      
      if (result.status === 200) {
        if (endpoint.name.includes('Price')) {
          const data = result.data.data || result.data;
          if (data[SOL]) {
            console.log(`✅ SOL Price: $${data[SOL].price || data[SOL]}`);
          } else {
            console.log(`✅ Response: ${JSON.stringify(result.data).substring(0, 150)}`);
          }
        } else if (endpoint.name.includes('Quote')) {
          console.log(`✅ Quote received: ${JSON.stringify(result.data).substring(0, 150)}`);
        } else if (endpoint.name.includes('Token')) {
          const tokens = Array.isArray(result.data) ? result.data : [];
          console.log(`✅ Found ${tokens.length} tokens`);
          if (tokens.length > 0) {
            console.log(`   First token: ${tokens[0].symbol} - ${tokens[0].name}`);
          }
        }
      } else {
        console.log(`❌ Failed: ${JSON.stringify(result.data).substring(0, 150)}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    console.log('');
  }
}

testJupiter().catch(console.error);
