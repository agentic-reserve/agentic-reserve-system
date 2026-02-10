import { getSupabaseClient } from '../supabase';
import { getJupiterClient } from '../defi/jupiter-client';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

interface RevenueEvent {
  id?: string;
  event_type: 'transaction_fee' | 'oracle_query' | 'er_session' | 'ai_usage' | 'proposal_fee' | 'vault_management';
  amount_usdc: number;
  agent_id?: string;
  metadata?: any;
  timestamp: Date;
}

interface RevenueDistribution {
  buyback_amount: number;
  staking_amount: number;
  development_amount: number;
  insurance_amount: number;
  total_revenue: number;
}

/**
 * Revenue Tracking Service
 * Tracks all protocol revenue streams and handles distribution
 */
export class RevenueTracker {
  private supabase: any;
  private jupiter: any;

  // Fee rates
  private readonly TRANSACTION_FEE_RATE = 0.0005; // 0.05%
  private readonly ER_SESSION_FEE_RATE = 0.0002; // 0.02%
  private readonly AI_USAGE_MARKUP = 0.10; // 10%
  private readonly VAULT_MANAGEMENT_FEE_RATE = 0.001; // 0.1% annually
  private readonly PROPOSAL_FEE_ICU = 10; // 10 ARU burned

  // Oracle query fees
  private readonly ORACLE_FEES = {
    basic: 0, // Free
    realtime: 0.001, // 0.001 USDC
    premium: 0.01 // 0.01 USDC
  };

  // Distribution percentages
  private readonly DISTRIBUTION = {
    buyback: 0.40, // 40%
    staking: 0.30, // 30%
    development: 0.20, // 20%
    insurance: 0.10 // 10%
  };

  constructor() {
    this.supabase = getSupabaseClient();
    this.jupiter = getJupiterClient();
    console.log('✅ Revenue Tracker initialized');
  }

  /**
   * Track transaction fee (0.05%)
   */
  async trackTransactionFee(
    transactionValue: number,
    agentId: string,
    metadata?: any
  ): Promise<void> {
    const feeAmount = transactionValue * this.TRANSACTION_FEE_RATE;

    await this.recordRevenueEvent({
      event_type: 'transaction_fee',
      amount_usdc: feeAmount,
      agent_id: agentId,
      metadata: {
        transaction_value: transactionValue,
        fee_rate: this.TRANSACTION_FEE_RATE,
        ...metadata
      },
      timestamp: new Date()
    });

    console.log(`💰 Transaction fee: $${feeAmount.toFixed(4)} (${agentId})`);
  }

  /**
   * Track oracle query fee
   */
  async trackOracleQueryFee(
    queryType: 'basic' | 'realtime' | 'premium',
    agentId: string,
    metadata?: any
  ): Promise<void> {
    const feeAmount = this.ORACLE_FEES[queryType];

    if (feeAmount > 0) {
      await this.recordRevenueEvent({
        event_type: 'oracle_query',
        amount_usdc: feeAmount,
        agent_id: agentId,
        metadata: {
          query_type: queryType,
          ...metadata
        },
        timestamp: new Date()
      });

      console.log(`💰 Oracle query fee: $${feeAmount} (${queryType})`);
    }
  }

  /**
   * Track ER session fee (0.02%)
   */
  async trackERSessionFee(
    sessionValue: number,
    agentId: string,
    metadata?: any
  ): Promise<void> {
    const feeAmount = sessionValue * this.ER_SESSION_FEE_RATE;

    await this.recordRevenueEvent({
      event_type: 'er_session',
      amount_usdc: feeAmount,
      agent_id: agentId,
      metadata: {
        session_value: sessionValue,
        fee_rate: this.ER_SESSION_FEE_RATE,
        ...metadata
      },
      timestamp: new Date()
    });

    console.log(`💰 ER session fee: $${feeAmount.toFixed(4)} (${agentId})`);
  }

  /**
   * Track AI usage markup (10%)
   */
  async trackAIUsageMarkup(
    openRouterCost: number,
    agentId: string,
    metadata?: any
  ): Promise<void> {
    const markupAmount = openRouterCost * this.AI_USAGE_MARKUP;

    await this.recordRevenueEvent({
      event_type: 'ai_usage',
      amount_usdc: markupAmount,
      agent_id: agentId,
      metadata: {
        openrouter_cost: openRouterCost,
        markup_rate: this.AI_USAGE_MARKUP,
        total_charged: openRouterCost + markupAmount,
        ...metadata
      },
      timestamp: new Date()
    });

    console.log(`💰 AI usage markup: $${markupAmount.toFixed(4)} (${agentId})`);
  }

