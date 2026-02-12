import { supabase } from '../supabase';
import { redisClient } from '../redis';

interface TokenPosition {
  tokenMint: string;
  amount: number;
  costBasis: number;
  totalCost: number;
}

interface Trade {
  signature: string;
  timestamp: number;
  tokenIn: string;
  amountIn: number;
  tokenOut: string;
  amountOut: number;
  realizedPnL: number;
  fees: number;
}

interface CostBasisEntry {
  id: number;
  tokenMint: string;
  amount: number;
  costPerToken: number;
  totalCost: number;
  acquiredAt: number;
  transactionSignature: string;
}

interface PnLResult {
  walletAddress: string;
  period: '24h' | '7d' | '30d' | 'all';
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  returnPercentage: number;
  feesPaid: number;
  byToken: Record<string, {
    realizedPnL: number;
    unrealizedPnL: number;
    totalPnL: number;
  }>;
  isStale: boolean;
}

export class PnLCalculator {
  /**
   * Calculate realized PnL using FIFO cost basis method
   */
  async calculateRealizedPnL(
    walletAddress: string,
    fromTimestamp: number,
    toTimestamp: number
  ): Promise<{ realizedPnL: number; feesPaid: number; byToken: Record<string, number> }> {
    // Get all transactions in the period
    const { data: transactions, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_address', walletAddress)
      .gte('timestamp', fromTimestamp)
      .lte('timestamp', toTimestamp)
      .in('transaction_type', ['swap', 'liquidity_remove'])
      .order('timestamp', { ascending: true });

    if (error) throw error;

    let totalRealizedPnL = 0;
    let totalFees = 0;
    const pnlByToken: Record<string, number> = {};

    for (const tx of transactions || []) {
      // Extract fee from metadata
      const fee = tx.fee_amount || 0;
      totalFees += fee;

      if (tx.transaction_type === 'swap') {
        // For swaps, calculate PnL based on cost basis
        const tokenOut = tx.token_mint;
        const amountOut = tx.amount;

        // Get cost basis for tokens being sold
        const costBasis = await this.getCostBasisForSale(
          walletAddress,
          tokenOut,
          amountOut,
          tx.timestamp
        );

        // Calculate realized PnL
        const saleValue = tx.metadata?.tokenInAmount || 0;
        const realizedPnL = saleValue - costBasis - fee;

        totalRealizedPnL += realizedPnL;
        pnlByToken[tokenOut] = (pnlByToken[tokenOut] || 0) + realizedPnL;

        // Update cost basis entries (remove sold tokens)
        await this.consumeCostBasis(walletAddress, tokenOut, amountOut, tx.timestamp);

        // Add cost basis for tokens received
        const tokenIn = tx.metadata?.tokenInMint;
        const amountIn = tx.metadata?.tokenInAmount;
        if (tokenIn && amountIn) {
          await this.addCostBasis(
            walletAddress,
            tokenIn,
            amountIn,
            saleValue + fee,
            tx.timestamp,
            tx.signature
          );
        }
      }
    }

    return {
      realizedPnL: totalRealizedPnL,
      feesPaid: totalFees,
      byToken: pnlByToken,
    };
  }

  /**
   * Calculate unrealized PnL for open positions
   */
  async calculateUnrealizedPnL(walletAddress: string): Promise<{
    unrealizedPnL: number;
    byToken: Record<string, { amount: number; costBasis: number; currentValue: number; unrealizedPnL: number }>;
    isStale: boolean;
  }> {
    // Get current balances
    const { data: balances, error } = await supabase
      .from('wallet_balances')
      .select('*')
      .eq('wallet_address', walletAddress);

    if (error) throw error;

    let totalUnrealizedPnL = 0;
    const byToken: Record<string, any> = {};
    let isStale = false;

    for (const balance of balances || []) {
      // Get cost basis for this token
      const { data: costBasisEntries, error: cbError } = await supabase
        .from('cost_basis')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('token_mint', balance.token_mint)
        .order('acquired_at', { ascending: true });

      if (cbError) throw cbError;

      const totalCostBasis = (costBasisEntries || []).reduce(
        (sum, entry) => sum + entry.total_cost,
        0
      );

      // Get current price (from balance.usd_value or fetch from oracle)
      const currentValue = balance.usd_value || 0;
      
      // Check if price is stale (> 15 minutes old)
      const priceAge = Date.now() - balance.last_updated;
      if (priceAge > 15 * 60 * 1000) {
        isStale = true;
      }

      const unrealizedPnL = currentValue - totalCostBasis;
      totalUnrealizedPnL += unrealizedPnL;

      byToken[balance.token_mint] = {
        amount: balance.amount,
        costBasis: totalCostBasis,
        currentValue,
        unrealizedPnL,
      };
    }

    return {
      unrealizedPnL: totalUnrealizedPnL,
      byToken,
      isStale,
    };
  }

  /**
   * Calculate total PnL for a time period
   */
  async calculateTotalPnL(
    walletAddress: string,
    period: '24h' | '7d' | '30d' | 'all'
  ): Promise<PnLResult> {
    const now = Date.now();
    const periodMs = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      'all': now,
    };

    const fromTimestamp = period === 'all' ? 0 : now - periodMs[period];

    // Calculate realized PnL
    const realized = await this.calculateRealizedPnL(walletAddress, fromTimestamp, now);

    // Calculate unrealized PnL
    const unrealized = await this.calculateUnrealizedPnL(walletAddress);

    // Combine by token
    const byToken: Record<string, any> = {};
    
    // Add realized PnL
    for (const [token, pnl] of Object.entries(realized.byToken)) {
      byToken[token] = {
        realizedPnL: pnl,
        unrealizedPnL: 0,
        totalPnL: pnl,
      };
    }

    // Add unrealized PnL
    for (const [token, data] of Object.entries(unrealized.byToken)) {
      if (!byToken[token]) {
        byToken[token] = { realizedPnL: 0, unrealizedPnL: 0, totalPnL: 0 };
      }
      byToken[token].unrealizedPnL = data.unrealizedPnL;
      byToken[token].totalPnL = byToken[token].realizedPnL + data.unrealizedPnL;
    }

    const totalPnL = realized.realizedPnL + unrealized.unrealizedPnL;

    // Calculate return percentage (simplified - would need initial portfolio value)
    const returnPercentage = 0; // TODO: Calculate based on initial investment

    return {
      walletAddress,
      period,
      realizedPnL: realized.realizedPnL,
      unrealizedPnL: unrealized.unrealizedPnL,
      totalPnL,
      returnPercentage,
      feesPaid: realized.feesPaid,
      byToken,
      isStale: unrealized.isStale,
    };
  }

