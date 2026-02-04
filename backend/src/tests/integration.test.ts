import axios from 'axios';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const client = axios.create({ baseURL: API_URL, timeout: 10000 });

describe('Integration Tests - ARS Protocol', () => {
  describe('19.1 - End-to-End ILI Calculation Flow', () => {
    test('should fetch current ILI', async () => {
      const response = await client.get('/ili/current');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('value');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('avgYield');
      expect(response.data).toHaveProperty('volatility');
      expect(response.data).toHaveProperty('tvl');
      
      // Validate ILI is positive
      expect(response.data.value).toBeGreaterThan(0);
    });

    test('should fetch ILI history', async () => {
      const response = await client.get('/ili/history', {
        params: {
          start: Date.now() - 24 * 60 * 60 * 1000, // 24h ago
          end: Date.now()
        }
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('history');
      expect(Array.isArray(response.data.history)).toBe(true);
      
      if (response.data.history.length > 0) {
        const dataPoint = response.data.history[0];
        expect(dataPoint).toHaveProperty('timestamp');
        expect(dataPoint).toHaveProperty('ili_value');
      }
    });

    test('should validate ILI components', async () => {
      const response = await client.get('/ili/current');
      const ili = response.data;
      
      // Validate components are within expected ranges
      expect(ili.avgYield).toBeGreaterThanOrEqual(0);
      expect(ili.avgYield).toBeLessThan(10000); // < 100%
      expect(ili.volatility).toBeGreaterThanOrEqual(0);
      expect(ili.tvl).toBeGreaterThan(0);
    });
  });

  describe('19.2 - Full Proposal Lifecycle', () => {
    let proposalId: number;

    test('should create a new proposal', async () => {
      const proposalData = {
        policyType: 'mint',
        params: {
          amount: 1000000,
          reason: 'Test proposal for integration testing'
        },
        proposer: 'TestAgent123',
        timestamp: Date.now(),
        signature: 'test_signature_' + Date.now()
      };

      const response = await client.post('/proposals/create', proposalData);
      
      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('proposal');
      expect(response.data.proposal).toHaveProperty('id');
      
      proposalId = response.data.proposal.id;
    });

    test('should fetch proposal list', async () => {
      const response = await client.get('/proposals');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('proposals');
      expect(Array.isArray(response.data.proposals)).toBe(true);
    });

    test('should fetch proposal details', async () => {
      if (!proposalId) {
        // Get first proposal from list
        const listResponse = await client.get('/proposals');
        proposalId = listResponse.data.proposals[0]?.id;
      }

      if (proposalId) {
        const response = await client.get(`/proposals/${proposalId}`);
        
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('proposal');
        expect(response.data.proposal.id).toBe(proposalId);
      }
    });

    test('should vote on proposal', async () => {
      if (!proposalId) {
        const listResponse = await client.get('/proposals');
        proposalId = listResponse.data.proposals[0]?.id;
      }

      if (proposalId) {
        const voteData = {
          proposalId,
          prediction: true,
          stakeAmount: 1000,
          agent: 'TestAgent123',
          timestamp: Date.now(),
          signature: 'test_vote_signature_' + Date.now()
        };

        const response = await client.post(`/proposals/${proposalId}/vote`, voteData);
        
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('signature');
      }
    });

    test('should filter proposals by status', async () => {
      const response = await client.get('/proposals', {
        params: { status: 'active' }
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('proposals');
      
      // All proposals should have 'active' status
      response.data.proposals.forEach((proposal: any) => {
        expect(proposal.status).toBe('active');
      });
    });
  });

  describe('19.3 - Reserve Rebalancing Flow', () => {
    test('should fetch reserve state', async () => {
      const response = await client.get('/reserve/state');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('vault');
      expect(response.data.vault).toHaveProperty('vhr');
      expect(response.data.vault).toHaveProperty('totalValue');
      expect(response.data.vault).toHaveProperty('liabilities');
      expect(response.data.vault).toHaveProperty('assets');
      
      // Validate VHR is positive
      expect(response.data.vault.vhr).toBeGreaterThan(0);
    });

    test('should fetch rebalance history', async () => {
      const response = await client.get('/reserve/rebalance-history');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('events');
      expect(Array.isArray(response.data.events)).toBe(true);
      
      if (response.data.events.length > 0) {
        const event = response.data.events[0];
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('from_asset');
        expect(event).toHaveProperty('to_asset');
        expect(event).toHaveProperty('amount');
        expect(event).toHaveProperty('vhr_before');
        expect(event).toHaveProperty('vhr_after');
      }
    });

    test('should validate vault composition', async () => {
      const response = await client.get('/reserve/state');
      const vault = response.data.vault;
      
      // Validate assets array
      expect(Array.isArray(vault.assets)).toBe(true);
      
      // Calculate total percentage
      const totalPercentage = vault.assets.reduce(
        (sum: number, asset: any) => sum + asset.percentage,
        0
      );
      
      // Should be approximately 100%
      expect(totalPercentage).toBeGreaterThan(99);
      expect(totalPercentage).toBeLessThan(101);
    });
  });

  describe('19.4 - Circuit Breaker Activation', () => {
    test('should check circuit breaker status', async () => {
      const response = await client.get('/reserve/state');
      const vault = response.data.vault;
      
      // Circuit breaker should activate if VHR < 150%
      if (vault.vhr < 150) {
        expect(vault.circuitBreakerActive).toBe(true);
      } else {
        expect(vault.circuitBreakerActive).toBe(false);
      }
    });

    test('should prevent operations when circuit breaker is active', async () => {
      const response = await client.get('/reserve/state');
      const vault = response.data.vault;
      
      if (vault.circuitBreakerActive) {
        // Attempt to create proposal (should fail)
        try {
          await client.post('/proposals/create', {
            policyType: 'mint',
            params: { amount: 1000 },
            proposer: 'TestAgent',
            timestamp: Date.now(),
            signature: 'test_sig'
          });
          
          // Should not reach here
          expect(true).toBe(false);
        } catch (error: any) {
          expect(error.response.status).toBe(403);
          expect(error.response.data.error).toContain('circuit breaker');
        }
      }
    });
  });

  describe('19.5 - Load Testing (100 Concurrent Requests)', () => {
    test('should handle 100 concurrent ILI requests', async () => {
      const requests = Array(100).fill(null).map(() => 
        client.get('/ili/current')
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('value');
      });
      
      // Should complete within reasonable time (< 10 seconds)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000);
      
      console.log(`100 concurrent requests completed in ${duration}ms`);
    });

    test('should handle 100 concurrent proposal list requests', async () => {
      const requests = Array(100).fill(null).map(() => 
        client.get('/proposals')
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('proposals');
      });
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000);
      
      console.log(`100 concurrent proposal requests completed in ${duration}ms`);
    });

    test('should handle mixed concurrent requests', async () => {
      const requests = [
        ...Array(25).fill(null).map(() => client.get('/ili/current')),
        ...Array(25).fill(null).map(() => client.get('/icr/current')),
        ...Array(25).fill(null).map(() => client.get('/reserve/state')),
        ...Array(25).fill(null).map(() => client.get('/proposals')),
      ];
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(15000);
      
      console.log(`100 mixed concurrent requests completed in ${duration}ms`);
    });
  });

  describe('Additional Integration Tests', () => {
    test('should fetch ICR with confidence interval', async () => {
      const response = await client.get('/icr/current');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('value');
      expect(response.data).toHaveProperty('confidence');
      expect(response.data).toHaveProperty('timestamp');
      
      // ICR should be between 0-100%
      expect(response.data.value).toBeGreaterThanOrEqual(0);
      expect(response.data.value).toBeLessThanOrEqual(100);
    });

    test('should fetch revenue metrics', async () => {
      const response = await client.get('/revenue/current');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('daily');
      expect(response.data).toHaveProperty('monthly');
      expect(response.data).toHaveProperty('annual');
    });

    test('should fetch staking metrics', async () => {
      const response = await client.get('/agents/staking/metrics');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('totalStaked');
      expect(response.data).toHaveProperty('stakingAPY');
      expect(response.data).toHaveProperty('rewardsPool');
    });

    test('should handle rate limiting gracefully', async () => {
      // Send 150 requests (exceeds 100 req/min limit)
      const requests = Array(150).fill(null).map((_, i) => 
        client.get('/ili/current').catch(err => err.response)
      );
      
      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429)
      const rateLimited = responses.filter(r => r?.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should return proper error for invalid proposal ID', async () => {
      try {
        await client.get('/proposals/999999');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });

    test('should validate proposal creation with missing fields', async () => {
      try {
        await client.post('/proposals/create', {
          policyType: 'mint'
          // Missing required fields
        });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });
});
