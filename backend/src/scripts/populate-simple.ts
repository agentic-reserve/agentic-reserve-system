/**
 * Populate Database with Sample Data (Simplified)
 * 
 * This script populates Supabase with realistic sample data for demo
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY!
);

async function populateSimpleData() {
  console.log('🚀 Starting database population...\n');

  const now = Date.now();

  try {
    // 1. Generate historical ILI data (last 7 days, every 5 minutes)
    console.log('📈 Step 1: Generating historical ILI data (7 days)...');
    const historicalILI = [];
    const baseILI = 512.45;

    for (let i = 0; i < 7 * 24 * 12; i++) { // Every 5 minutes for 7 days
      const timestamp = new Date(now - i * 5 * 60 * 1000);
      const variance = (Math.random() - 0.5) * 20;
      
      historicalILI.push({
        timestamp: timestamp.toISOString(),
        ili_value: (baseILI + variance).toFixed(2),
        avg_yield: (8.5 + (Math.random() - 0.5) * 2).toFixed(2),
        volatility: (12.3 + (Math.random() - 0.5) * 5).toFixed(2),
        tvl_usd: (2500000000 * (1 + (Math.random() - 0.5) * 0.1)).toFixed(2),
        source_data: {
          sources: ['kamino', 'meteora', 'jupiter', 'pyth'],
          components: {}
        }
      });
    }

    // Insert in batches
    const batchSize = 1000;
    for (let i = 0; i < historicalILI.length; i += batchSize) {
      const batch = historicalILI.slice(i, i + batchSize);
      const { error } = await supabase.from('ili_history').insert(batch);
      if (error) {
        console.error(`❌ Batch ${i / batchSize + 1} failed:`, error.message);
      } else {
        console.log(`✅ Inserted batch ${i / batchSize + 1}/${Math.ceil(historicalILI.length / batchSize)}`);
      }
    }

    // 2. Create sample proposals
    console.log('\n📝 Step 2: Creating sample proposals...');
    const proposals = [
      {
        proposer: 'AgentPolicyExecutor1111111111111111111111111',
        policy_type: 'MintICU',
        policy_params: JSON.stringify({
          amount: 1000000,
          reason: 'Increase ARU supply to meet growing demand from autonomous agents'
        }),
        status: 'active',
        yes_stake: 50000,
        no_stake: 30000,
        start_time: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        end_time: new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        proposer: 'AgentPolicyExecutor2222222222222222222222222',
        policy_type: 'UpdateICR',
        policy_params: JSON.stringify({
          new_icr: 8.5,
          reason: 'Adjust interest rate based on market conditions'
        }),
        status: 'passed',
        yes_stake: 80000,
        no_stake: 20000,
        start_time: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_time: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        execution_tx: '5xKjH3vN2pQrM8wYzT4bL9cF6dE1aR7sW3qP5nM8hG2k',
        created_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        proposer: 'AgentPolicyExecutor3333333333333333333333333',
        policy_type: 'RebalanceVault',
        policy_params: JSON.stringify({
          from_asset: 'SOL',
          to_asset: 'USDC',
          amount: 500000,
          reason: 'Reduce volatility exposure during market uncertainty'
        }),
        status: 'executed',
        yes_stake: 100000,
        no_stake: 15000,
        start_time: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        end_time: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        execution_tx: '3yH9mK2nL5pR8wT4vB6cD1eF7aG3sW9qP2nM5hJ8kL4x',
        created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const { error: proposalError } = await supabase.from('proposals').insert(proposals);
    if (proposalError) {
      console.error('❌ Failed to insert proposals:', proposalError.message);
    } else {
      console.log(`✅ Created ${proposals.length} sample proposals`);
    }

    // 3. Create reserve events
    console.log('\n🏦 Step 3: Creating reserve events...');
    const reserveEvents = [];
    for (let i = 0; i < 30; i++) {
      const timestamp = new Date(now - i * 24 * 60 * 60 * 1000);
      reserveEvents.push({
        timestamp: timestamp.toISOString(),
        event_type: 'rebalance',
        from_asset: i % 2 === 0 ? 'SOL' : 'USDC',
        to_asset: i % 2 === 0 ? 'USDC' : 'mSOL',
        amount: (Math.random() * 500000 + 100000).toFixed(2),
        vhr_before: (170 + Math.random() * 10).toFixed(2),
        vhr_after: (175 + Math.random() * 10).toFixed(2),
        transaction_signature: `${i}xRebalance${Math.random().toString(36).substring(7)}`,
        metadata: JSON.stringify({
          reason: 'Automated rebalancing',
          trigger: 'VHR threshold'
        })
      });
    }

    const { error: reserveError } = await supabase.from('reserve_events').insert(reserveEvents);
    if (reserveError) {
      console.error('❌ Failed to insert reserve events:', reserveError.message);
    } else {
      console.log(`✅ Created ${reserveEvents.length} reserve events`);
    }

    // 4. Create revenue events
    console.log('\n💵 Step 4: Creating revenue events...');
    const revenueEvents = [];
    for (let i = 0; i < 90; i++) {
      const timestamp = new Date(now - i * 24 * 60 * 60 * 1000);
      const agentNum = (i % 5) + 1;
      revenueEvents.push({
        timestamp: timestamp.toISOString(),
        revenue_type: ['transaction_fee', 'oracle_query_fee', 'proposal_fee'][i % 3],
        amount_usd: (Math.random() * 5000 + 1000).toFixed(2),
        agent_pubkey: `Agent${agentNum}${'1'.repeat(38 - agentNum.toString().length)}`,
        metadata: JSON.stringify({
          source: 'automated',
          protocol: ['kamino', 'meteora', 'jupiter'][i % 3]
        })
      });
    }

    const { error: revenueError } = await supabase.from('revenue_events').insert(revenueEvents);
    if (revenueError) {
      console.error('❌ Failed to insert revenue events:', revenueError.message);
    } else {
      console.log(`✅ Created ${revenueEvents.length} revenue events`);
    }

    // 5. Create agent staking data
    console.log('\n🤖 Step 5: Creating agent staking data...');
    const stakingData = [];
    for (let i = 1; i <= 10; i++) {
      stakingData.push({
        agent_pubkey: `Agent${i}${'1'.repeat(38 - i.toString().length)}`,
        staked_icu: Math.floor(Math.random() * 50000 + 10000),
        staking_start: new Date(now - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
        rewards_claimed: Math.floor(Math.random() * 5000 + 500),
        fee_discount_active: true,
        metadata: JSON.stringify({
          agent_name: `Security Agent ${i}`,
          role: ['red_team', 'blue_team', 'blockchain_security'][i % 3],
          uptime: (95 + Math.random() * 5).toFixed(2) + '%',
          performance_score: Math.floor(Math.random() * 30 + 70)
        })
      });
    }

    const { error: stakingError } = await supabase.from('agent_staking').insert(stakingData);
    if (stakingError) {
      console.error('❌ Failed to insert staking data:', stakingError.message);
    } else {
      console.log(`✅ Created ${stakingData.length} agent staking records`);
    }

    console.log('\n✅ Database population complete!');
    console.log('\n📊 Summary:');
    console.log(`   - ILI History: ${historicalILI.length} records (7 days)`);
    console.log(`   - Proposals: ${proposals.length} records`);
    console.log(`   - Reserve Events: ${reserveEvents.length} records`);
    console.log(`   - Revenue Events: ${revenueEvents.length} records`);
    console.log(`   - Agent Staking: ${stakingData.length} records`);
    console.log('\n🎉 Database is now ready for demo!');

  } catch (error) {
    console.error('\n❌ Population failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  populateSimpleData();
}

export { populateSimpleData };
