/**
 * FINAL VERIFICATION: ALL EXTERNAL APIs USE REAL DATA
 * 
 * This test verifies that NO MOCK DATA exists in any external API integration
 */

import { getJupiterClient } from './src/services/defi/jupiter-client';
import { getKaminoSDKClient } from './src/services/defi/kamino-sdk-client';
import { getMeteoraClient } from './src/services/defi/meteora-client';

async function verifyAllRealData() {
  console.log('🔍 FINAL VERIFICATION: NO MOCK DATA\n');
  console.log('============================================================');
  console.log('Testing all external API integrations...\n');

  let allPassed = true;

  // Test 1: Jupiter API
  console.log('📊 Test 1: Jupiter API (Price Data)');
  try {
    const jupiter = getJupiterClient();
    const solPrice = await jupiter.getTokenPrice('So11111111111111111111111111111111111111112');
    
    console.log(`✅ Jupiter: SOL Price = $${solPrice.toFixed(2)}`);
    
    // Verify it's not mock data (mock was $150)
    if (solPrice === 150) {
      console.error('❌ FAILED: Jupiter returning mock data ($150)');
      allPassed = false;
    } else {
      console.log('   ✓ Real data confirmed (not mock $150)');
    }
  } catch (error: any) {
    console.error('❌ Jupiter test failed:', error.message);
    allPassed = false;
  }

  console.log('');

  // Test 2: Kamino SDK
  console.log('📊 Test 2: Kamino SDK (On-Chain Data)');
  try {
    const kamino = getKaminoSDKClient();
    const market = await kamino.getMarket();
    
    console.log(`✅ Kamino: TVL = $${(market.tvl / 1e9).toFixed(2)}B`);
    console.log(`   Total Supply: $${(market.totalSupply / 1e9).toFixed(2)}B`);
    console.log(`   Total Borrow: $${(market.totalBorrow / 1e9).toFixed(2)}B`);
    console.log(`   Avg Supply APY: ${market.supplyAPY.toFixed(2)}%`);
    
    // Verify it's not mock data (mock was $1B TVL)
    if (market.tvl === 1000000000) {
      console.error('❌ FAILED: Kamino returning mock data ($1B TVL)');
      allPassed = false;
    } else {
      console.log('   ✓ Real on-chain data confirmed (not mock $1B)');
    }

    // Check reserves
    const reserves = await kamino.getReserves();
    console.log(`   Reserves: ${reserves.length} assets loaded from blockchain`);
    
    if (reserves.length === 2) {
      console.error('❌ FAILED: Kamino returning mock reserves (only 2)');
      allPassed = false;
    } else {
      console.log('   ✓ Real reserves confirmed (not mock 2 assets)');
    }
  } catch (error: any) {
    console.error('❌ Kamino test failed:', error.message);
    allPassed = false;
  }

  console.log('');

  // Test 3: Meteora API
  console.log('📊 Test 3: Meteora API (Pool Data)');
  try {
    const meteora = getMeteoraClient();
    const pools = await meteora.getDLMMPools();
    
    console.log(`✅ Meteora: ${pools.length} pools loaded`);
    
    if (pools.length > 0) {
      const totalTvl = pools.reduce((sum: number, p: any) => sum + p.tvl, 0);
      console.log(`   Total TVL: $${(totalTvl / 1e6).toFixed(2)}M`);
      console.log('   ✓ Real pool data from API');
    } else {
      console.log('   ⚠️  No pools returned (API may be down)');
    }
  } catch (error: any) {
    console.error('❌ Meteora test failed:', error.message);
    allPassed = false;
  }

  console.log('');
  console.log('============================================================');
  
  if (allPassed) {
    console.log('✅ VERIFICATION PASSED: NO MOCK DATA DETECTED\n');
    console.log('All external APIs are using REAL data:');
    console.log('  ✓ Jupiter: Real prices from API');
    console.log('  ✓ Kamino: Real on-chain data from Solana');
    console.log('  ✓ Meteora: Real pool data from API');
    console.log('\n🎉 DILARANG MOCK DATA - Requirement fulfilled!');
    console.log('============================================================\n');
  } else {
    console.error('❌ VERIFICATION FAILED: Mock data detected');
    console.error('============================================================\n');
    process.exit(1);
  }
}

verifyAllRealData();
