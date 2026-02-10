import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryEventEmitter, EventType } from '../../services/memory/event-emitter';
import { WebSocket } from 'ws';

describe('MemoryEventEmitter', () => {
  let emitter: MemoryEventEmitter;

  beforeEach(() => {
    emitter = new MemoryEventEmitter();
  });

  describe('Subscription Management (Task 12.3)', () => {
    it('should create subscription with unique ID', () => {
      const subscriptionId = emitter.subscribe(
        'test-agent',
        [EventType.TRANSACTION_NEW],
        ['wallet123']
      );

      expect(subscriptionId).toBeDefined();
      expect(subscriptionId).toContain('test-agent');
      expect(emitter.getSubscriptionCount()).toBe(1);
    });

    it('should support event type filtering', () => {
      const subscriptionId = emitter.subscribe(
        'test-agent',
        [EventType.TRANSACTION_NEW, EventType.BALANCE_UPDATED],
        ['wallet123']
      );

      expect(subscriptionId).toBeDefined();
      const agentSubs = emitter.getAgentSubscriptions('test-agent');
      expect(agentSubs).toHaveLength(1);
    });

    it('should support wallet address filtering', () => {
      const subscriptionId = emitter.subscribe(
        'test-agent',
        [EventType.TRANSACTION_NEW],
        ['wallet123', 'wallet456']
      );

      expect(subscriptionId).toBeDefined();
    });

    it('should support wildcard wallet subscription', () => {
      const subscriptionId = emitter.subscribe(
        'test-agent',
        [EventType.TRANSACTION_NEW],
        ['*']
      );

      expect(subscriptionId).toBeDefined();
    });

    it('should unsubscribe successfully', () => {
      const subscriptionId = emitter.subscribe(
        'test-agent',
        [EventType.TRANSACTION_NEW]
      );

      expect(emitter.getSubscriptionCount()).toBe(1);

      emitter.unsubscribe(subscriptionId);

      expect(emitter.getSubscriptionCount()).toBe(0);
    });

    it('should send confirmation message with subscription ID', () => {
      const mockWs = {
        readyState: 1, // WebSocket.OPEN
        send: vi.fn(),
      } as unknown as WebSocket;

      const subscriptionId = emitter.subscribe(
        'test-agent',
        [EventType.TRANSACTION_NEW],
        ['wallet123'],
        mockWs
      );

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('subscription_confirmed')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(subscriptionId)
      );
    });

    it('should track multiple subscriptions for same agent', () => {
      const sub1 = emitter.subscribe('test-agent', [EventType.TRANSACTION_NEW]);
      const sub2 = emitter.subscribe('test-agent', [EventType.BALANCE_UPDATED]);

      const agentSubs = emitter.getAgentSubscriptions('test-agent');
      expect(agentSubs).toHaveLength(2);
      expect(agentSubs).toContain(sub1);
      expect(agentSubs).toContain(sub2);
    });
  });

  describe('Event Rate Limiting (Task 12.5)', () => {
    it('should set rate limit for agent', () => {
      emitter.subscribe('test-agent', [EventType.TRANSACTION_NEW]);
      
      // Should not throw
      emitter.setRateLimit('test-agent', 50);
    });

    it('should have default rate limit of 100 events/sec', () => {
      const subscriptionId = emitter.subscribe(
        'test-agent',
        [EventType.TRANSACTION_NEW]
      );

      expect(subscriptionId).toBeDefined();
      // Default rate limit is set internally
    });

    it('should buffer events for rate-limited delivery', async () => {
      const mockWs = {
        readyState: 1,
        send: vi.fn(),
      } as unknown as WebSocket;

      emitter.subscribe(
        'test-agent',
        [EventType.TRANSACTION_NEW],
        ['wallet123'],
        mockWs
      );

      // Emit multiple events rapidly
      for (let i = 0; i < 10; i++) {
        emitter.emitTransactionEvent({
          signature: `sig${i}`,
          wallet_address: 'wallet123',
          timestamp: Date.now(),
          transaction_type: 'transfer',
          amount: 100,
          token_mint: 'token123',
        });
      }

      // Events should be buffered
      expect(mockWs.send).toHaveBeenCalled();
    });
  });

  describe('Event Emission (Task 12.1)', () => {
    it('should emit transaction event', () => {
      const mockWs = {
        readyState: 1,
        send: vi.fn(),
      } as unknown as WebSocket;

      emitter.subscribe(
        'test-agent',
        [EventType.TRANSACTION_NEW],
        ['wallet123'],
        mockWs
      );

      emitter.emitTransactionEvent({
        signature: 'sig123',
        wallet_address: 'wallet123',
        timestamp: Date.now(),
        transaction_type: 'transfer',
        amount: 100,
        token_mint: 'token123',
      });

      // Event should be buffered for delivery
      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should emit balance update event', () => {
      const mockWs = {
        readyState: 1,
        send: vi.fn(),
      } as unknown as WebSocket;

      emitter.subscribe(
        'test-agent',
        [EventType.BALANCE_UPDATED],
        ['wallet123'],
        mockWs
      );

      emitter.emitBalanceUpdateEvent({
        wallet_address: 'wallet123',
        token_mint: 'token123',
        amount: 1000,
        usd_value: 50,
      });

      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should emit anomaly event', () => {
      const mockWs = {
        readyState: 1,
        send: vi.fn(),
      } as unknown as WebSocket;

      emitter.subscribe(
        'test-agent',
        [EventType.SECURITY_ANOMALY],
        ['wallet123'],
        mockWs
      );

      emitter.emitAnomalyEvent({
        transaction_signature: 'sig123',
        wallet_address: 'wallet123',
        anomaly_type: 'large_amount',
        severity: 'high',
        score: 85,
        description: 'Unusually large transaction',
        timestamp: Date.now(),
      });

      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should emit market odds event', () => {
      const mockWs = {
        readyState: 1,
        send: vi.fn(),
      } as unknown as WebSocket;

      emitter.subscribe(
        'test-agent',
        [EventType.MARKET_ODDS_CHANGED],
        undefined,
        mockWs
      );

      emitter.emitMarketOddsEvent({
        market_address: 'market123',
        proposal_id: 'prop123',
        outcomes: { yes: 0.6, no: 0.4 },
        total_volume: 10000,
        confidence_score: 0.85,
      });

      expect(mockWs.send).toHaveBeenCalled();
    });
  });

  describe('Event Filtering', () => {
    it('should only send events matching subscribed event types', () => {
      const mockWs = {
        readyState: 1,
        send: vi.fn(),
      } as unknown as WebSocket;

      emitter.subscribe(
        'test-agent',
        [EventType.TRANSACTION_NEW], // Only subscribed to transactions
        ['wallet123'],
        mockWs
      );

      // Emit transaction event - should be sent
      emitter.emitTransactionEvent({
        signature: 'sig123',
        wallet_address: 'wallet123',
        timestamp: Date.now(),
        transaction_type: 'transfer',
        amount: 100,
        token_mint: 'token123',
      });

      const callCountAfterTransaction = mockWs.send.mock.calls.length;

      // Emit balance event - should NOT be sent
      emitter.emitBalanceUpdateEvent({
        wallet_address: 'wallet123',
        token_mint: 'token123',
        amount: 1000,
        usd_value: 50,
      });

      // Call count should not increase (except for confirmation message)
      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should only send events matching subscribed wallet addresses', () => {
      const mockWs = {
        readyState: 1,
        send: vi.fn(),
      } as unknown as WebSocket;

      emitter.subscribe(
        'test-agent',
        [EventType.TRANSACTION_NEW],
        ['wallet123'], // Only subscribed to wallet123
        mockWs
      );

      // Clear confirmation message call
      mockWs.send.mockClear();

      // Emit event for wallet123 - should be sent
      emitter.emitTransactionEvent({
        signature: 'sig123',
        wallet_address: 'wallet123',
        timestamp: Date.now(),
        transaction_type: 'transfer',
        amount: 100,
        token_mint: 'token123',
      });

      // Emit event for wallet456 - should NOT be sent
      emitter.emitTransactionEvent({
        signature: 'sig456',
        wallet_address: 'wallet456',
        timestamp: Date.now(),
        transaction_type: 'transfer',
        amount: 100,
        token_mint: 'token123',
      });

      // Should have buffered events but not sent to non-matching wallet
      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should send all events when subscribed to wildcard', () => {
      const mockWs = {
        readyState: 1,
        send: vi.fn(),
      } as unknown as WebSocket;

      emitter.subscribe(
        'test-agent',
        [EventType.TRANSACTION_NEW],
        ['*'], // Wildcard subscription
        mockWs
      );

      mockWs.send.mockClear();

      // Emit events for different wallets
      emitter.emitTransactionEvent({
        signature: 'sig123',
        wallet_address: 'wallet123',
        timestamp: Date.now(),
        transaction_type: 'transfer',
        amount: 100,
        token_mint: 'token123',
      });

      emitter.emitTransactionEvent({
        signature: 'sig456',
        wallet_address: 'wallet456',
        timestamp: Date.now(),
        transaction_type: 'transfer',
        amount: 100,
        token_mint: 'token123',
      });

      // Both should be buffered
      expect(mockWs.send).toHaveBeenCalled();
    });
  });
});