  /**
   * Track proposal fee (10 ARU burned)
   */
  async trackProposalFee(
    proposalId: string,
    agentId: string,
    icuPriceUSD: number
  ): Promise<void> {
    const feeAmountUSD = this.PROPOSAL_FEE_ICU * icuPriceUSD;

    await this.recordRevenueEvent({
      event_type: 'proposal_fee',
      amount_usdc: feeAmountUSD,
      agent_id: agentId,
      metadata: {
        proposal_id: proposalId,
        icu_burned: this.PROPOSAL_FEE_ICU,
        icu_price_usd: icuPriceUSD
      },
      timestamp: new Date()
    });

    // Update ARU total supply (burn)
    await this.burnICU(this.PROPOSAL_FEE_ICU);

    console.log(`💰 Proposal fee: ${this.PROPOSAL_FEE_ICU} ARU burned ($${feeAmountUSD.toFixed(2)})`);
  }

  /**
   * Track vault management fee (0.1% annually, charged quarterly)
   */
  async trackVaultManagementFee(
    vaultTVL: number,
    metadata?: any
  ): Promise<void> {
    // Quarterly fee = annual fee / 4
    const quarterlyFee = (vaultTVL * this.VAULT_MANAGEMENT_FEE_RATE) / 4;

    await this.recordRevenueEvent({
      event_type: 'vault_management',
      amount_usdc: quarterlyFee,
      metadata: {
        vault_tvl: vaultTVL,
        annual_fee_rate: this.VAULT_MANAGEMENT_FEE_RATE,
        ...metadata
      },
      timestamp: new Date()
    });

    console.log(`💰 Vault management fee: $${quarterlyFee.toFixed(2)} (quarterly)`);
  }

  /**
   * Record revenue event in database
   */
  private async recordRevenueEvent(event: RevenueEvent): Promise<void> {
    const { error } = await this.supabase
      .from('revenue_events')
      .insert([event]);

    if (error) {
      console.error('Failed to record revenue event:', error);
      throw error;
    }
  }

  /**
   * Get total revenue for period
   */
  async getTotalRevenue(
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from('revenue_events')
      .select('amount_usdc')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    if (error) {
      console.error('Failed to get total revenue:', error);
      return 0;
    }

    return data.reduce((sum: number, event: any) => sum + event.amount_usdc, 0);
  }

