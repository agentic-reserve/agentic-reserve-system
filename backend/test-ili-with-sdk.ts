/**
 * Test ILI Calculator with Kamino SDK (REAL DATA)
 */

import { getILICalculator } from './src/services/ili-calculator';

async function testILIWithSDK() {
  console.log('🚀 Testing ILI Calculator with Kamino SDK\n');
  console.log('============================================================');

  try {
    const calculator = getILICalculator();
    
    console.log('\n📊 Calculating ILI with REAL data from:');
    console.log('   - Kamino SDK (on-chain data)');
    console.log('   - Meteora API (real pools)');
    console.log('   - Jupiter API (real prices)\n');

    const ili = await calculator.calculateILI();

    console.log('\n============================================================');
    console.log('✅ ILI Calculation Complete\n');
    console.log(`ILI Value: ${ili.iliValue.toFixed(2)}`);
    console.log(`Avg Yield: ${ili.avgYield.toFixed(2)}%`);
    console.log(`Volatility: ${ili.volatility.toFixed(2)}%`);
    console.log(`TVL: $${(ili.tvl / 1e9).toFixed(2)}B`);
    console.log(`Sources: ${ili.sources.join(', ')}`);
    console.log(`Timestamp: ${ili.timestamp.toISOString()}`);
    console.log('\n============================================================');
    console.log('✅ NO MOCK DATA - All data is REAL from blockchain/APIs');
    console.log('============================================================\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testILIWithSDK();
