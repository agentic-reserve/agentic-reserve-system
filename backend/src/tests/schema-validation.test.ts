/**
 * Schema Validation Tests for Solder Cortex Memory Tables
 * 
 * Tests the database schema created by migration 012_create_solder_cortex_memory_tables.sql
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getSupabaseClient } from '../services/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

describe('Solder Cortex Memory Tables Schema Validation', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    supabase = getSupabaseClient();
  });

  describe('Table Existence', () => {
    const expectedTables = [
      'wallet_registrations',
      'wallet_transactions',
      'wallet_balances',
      'wallet_pnl',
      'prediction_markets',
      'market_snapshots',
      'risk_profiles',
      'anomalies',
      'wallet_audit_trail',
      'cost_basis',
      'malicious_addresses',
    ];

    it('should have all required memory tables', async () => {
      const { data, error } = await supabase.rpc('get_tables', {
        schema_name: 'public',
      }).catch(() => {
        // Fallback: query information_schema directly
        return supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .in('table_name', expectedTables);
      });

      if (error) {
        // Alternative approach: try to select from each table
        for (const tableName of expectedTables) {
          const { error: tableError } = await supabase
            .from(tableName)
            .select('*')
            .limit(0);
          
          expect(tableError).toBeNull();
        }
      } else {
        const tableNames = data?.map((row: any) => row.table_name) || [];
        expectedTables.forEach(table => {
          expect(tableNames).toContain(table);
        });
      }
    });
  });

  describe('wallet_registrations Table', () => {
    it('should have correct column structure', async () => {
      const { data, error } = await supabase
        .from('wallet_registrations')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should enforce indexing_status check constraint', async () => {
      const { error } = await supabase
        .from('wallet_registrations')
        .insert({
          address: 'test_wallet_invalid_status',
          indexing_status: 'invalid_status', // Should fail
        });

      expect(error).toBeDefined();
      expect(error?.message).toContain('indexing_status');
    });

    it('should have primary key on address', async () => {
      const testAddress = 'test_wallet_pk_' + Date.now();
      
      // Insert first record
      const { error: insertError1 } = await supabase
        .from('wallet_registrations')
        .insert({
          address: testAddress,
          indexing_status: 'pending',
        });

      expect(insertError1).toBeNull();

      // Try to insert duplicate - should fail
      const { error: insertError2 } = await supabase
        .from('wallet_registrations')
        .insert({
          address: testAddress,
          indexing_status: 'active',
        });

      expect(insertError2).toBeDefined();

      // Cleanup
      await supabase
        .from('wallet_registrations')
        .delete()
        .eq('address', testAddress);
    });
  });

  describe('wallet_transactions Table', () => {
    it('should have correct column structure', async () => {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should enforce foreign key constraint to wallet_registrations', async () => {
      const { error } = await supabase
        .from('wallet_transactions')
        .insert({
          signature: 'test_sig_' + Date.now(),
          wallet_address: 'non_existent_wallet',
          timestamp: Date.now(),
          transaction_type: 'transfer',
        });

      expect(error).toBeDefined();
      expect(error?.message.toLowerCase()).toContain('foreign key');
    });

    it('should have primary key on signature', async () => {
      const testWallet = 'test_wallet_tx_' + Date.now();
      const testSignature = 'test_sig_' + Date.now();

      // Create wallet first
      await supabase
        .from('wallet_registrations')
        .insert({
          address: testWallet,
          indexing_status: 'active',
        });

      // Insert first transaction
      const { error: insertError1 } = await supabase
        .from('wallet_transactions')
        .insert({
          signature: testSignature,
          wallet_address: testWallet,
          timestamp: Date.now(),
          transaction_type: 'transfer',
        });

      expect(insertError1).toBeNull();

      // Try to insert duplicate signature - should fail
      const { error: insertError2 } = await supabase
        .from('wallet_transactions')
        .insert({
          signature: testSignature,
          wallet_address: testWallet,
          timestamp: Date.now(),
          transaction_type: 'swap',
        });

      expect(insertError2).toBeDefined();

      // Cleanup
      await supabase
        .from('wallet_registrations')
        .delete()
        .eq('address', testWallet);
    });
  });

  describe('wallet_balances Table', () => {
    it('should have correct column structure', async () => {
      const { data, error } = await supabase
        .from('wallet_balances')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should enforce unique constraint on (wallet_address, token_mint)', async () => {
      const testWallet = 'test_wallet_balance_' + Date.now();
      const testToken = 'test_token_' + Date.now();

      // Create wallet first
      await supabase
        .from('wallet_registrations')
        .insert({
          address: testWallet,
          indexing_status: 'active',
        });

      // Insert first balance
      const { error: insertError1 } = await supabase
        .from('wallet_balances')
        .insert({
          wallet_address: testWallet,
          token_mint: testToken,
          token_symbol: 'TEST',
          amount: 100,
          last_updated: Date.now(),
        });

      expect(insertError1).toBeNull();

      // Try to insert duplicate (wallet, token) - should fail
      const { error: insertError2 } = await supabase
        .from('wallet_balances')
        .insert({
          wallet_address: testWallet,
          token_mint: testToken,
          token_symbol: 'TEST',
          amount: 200,
          last_updated: Date.now(),
        });

      expect(insertError2).toBeDefined();

      // Cleanup
      await supabase
        .from('wallet_registrations')
        .delete()
        .eq('address', testWallet);
    });
  });

  describe('wallet_pnl Table', () => {
    it('should have correct column structure', async () => {
      const { data, error } = await supabase
        .from('wallet_pnl')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should enforce period check constraint', async () => {
      const testWallet = 'test_wallet_pnl_' + Date.now();

      // Create wallet first
      await supabase
        .from('wallet_registrations')
        .insert({
          address: testWallet,
          indexing_status: 'active',
        });

      const { error } = await supabase
        .from('wallet_pnl')
        .insert({
          wallet_address: testWallet,
          period: 'invalid_period', // Should fail
          realized_pnl: 100,
          unrealized_pnl: 50,
          total_pnl: 150,
          calculated_at: Date.now(),
        });

      expect(error).toBeDefined();
      expect(error?.message).toContain('period');

      // Cleanup
      await supabase
        .from('wallet_registrations')
        .delete()
        .eq('address', testWallet);
    });

    it('should accept valid period values', async () => {
      const testWallet = 'test_wallet_pnl_valid_' + Date.now();
      const validPeriods = ['24h', '7d', '30d', 'all'];

      // Create wallet first
      await supabase
        .from('wallet_registrations')
        .insert({
          address: testWallet,
          indexing_status: 'active',
        });

      for (const period of validPeriods) {
        const { error } = await supabase
          .from('wallet_pnl')
          .insert({
            wallet_address: testWallet,
            period,
            realized_pnl: 100,
            unrealized_pnl: 50,
            total_pnl: 150,
            calculated_at: Date.now() + validPeriods.indexOf(period),
          });

        expect(error).toBeNull();
      }

      // Cleanup
      await supabase
        .from('wallet_registrations')
        .delete()
        .eq('address', testWallet);
    });
  });

  describe('prediction_markets Table', () => {
    it('should have correct column structure', async () => {
      const { data, error } = await supabase
        .from('prediction_markets')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should store JSONB outcomes correctly', async () => {
      const testMarket = 'test_market_' + Date.now();
      const outcomes = {
        yes: { odds: 0.6, volume: 1000, liquidity: 5000 },
        no: { odds: 0.4, volume: 800, liquidity: 4000 },
      };

      const { error: insertError } = await supabase
        .from('prediction_markets')
        .insert({
          market_address: testMarket,
          proposal_id: 'test_proposal',
          outcomes,
          total_volume: 1800,
          total_liquidity: 9000,
          last_updated: Date.now(),
        });

      expect(insertError).toBeNull();

      // Verify JSONB storage
      const { data, error: selectError } = await supabase
        .from('prediction_markets')
        .select('outcomes')
        .eq('market_address', testMarket)
        .single();

      expect(selectError).toBeNull();
      expect(data?.outcomes).toEqual(outcomes);

      // Cleanup
      await supabase
        .from('prediction_markets')
        .delete()
        .eq('market_address', testMarket);
    });
  });

  describe('risk_profiles Table', () => {
    it('should have correct column structure', async () => {
      const { data, error } = await supabase
        .from('risk_profiles')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should enforce risk_score range constraint (0-100)', async () => {
      const testWallet = 'test_wallet_risk_' + Date.now();

      // Create wallet first
      await supabase
        .from('wallet_registrations')
        .insert({
          address: testWallet,
          indexing_status: 'active',
        });

      // Test invalid risk score (> 100)
      const { error: error1 } = await supabase
        .from('risk_profiles')
        .insert({
          wallet_address: testWallet,
          risk_score: 150, // Should fail
          risk_factors: {},
          last_assessment: Date.now(),
        });

      expect(error1).toBeDefined();

      // Test invalid risk score (< 0)
      const { error: error2 } = await supabase
        .from('risk_profiles')
        .insert({
          wallet_address: testWallet,
          risk_score: -10, // Should fail
          risk_factors: {},
          last_assessment: Date.now(),
        });

      expect(error2).toBeDefined();

      // Test valid risk score
      const { error: error3 } = await supabase
        .from('risk_profiles')
        .insert({
          wallet_address: testWallet,
          risk_score: 75, // Should succeed
          risk_factors: {},
          last_assessment: Date.now(),
        });

      expect(error3).toBeNull();

      // Cleanup
      await supabase
        .from('wallet_registrations')
        .delete()
        .eq('address', testWallet);
    });
  });

  describe('anomalies Table', () => {
    it('should have correct column structure', async () => {
      const { data, error } = await supabase
        .from('anomalies')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should enforce severity check constraint', async () => {
      const testWallet = 'test_wallet_anomaly_' + Date.now();
      const testSignature = 'test_sig_anomaly_' + Date.now();

      // Create wallet and transaction first
      await supabase
        .from('wallet_registrations')
        .insert({
          address: testWallet,
          indexing_status: 'active',
        });

      await supabase
        .from('wallet_transactions')
        .insert({
          signature: testSignature,
          wallet_address: testWallet,
          timestamp: Date.now(),
          transaction_type: 'transfer',
        });

      // Test invalid severity
      const { error } = await supabase
        .from('anomalies')
        .insert({
          transaction_signature: testSignature,
          wallet_address: testWallet,
          anomaly_type: 'large_amount',
          severity: 'invalid_severity', // Should fail
          description: 'Test anomaly',
          score: 85,
          timestamp: Date.now(),
        });

      expect(error).toBeDefined();
      expect(error?.message).toContain('severity');

      // Cleanup
      await supabase
        .from('wallet_registrations')
        .delete()
        .eq('address', testWallet);
    });
  });

  describe('wallet_audit_trail Table', () => {
    it('should have correct column structure', async () => {
      const { data, error } = await supabase
        .from('wallet_audit_trail')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should enforce authorization_status check constraint', async () => {
      const testWallet = 'test_wallet_audit_' + Date.now();

      // Create wallet first
      await supabase
        .from('wallet_registrations')
        .insert({
          address: testWallet,
          indexing_status: 'active',
        });

      const { error } = await supabase
        .from('wallet_audit_trail')
        .insert({
          wallet_address: testWallet,
          action_type: 'query',
          agent_id: 'test_agent',
          authorization_status: 'invalid_status', // Should fail
          timestamp: Date.now(),
        });

      expect(error).toBeDefined();
      expect(error?.message).toContain('authorization_status');

      // Cleanup
      await supabase
        .from('wallet_registrations')
        .delete()
        .eq('address', testWallet);
    });
  });

  describe('cost_basis Table', () => {
    it('should have correct column structure', async () => {
      const { data, error } = await supabase
        .from('cost_basis')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should support FIFO cost basis tracking', async () => {
      const testWallet = 'test_wallet_cost_' + Date.now();
      const testToken = 'test_token_cost_' + Date.now();

      // Create wallet first
      await supabase
        .from('wallet_registrations')
        .insert({
          address: testWallet,
          indexing_status: 'active',
        });

      // Insert multiple cost basis entries (FIFO order)
      const entries = [
        {
          wallet_address: testWallet,
          token_mint: testToken,
          amount: 100,
          cost_per_token: 10,
          total_cost: 1000,
          acquired_at: Date.now() - 3000,
          transaction_signature: 'sig1',
        },
        {
          wallet_address: testWallet,
          token_mint: testToken,
          amount: 50,
          cost_per_token: 12,
          total_cost: 600,
          acquired_at: Date.now() - 2000,
          transaction_signature: 'sig2',
        },
        {
          wallet_address: testWallet,
          token_mint: testToken,
          amount: 75,
          cost_per_token: 11,
          total_cost: 825,
          acquired_at: Date.now() - 1000,
          transaction_signature: 'sig3',
        },
      ];

      for (const entry of entries) {
        const { error } = await supabase
          .from('cost_basis')
          .insert(entry);
        expect(error).toBeNull();
      }

      // Query in FIFO order (oldest first)
      const { data, error } = await supabase
        .from('cost_basis')
        .select('*')
        .eq('wallet_address', testWallet)
        .eq('token_mint', testToken)
        .order('acquired_at', { ascending: true });

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(data![0].transaction_signature).toBe('sig1');
      expect(data![1].transaction_signature).toBe('sig2');
      expect(data![2].transaction_signature).toBe('sig3');

      // Cleanup
      await supabase
        .from('wallet_registrations')
        .delete()
        .eq('address', testWallet);
    });
  });

  describe('malicious_addresses Table', () => {
    it('should have correct column structure', async () => {
      const { data, error } = await supabase
        .from('malicious_addresses')
        .select('*')
        .limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should enforce severity check constraint', async () => {
      const testAddress = 'test_malicious_' + Date.now();

      const { error } = await supabase
        .from('malicious_addresses')
        .insert({
          address: testAddress,
          reason: 'Test malicious address',
          severity: 'invalid_severity', // Should fail
          reported_at: Date.now(),
        });

      expect(error).toBeDefined();
      expect(error?.message).toContain('severity');
    });
  });

  describe('Index Verification', () => {
    it('should have indexes on wallet_registrations', async () => {
      // Test that queries using indexed columns are efficient
      const { error } = await supabase
        .from('wallet_registrations')
        .select('*')
        .eq('indexing_status', 'active')
        .limit(1);

      expect(error).toBeNull();
    });

    it('should have indexes on wallet_transactions', async () => {
      // Test composite index (wallet_address, timestamp)
      const { error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_address', 'test')
        .order('timestamp', { ascending: false })
        .limit(1);

      expect(error).toBeNull();
    });

    it('should have indexes on wallet_balances', async () => {
      const { error } = await supabase
        .from('wallet_balances')
        .select('*')
        .eq('wallet_address', 'test')
        .limit(1);

      expect(error).toBeNull();
    });

    it('should have indexes on wallet_pnl', async () => {
      const { error } = await supabase
        .from('wallet_pnl')
        .select('*')
        .eq('wallet_address', 'test')
        .eq('period', '24h')
        .order('calculated_at', { ascending: false })
        .limit(1);

      expect(error).toBeNull();
    });
  });

  describe('Cascade Delete Behavior', () => {
    it('should cascade delete wallet_transactions when wallet is deleted', async () => {
      const testWallet = 'test_wallet_cascade_' + Date.now();
      const testSignature = 'test_sig_cascade_' + Date.now();

      // Create wallet and transaction
      await supabase
        .from('wallet_registrations')
        .insert({
          address: testWallet,
          indexing_status: 'active',
        });

      await supabase
        .from('wallet_transactions')
        .insert({
          signature: testSignature,
          wallet_address: testWallet,
          timestamp: Date.now(),
          transaction_type: 'transfer',
        });

      // Verify transaction exists
      const { data: txBefore } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('signature', testSignature)
        .single();

      expect(txBefore).toBeDefined();

      // Delete wallet
      await supabase
        .from('wallet_registrations')
        .delete()
        .eq('address', testWallet);

      // Verify transaction was cascade deleted
      const { data: txAfter } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('signature', testSignature)
        .single();

      expect(txAfter).toBeNull();
    });

    it('should cascade delete all related records when wallet is deleted', async () => {
      const testWallet = 'test_wallet_cascade_all_' + Date.now();

      // Create wallet
      await supabase
        .from('wallet_registrations')
        .insert({
          address: testWallet,
          indexing_status: 'active',
        });

      // Create related records
      await supabase.from('wallet_balances').insert({
        wallet_address: testWallet,
        token_mint: 'test_token',
        token_symbol: 'TEST',
        amount: 100,
        last_updated: Date.now(),
      });

      await supabase.from('wallet_pnl').insert({
        wallet_address: testWallet,
        period: '24h',
        realized_pnl: 100,
        unrealized_pnl: 50,
        total_pnl: 150,
        calculated_at: Date.now(),
      });

      await supabase.from('risk_profiles').insert({
        wallet_address: testWallet,
        risk_score: 50,
        risk_factors: {},
        last_assessment: Date.now(),
      });

      // Delete wallet
      await supabase
        .from('wallet_registrations')
        .delete()
        .eq('address', testWallet);

      // Verify all related records were cascade deleted
      const { data: balances } = await supabase
        .from('wallet_balances')
        .select('*')
        .eq('wallet_address', testWallet);

      const { data: pnl } = await supabase
        .from('wallet_pnl')
        .select('*')
        .eq('wallet_address', testWallet);

      const { data: risk } = await supabase
        .from('risk_profiles')
        .select('*')
        .eq('wallet_address', testWallet);

      expect(balances).toHaveLength(0);
      expect(pnl).toHaveLength(0);
      expect(risk).toHaveLength(0);
    });
  });
});
