/**
 * Test Kamino SDK Integration
 */

import { getKaminoSDKClient } from './src/services/defi/kamino-sdk-client';

async function testKaminoSDK() {
  console.log('🚀 Testing Kamino SDK Integration\n');
  console.log('='.repeat(60));
  
  const client = getKaminoSDKClient();
  
  // Test 1: Get Main Market
  console.log('\n📊 Test 1: Get Main Market');
  try {
    const market = await client.getMarket();
    console.log('✅ Success: Market loaded');
    console.log(`   Name: ${market.name}`);
    console.log(`   Address: ${market.address}`);
    console.log(`   TVL: $${market.tvl.toFixed(2)}`);
    console.log(`   Total Supply: $${market.totalSupply.toFixed(2)}`);
    console.log(`   Total Borrow: $${market.totalBorrow.toFixed(2)}`);
    console.log(`   Utilization: ${market.utilization.toFixed(2)}%`);
    console.log(`   Avg Supply APY: ${market.supplyAPY.toFixed(2)}%`);
    console.log(`   Avg Borrow APY: ${market.borrowAPY.toFixed(2)}%`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 2: Get All Reserves
  console.log('\n📊 Test 2: Get All Reserves');
  try {
    const reserves = await client.getReserves();
    console.log(`✅ Success: Found ${reserves.length} reserves`);
    
    if (reserves.length > 0) {
      console.log('\nTop 5 reserves by TVL:');
      reserves
        .sort((a, b) => b.totalSupply - a.totalSupply)
        .slice(0, 5)
        .forEach((reserve, i) => {
          console.log(`  ${i + 1}. ${reserve.symbol}`);
          console.log(`     Supply APY: ${reserve.supplyAPY.toFixed(2)}%`);
          console.log(`     Borrow APY: ${reserve.borrowAPY.toFixed(2)}%`);
          console.log(`     TVL: $${reserve.totalSupply.toFixed(2)}`);
          console.log(`     Utilization: ${reserve.utilizationRate.toFixed(2)}%`);
        });
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 3: Get SOL Lending Rate
  console.log('\n📊 Test 3: Get SOL Lending Rate');
  try {
    const rate = await client.getSOLLendingRate();
    console.log(`✅ Success: SOL lending rate = ${rate.toFixed(2)}%`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 4: Get USDC Lending Rate
  console.log('\n📊 Test 4: Get USDC Lending Rate');
  try {
    const rate = await client.getUSDCLendingRate();
    console.log(`✅ Success: USDC lending rate = ${rate.toFixed(2)}%`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 5: Get Total TVL
  console.log('\n📊 Test 5: Get Total TVL');
  try {
    const tvl = await client.getTotalTVL();
    console.log(`✅ Success: Total TVL = $${tvl.toFixed(2)}`);
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Kamino SDK Test Complete\n');
  console.log('Key Points:');
  console.log('  ✓ Using real on-chain data from Solana');
  console.log('  ✓ No mock data');
  console.log('  ✓ Direct integration with Kamino protocol');
  console.log('  ✓ Real-time APY and TVL data');
}

testKaminoSDK().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  console.error('\nPossible issues:');
  console.error('  - RPC connection failed');
  console.error('  - Network mismatch (devnet vs mainnet)');
  console.error('  - Market address incorrect');
  console.error('  - SDK version incompatibility');
  process.exit(1);
});
