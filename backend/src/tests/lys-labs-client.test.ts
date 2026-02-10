import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LYSLabsClient, TransactionType, LYSTransaction } from '../services/memory/lys-labs-client';

describe('LYSLabsClient', () => {
  let client: LYSLabsClient;
  const testUrl = 'wss://api.lyslabs.io/ws';
  const testApiKey = 'test-api-key';

  beforeEach(() => {
    client = new LYSLabsClient(testUrl, testApiKey);
  });

  describe('Initialization', () => {
    it('should create client instance with correct parameters', () => {
      expect(client).toBeInstanceOf(LYSLabsClient);
      expect(client.isConnected()).toBe(false);
    });

    it('should initialize with zero subscriptions', () => {
      expect(client.getSubscriptionCount()).toBe(0);
      expect(client.getSubscriptions()).toEqual([]);
    });
  });

  describe('Connection State', () => {
    it('should return false for isConnected when not connected', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should throw error when subscribing without connection', async () => {
      await expect(
        client.subscribeWallet('So11111111111111111111111111111111111111112')
      ).rejects.toThrow('WebSocket not connected');
    });

    it('should throw error when unsubscribing without connection', async () => {
      await expect(
        client.unsubscribeWallet('So11111111111111111111111111111111111111112')
      ).rejects.toThrow('WebSocket not connected');
    });
  });

  describe('Event Handler Registration', () => {
    it('should register transaction event handler', () => {
      const handler = vi.fn();
      client.onTransaction(handler);
      
      // Emit a test event
      const testTransaction: LYSTransaction = {
        signature: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
        walletAddress: 'So11111111111111111111111111111111111111112',
        timestamp: Date.now(),
        type: TransactionType.TRANSFER,
        amount: 1.5,
        tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        metadata: {},
      };
      
      client.emit('transaction', testTransaction);
      expect(handler).toHaveBeenCalledWith(testTransaction);
    });

    it('should register error event handler', () => {
      const handler = vi.fn();
      client.onError(handler);
      
      const testError = new Error('Test error');
      client.emit('error', testError);
      expect(handler).toHaveBeenCalledWith(testError);
    });

    it('should register reconnect event handler', () => {
      const handler = vi.fn();
      client.onReconnect(handler);
      
      client.emit('reconnected');
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Subscription Management (Internal State)', () => {
    it('should track subscription count', () => {
      expect(client.getSubscriptionCount()).toBe(0);
    });

    it('should return empty list of subscriptions initially', () => {
      const subscriptions = client.getSubscriptions();
      expect(subscriptions).toEqual([]);
      expect(subscriptions).toHaveLength(0);
    });
  });

  describe('Transaction Type Enum', () => {
    it('should have all required transaction types', () => {
      expect(TransactionType.TRANSFER).toBe('transfer');
      expect(TransactionType.SWAP).toBe('swap');
      expect(TransactionType.STAKE).toBe('stake');
      expect(TransactionType.UNSTAKE).toBe('unstake');
      expect(TransactionType.LIQUIDITY_ADD).toBe('liquidity_add');
      expect(TransactionType.LIQUIDITY_REMOVE).toBe('liquidity_remove');
      expect(TransactionType.VOTE).toBe('vote');
      expect(TransactionType.UNKNOWN).toBe('unknown');
    });
  });

  describe('Transaction Interface', () => {
    it('should accept valid transaction structure', () => {
      const validTransaction: LYSTransaction = {
        signature: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
        walletAddress: 'So11111111111111111111111111111111111111112',
        timestamp: 1234567890,
        type: TransactionType.SWAP,
        amount: 100.5,
        tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        metadata: { protocol: 'Jupiter', fee: 0.000005 },
      };

      expect(validTransaction.signature).toBeDefined();
      expect(validTransaction.walletAddress).toBeDefined();
      expect(validTransaction.timestamp).toBeGreaterThan(0);
      expect(validTransaction.type).toBe(TransactionType.SWAP);
      expect(validTransaction.amount).toBeGreaterThan(0);
      expect(validTransaction.tokenMint).toBeDefined();
      expect(validTransaction.metadata).toBeDefined();
    });

    it('should handle transaction with empty metadata', () => {
      const transaction: LYSTransaction = {
        signature: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
        walletAddress: 'So11111111111111111111111111111111111111112',
        timestamp: 1234567890,
        type: TransactionType.TRANSFER,
        amount: 1.0,
        tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        metadata: {},
      };

      expect(transaction.metadata).toEqual({});
    });
  });

  describe('Client Configuration', () => {
    it('should accept URL and API key in constructor', () => {
      const customUrl = 'wss://custom.api.com/ws';
      const customKey = 'custom-key';
      const customClient = new LYSLabsClient(customUrl, customKey);
      
      expect(customClient).toBeInstanceOf(LYSLabsClient);
      expect(customClient.isConnected()).toBe(false);
    });
  });

  describe('Event Emitter Behavior', () => {
    it('should support multiple event listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      client.onTransaction(handler1);
      client.onTransaction(handler2);
      
      const testTransaction: LYSTransaction = {
        signature: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
        walletAddress: 'So11111111111111111111111111111111111111112',
        timestamp: Date.now(),
        type: TransactionType.TRANSFER,
        amount: 1.0,
        tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        metadata: {},
      };
      
      client.emit('transaction', testTransaction);
      
      expect(handler1).toHaveBeenCalledWith(testTransaction);
      expect(handler2).toHaveBeenCalledWith(testTransaction);
    });

    it('should support multiple error listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      client.onError(handler1);
      client.onError(handler2);
      
      const testError = new Error('Test error');
      client.emit('error', testError);
      
      expect(handler1).toHaveBeenCalledWith(testError);
      expect(handler2).toHaveBeenCalledWith(testError);
    });
  });

  describe('Disconnect Behavior', () => {
    it('should handle disconnect when not connected', async () => {
      // Should not throw
      await expect(client.disconnect()).resolves.toBeUndefined();
    });
  });
});
