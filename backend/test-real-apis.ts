/**
 * Test Real API Integration (No Mock Data)
 * Tests Jupiter, Kamino SDK, and Meteora API
 */

import { getJupiterClient } from './src/services/defi/jupiter-client';
import { getKaminoClientReal } from './src/services/defi/kamino-client-real';
import { getMeteoraClient } from './src/services/defi/meteora-client';

interface TestResult {
  service: string;
  test: string;
  status: 'pass' | 'fail';
  data?: any;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function testService(
  service: string,
  test: string,
  fn: () => Promise<any>
): Promise<void> {
  const start = Date.now();
  try {
    console.log(`\n🧪 ${service}: ${test}`);
    const data = await fn();
    const duration = Date.now() - start;
    
    console.log(`   ✅ Pass (${duration}ms)`);
    if (data !== undefined && data !== null) {
      const preview = JSON.stringify(data).substring(0, 200);
      console.log(`   Data: ${preview}${preview.length >= 200 ? '...' : ''}`);
    }
    
    results.push({ service, test, status: 'pass', data, duration });
  } catch (error: any) {
    const duration = Date.now() - start;
    console.log(`   ❌ Fail (${duration}ms)`);
    console.log(`   Error: ${error.message}`);
    
    results.push({ service, test, status: 'fail', error: error.message, duration });
  }
}

async function main() {
  console.log('🚀 Testing Real API Integration (No Mock Data)\n');
  console.log('='.repeat(60));

  // ========================================
  // Jupiter API Tests
  // ========================================
  console.log('\n📊 JUPITER API (Real Data)');
  console.log('-'.repeat(60));
  
  const jupiter = getJupiterClient();
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  
  await testService('Jupiter', 'Get SOL Price', async () => {
    const price = await jupiter.getTokenPrice(SOL_MINT);
    if (price === 150) throw new Error('Using MOCK price ($150)');
    return { price, isMock: false };
  });
  
  await testService('Jupiter', 'Get Multiple Prices', async () => {
    const prices = await jupiter.getTokenPrices([SOL_MINT, USDC_MINT]);
    if (prices[SOL_MINT] === 150) throw new Error('Using MOCK prices');
    return { count: Object.keys(prices).length, prices };
  });

  // ========================================
  // Kamino SDK Tests
  // ========================================
  console.log('\n📊 KAMINO SDK (Real On-Chain Data)');
  console.log('-'.repeat(60));
  
  const kamino = getKaminoClientReal();
  
  await testService('Kamino', 'Get Main Market', async () => {
    const market = await kamino.getMarket();
    return {
      address: market.address,
      tvl: market.tvl,
      utilization: market.utilization.toFixed(2) + '%'
    };
  });
  
  await testService('Kamino', 'Get All Reserves', async () => {
    const reserves = await kamino.getReserves();
    return {
      count: reserves.length,
      reserves: reserves.slice(0, 3).map(r => ({
        symbol: r.symbol,
        supplyAPY: r.supplyAPY.toFixed(2) + '%',
        borrowAPY: r.borrowAPY.toFixed(2) + '%'
      }))
    };
  });
  
  await testService('Kamino', 'Get SOL Lending Rate', async () => {
    const rate = await kamino.getSOLLendingRate();
    return { rate: rate.toFixed(2) + '%' };
  });
  
  await testService('Kamino', 'Get USDC Lending Rate', async () => {
    const rate = await kamino.getUSDCLendingRate();
    return { rate: rate.toFixed(2) + '%' };
  });

  // ========================================
  // Meteora API Tests
  // ========================================
  console.log('\n📊 METEORA API (Real Data)');
  console.log('-'.repeat(60));
  
  const meteora = getMeteoraClient();
  
  await testService('Meteora', 'Get DLMM Pools', async () => {
    const pools = await meteora.getDLMMPools();
    return {
      count: pools.length,
      sample: pools.slice(0, 2).map(p => ({
        name: p.name,
        tvl: parseFloat(p.liquidity).toFixed(0)
      }))
    };
  });
  
  await testService('Meteora', 'Get Dynamic Vaults', async () => {
    const vaults = await meteora.getDynamicVaults();
    return {
      count: vaults.length,
      sample: vaults.slice(0, 2).map(v => ({
        name: v.name,
        apy: v.apy?.toFixed(2) + '%'
      }))
    };
  });
  
  await testService('Meteora', 'Get Protocol TVL', async () => {
    const tvl = await meteora.getProtocolTVL();
    return { tvl: tvl > 0 ? `$${tvl.toFixed(0)}` : 'N/A' };
  });

  // ========================================
  // Summary
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY\n');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);
  
  // Group by service
  const byService: Record<string, TestResult[]> = {};
  results.forEach(r => {
    if (!byService[r.service]) byService[r.service] = [];
    byService[r.service].push(r);
  });
  
  Object.entries(byService).forEach(([service, tests]) => {
    const servicePassed = tests.filter(t => t.status === 'pass').length;
    const serviceTotal = tests.length;
    const icon = servicePassed === serviceTotal ? '✅' : '⚠️';
    
    console.log(`${icon} ${service}: ${servicePassed}/${serviceTotal} passed`);
    tests.forEach(t => {
      const testIcon = t.status === 'pass' ? '  ✓' : '  ✗';
      console.log(`${testIcon} ${t.test} (${t.duration}ms)`);
      if (t.error) {
        console.log(`     Error: ${t.error}`);
      }
    });
    console.log('');
  });
  
  console.log('='.repeat(60));
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
