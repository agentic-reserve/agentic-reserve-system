/**
 * Unit tests for capacity check middleware
 * 
 * Tests:
 * - HTTP 503 response when at capacity
 * - Retry-after header calculation
 * - Concurrent request tracking
 * - Connection pool utilization monitoring
 * - Capacity metrics reporting
 * 
 * Validates Requirement 13.4
 */

import { Request, Response, NextFunction } from 'express';
import { vi } from 'vitest';
import {
  capacityCheck,
  getCapacityUtilization,
  updateConnectionMetrics,
  getConcurrentRequests,
  resetConcurrentRequests,
} from './capacity-check';

// Mock the metrics service
vi.mock('../services/memory/metrics', () => ({
  metricsService: {
    setGauge: vi.fn(),
    incrementCounter: vi.fn(),
    observeHistogram: vi.fn(),
  },
}));

// Mock the config
vi.mock('../config', () => ({
  config: {
    supabase: {
      pool: {
        max: 100,
      },
    },
    redis: {
      pool: {
        max: 50,
      },
    },
  },
}));

// Mock Express request/response
function createMockRequest(): Partial<Request> {
  return {
    path: '/api/v1/memory/test',
    method: 'GET',
  };
}

function createMockResponse(): Partial<Response> {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: null,
    status: function(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader: function(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    json: function(data: any) {
      this.body = data;
      return this;
    },
    on: function(event: string, handler: Function) {
      // Store event handlers for manual triggering
      if (!this.eventHandlers) {
        this.eventHandlers = {};
      }
      if (!this.eventHandlers[event]) {
        this.eventHandlers[event] = [];
      }
      this.eventHandlers[event].push(handler);
      return this;
    },
    emit: function(event: string) {
      if (this.eventHandlers && this.eventHandlers[event]) {
        this.eventHandlers[event].forEach((handler: Function) => handler());
      }
    },
  };
  return res;
}

function createMockNext(): NextFunction {
  return vi.fn();
}

describe('Capacity Check Middleware', () => {
  beforeEach(() => {
    // Reset state before each test
    resetConcurrentRequests();
    updateConnectionMetrics(0, 0);
  });

  describe('Concurrent Request Tracking', () => {
    test('should track concurrent requests', async () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      expect(getConcurrentRequests()).toBe(0);

      await capacityCheck(req, res, next);

      expect(getConcurrentRequests()).toBe(1);
      expect(next).toHaveBeenCalled();
    });

    test('should decrement concurrent requests on response finish', async () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await capacityCheck(req, res, next);
      expect(getConcurrentRequests()).toBe(1);

      // Simulate response finish
      (res as any).emit('finish');

      expect(getConcurrentRequests()).toBe(0);
    });

    test('should decrement concurrent requests on response close', async () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await capacityCheck(req, res, next);
      expect(getConcurrentRequests()).toBe(1);

      // Simulate response close
      (res as any).emit('close');

      expect(getConcurrentRequests()).toBe(0);
    });

    test('should decrement concurrent requests on response error', async () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await capacityCheck(req, res, next);
      expect(getConcurrentRequests()).toBe(1);

      // Simulate response error
      (res as any).emit('error');

      expect(getConcurrentRequests()).toBe(0);
    });
  });

  describe('Capacity Overload Response', () => {
    test('should return HTTP 503 when concurrent requests exceed capacity', async () => {
      // Simulate 1000 concurrent requests (at capacity)
      for (let i = 0; i < 1000; i++) {
        const req = createMockRequest() as Request;
        const res = createMockResponse() as Response;
        const next = createMockNext();
        await capacityCheck(req, res, next);
      }

      // Next request should be rejected
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await capacityCheck(req, res, next);

      expect(res.statusCode).toBe(503);
      expect(next).not.toHaveBeenCalled();
    });

    test('should include retry-after header when at capacity', async () => {
      // Simulate capacity overload
      for (let i = 0; i < 1000; i++) {
        const req = createMockRequest() as Request;
        const res = createMockResponse() as Response;
        const next = createMockNext();
        await capacityCheck(req, res, next);
      }

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await capacityCheck(req, res, next);

      expect((res as any).headers['Retry-After']).toBeDefined();
      const retryAfter = parseInt((res as any).headers['Retry-After'], 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(30);
    });

    test('should return error message with capacity details', async () => {
      // Simulate capacity overload
      for (let i = 0; i < 1000; i++) {
        const req = createMockRequest() as Request;
        const res = createMockResponse() as Response;
        const next = createMockNext();
        await capacityCheck(req, res, next);
      }

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await capacityCheck(req, res, next);

      expect((res as any).body).toBeDefined();
      expect((res as any).body.error).toBe('Service at capacity');
      expect((res as any).body.retryAfter).toBeDefined();
      expect((res as any).body.capacity).toBeDefined();
      expect((res as any).body.capacity.requestUtilization).toBeDefined();
    });

    test('should return HTTP 503 when Supabase pool at capacity', async () => {
      // Simulate Supabase pool at 95% capacity (threshold is 90%)
      updateConnectionMetrics(95, 0);

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await capacityCheck(req, res, next);

      expect(res.statusCode).toBe(503);
      expect(next).not.toHaveBeenCalled();
    });

    test('should return HTTP 503 when Redis pool at capacity', async () => {
      // Simulate Redis pool at 95% capacity (threshold is 90%)
      updateConnectionMetrics(0, 48); // 48/50 = 96%

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await capacityCheck(req, res, next);

      expect(res.statusCode).toBe(503);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Retry-After Calculation', () => {
    test('should return 30 seconds retry-after when over 100% capacity', async () => {
      // Simulate over capacity
      for (let i = 0; i < 1001; i++) {
        const req = createMockRequest() as Request;
        const res = createMockResponse() as Response;
        const next = createMockNext();
        await capacityCheck(req, res, next);
      }

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await capacityCheck(req, res, next);

      const retryAfter = parseInt((res as any).headers['Retry-After'], 10);
      expect(retryAfter).toBe(30);
    });

    test('should return 10 seconds retry-after when at 95-100% capacity', async () => {
      // Simulate 95% capacity
      updateConnectionMetrics(95, 0); // 95/100 = 95%

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await capacityCheck(req, res, next);

      const retryAfter = parseInt((res as any).headers['Retry-After'], 10);
      expect(retryAfter).toBe(10);
    });

    test('should return 5 seconds retry-after when at 90-95% capacity', async () => {
      // Simulate 91% capacity
      updateConnectionMetrics(91, 0); // 91/100 = 91%

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await capacityCheck(req, res, next);

      const retryAfter = parseInt((res as any).headers['Retry-After'], 10);
      expect(retryAfter).toBe(5);
    });
  });

  describe('Capacity Utilization Reporting', () => {
    test('should report accurate capacity utilization', () => {
      updateConnectionMetrics(50, 25);

      const utilization = getCapacityUtilization();

      expect(utilization.concurrentRequests).toBe(0);
      expect(utilization.maxConcurrentRequests).toBe(1000);
      expect(utilization.requestUtilization).toBe(0);
      expect(utilization.supabasePoolUtilization).toBe(0.5); // 50/100
      expect(utilization.redisPoolUtilization).toBe(0.5); // 25/50
      expect(utilization.atCapacity).toBe(false);
    });

    test('should report at capacity when any resource exceeds threshold', () => {
      updateConnectionMetrics(91, 0); // 91% Supabase utilization

      const utilization = getCapacityUtilization();

      expect(utilization.atCapacity).toBe(true);
    });

    test('should report not at capacity when all resources below threshold', () => {
      updateConnectionMetrics(50, 25); // 50% and 50% utilization

      const utilization = getCapacityUtilization();

      expect(utilization.atCapacity).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero concurrent requests', () => {
      const utilization = getCapacityUtilization();

      expect(utilization.concurrentRequests).toBe(0);
      expect(utilization.requestUtilization).toBe(0);
      expect(utilization.atCapacity).toBe(false);
    });

    test('should handle exactly at capacity threshold', async () => {
      // Simulate exactly 90% Supabase pool utilization
      updateConnectionMetrics(90, 0);

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await capacityCheck(req, res, next);

      // Should reject request at exactly 90% (threshold)
      expect(res.statusCode).toBe(503);
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle multiple resources at high utilization', async () => {
      // Simulate both pools at high utilization
      updateConnectionMetrics(95, 48); // 95% and 96%

      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;
      const next = createMockNext();

      await capacityCheck(req, res, next);

      expect(res.statusCode).toBe(503);
      
      // Retry-after should be based on highest utilization (96%)
      const retryAfter = parseInt((res as any).headers['Retry-After'], 10);
      expect(retryAfter).toBeGreaterThan(0);
    });
  });
});