  /**
   * Get revenue breakdown by type
   */
  async getRevenueBreakdown(
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, number>> {
    const { data, error } = await this.supabase
      .from('revenue_events')
      .select('event_type, amount_usdc')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    if (error) {
      console.error('Failed to get revenue breakdown:', error);
      return {};
    }

    const breakdown: Record<string, number> = {};
    data.forEach((event: any) => {
      breakdown[event.event_type] = (breakdown[event.event_type] || 0) + event.amount_usdc;
    });

    return breakdown;
  }

  /**
   * Get agent revenue contributions
   */
  async getAgentRevenue(
    agentId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from('revenue_events')
      .select('amount_usdc')
      .eq('agent_id', agentId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    if (error) {
      console.error('Failed to get agent revenue:', error);
      return 0;
    }

    return data.reduce((sum: number, event: any) => sum + event.amount_usdc, 0);
  }

  /**
   * Distribute revenue according to allocation
   */
  async distributeRevenue(totalRevenue: number): Promise<RevenueDistribution> {
    const distribution: RevenueDistribution = {
      buyback_amount: totalRevenue * this.DISTRIBUTION.buyback,
      staking_amount: totalRevenue * this.DISTRIBUTION.staking,
      development_amount: totalRevenue * this.DISTRIBUTION.development,
      insurance_amount: totalRevenue * this.DISTRIBUTION.insurance,
      total_revenue: totalRevenue
    };

    console.log('💰 Revenue Distribution:');
    console.log(`   Total: $${totalRevenue.toFixed(2)}`);
    console.log(`   Buyback (40%): $${distribution.buyback_amount.toFixed(2)}`);
    console.log(`   Staking (30%): $${distribution.staking_amount.toFixed(2)}`);
    console.log(`   Development (20%): $${distribution.development_amount.toFixed(2)}`);
    console.log(`   Insurance (10%): $${distribution.insurance_amount.toFixed(2)}`);

    // Execute buyback
    if (distribution.buyback_amount > 0) {
      await this.executeBuyback(distribution.buyback_amount);
    }

    // Distribute staking rewards
    if (distribution.staking_amount > 0) {
      await this.distributeStakingRewards(distribution.staking_amount);
    }

    // Record distribution
    await this.recordDistribution(distribution);

    return distribution;
  }

  /**
   * Execute ARU buyback via Jupiter
   */
  private async executeBuyback(usdcAmount: number): Promise<void> {
    try {
      console.log(`🔄 Executing ARU buyback: $${usdcAmount.toFixed(2)}`);

      // Get quote for USDC -> ARU swap
      const quote = await this.jupiter.getQuote({
        inputMint: 'USDC_MINT_ADDRESS',
        outputMint: 'ICU_MINT_ADDRESS',
        amount: usdcAmount * 1_000_000, // Convert to lamports
        slippageBps: 50 // 0.5% slippage
      });

      // Execute swap
      // const swapResult = await this.jupiter.swap(quote, payerKeypair);

      console.log(`✅ Buyback executed: ${quote.outAmount} ARU`);

      // Burn bought ARU
      await this.burnICU(quote.outAmount / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Buyback failed:', error);
    }
  }

  /**
   * Distribute staking rewards to ARU stakers
   */
  private async distributeStakingRewards(amount: number): Promise<void> {
    console.log(`💎 Distributing staking rewards: $${amount.toFixed(2)}`);

    // Get all stakers
    const { data: stakers, error } = await this.supabase
      .from('agent_staking')
      .select('agent_id, staked_amount');

    if (error || !stakers) {
      console.error('Failed to get stakers:', error);
      return;
    }

    const totalStaked = stakers.reduce(
      (sum: number, s: any) => sum + s.staked_amount,
      0
    );

    if (totalStaked === 0) return;

    // Distribute proportionally
    for (const staker of stakers) {
      const share = (staker.staked_amount / totalStaked) * amount;

      await this.supabase
        .from('agent_staking')
        .update({
          pending_rewards: share
        })
        .eq('agent_id', staker.agent_id);

      console.log(`   ${staker.agent_id}: $${share.toFixed(4)}`);
    }
  }

  /**
   * Record revenue distribution
   */
  private async recordDistribution(distribution: RevenueDistribution): Promise<void> {
    const { error } = await this.supabase
      .from('revenue_distributions')
      .insert([{
        ...distribution,
        timestamp: new Date()
      }]);

    if (error) {
      console.error('Failed to record distribution:', error);
    }
  }

  /**
   * Burn ARU tokens
   */
  private async burnICU(amount: number): Promise<void> {
    // Update total supply in database
    const { error } = await this.supabase
      .from('icu_token_supply')
      .update({
        total_supply: this.supabase.raw(`total_supply - ${amount}`),
        burned_amount: this.supabase.raw(`burned_amount + ${amount}`)
      })
      .eq('id', 1);

    if (error) {
      console.error('Failed to update ARU supply:', error);
    }

    console.log(`🔥 Burned ${amount} ARU tokens`);
  }

  /**
   * Calculate revenue projections
   */
  calculateProjections(
    activeAgents: number,
    avgTransactionsPerDay: number = 1000
  ): any {
    const dailyTransactionFees = avgTransactionsPerDay * 10000 * this.TRANSACTION_FEE_RATE;
    const dailyOracleQueries = activeAgents * 10 * this.ORACLE_FEES.realtime;
    const dailyERSessions = activeAgents * 50 * this.ER_SESSION_FEE_RATE;
    const dailyAIUsage = activeAgents * 5 * this.AI_USAGE_MARKUP;

    const dailyRevenue = dailyTransactionFees + dailyOracleQueries + dailyERSessions + dailyAIUsage;

    return {
      daily: dailyRevenue,
      monthly: dailyRevenue * 30,
      annual: dailyRevenue * 365,
      breakdown: {
        transaction_fees: dailyTransactionFees,
        oracle_queries: dailyOracleQueries,
        er_sessions: dailyERSessions,
        ai_usage: dailyAIUsage
      }
    };
  }
}

/**
 * Get revenue tracker instance
 */
let revenueTrackerInstance: RevenueTracker | null = null;

export function getRevenueTracker(): RevenueTracker {
  if (!revenueTrackerInstance) {
    revenueTrackerInstance = new RevenueTracker();
  }
  return revenueTrackerInstance;
}
