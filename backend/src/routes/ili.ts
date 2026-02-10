import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { getCachedData, setCachedData } from '../services/redis';

const router = Router();

// GET /ili/current - Get current ILI value
router.get('/current', async (req: Request, res: Response) => {
  try {
    // Try to get from cache first
    const cached = await getCachedData<any>('ili:current');
    if (cached) {
      return res.json(cached);
    }

    // Query from Supabase
    const { data, error } = await supabase
      .from('ili_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch ILI data' });
    }

    if (!data) {
      return res.status(404).json({ error: 'No ILI data available' });
    }

    const response = {
      ili: parseFloat(data.ili_value),
      timestamp: data.timestamp,
      components: {
        avgYield: parseFloat(data.avg_yield || '0'),
        volatility: parseFloat(data.volatility || '0'),
        tvl: parseFloat(data.tvl_usd || '0'),
      },
    };

    // Cache for 5 minutes
    await setCachedData('ili:current', response, 300);

    res.json(response);
  } catch (error) {
    console.error('Error fetching current ILI:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /ili/history - Get ILI history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { from, to, interval = '5m' } = req.query;

    let query = supabase
      .from('ili_history')
      .select('*')
      .order('timestamp', { ascending: true });

    if (from) {
      query = query.gte('timestamp', from as string);
    }

    if (to) {
      query = query.lte('timestamp', to as string);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch ILI history' });
    }

    const response = {
      data: data.map((row) => ({
        timestamp: row.timestamp,
        ili: parseFloat(row.ili_value),
        avgYield: parseFloat(row.avg_yield || '0'),
        volatility: parseFloat(row.volatility || '0'),
        tvl: parseFloat(row.tvl_usd || '0'),
      })),
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching ILI history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
