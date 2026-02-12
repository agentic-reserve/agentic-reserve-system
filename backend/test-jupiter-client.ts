/**
 * Test Jupiter Client directly
 * Run: ts-node test-jupiter-client.ts
 */

import { getJupiterClient } from './src/services/defi/jupiter-client';

async function testJupiterClient() {
  console.log('🚀 Testing Jupiter Client\n');
  console.log('='.repeat(60));
  
  const client = getJupiterClient();
  
  // Test 1: Get SOL price
  console.log('\n📊 Test 1: Get SOL Price');
  try {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    const price = await client.getTokenPrice(SOL_MINT);
    console.log(`✅ SOL Price: $${price}`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 2: Get multiple token prices
  console.log('\n📊 Test 2: Get Multiple Token Prices');
  try {
    const mints = [
      'So11111111111111111111111111111111111111112', // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    ];
    const prices = await client.getTokenPrices(mints);
    console.log('✅ Prices:', JSON.stringify(prices, null, 2));
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 3: Get SOL/USDC price
  console.log('\n📊 Test 3: Get SOL/USDC Price');
  try {
    const price = await client.getSOLUSDCPrice();
    console.log(`✅ SOL/USDC Price: $${price}`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 4: Get token list
  console.log('\n📊 Test 4: Get Token List');
  try {
    const tokens = await client.getTokenList();
    console.log(`✅ Token List: ${tokens.length} tokens`);
    console.log('First 5 tokens:');
    tokens.slice(0, 5).forEach(token => {
      console.log(`  - ${token.symbol} (${token.name}): ${token.address}`);
    });
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 5: Search token
  console.log('\n📊 Test 5: Search Token (SOL)');
  try {
    const results = await client.searchToken('SOL');
    console.log(`✅ Search Results: ${results.length} tokens`);
    results.slice(0, 3).forEach(token => {
      console.log(`  - ${token.symbol} (${token.name})`);
    });
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 6: Test caching
  console.log('\n📊 Test 6: Test Price Caching');
  try {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    
    console.log('First call (should hit API or return mock):');
    const start1 = Date.now();
    const price1 = await client.getTokenPrice(SOL_MINT);
    const duration1 = Date.now() - start1;
    console.log(`  Price: $${price1} (${duration1}ms)`);
    
    console.log('Second call (should hit cache):');
    const start2 = Date.now();
    const price2 = await client.getTokenPrice(SOL_MINT);
    const duration2 = Date.now() - start2;
    console.log(`  Price: $${price2} (${duration2}ms)`);
    
    if (duration2 < duration1) {
      console.log('✅ Cache is working! Second call was faster.');
    } else {
      console.log('⚠️  Cache might not be working as expected.');
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Jupiter Client tests complete!\n');
}

testJupiterClient().catch(console.error);
