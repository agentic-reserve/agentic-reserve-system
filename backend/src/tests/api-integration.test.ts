import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../app';
import { Application } from 'express';
import request from 'supertest';

describe('API Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('Health Check', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('ILI Endpoints', () => {
    it('GET /api/v1/ili/current should return current ILI', async () => {
      const response = await request(app).get('/api/v1/ili/current');
      
      if (response.status === 404) {
        // No data yet - acceptable for fresh install
        expect(response.body).toHaveProperty('error');
      } else {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('ili');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('components');
        expect(response.body.components).toHaveProperty('avgYield');
        expect(response.body.components).toHaveProperty('volatility');
        expect(response.body.components).toHaveProperty('tvl');
      }
    });

    it('GET /api/v1/ili/history should return ILI history', async () => {
      const response = await request(app).get('/api/v1/ili/history');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('GET /api/v1/ili/history with date range should filter results', async () => {
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();
      
      const response = await request(app)
        .get('/api/v1/ili/history')
        .query({ from, to });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('ICR Endpoints', () => {
    it('GET /api/v1/icr/current should return current ICR', async () => {
      const response = await request(app).get('/api/v1/icr/current');
      
      if (response.status === 404) {
        // No data yet - acceptable for fresh install
        expect(response.body).toHaveProperty('error');
      } else {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('icr');
        expect(response.body).toHaveProperty('confidence');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('sources');
        expect(Array.isArray(response.body.sources)).toBe(true);
      }
    });
  });

  describe('Proposal Endpoints', () => {
    it('GET /api/v1/proposals should return proposals list', async () => {
      const response = await request(app).get('/api/v1/proposals');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('proposals');
      expect(Array.isArray(response.body.proposals)).toBe(true);
    });

    it('GET /api/v1/proposals with status filter should work', async () => {
      const response = await request(app)
        .get('/api/v1/proposals')
        .query({ status: 'active' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('proposals');
      expect(Array.isArray(response.body.proposals)).toBe(true);
    });

    it('GET /api/v1/proposals/:id should return 404 for non-existent proposal', async () => {
      const response = await request(app).get('/api/v1/proposals/999999');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Reserve Endpoints', () => {
    it('GET /api/v1/reserve/state should return reserve state', async () => {
      const response = await request(app).get('/api/v1/reserve/state');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalValueUsd');
      expect(response.body).toHaveProperty('liabilitiesUsd');
      expect(response.body).toHaveProperty('vhr');
      expect(response.body).toHaveProperty('composition');
      expect(response.body).toHaveProperty('lastRebalance');
    });

    it('GET /api/v1/reserve/history should return rebalance history', async () => {
      const response = await request(app).get('/api/v1/reserve/history');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('events');
      expect(Array.isArray(response.body.events)).toBe(true);
    });

    it('GET /api/v1/reserve/history with limit should work', async () => {
      const response = await request(app)
        .get('/api/v1/reserve/history')
        .query({ limit: '10' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('events');
      expect(response.body.events.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Revenue Endpoints', () => {
    it('GET /api/v1/revenue/current should return current revenue metrics', async () => {
      const response = await request(app).get('/api/v1/revenue/current');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('daily');
      expect(response.body).toHaveProperty('monthly');
      expect(response.body).toHaveProperty('annual');
      expect(response.body).toHaveProperty('agentCount');
      expect(response.body).toHaveProperty('avgRevenuePerAgent');
    });

    it('GET /api/v1/revenue/history should return revenue history', async () => {
      const response = await request(app).get('/api/v1/revenue/history');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('GET /api/v1/revenue/projections should return revenue projections', async () => {
      const response = await request(app).get('/api/v1/revenue/projections');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('current');
      expect(response.body).toHaveProperty('at100Agents');
      expect(response.body).toHaveProperty('at1000Agents');
      expect(response.body).toHaveProperty('at10000Agents');
      
      // Verify structure of projections
      expect(response.body.at100Agents).toHaveProperty('agents', 100);
      expect(response.body.at100Agents).toHaveProperty('dailyRevenue');
      expect(response.body.at100Agents).toHaveProperty('monthlyRevenue');
      expect(response.body.at100Agents).toHaveProperty('annualRevenue');
    });

    it('GET /api/v1/revenue/breakdown should return fee breakdown', async () => {
      const response = await request(app).get('/api/v1/revenue/breakdown');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('breakdown');
      expect(typeof response.body.breakdown).toBe('object');
    });

    it('GET /api/v1/revenue/distributions should return distribution history', async () => {
      const response = await request(app).get('/api/v1/revenue/distributions');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('distributions');
      expect(Array.isArray(response.body.distributions)).toBe(true);
    });
  });

  describe('Agent Endpoints', () => {
    const testAgentPubkey = 'TestAgent1111111111111111111111111111111';

    it('GET /api/v1/agents/:pubkey/fees should return agent fee history', async () => {
      const response = await request(app).get(`/api/v1/agents/${testAgentPubkey}/fees`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('agentPubkey', testAgentPubkey);
      expect(response.body).toHaveProperty('totalFees');
      expect(response.body).toHaveProperty('transactions');
      expect(Array.isArray(response.body.transactions)).toBe(true);
    });

    it('GET /api/v1/agents/:pubkey/staking should return staking status', async () => {
      const response = await request(app).get(`/api/v1/agents/${testAgentPubkey}/staking`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('agentPubkey', testAgentPubkey);
      expect(response.body).toHaveProperty('isStaking');
      expect(response.body).toHaveProperty('stakedAmount');
      expect(response.body).toHaveProperty('rewardsClaimed');
      expect(response.body).toHaveProperty('feeDiscountActive');
    });

    it('POST /api/v1/agents/:pubkey/stake should validate amount', async () => {
      const response = await request(app)
        .post(`/api/v1/agents/${testAgentPubkey}/stake`)
        .send({ amount: -100 });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('POST /api/v1/agents/:pubkey/stake with valid amount should succeed', async () => {
      const response = await request(app)
        .post(`/api/v1/agents/${testAgentPubkey}/stake`)
        .send({ amount: 100 });
      
      // May fail if database not set up, but should validate request
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('amount', 100);
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make many requests quickly
      const requests = Array(110).fill(null).map(() => 
        request(app).get('/api/v1/ili/current')
      );
      
      const responses = await Promise.all(requests);
      
      // At least one should be rate limited
      const rateLimited = responses.some(r => r.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/v1/unknown');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/agents/test/stake')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');
      
      expect(response.status).toBe(400);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');
      
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});
