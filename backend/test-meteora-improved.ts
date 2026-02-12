/**
 * Test Improved Meteora Client
 */

import { getMeteoraClient } from './src/services/defi/meteora-client';

async function testMeteora() {
  console.log('🚀 Testing Improved Meteora Client\n');
  console.log('='.repeat(60));
  
  const client = getMeteoraClient();
  
  // Test 1: Get DLMM Pools
  console.log('\n📊 Test 1: Get DLMM Pools');
  try {
    const pools = await client.getDLMMPools();
    console.log(`✅ Success: Found ${pools.length} pools`);
    if (pools.length > 0) {
      console.log('Sample pools:');
      pools.slice(0, 3).forEach(pool => {
        console.log(`  - ${pool.name}: TVL $${parseFloat(pool.liquidity).toFixed(0)}`);
      });
    } else {
      console.log('⚠️  No pools returned (API may be down)');
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 2: Get Dynamic Vaults
  console.log('\n📊 Test 2: Get Dynamic Vaults');
  try {
    const vaults = await client.getDynamicVaults();
    console.log(`✅ Success: Found ${vaults.length} vaults`);
    if (vaults.length > 0) {
      console.log('Sample vaults:');
      vaults.slice(0, 3).forEach(vault => {
        console.log(`  - ${vault.name}: APY ${vault.apy?.toFixed(2)}%`);
      });
    } else {
      console.log('⚠️  No vaults returned (API may be down)');
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 3: Get Protocol TVL
  console.log('\n📊 Test 3: Get Protocol TVL');
  try {
    const tvl = await client.getProtocolTVL();
    if (tvl > 0) {
      console.log(`✅ Success: Protocol TVL = $${tvl.toFixed(0)}`);
    } else {
      console.log('⚠️  TVL = 0 (API may be down or no pools available)');
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 4: Get Top Pools by TVL
  console.log('\n📊 Test 4: Get Top Pools by TVL');
  try {
    const topPools = await client.getTopPoolsByTVL(5);
    console.log(`✅ Success: Found ${topPools.length} top pools`);
    topPools.forEach((pool, i) => {
      console.log(`  ${i + 1}. ${pool.name}: $${parseFloat(pool.liquidity).toFixed(0)}`);
    });
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 5: Error Handling (invalid pool address)
  console.log('\n📊 Test 5: Error Handling (Invalid Pool)');
  try {
    const pool = await client.getDLMMPool('InvalidAddress123');
    if (pool === null) {
      console.log('✅ Success: Gracefully returned null for invalid address');
    } else {
      console.log('⚠️  Unexpected: Got pool data for invalid address');
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Meteora Client Test Complete\n');
  console.log('Key Improvements:');
  console.log('  ✓ Returns empty array instead of throwing errors');
  console.log('  ✓ Graceful degradation when API is down');
  console.log('  ✓ Null checks for missing data');
  console.log('  ✓ App continues working even if Meteora fails');
}

testMeteora().catch(console.error);
