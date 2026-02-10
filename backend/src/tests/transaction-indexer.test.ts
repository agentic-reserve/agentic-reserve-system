import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransactionIndexer } from '../services/memory/transaction-indexer';
import { LYSTransaction, TransactionType } from '../services/memory/lys-labs-client';

/**
 * Unit tests for Transaction Indexer
 * 
 * Tests basic functionality including:
 * - Transaction indexing
 * - Metadata parsing
 * - Balance updates
 * - Error handling
 * - Indexing status tracking
 */

describe('TransactionIndexer', () => {
  let indexer: TransactionIndexer;
  let mockSupabase: any;

  beforeEach(() => {
    // Create mock Supabase client with proper chaining
    // The key is that eq() is the last in the chain and returns a promise
    mockSupabase = {
      from: vi.fn(),
      select: vi.fn(),
      insert: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
      rpc: vi.fn(),
    };

    // Set up chaining - all methods return mockSupabase except eq() which returns a promise
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
    mockSupabase.upsert.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockResolvedValue({ data: null, error: null });
    mockSupabase.single.mockResolvedValue({ data: null, error: null });
    mockSupabase.rpc.mockResolvedValue({ error: null });

    indexer = new TransactionIndexer(mockSupabase);
  });

  describe('indexTransaction', () => {
    it('should index a valid transaction', async () => {
      const tx: LYSTransaction = {
        signature: '5j7s8K9mN2pQ3rT4uV5wX6yZ7aB8cD9eF0gH1iJ2kL3mN4oP5qR6sT7uV8wX9yZ0',
        walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        timestamp: 1640000000,
        type: TransactionType.TRANSFER,
        amount: 100,
        tokenMint: 'So11111111111111111111111111111111111111112',
        metadata: {
          tokenSymbol: 'SOL',
          fee: 0.000005,
          blockNumber: 123456,
        },
      };

      // Mock wallet registration check
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          address: tx.walletAddress,
          privacy_protected: false,
        },
        error: null,
      });

      // Mock RPC call (simulate RPC doesn't exist)
      mockSupabase.rpc.mockResolvedValueOnce({
        error: { message: 'function index_transaction_atomic does not exist' },
      });

      // Mock transaction insert
      mockSupabase.upsert.mockResolvedValueOnce({
        error: null,
      });

      // Mock balance fetch (no existing balance)
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock balance upsert
      mockSupabase.upsert.mockResolvedValueOnce({
        error: null,
      });

      // Mock indexing status fetch
      mockSupabase.single.mockResolvedValueOnce({
        data: { transaction_count: 0 },
        error: null,
      });

      // Mock indexing status update
      mockSupabase.update.mockResolvedValueOnce({
        error: null,
      });

      await expect(indexer.indexTransaction(tx)).resolves.not.toThrow();
    });

    it('should throw error for unregistered wallet', async () => {
      const tx: LYSTransaction = {
        signature: '5j7s8K9mN2pQ3rT4uV5wX6yZ7aB8cD9eF0gH1iJ2kL3mN4oP5qR6sT7uV8wX9yZ0',
        walletAddress: 'UnregisteredWallet111111111111111111111',
        timestamp: 1640000000,
        type: TransactionType.TRANSFER,
        amount: 100,
        tokenMint: 'So11111111111111111111111111111111111111112',
        metadata: {},
      };

      // Mock wallet registration check (not found)
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      // Mock indexing status update for error
      mockSupabase.single.mockResolvedValueOnce({
        data: { transaction_count: 0 },
        error: null,
      });
      mockSupabase.update.mockResolvedValueOnce({
        error: null,
      });

      await expect(indexer.indexTransaction(tx)).rejects.toThrow('not registered');
    });

    it('should handle privacy-protected transactions', async () => {
      const tx: LYSTransaction = {
        signature: '5j7s8K9mN2pQ3rT4uV5wX6yZ7aB8cD9eF0gH1iJ2kL3mN4oP5qR6sT7uV8wX9yZ0',
        walletAddress: 'PrivacyWallet111111111111111111111111111',
        timestamp: 1640000000,
        type: TransactionType.TRANSFER,
        amount: 100,
        tokenMint: 'So11111111111111111111111111111111111111112',
        metadata: {},
      };

      // Mock wallet registration check (privacy protected)
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          address: tx.walletAddress,
          privacy_protected: true,
        },
        error: null,
      });

      // Mock RPC call
      mockSupabase.rpc.mockResolvedValueOnce({
        error: { message: 'function index_transaction_atomic does not exist' },
      });

      // Mock transaction insert
      mockSupabase.upsert.mockResolvedValueOnce({
        error: null,
      });

      // Mock balance operations
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });
      mockSupabase.upsert.mockResolvedValueOnce({
        error: null,
      });

      // Mock indexing status operations
      mockSupabase.single.mockResolvedValueOnce({
        data: { transaction_count: 0 },
        error: null,
      });
      mockSupabase.update.mockResolvedValueOnce({
        error: null,
      });

      await expect(indexer.indexTransaction(tx)).resolves.not.toThrow();
    });
  });

  describe('indexTransactionBatch', () => {
    it('should process batch of transactions', async () => {
      const txs: LYSTransaction[] = [
        {
          signature: 'sig1',
          walletAddress: 'wallet1',
          timestamp: 1640000000,
          type: TransactionType.TRANSFER,
          amount: 100,
          tokenMint: 'token1',
          metadata: {},
        },
        {
          signature: 'sig2',
          walletAddress: 'wallet1',
          timestamp: 1640000001,
          type: TransactionType.SWAP,
          amount: 50,
          tokenMint: 'token2',
          metadata: {},
        },
      ];

      // Mock all operations for both transactions
      for (let i = 0; i < txs.length; i++) {
        mockSupabase.single
          .mockResolvedValueOnce({
            data: { address: 'wallet1', privacy_protected: false },
            error: null,
          })
          .mockResolvedValueOnce({
            data: null,
            error: { code: 'PGRST116' },
          })
          .mockResolvedValueOnce({
            data: { transaction_count: i },
            error: null,
          });
      }

      mockSupabase.rpc.mockResolvedValue({
        error: { message: 'function index_transaction_atomic does not exist' },
      });
      mockSupabase.upsert.mockResolvedValue({ error: null });
      mockSupabase.update.mockResolvedValue({ error: null });

      await expect(indexer.indexTransactionBatch(txs)).resolves.not.toThrow();
    });

    it('should throw error if any transaction fails', async () => {
      const txs: LYSTransaction[] = [
        {
          signature: 'sig1',
          walletAddress: 'wallet1',
          timestamp: 1640000000,
          type: TransactionType.TRANSFER,
          amount: 100,
          tokenMint: 'token1',
          metadata: {},
        },
      ];

      // Mock wallet registration check failure
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      // Mock error status update
      mockSupabase.single.mockResolvedValueOnce({
        data: { transaction_count: 0 },
        error: null,
      });
      mockSupabase.update.mockResolvedValueOnce({
        error: null,
      });

      await expect(indexer.indexTransactionBatch(txs)).rejects.toThrow('errors');
    });
  });

  describe('getIndexingStatus', () => {
    it('should return indexing status for registered wallet', async () => {
      const address = 'TestWallet111111111111111111111111111111';

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          address,
          indexing_status: 'active',
          last_indexed_timestamp: 1640000000,
          transaction_count: 42,
          error_message: null,
        },
        error: null,
      });

      const status = await indexer.getIndexingStatus(address);

      expect(status).not.toBeNull();
      expect(status?.walletAddress).toBe(address);
      expect(status?.status).toBe('active');
      expect(status?.transactionCount).toBe(42);
    });

    it('should return null for unregistered wallet', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const status = await indexer.getIndexingStatus('UnknownWallet');

      expect(status).toBeNull();
    });
  });

  describe('backfillWallet', () => {
    it('should update status during backfill', async () => {
      const address = 'TestWallet111111111111111111111111111111';

      // Mock status updates
      mockSupabase.update.mockResolvedValue({ error: null });

      await expect(indexer.backfillWallet(address)).resolves.not.toThrow();
    });

    it('should handle backfill errors', async () => {
      const address = 'TestWallet111111111111111111111111111111';

      // Mock status update failure
      mockSupabase.update
        .mockResolvedValueOnce({ error: null }) // pending status
        .mockResolvedValueOnce({ error: { message: 'Update failed' } }); // error status

      await expect(indexer.backfillWallet(address)).rejects.toThrow();
    });
  });
});
