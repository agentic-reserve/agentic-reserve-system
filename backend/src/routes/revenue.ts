import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { getCachedData, setCachedData } from '../services/redis';

const router = Router();

// GET /revenue/current - Current revenue metrics
router.get('/current', async (req: Request, res: Response) => {
  try {
    const cached = await getCachedData<any>('revenue:current');
    if (cached) {
      return res.json(cached);
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisYear = new Date(now.getFullYear(), 0, 1);

    // Get daily revenue
    const { data: dailyData } = await supabase
      .from('revenue_events')
      .select('amount_usd')
      .gte('timestamp', today.toISOString());

    const dailyRevenue = dailyData?.reduce((sum, row) => sum + parseFloat(row.amount_usd), 0) || 0;

    // Get monthly revenue
    const { data: monthlyData } = await supabase
      .from('revenue_events')
      .select('amount_usd')
      .gte('timestamp', thisMonth.toISOString());

    const monthlyRevenue = monthlyData?.reduce((sum, row) => sum + parseFloat(row.amount_usd), 0) || 0;

    // Get annual revenue
    const { data: annualData } = await supabase
      .from('revenue_events')
      .select('amount_usd')
      .gte('timestamp', thisYear.toISOString());

    const annualRevenue = annualData?.reduce((sum, row) => sum + parseFloat(row.amount_usd), 0) || 0;

    // Get agent count
    const { count: agentCount } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true });

    const response = {
      daily: dailyRevenue,
      monthly: monthlyRevenue,
      annual: annualRevenue,
      agentCount: agentCount || 0,
      avgRevenuePerAgent: agentCount ? dailyRevenue / agentCount : 0,
    };

    await setCachedData('revenue:current', response, 300);
    res.json(response);
  } catch (error) {
    console.error('Error fetching current revenue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /revenue/history - Historical revenue data
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;

    let query = supabase
      .from('revenue_events')
      .select('*')
      .order('timestamp', { ascending: true });

    if (from) query = query.gte('timestamp', from as string);
    if (to) query = query.lte('timestamp', to as string);

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch revenue history' });
    }

    res.json({ data });
  } catch (error) {
    console.error('Error fetching revenue history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /revenue/projections - Revenue projections by agent count
router.get('/projections', async (req: Request, res: Response) => {
  try {
    // Get average revenue per agent from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from('revenue_events')
      .select('amount_usd')
      .gte('timestamp', thirtyDaysAgo.toISOString());

    const totalRevenue = data?.reduce((sum, row) => sum + parseFloat(row.amount_usd), 0) || 0;
    const avgDailyRevenue = totalRevenue / 30;

    const { count: currentAgents } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true });

    const avgRevenuePerAgent = currentAgents ? avgDailyRevenue / currentAgents : 1;

    const projections = {
      current: {
        agents: currentAgents || 0,
        dailyRevenue: avgDailyRevenue,
        monthlyRevenue: avgDailyRevenue * 30,
        annualRevenue: avgDailyRevenue * 365,
      },
      at100Agents: {
        agents: 100,
        dailyRevenue: avgRevenuePerAgent * 100,
        monthlyRevenue: avgRevenuePerAgent * 100 * 30,
        annualRevenue: avgRevenuePerAgent * 100 * 365,
      },
      at1000Agents: {
        agents: 1000,
        dailyRevenue: avgRevenuePerAgent * 1000,
        monthlyRevenue: avgRevenuePerAgent * 1000 * 30,
        annualRevenue: avgRevenuePerAgent * 1000 * 365,
      },
      at10000Agents: {
        agents: 10000,
        dailyRevenue: avgRevenuePerAgent * 10000,
        monthlyRevenue: avgRevenuePerAgent * 10000 * 30,
        annualRevenue: avgRevenuePerAgent * 10000 * 365,
      },
    };

    res.json(projections);
  } catch (error) {
    console.error('Error calculating projections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /revenue/breakdown - Fee breakdown by type
router.get('/breakdown', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('revenue_events')
      .select('revenue_type, amount_usd');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch revenue breakdown' });
    }

    const breakdown: Record<string, number> = {};
    data.forEach((row) => {
      const type = row.revenue_type;
      breakdown[type] = (breakdown[type] || 0) + parseFloat(row.amount_usd);
    });

    res.json({ breakdown });
  } catch (error) {
    console.error('Error fetching revenue breakdown:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /revenue/distributions - Distribution history
router.get('/distributions', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('revenue_distributions')
      .select('*')
      .order('distribution_date', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch distributions' });
    }

    res.json({ distributions: data });
  } catch (error) {
    console.error('Error fetching distributions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
