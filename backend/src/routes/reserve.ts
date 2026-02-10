import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { getCachedData, setCachedData } from '../services/redis';

const router = Router();

// GET /reserve/state - Get current reserve vault state
router.get('/state', async (req: Request, res: Response) => {
  try {
    // Try to get from cache first
    const cached = await getCachedData<any>('reserve:state');
    if (cached) {
      return res.json(cached);
    }

    // Query latest reserve event to get current state
    const { data, error } = await supabase
      .from('reserve_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Return mock data if no events yet
      const mockResponse = {
        totalValueUsd: 0,
        liabilitiesUsd: 0,
        vhr: 0,
        composition: [],
        lastRebalance: new Date().toISOString(),
      };
      return res.json(mockResponse);
    }

    const response = {
      totalValueUsd: parseFloat(data.metadata?.total_value_usd || '0'),
      liabilitiesUsd: parseFloat(data.metadata?.liabilities_usd || '0'),
      vhr: parseFloat(data.vhr_after || '0'),
      composition: data.metadata?.composition || [],
      lastRebalance: data.timestamp,
    };

    // Cache for 5 minutes
    await setCachedData('reserve:state', response, 300);

    res.json(response);
  } catch (error) {
    console.error('Error fetching reserve state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reserve/history - Get rebalance history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { limit = '50' } = req.query;

    const { data, error } = await supabase
      .from('reserve_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(parseInt(limit as string, 10));

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch reserve history' });
    }

    const response = {
      events: data.map((row) => ({
        timestamp: row.timestamp,
        eventType: row.event_type,
        fromAsset: row.from_asset,
        toAsset: row.to_asset,
        amount: parseFloat(row.amount || '0'),
        vhrBefore: parseFloat(row.vhr_before || '0'),
        vhrAfter: parseFloat(row.vhr_after || '0'),
        txSignature: row.transaction_signature,
      })),
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching reserve history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
