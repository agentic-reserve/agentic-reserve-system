import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { redisClient } from '../services/redis';
import crypto from 'crypto';
import { checkPrivacyAuthorization } from '../middleware/privacy-auth';
import { queryRateLimit } from '../middleware/query-rate-limit';
import { capacityCheck } from '../middleware/capacity-check';

const router = Router();

// Apply capacity check first (before rate limiting)
router.use(capacityCheck);

// Apply rate limiting to all memory routes
router.use(queryRateLimit);

// Cache TTL: 5 minutes
const CACHE_TTL = 300;

// Helper: Generate cache key
function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify(params))
    .digest('hex');
  return `${prefix}:${hash}`;
}

// Helper: Check cache first, then query database
async function cacheFirst<T>(
  cacheKey: string,
  queryFn: () => Promise<T>
): Promise<T> {
  try {
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Cache miss - query database
    const result = await queryFn();

    // Store in cache
    await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

    return result;
  } catch (error) {
    // Fall back to direct query on cache failure
    console.error('Cache error, falling back to direct query:', error);
    return queryFn();
  }
}

/**
 * GET /api/v1/memory/transactions/:walletAddress
 * Get transaction history for a wallet
 * Requires authorization for privacy-protected wallets
 */
router.get('/transactions/:walletAddress', checkPrivacyAuthorization, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const {
      page = '1',
      pageSize = '50',
      transactionType,
      tokenMint,
      minAmount,
      maxAmount,
      startDate,
      endDate,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    const offset = (pageNum - 1) * pageSizeNum;

    const cacheKey = generateCacheKey('transactions', {
      walletAddress,
      page,
      pageSize,
      transactionType,
      tokenMint,
      minAmount,
      maxAmount,
      startDate,
      endDate,
    });

    const result = await cacheFirst(cacheKey, async () => {
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('wallet_address', walletAddress)
        .order('timestamp', { ascending: false })
        .range(offset, offset + pageSizeNum - 1);

      // Apply filters
      if (transactionType) {
        query = query.eq('transaction_type', transactionType);
      }
      if (tokenMint) {
        query = query.eq('token_mint', tokenMint);
      }
      if (minAmount) {
        query = query.gte('amount', parseFloat(minAmount as string));
      }
      if (maxAmount) {
        query = query.lte('amount', parseFloat(maxAmount as string));
      }
      if (startDate) {
        query = query.gte('timestamp', startDate);
      }
      if (endDate) {
        query = query.lte('timestamp', endDate);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        transactions: data || [],
        pagination: {
          page: pageNum,
          pageSize: pageSizeNum,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / pageSizeNum),
        },
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/memory/balances/:walletAddress
 * Get current balances for a wallet
 * Requires authorization for privacy-protected wallets
 */
router.get('/balances/:walletAddress', checkPrivacyAuthorization, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    const cacheKey = generateCacheKey('balances', { walletAddress });

    const result = await cacheFirst(cacheKey, async () => {
      const { data, error } = await supabase
        .from('wallet_balances')
        .select('*')
        .eq('wallet_address', walletAddress);

      if (error) throw error;

      return { balances: data || [] };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching wallet balances:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/memory/pnl/:walletAddress
 * Get PnL analytics for a wallet
 * Requires authorization for privacy-protected wallets
 */
router.get('/pnl/:walletAddress', checkPrivacyAuthorization, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const { period = 'all' } = req.query;

    const cacheKey = generateCacheKey('pnl', { walletAddress, period });

    const result = await cacheFirst(cacheKey, async () => {
      const { data, error } = await supabase
        .from('pnl_snapshots')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('snapshot_time', { ascending: false })
        .limit(1);

      if (error) throw error;

      const snapshot = data?.[0];

      if (!snapshot) {
        return {
          realizedPnl: 0,
          unrealizedPnl: 0,
          totalPnl: 0,
          tokens: [],
        };
      }

      return {
        realizedPnl: snapshot.realized_pnl,
        unrealizedPnl: snapshot.unrealized_pnl,
        totalPnl: snapshot.total_pnl,
        tokens: snapshot.token_breakdown || [],
        snapshotTime: snapshot.snapshot_time,
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching PnL analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/memory/risk/:walletAddress
 * Get risk profile for a wallet
 * Requires authorization for privacy-protected wallets
 */
router.get('/risk/:walletAddress', checkPrivacyAuthorization, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    const cacheKey = generateCacheKey('risk', { walletAddress });

    const result = await cacheFirst(cacheKey, async () => {
      const { data, error } = await supabase
        .from('risk_profiles')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const profile = data?.[0];

      if (!profile) {
        return {
          riskScore: 0,
          anomalyCount: 0,
          lastAnomalyTime: null,
          metrics: {},
        };
      }

      return {
        riskScore: profile.risk_score,
        anomalyCount: profile.anomaly_count,
        lastAnomalyTime: profile.last_anomaly_time,
        metrics: profile.risk_metrics || {},
        updatedAt: profile.updated_at,
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching risk profile:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/memory/prediction-markets/:marketId
 * Get prediction market data
 */
router.get('/prediction-markets/:marketId', async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;

    const cacheKey = generateCacheKey('prediction-market', { marketId });

    const result = await cacheFirst(cacheKey, async () => {
      const { data, error } = await supabase
        .from('prediction_markets')
        .select('*')
        .eq('market_id', marketId)
        .single();

      if (error) throw error;

      return {
        marketId: data.market_id,
        proposalId: data.proposal_id,
        yesOdds: data.yes_odds,
        noOdds: data.no_odds,
        totalVolume: data.total_volume,
        resolved: data.resolved,
        outcome: data.outcome,
        confidenceScore: data.confidence_score,
        updatedAt: data.updated_at,
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching prediction market:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/memory/portfolio/:walletAddress
 * Get portfolio analytics for a wallet
 * Requires authorization for privacy-protected wallets
 */
router.get('/portfolio/:walletAddress', checkPrivacyAuthorization, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    const cacheKey = generateCacheKey('portfolio', { walletAddress });

    const result = await cacheFirst(cacheKey, async () => {
      // Get balances
      const { data: balances, error: balancesError } = await supabase
        .from('wallet_balances')
        .select('*')
        .eq('wallet_address', walletAddress);

      if (balancesError) throw balancesError;

      // Get latest PnL
      const { data: pnlData, error: pnlError } = await supabase
        .from('pnl_snapshots')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('snapshot_time', { ascending: false })
        .limit(1);

      if (pnlError) throw pnlError;

      const pnl = pnlData?.[0];

      // Calculate total portfolio value
      const totalValue = (balances || []).reduce(
        (sum, balance) => sum + (balance.balance * (balance.price_usd || 0)),
        0
      );

      return {
        walletAddress,
        totalValue,
        balances: balances || [],
        pnl: pnl ? {
          realizedPnl: pnl.realized_pnl,
          unrealizedPnl: pnl.unrealized_pnl,
          totalPnl: pnl.total_pnl,
        } : null,
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching portfolio analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
