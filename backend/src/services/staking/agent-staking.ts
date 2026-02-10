import { getSupabaseClient } from '../supabase';
import { getHeliusStakingClient } from './helius-staking-client';
import { Keypair } from '@solana/web3.js';

interface StakingInfo {
  agent_id: string;
  staked_amount: number;
  pending_rewards: number;
  total_claimed: number;
  staked_at: Date;
  last_claim_at?: Date;
}

interface StakingRewards {
  agent_id: string;
  rewards: number;
  apy: number;
}

/**
 * Agent Staking System
 * Allows agents to stake ARU tokens for fee discounts and rewards
 */
export class AgentStakingSystem {
  private supabase: any;
  private heliusStaking: any;

  // Staking parameters
  private readonly FEE_DISCOUNT_RATE = 0.50; // 50% discount for stakers
  private readonly MIN_STAKE_AMOUNT = 100; // Minimum 100 ARU
  private readonly UNSTAKE_COOLDOWN_DAYS = 7; // 7 day cooldown

  constructor() {
    this.supabase = getSupabaseClient();
    this.heliusStaking = getHeliusStakingClient();
    console.log('✅ Agent Staking System initialized');
  }

  /**
   * Stake ARU tokens
   */
  async stakeICU(
    agentId: string,
    amount: number,
    agentKeypair: Keypair
  ): Promise<StakingInfo> {
    if (amount < this.MIN_STAKE_AMOUNT) {
      throw new Error(`Minimum stake amount is ${this.MIN_STAKE_AMOUNT} ARU`);
    }

    console.log(`🔒 Staking ${amount} ARU for agent: ${agentId}`);

    // Check if agent already has stake
    const { data: existing } = await this.supabase
      .from('agent_staking')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (existing) {
      // Add to existing stake
      const newAmount = existing.staked_amount + amount;

      const { data, error } = await this.supabase
        .from('agent_staking')
        .update({
          staked_amount: newAmount,
          updated_at: new Date()
        })
        .eq('agent_id', agentId)
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Added ${amount} ARU to existing stake (total: ${newAmount})`);
      return data;
    } else {
      // Create new stake
      const { data, error } = await this.supabase
        .from('agent_staking')
        .insert([{
          agent_id: agentId,
          staked_amount: amount,
          pending_rewards: 0,
          total_claimed: 0,
          staked_at: new Date()
        }])
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Staked ${amount} ARU for ${agentId}`);
      return data;
    }
  }

  /**
   * Unstake ARU tokens (with cooldown)
   */
  async unstakeICU(
    agentId: string,
    amount: number
  ): Promise<void> {
    console.log(`🔓 Unstaking ${amount} ARU for agent: ${agentId}`);

    const { data: staking, error: fetchError } = await this.supabase
      .from('agent_staking')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (fetchError || !staking) {
      throw new Error('No staking found for agent');
    }

    if (staking.staked_amount < amount) {
      throw new Error('Insufficient staked amount');
    }

    // Check cooldown
    if (staking.unstake_requested_at) {
      const cooldownEnd = new Date(staking.unstake_requested_at);
      cooldownEnd.setDate(cooldownEnd.getDate() + this.UNSTAKE_COOLDOWN_DAYS);

      if (new Date() < cooldownEnd) {
        const daysLeft = Math.ceil(
          (cooldownEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        throw new Error(`Cooldown period: ${daysLeft} days remaining`);
      }
    }

    // Request unstake (start cooldown)
    if (!staking.unstake_requested_at) {
      const { error } = await this.supabase
        .from('agent_staking')
        .update({
          unstake_requested_at: new Date(),
          unstake_amount: amount
        })
        .eq('agent_id', agentId);

      if (error) throw error;

      console.log(`⏳ Unstake requested. Cooldown: ${this.UNSTAKE_COOLDOWN_DAYS} days`);
      return;
    }

    // Execute unstake after cooldown
    const newAmount = staking.staked_amount - amount;

    const { error } = await this.supabase
      .from('agent_staking')
      .update({
        staked_amount: newAmount,
        unstake_requested_at: null,
        unstake_amount: null,
        updated_at: new Date()
      })
      .eq('agent_id', agentId);

    if (error) throw error;

    console.log(`✅ Unstaked ${amount} ARU (remaining: ${newAmount})`);
  }

  /**
   * Claim staking rewards
   */
  async claimRewards(agentId: string): Promise<number> {
    const { data: staking, error } = await this.supabase
      .from('agent_staking')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (error || !staking) {
      throw new Error('No staking found for agent');
    }

    const rewards = staking.pending_rewards;

    if (rewards === 0) {
      console.log('No rewards to claim');
      return 0;
    }

    // Update staking record
    const { error: updateError } = await this.supabase
      .from('agent_staking')
      .update({
        pending_rewards: 0,
        total_claimed: staking.total_claimed + rewards,
        last_claim_at: new Date()
      })
      .eq('agent_id', agentId);

    if (updateError) throw updateError;

    console.log(`💰 Claimed ${rewards} USDC rewards for ${agentId}`);
    return rewards;
  }

  /**
   * Get staking info for agent
   */
  async getStakingInfo(agentId: string): Promise<StakingInfo | null> {
    const { data, error } = await this.supabase
      .from('agent_staking')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Check if agent has staking (for fee discount)
   */
  async hasStaking(agentId: string): Promise<boolean> {
    const info = await this.getStakingInfo(agentId);
    return info !== null && info.staked_amount > 0;
  }

  /**
   * Get fee discount for agent
   */
  async getFeeDiscount(agentId: string): Promise<number> {
    const hasStake = await this.hasStaking(agentId);
    return hasStake ? this.FEE_DISCOUNT_RATE : 0;
  }

  /**
   * Calculate staking APY
   */
  async calculateStakingAPY(totalProtocolRevenue: number): Promise<number> {
    // Get total staked ARU
    const { data: stakers } = await this.supabase
      .from('agent_staking')
      .select('staked_amount');

    if (!stakers || stakers.length === 0) return 0;

    const totalStaked = stakers.reduce(
      (sum: number, s: any) => sum + s.staked_amount,
      0
    );

    // 30% of protocol revenue goes to stakers
    const annualStakingRewards = totalProtocolRevenue * 0.30;

    // APY = (Annual Rewards / Total Staked) * 100
    const apy = (annualStakingRewards / totalStaked) * 100;

    return apy;
  }

  /**
   * Get staking rewards for agent
   */
  async getStakingRewards(agentId: string): Promise<StakingRewards> {
    const info = await this.getStakingInfo(agentId);

    if (!info) {
      return {
        agent_id: agentId,
        rewards: 0,
        apy: 0
      };
    }

    // Calculate APY (example: 12.4% for 100 agents scenario)
    const apy = await this.calculateStakingAPY(20_700_000); // $20.7M annual revenue

    return {
      agent_id: agentId,
      rewards: info.pending_rewards,
      apy
    };
  }

  /**
   * Get all stakers
   */
  async getAllStakers(): Promise<StakingInfo[]> {
    const { data, error } = await this.supabase
      .from('agent_staking')
      .select('*')
      .order('staked_amount', { ascending: false });

    if (error) {
      console.error('Failed to get stakers:', error);
      return [];
    }

    return data;
  }

  /**
   * Get total staked ARU
   */
  async getTotalStaked(): Promise<number> {
    const stakers = await this.getAllStakers();
    return stakers.reduce((sum, s) => sum + s.staked_amount, 0);
  }

  /**
   * Stake SOL for additional rewards (via Helius)
   */
  async stakeSOL(
    agentId: string,
    amountInSol: number,
    agentKeypair: Keypair
  ): Promise<void> {
    console.log(`🔒 Staking ${amountInSol} SOL for agent: ${agentId}`);

    // Stake via Helius (0% commission)
    const result = await this.heliusStaking.stakeSOL(agentKeypair, amountInSol);

    // Record SOL staking
    const { error } = await this.supabase
      .from('agent_sol_staking')
      .insert([{
        agent_id: agentId,
        stake_account: result.stakeAccount,
        amount_sol: amountInSol,
        staked_at: new Date()
      }]);

    if (error) {
      console.error('Failed to record SOL staking:', error);
    }

    console.log(`✅ Staked ${amountInSol} SOL to Helius validator`);
    console.log(`   Stake Account: ${result.stakeAccount}`);
    console.log(`   APY: ~7% (0% commission)`);
  }

  /**
   * Get SOL staking info
   */
  async getSOLStakingInfo(agentId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('agent_sol_staking')
      .select('*')
      .eq('agent_id', agentId);

    if (error) {
      console.error('Failed to get SOL staking info:', error);
      return [];
    }

    return data;
  }

  /**
   * Calculate combined staking rewards (ARU + SOL)
   */
  async getCombinedRewards(agentId: string): Promise<any> {
    // ARU staking rewards
    const icuRewards = await this.getStakingRewards(agentId);

    // SOL staking rewards (estimated)
    const solStaking = await this.getSOLStakingInfo(agentId);
    const totalSOLStaked = solStaking.reduce((sum, s) => sum + s.amount_sol, 0);
    const solAPY = 7.0; // 7% average
    const estimatedSOLRewards = totalSOLStaked * (solAPY / 100);

    return {
      icu_rewards: icuRewards.rewards,
      icu_apy: icuRewards.apy,
      sol_staked: totalSOLStaked,
      sol_apy: solAPY,
      estimated_sol_rewards: estimatedSOLRewards,
      total_estimated_annual: icuRewards.rewards + estimatedSOLRewards
    };
  }
}

/**
 * Get agent staking system instance
 */
let stakingSystemInstance: AgentStakingSystem | null = null;

export function getAgentStakingSystem(): AgentStakingSystem {
  if (!stakingSystemInstance) {
    stakingSystemInstance = new AgentStakingSystem();
  }
  return stakingSystemInstance;
}
