import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { getCachedData, setCachedData } from '../services/redis';

const router = Router();

// GET /icr/current - Get current Internet Credit Rate
router.get('/current', async (req: Request, res: Response) => {
  try {
    // Try to get from cache first
    const cached = await getCachedData<any>('icr:current');
    if (cached) {
      return res.json(cached);
    }

    // Query from Supabase - get latest ICR calculation
    const { data, error } = await supabase
      .from('oracle_data')
      .select('*')
      .eq('data_type', 'icr')
      .order('timestamp', { ascending: false })
      .limit(5);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch ICR data' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'No ICR data available' });
    }

    // Calculate weighted average ICR
    const sources = data.map((row) => ({
      protocol: row.source,
      rate: parseFloat(row.value),
      weight: parseFloat(row.metadata?.weight || '1'),
    }));

    const totalWeight = sources.reduce((sum, s) => sum + s.weight, 0);
    const weightedICR = sources.reduce(
      (sum, s) => sum + s.rate * s.weight,
      0
    ) / totalWeight;

    // Calculate confidence interval (standard deviation)
    const mean = weightedICR;
    const variance = sources.reduce(
      (sum, s) => sum + Math.pow(s.rate - mean, 2) * s.weight,
      0
    ) / totalWeight;
    const stdDev = Math.sqrt(variance);

    const response = {
      icr: Math.round(weightedICR), // Basis points
      confidence: Math.round(stdDev * 2), // ±2σ in basis points
      timestamp: data[0].timestamp,
      sources,
    };

    // Cache for 10 minutes
    await setCachedData('icr:current', response, 600);

    res.json(response);
  } catch (error) {
    console.error('Error fetching current ICR:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
