/**
 * Simple API Server for Demo
 * Provides mock endpoints without complex dependencies
 */

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import programsRouter from './routes/programs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Smart contract programs routes
app.use('/programs', programsRouter);

// GET /ili/current
app.get('/ili/current', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ili_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    
    if (error) throw error;
    
    res.json({
      value: parseFloat(data.ili_value),
      timestamp: new Date(data.timestamp).getTime(),
      avgYield: parseFloat(data.avg_yield || '0'),
      volatility: parseFloat(data.volatility || '0'),
      tvl: parseFloat(data.tvl_usd || '0'),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /ili/history
app.get('/ili/history', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    let query = supabase
      .from('ili_history')
      .select('timestamp, ili_value')
      .order('timestamp', { ascending: true });
    
    if (start) {
      query = query.gte('timestamp', new Date(Number(start)).toISOString());
    }
    if (end) {
      query = query.lte('timestamp', new Date(Number(end)).toISOString());
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({
      history: data.map(d => ({
        timestamp: new Date(d.timestamp).getTime(),
        ili_value: parseFloat(d.ili_value),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /icr/current
app.get('/icr/current', async (req, res) => {
  try {
    // Mock ICR data
    res.json({
      value: 7.5 + Math.random() * 2, // 7.5-9.5%
      confidence: 0.95,
      timestamp: Date.now(),
      sources: ['Kamino', 'Solend', 'MarginFi'],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /reserve/state
app.get('/reserve/state', async (req, res) => {
  try {
    const { data, error} = await supabase
      .from('reserve_events')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    
    const vhr = data ? parseFloat(data.vhr_after) : 175;
    const totalValue = 25000000 + Math.random() * 5000000;
    const liabilities = totalValue / (vhr / 100);
    
    res.json({
      vault: {
        vhr,
        totalValue,
        liabilities,
        assets: [
          { symbol: 'USDC', amount: totalValue * 0.4, valueUsd: totalValue * 0.4, percentage: 40 },
          { symbol: 'SOL', amount: totalValue * 0.35, valueUsd: totalValue * 0.35, percentage: 35 },
          { symbol: 'mSOL', amount: totalValue * 0.25, valueUsd: totalValue * 0.25, percentage: 25 },
        ],
        lastRebalance: data ? new Date(data.timestamp).getTime() : Date.now() - 3600000,
        circuitBreakerActive: vhr < 150,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /reserve/rebalance-history
app.get('/reserve/rebalance-history', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reserve_events')
      .select('*')
      .eq('event_type', 'rebalance')
      .order('timestamp', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    res.json({
      events: data.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        from_asset: e.from_asset,
        to_asset: e.to_asset,
        amount: parseFloat(e.amount),
        vhr_before: parseFloat(e.vhr_before),
        vhr_after: parseFloat(e.vhr_after),
        reason: JSON.parse(e.metadata || '{}').reason || 'Automated rebalancing',
        transaction_signature: e.transaction_signature,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /proposals
app.get('/proposals', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = supabase
      .from('proposals')
      .select('*')
      .order('id', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({
      proposals: data.map(p => ({
        id: p.id,
        title: `${p.policy_type.toUpperCase()} Proposal #${p.id}`,
        description: JSON.parse(p.policy_params).reason || 'No description',
        policy_type: p.policy_type,
        status: p.status,
        yes_stake: p.yes_stake,
        no_stake: p.no_stake,
        total_stake: p.yes_stake + p.no_stake,
        created_at: p.start_time,
        voting_ends_at: p.end_time,
        execution_time: p.execution_tx ? p.updated_at : null,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /proposals/:id
app.get('/proposals/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
    if (error) throw error;
    
    res.json({
      proposal: {
        id: data.id,
        title: `${data.policy_type.toUpperCase()} Proposal #${data.id}`,
        description: JSON.parse(data.policy_params).reason || 'No description',
        policy_type: data.policy_type,
        status: data.status,
        yes_stake: data.yes_stake,
        no_stake: data.no_stake,
        total_stake: data.yes_stake + data.no_stake,
        created_at: data.start_time,
        voting_ends_at: data.end_time,
        execution_time: data.execution_tx ? data.updated_at : null,
      },
    });
  } catch (error: any) {
    res.status(404).json({ error: 'Proposal not found' });
  }
});

// GET /revenue/current
app.get('/revenue/current', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('revenue_events')
      .select('amount_usd')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    const daily = data?.reduce((sum, e) => sum + parseFloat(e.amount_usd), 0) || 0;
    
    res.json({
      daily: daily.toFixed(2),
      monthly: (daily * 30).toFixed(2),
      annual: (daily * 365).toFixed(2),
      agentCount: 5,
      avgFeePerAgent: (daily / 5).toFixed(2),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /revenue/breakdown
app.get('/revenue/breakdown', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('revenue_events')
      .select('revenue_type, amount_usd')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    const breakdown: any = {};
    data?.forEach(e => {
      breakdown[e.revenue_type] = (breakdown[e.revenue_type] || 0) + parseFloat(e.amount_usd);
    });
    
    res.json({ breakdown });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /agents/staking/metrics
app.get('/agents/staking/metrics', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agent_staking')
      .select('staked_amount, rewards_earned');
    
    const totalStaked = data?.reduce((sum, s) => sum + s.staked_amount, 0) || 0;
    const rewardsPool = data?.reduce((sum, s) => sum + s.rewards_earned, 0) || 0;
    
    res.json({
      totalStaked,
      stakingAPY: 124.5, // Mock APY
      rewardsPool,
      totalStakers: data?.length || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /history/policies
app.get('/history/policies', async (req, res) => {
  try {
    const { data: proposals } = await supabase
      .from('proposals')
      .select('*')
      .in('status', ['executed', 'passed'])
      .order('updated_at', { ascending: false })
      .limit(10);
    
    const { data: iliHistory } = await supabase
      .from('ili_history')
      .select('ili_value, timestamp')
      .order('timestamp', { ascending: false })
      .limit(10);
    
    const events = proposals?.map((p, i) => ({
      id: p.id,
      timestamp: p.updated_at || p.end_time,
      policy_type: p.policy_type,
      description: JSON.parse(p.policy_params).reason || 'Policy executed',
      status: 'success',
      impact: {
        ili_before: iliHistory?.[i + 1]?.ili_value || 500,
        ili_after: iliHistory?.[i]?.ili_value || 510,
        vhr_before: 170,
        vhr_after: 175,
      },
    })) || [];
    
    res.json({ events });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /revenue/projections
app.get('/revenue/projections', async (req, res) => {
  try {
    const { data } = await supabase
      .from('revenue_events')
      .select('amount_usd')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
    const dailyRevenue = data?.reduce((sum, e) => sum + parseFloat(e.amount_usd), 0) || 0;
    const avgRevenuePerAgent = dailyRevenue / 5; // Current 5 agents
    
    res.json({
      at100Agents: {
        dailyRevenue: avgRevenuePerAgent * 100,
        monthlyRevenue: avgRevenuePerAgent * 100 * 30,
        annualRevenue: avgRevenuePerAgent * 100 * 365,
      },
      at1000Agents: {
        dailyRevenue: avgRevenuePerAgent * 1000,
        monthlyRevenue: avgRevenuePerAgent * 1000 * 30,
        annualRevenue: avgRevenuePerAgent * 1000 * 365,
      },
      at10000Agents: {
        dailyRevenue: avgRevenuePerAgent * 10000,
        monthlyRevenue: avgRevenuePerAgent * 10000 * 30,
        annualRevenue: avgRevenuePerAgent * 10000 * 365,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /revenue/distributions
app.get('/revenue/distributions', async (req, res) => {
  try {
    const { data } = await supabase
      .from('revenue_events')
      .select('timestamp, amount_usd')
      .order('timestamp', { ascending: false })
      .limit(10);
    
    const distributions = data?.map(e => ({
      distribution_date: e.timestamp,
      total_revenue: parseFloat(e.amount_usd),
      buyback_burn: parseFloat(e.amount_usd) * 0.4,
      staking_rewards: parseFloat(e.amount_usd) * 0.3,
      development: parseFloat(e.amount_usd) * 0.2,
      insurance_fund: parseFloat(e.amount_usd) * 0.1,
    })) || [];
    
    res.json({ distributions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
server.listen(PORT, () => {
  console.log('========================================');
  console.log('ARS Simple API Server');
  console.log('========================================');
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket running on ws://localhost:${PORT}/ws`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /ili/current');
  console.log('  GET  /ili/history');
  console.log('  GET  /icr/current');
  console.log('  GET  /reserve/state');
  console.log('  GET  /reserve/rebalance-history');
  console.log('  GET  /proposals');
  console.log('  GET  /proposals/:id');
  console.log('  GET  /revenue/current');
  console.log('  GET  /revenue/breakdown');
  console.log('  GET  /revenue/projections');
  console.log('  GET  /revenue/distributions');
  console.log('  GET  /agents/staking/metrics');
  console.log('  GET  /history/policies');
  console.log('  WS   /ws (real-time updates)');
  console.log('========================================');
});

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

interface Client {
  ws: WebSocket;
  subscriptions: Set<string>;
}

const clients = new Set<Client>();

wss.on('connection', (ws: WebSocket) => {
  console.log('WebSocket client connected');
  
  const client: Client = {
    ws,
    subscriptions: new Set(),
  };
  
  clients.add(client);

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'subscribe') {
        client.subscriptions.add(message.channel);
        console.log(`Client subscribed to: ${message.channel}`);
        
        // Send initial data
        sendChannelData(client, message.channel);
      } else if (message.type === 'unsubscribe') {
        client.subscriptions.delete(message.channel);
        console.log(`Client unsubscribed from: ${message.channel}`);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(client);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to ARS WebSocket server',
  }));
});

// Send data to specific channel
async function sendChannelData(client: Client, channel: string) {
  try {
    let data;
    
    switch (channel) {
      case 'ili':
        const iliData = await supabase
          .from('ili_history')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();
        
        if (iliData.data) {
          data = {
            value: parseFloat(iliData.data.ili_value),
            timestamp: new Date(iliData.data.timestamp).getTime(),
            avgYield: parseFloat(iliData.data.avg_yield || '0'),
            volatility: parseFloat(iliData.data.volatility || '0'),
            tvl: parseFloat(iliData.data.tvl_usd || '0'),
          };
        }
        break;
        
      case 'reserve':
        const reserveData = await supabase
          .from('reserve_events')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();
        
        if (reserveData.data) {
          const vhr = parseFloat(reserveData.data.vhr_after);
          data = {
            vhr,
            lastUpdate: new Date(reserveData.data.timestamp).getTime(),
          };
        }
        break;
        
      case 'revenue':
        const revenueData = await supabase
          .from('revenue_events')
          .select('amount_usd')
          .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        
        const daily = revenueData.data?.reduce((sum, e) => sum + parseFloat(e.amount_usd), 0) || 0;
        data = {
          daily: daily.toFixed(2),
          timestamp: Date.now(),
        };
        break;
    }
    
    if (data && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: `${channel}_update`,
        data,
      }));
    }
  } catch (error) {
    console.error(`Error sending ${channel} data:`, error);
  }
}

// Broadcast updates to all subscribed clients every 5 seconds
setInterval(() => {
  clients.forEach(client => {
    client.subscriptions.forEach(channel => {
      sendChannelData(client, channel);
    });
  });
}, 5000);