  /**
   * Calculate PnL for all registered wallets and store snapshots
   */
  async calculateAllWallets(): Promise<void> {
    console.log('Starting PnL calculation for all wallets...');

    // Get all active registered wallets
    const { data: registrations, error } = await supabase
      .from('wallet_registrations')
      .select('address')
      .eq('indexing_status', 'active');

    if (error) {
      console.error('Error fetching wallet registrations:', error);
      return;
    }

    const periods: Array<'24h' | '7d' | '30d' | 'all'> = ['24h', '7d', '30d', 'all'];

    for (const registration of registrations || []) {
      try {
        for (const period of periods) {
          const pnl = await this.calculateTotalPnL(registration.address, period);

          // Store snapshot
          await supabase.from('wallet_pnl').insert({
            wallet_address: pnl.walletAddress,
            period: pnl.period,
            realized_pnl: pnl.realizedPnL,
            unrealized_pnl: pnl.unrealizedPnL,
            total_pnl: pnl.totalPnL,
            return_percentage: pnl.returnPercentage,
            fees_paid: pnl.feesPaid,
            by_token: pnl.byToken,
            calculated_at: Date.now(),
            is_stale: pnl.isStale,
          });

          // Invalidate cache
          if (redisClient) {
            await redisClient.del(`wallet:${registration.address}:pnl:${period}`);
          }
        }

        console.log(`PnL calculated for wallet: ${registration.address}`);
      } catch (error) {
        console.error(`Error calculating PnL for ${registration.address}:`, error);
      }
    }

    console.log('PnL calculation complete');
  }

  /**
   * Get cost basis for selling tokens (FIFO method)
   */
  private async getCostBasisForSale(
    walletAddress: string,
    tokenMint: string,
    amountToSell: number,
    timestamp: number
  ): Promise<number> {
    const { data: entries, error } = await supabase
      .from('cost_basis')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('token_mint', tokenMint)
      .lte('acquired_at', timestamp)
      .order('acquired_at', { ascending: true });

    if (error) throw error;

    let remainingToSell = amountToSell;
    let totalCost = 0;

    for (const entry of entries || []) {
      if (remainingToSell <= 0) break;

      const amountFromEntry = Math.min(remainingToSell, entry.amount);
      totalCost += amountFromEntry * entry.cost_per_token;
      remainingToSell -= amountFromEntry;
    }

    return totalCost;
  }

  /**
   * Consume cost basis entries when selling tokens (FIFO)
   */
  private async consumeCostBasis(
    walletAddress: string,
    tokenMint: string,
    amountToSell: number,
    timestamp: number
  ): Promise<void> {
    const { data: entries, error } = await supabase
      .from('cost_basis')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('token_mint', tokenMint)
      .lte('acquired_at', timestamp)
      .order('acquired_at', { ascending: true });

    if (error) throw error;

    let remainingToSell = amountToSell;

    for (const entry of entries || []) {
      if (remainingToSell <= 0) break;

      if (entry.amount <= remainingToSell) {
        // Consume entire entry
        await supabase.from('cost_basis').delete().eq('id', entry.id);
        remainingToSell -= entry.amount;
      } else {
        // Partial consumption - update entry
        const newAmount = entry.amount - remainingToSell;
        const newTotalCost = newAmount * entry.cost_per_token;
        
        await supabase
          .from('cost_basis')
          .update({
            amount: newAmount,
            total_cost: newTotalCost,
          })
          .eq('id', entry.id);
        
        remainingToSell = 0;
      }
    }
  }

  /**
   * Add cost basis entry for acquired tokens
   */
  private async addCostBasis(
    walletAddress: string,
    tokenMint: string,
    amount: number,
    totalCost: number,
    timestamp: number,
    signature: string
  ): Promise<void> {
    const costPerToken = totalCost / amount;

    await supabase.from('cost_basis').insert({
      wallet_address: walletAddress,
      token_mint: tokenMint,
      amount,
      cost_per_token: costPerToken,
      total_cost: totalCost,
      acquired_at: timestamp,
      transaction_signature: signature,
    });
  }

  /**
   * Get cost basis entries for a wallet and token
   */
  async getCostBasis(walletAddress: string, tokenMint: string): Promise<CostBasisEntry[]> {
    const { data, error } = await supabase
      .from('cost_basis')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('token_mint', tokenMint)
      .order('acquired_at', { ascending: true });

    if (error) throw error;

    return data || [];
  }
}

// Export singleton instance
export const pnlCalculator = new PnLCalculator();
