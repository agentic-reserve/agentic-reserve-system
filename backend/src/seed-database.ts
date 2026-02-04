/**
 * Database Seeding Script
 * Seeds the database with 7 days of historical data for demo purposes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Helper to generate random data within range
const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

// Helper to generate timestamp for N days ago
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function seedILIHistory() {
  console.log('Seeding ILI history...');
  
  const iliData = [];
  const baseILI = 500;
  
  // Generate 7 days of hourly data (168 data points)
  for (let i = 168; i >= 0; i--) {
    const timestamp = new Date(Date.now() - i * 60 * 60 * 1000);
    const variation = randomInRange(-50, 50);
    const ili_value = baseILI + variation;
    
    iliData.push({
      timestamp: timestamp.toISOString(),
      ili_value: ili_value.toFixed(2),
      avg_yield: randomInRange(500, 1500).toFixed(0), // 5-15% in basis points
      volatility: randomInRange(100, 500).toFixed(0), // 1-5% in basis points
      tvl_usd: randomInRange(10000000, 50000000).toFixed(2), // $10M-$50M
      source_data: JSON.stringify({
        jupiter_volume: randomInRange(1000000, 5000000),
        meteora_tvl: randomInRange(5000000, 15000000),
        kamino_tvl: randomInRange(3000000, 10000000),
      }),
    });
  }
  
  const { error } = await supabase
    .from('ili_history')
    .insert(iliData);
  
  if (error) {
    console.error('Error seeding ILI history:', error);
  } else {
    console.log(`✓ Seeded ${iliData.length} ILI history records`);
  }
}

async function seedProposals() {
  console.log('Seeding proposals...');
  
  const proposals = [
    {
      id: 1,
      proposer: 'AgentLending123',
      policy_type: 'mint',
      policy_params: JSON.stringify({ amount: 1000000, reason: 'Expand liquidity based on low ILI' }),
      start_time: daysAgo(5).toISOString(),
      end_time: daysAgo(4).toISOString(),
      yes_stake: 15000,
      no_stake: 8000,
      status: 'executed',
      execution_tx: 'tx_' + Math.random().toString(36).substring(7),
      proposal_fee: 10,
    },
    {
      id: 2,
      proposer: 'AgentGovernance456',
      policy_type: 'rebalance',
      policy_params: JSON.stringify({ from_asset: 'SOL', to_asset: 'USDC', amount: 500000 }),
      start_time: daysAgo(3).toISOString(),
      end_time: daysAgo(2).toISOString(),
      yes_stake: 12000,
      no_stake: 5000,
      status: 'passed',
      proposal_fee: 10,
    },
    {
      id: 3,
      proposer: 'AgentRisk789',
      policy_type: 'burn',
      policy_params: JSON.stringify({ amount: 500000, reason: 'Reduce supply due to high ILI' }),
      start_time: daysAgo(2).toISOString(),
      end_time: daysAgo(1).toISOString(),
      yes_stake: 8000,
      no_stake: 14000,
      status: 'rejected',
      proposal_fee: 10,
    },
    {
      id: 4,
      proposer: 'AgentMonitoring101',
      policy_type: 'icr_update',
      policy_params: JSON.stringify({ new_icr: 7.5, reason: 'Adjust based on market conditions' }),
      start_time: daysAgo(1).toISOString(),
      end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      yes_stake: 10000,
      no_stake: 6000,
      status: 'active',
      proposal_fee: 10,
    },
  ];
  
  const { error } = await supabase
    .from('proposals')
    .upsert(proposals, { onConflict: 'id' });
  
  if (error) {
    console.error('Error seeding proposals:', error);
  } else {
    console.log(`✓ Seeded ${proposals.length} proposals`);
  }
}

async function seedVotes() {
  console.log('Seeding votes...');
  
  const votes = [
    { proposal_id: 1, agent_pubkey: 'Agent1', agent_type: 'lending', stake_amount: 5000, prediction: true, timestamp: daysAgo(5).toISOString(), claimed: true },
    { proposal_id: 1, agent_pubkey: 'Agent2', agent_type: 'yield', stake_amount: 10000, prediction: true, timestamp: daysAgo(5).toISOString(), claimed: true },
    { proposal_id: 1, agent_pubkey: 'Agent3', agent_type: 'liquidity', stake_amount: 8000, prediction: false, timestamp: daysAgo(5).toISOString(), claimed: false },
    { proposal_id: 2, agent_pubkey: 'Agent4', agent_type: 'governance', stake_amount: 12000, prediction: true, timestamp: daysAgo(3).toISOString(), claimed: false },
    { proposal_id: 2, agent_pubkey: 'Agent5', agent_type: 'risk', stake_amount: 5000, prediction: false, timestamp: daysAgo(3).toISOString(), claimed: false },
    { proposal_id: 3, agent_pubkey: 'Agent6', agent_type: 'prediction', stake_amount: 8000, prediction: true, timestamp: daysAgo(2).toISOString(), claimed: false },
    { proposal_id: 3, agent_pubkey: 'Agent7', agent_type: 'treasury', stake_amount: 14000, prediction: false, timestamp: daysAgo(2).toISOString(), claimed: false },
    { proposal_id: 4, agent_pubkey: 'Agent8', agent_type: 'monitoring', stake_amount: 10000, prediction: true, timestamp: daysAgo(1).toISOString(), claimed: false },
    { proposal_id: 4, agent_pubkey: 'Agent9', agent_type: 'arbitrage', stake_amount: 6000, prediction: false, timestamp: daysAgo(1).toISOString(), claimed: false },
  ];
  
  const { error } = await supabase
    .from('votes')
    .insert(votes);
  
  if (error) {
    console.error('Error seeding votes:', error);
  } else {
    console.log(`✓ Seeded ${votes.length} votes`);
  }
}

async function seedAgents() {
  console.log('Seeding agents...');
  
  const agents = [
    { agent_pubkey: 'Agent1', agent_type: 'lending', total_transactions: 150, total_volume: 5000000, total_fees_paid: 2500, reputation_score: 95, registered_at: daysAgo(30).toISOString(), last_active: new Date().toISOString() },
    { agent_pubkey: 'Agent2', agent_type: 'yield', total_transactions: 200, total_volume: 8000000, total_fees_paid: 4000, reputation_score: 98, registered_at: daysAgo(25).toISOString(), last_active: new Date().toISOString() },
    { agent_pubkey: 'Agent3', agent_type: 'liquidity', total_transactions: 180, total_volume: 6500000, total_fees_paid: 3250, reputation_score: 92, registered_at: daysAgo(20).toISOString(), last_active: new Date().toISOString() },
    { agent_pubkey: 'Agent4', agent_type: 'governance', total_transactions: 50, total_volume: 1000000, total_fees_paid: 500, reputation_score: 88, registered_at: daysAgo(15).toISOString(), last_active: new Date().toISOString() },
    { agent_pubkey: 'Agent5', agent_type: 'risk', total_transactions: 120, total_volume: 4000000, total_fees_paid: 2000, reputation_score: 90, registered_at: daysAgo(10).toISOString(), last_active: new Date().toISOString() },
  ];
  
  const { error } = await supabase
    .from('agents')
    .upsert(agents, { onConflict: 'agent_pubkey' });
  
  if (error) {
    console.error('Error seeding agents:', error);
  } else {
    console.log(`✓ Seeded ${agents.length} agents`);
  }
}

async function seedReserveEvents() {
  console.log('Seeding reserve events...');
  
  const events = [];
  
  for (let i = 7; i >= 0; i--) {
    events.push({
      event_type: i % 2 === 0 ? 'rebalance' : 'deposit',
      from_asset: 'SOL',
      to_asset: 'USDC',
      amount: randomInRange(100000, 500000).toFixed(2),
      vhr_before: randomInRange(150, 200).toFixed(2),
      vhr_after: randomInRange(160, 210).toFixed(2),
      timestamp: daysAgo(i).toISOString(),
      transaction_signature: 'tx_' + Math.random().toString(36).substring(7),
      metadata: JSON.stringify({ reason: 'Automated rebalancing', trigger: 'volatility_threshold' }),
    });
  }
  
  const { error } = await supabase
    .from('reserve_events')
    .insert(events);
  
  if (error) {
    console.error('Error seeding reserve events:', error);
  } else {
    console.log(`✓ Seeded ${events.length} reserve events`);
  }
}

async function seedRevenueEvents() {
  console.log('Seeding revenue events...');
  
  const revenueTypes = ['transaction_fee', 'oracle_query_fee', 'er_session_fee', 'ai_usage_markup', 'proposal_fee', 'vault_management_fee'];
  const events = [];
  
  // Generate daily revenue events for 7 days
  for (let day = 7; day >= 0; day--) {
    for (const type of revenueTypes) {
      const amount = type === 'transaction_fee' ? randomInRange(50, 200) :
                     type === 'oracle_query_fee' ? randomInRange(1, 10) :
                     type === 'er_session_fee' ? randomInRange(10, 50) :
                     type === 'ai_usage_markup' ? randomInRange(5, 25) :
                     type === 'proposal_fee' ? 10 :
                     randomInRange(20, 100);
      
      events.push({
        revenue_type: type,
        amount_usd: amount.toFixed(2),
        agent_pubkey: 'Agent' + (Math.floor(Math.random() * 5) + 1),
        timestamp: daysAgo(day).toISOString(),
        metadata: JSON.stringify({ source: 'automated', period: 'daily' }),
      });
    }
  }
  
  const { error } = await supabase
    .from('revenue_events')
    .insert(events);
  
  if (error) {
    console.error('Error seeding revenue events:', error);
  } else {
    console.log(`✓ Seeded ${events.length} revenue events`);
  }
}

async function seedAgentStaking() {
  console.log('Seeding agent staking...');
  
  const staking = [
    { agent_pubkey: 'Agent1', staked_amount: 10000, rewards_earned: 150, last_claim: daysAgo(1).toISOString(), stake_timestamp: daysAgo(30).toISOString() },
    { agent_pubkey: 'Agent2', staked_amount: 25000, rewards_earned: 400, last_claim: daysAgo(2).toISOString(), stake_timestamp: daysAgo(25).toISOString() },
    { agent_pubkey: 'Agent3', staked_amount: 15000, rewards_earned: 220, last_claim: daysAgo(3).toISOString(), stake_timestamp: daysAgo(20).toISOString() },
    { agent_pubkey: 'Agent4', staked_amount: 5000, rewards_earned: 75, last_claim: daysAgo(1).toISOString(), stake_timestamp: daysAgo(15).toISOString() },
    { agent_pubkey: 'Agent5', staked_amount: 12000, rewards_earned: 180, last_claim: daysAgo(2).toISOString(), stake_timestamp: daysAgo(10).toISOString() },
  ];
  
  const { error } = await supabase
    .from('agent_staking')
    .upsert(staking, { onConflict: 'agent_pubkey' });
  
  if (error) {
    console.error('Error seeding agent staking:', error);
  } else {
    console.log(`✓ Seeded ${staking.length} agent staking records`);
  }
}

async function main() {
  console.log('========================================');
  console.log('ARS Database Seeding Script');
  console.log('========================================\n');
  
  try {
    await seedILIHistory();
    await seedProposals();
    await seedVotes();
    await seedAgents();
    await seedReserveEvents();
    await seedRevenueEvents();
    await seedAgentStaking();
    
    console.log('\n========================================');
    console.log('✓ Database seeding completed successfully!');
    console.log('========================================');
  } catch (error) {
    console.error('\n✗ Error during seeding:', error);
    process.exit(1);
  }
}

main();
