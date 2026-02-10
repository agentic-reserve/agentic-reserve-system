import { Router, Request, Response } from 'express';
import { Connection, Keypair } from '@solana/web3.js';
import { getStealthAddressManager } from '../services/privacy/stealth-address-manager';
import { getShieldedTransferBuilder } from '../services/privacy/shielded/shielded-transfer-builder';
import { getPaymentScannerService } from '../services/privacy/scanning/payment-scanner-service';
import { getSupabaseClient } from '../services/supabase';
import { SipherClient } from '../services/privacy/sipher/sipher-client';
import { CommitmentManager } from '../services/privacy/commitment-manager';
import { PrivacyScoreAnalyzer } from '../services/privacy/privacy-score-analyzer';
import { MEVProtectionService } from '../services/privacy/mev-protection-service';
import { getEncryptionService } from '../services/privacy/encryption-service';
import { getJupiterClient } from '../services/defi/jupiter-client';
import { config } from '../config';

const router = Router();

/**
 * Privacy API Routes
 * 
 * Provides REST endpoints for privacy features:
 * 
 * Phase 1: Shielded ARU Transfers
 * - Stealth address generation
 * - Shielded transfer building
 * - Payment detection
 * - Payment claiming
 * - Transaction history
 * 
 * Phase 2: MEV-Protected Rebalancing
 * - Pedersen commitment operations
 * - Privacy score analysis
 * - MEV-protected swaps
 * - MEV metrics tracking
 * 
 * Requirements: 1.1, 2.1, 3.1, 4.1, 5.5, 6.1, 7.1, 8.1, 9.1, 10.1
 */

// Initialize Phase 2 services
let commitmentManager: CommitmentManager | null = null;
let privacyAnalyzer: PrivacyScoreAnalyzer | null = null;
let mevProtectionService: MEVProtectionService | null = null;

function getCommitmentManager(): CommitmentManager {
  if (!commitmentManager) {
    const sipherClient = new SipherClient({
      baseUrl: config.sipher.url,
      apiKey: config.sipher.apiKey
    });
    const supabase = getSupabaseClient();
    const encryption = getEncryptionService();
    commitmentManager = new CommitmentManager(sipherClient, supabase, encryption);
  }
  return commitmentManager;
}

function getPrivacyAnalyzer(): PrivacyScoreAnalyzer {
  if (!privacyAnalyzer) {
    const sipherClient = new SipherClient({
      baseUrl: config.sipher.url,
      apiKey: config.sipher.apiKey
    });
    const supabase = getSupabaseClient();
    privacyAnalyzer = new PrivacyScoreAnalyzer(sipherClient, supabase);
  }
  return privacyAnalyzer;
}

function getMEVProtectionService(): MEVProtectionService {
  if (!mevProtectionService) {
    const sipherClient = new SipherClient({
      baseUrl: config.sipher.url,
      apiKey: config.sipher.apiKey
    });
    const supabase = getSupabaseClient();
    const encryption = getEncryptionService();
    const commitmentMgr = getCommitmentManager();
    const stealthMgr = getStealthAddressManager();
    const privacyAn = getPrivacyAnalyzer();
    const jupiterClient = getJupiterClient();
    
    mevProtectionService = new MEVProtectionService(
      sipherClient,
      commitmentMgr,
      stealthMgr,
      privacyAn,
      jupiterClient,
      supabase
    );
  }
  return mevProtectionService;
}

// ============================================================================
// Phase 1: Shielded ARU Transfers
// ============================================================================

/**
 * POST /api/privacy/stealth-address
 * 
 * Generate stealth meta-address for agent
 * 
 * Body:
 * - agentId: string - Agent identifier
 * - label: string - Human-readable label
 * 
 * Response:
 * - id: number - Database record ID
 * - metaAddress: MetaAddress - Generated meta-address
 * 
 * Requirements: 1.1
 */
router.post('/stealth-address', async (req: Request, res: Response) => {
  try {
    const { agentId, label } = req.body;

    if (!agentId || !label) {
      return res.status(400).json({
        error: 'Missing required fields: agentId, label'
      });
    }

    const stealthManager = getStealthAddressManager();
    const result = await stealthManager.generateForAgent(agentId, label);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Failed to generate stealth address:', error);
    res.status(500).json({
      error: 'Failed to generate stealth address',
      message: error.message
    });
  }
});

/**
 * GET /api/privacy/stealth-address/:agentId
 * 
 * Get meta-address for agent
 * 
 * Params:
 * - agentId: string - Agent identifier
 * 
 * Response:
 * - metaAddress: MetaAddress - Agent's meta-address
 * 
 * Requirements: 1.5
 */
router.get('/stealth-address/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;

    const stealthManager = getStealthAddressManager();
    const metaAddress = await stealthManager.getByAgentId(agentId);

    if (!metaAddress) {
      return res.status(404).json({
        error: 'Meta-address not found for agent'
      });
    }

    res.json({
      success: true,
      data: { metaAddress }
    });
  } catch (error: any) {
    console.error('Failed to get stealth address:', error);
    res.status(500).json({
      error: 'Failed to get stealth address',
      message: error.message
    });
  }
});

/**
 * POST /api/privacy/shielded-transfer
 * 
 * Build shielded transfer transaction
 * 
 * Body:
 * - senderId: string - Sender's Solana address
 * - recipientMetaAddressId: number - Recipient's meta-address ID
 * - amount: string - Transfer amount
 * - mint?: string - Token mint (optional, defaults to SOL)
 * 
 * Response:
 * - unsignedTransaction: string - Base64 encoded unsigned transaction
 * - stealthAddress: StealthAddress - One-time recipient address
 * - commitment: string - Pedersen commitment
 * - record: ShieldedTransferRecord - Database record
 * 
 * Requirements: 2.1
 */
router.post('/shielded-transfer', async (req: Request, res: Response) => {
  try {
    const { senderId, recipientMetaAddressId, amount, mint } = req.body;

    if (!senderId || !recipientMetaAddressId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: senderId, recipientMetaAddressId, amount'
      });
    }

    const transferBuilder = getShieldedTransferBuilder();
    const result = await transferBuilder.buildTransfer({
      senderId,
      recipientMetaAddressId: parseInt(recipientMetaAddressId),
      amount,
      mint
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Failed to build shielded transfer:', error);
    res.status(500).json({
      error: 'Failed to build shielded transfer',
      message: error.message
    });
  }
});

/**
 * POST /api/privacy/shielded-transfer/submit
 * 
 * Submit signed shielded transfer transaction
 * 
 * Body:
 * - unsignedTransaction: string - Base64 encoded unsigned transaction
 * - senderPrivateKey: string - Sender's private key (base58)
 * - recordId: number - Database record ID
 * 
 * Response:
 * - txSignature: string - Transaction signature
 * 
 * Requirements: 2.3
 */
router.post('/shielded-transfer/submit', async (req: Request, res: Response) => {
  try {
    const { unsignedTransaction, senderPrivateKey, recordId } = req.body;

    if (!unsignedTransaction || !senderPrivateKey || !recordId) {
      return res.status(400).json({
        error: 'Missing required fields: unsignedTransaction, senderPrivateKey, recordId'
      });
    }

    // Decode sender keypair from private key
    const senderKeypair = Keypair.fromSecretKey(
      Buffer.from(senderPrivateKey, 'base58')
    );

    const transferBuilder = getShieldedTransferBuilder();
    const signature = await transferBuilder.submitTransfer(
      unsignedTransaction,
      senderKeypair,
      parseInt(recordId)
    );

    res.json({
      success: true,
      data: { txSignature: signature }
    });
  } catch (error: any) {
    console.error('Failed to submit shielded transfer:', error);
    res.status(500).json({
      error: 'Failed to submit shielded transfer',
      message: error.message
    });
  }
});

/**
 * GET /api/privacy/payments/:agentId
 * 
 * Get detected payments for agent
 * 
 * Params:
 * - agentId: string - Agent identifier
 * 
 * Query:
 * - limit?: number - Maximum number of payments to return (default: 100)
 * 
 * Response:
 * - payments: DetectedPayment[] - Array of detected payments
 * 
 * Requirements: 3.1
 */
router.get('/payments/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const scanner = getPaymentScannerService();
    const payments = await scanner.scanForAgent(agentId);

    res.json({
      success: true,
      data: {
        payments: payments.slice(0, limit),
        total: payments.length
      }
    });
  } catch (error: any) {
    console.error('Failed to get payments:', error);
    res.status(500).json({
      error: 'Failed to get payments',
      message: error.message
    });
  }
});

/**
 * POST /api/privacy/claim
 * 
 * Claim stealth payment to destination address
 * 
 * Body:
 * - agentId: string - Agent identifier
 * - stealthAddress: string - Stealth address to claim from
 * - ephemeralPublicKey: string - Ephemeral public key
 * - destinationAddress: string - Destination address
 * - mint?: string - Token mint (optional)
 * 
 * Response:
 * - txSignature: string - Claim transaction signature
 * 
 * Requirements: 4.1
 */
router.post('/claim', async (req: Request, res: Response) => {
  try {
    const { agentId, stealthAddress, ephemeralPublicKey, destinationAddress, mint } = req.body;

    if (!agentId || !stealthAddress || !ephemeralPublicKey || !destinationAddress) {
      return res.status(400).json({
        error: 'Missing required fields: agentId, stealthAddress, ephemeralPublicKey, destinationAddress'
      });
    }

    const transferBuilder = getShieldedTransferBuilder();
    const result = await transferBuilder.claimPayment({
      agentId,
      stealthAddress,
      ephemeralPublicKey,
      destinationAddress,
      mint
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Failed to claim payment:', error);
    res.status(500).json({
      error: 'Failed to claim payment',
      message: error.message
    });
  }
});

/**
 * GET /api/privacy/transactions/:agentId
 * 
 * Get transaction history for agent
 * 
 * Params:
 * - agentId: string - Agent identifier
 * 
 * Query:
 * - limit?: number - Maximum number of transactions to return (default: 100)
 * 
 * Response:
 * - transactions: ShieldedTransferRecord[] - Array of transactions
 * 
 * Requirements: 5.5
 */
router.get('/transactions/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const transferBuilder = getShieldedTransferBuilder();
    const transactions = await transferBuilder.getTransferHistory(agentId, limit);

    res.json({
      success: true,
      data: {
        transactions,
        total: transactions.length
      }
    });
  } catch (error: any) {
    console.error('Failed to get transaction history:', error);
    res.status(500).json({
      error: 'Failed to get transaction history',
      message: error.message
    });
  }
});

/**
 * GET /api/privacy/scanner/stats
 * 
 * Get payment scanner statistics
 * 
 * Response:
 * - totalAgents: number - Total number of agents being scanned
 * - lastScanTimes: Array - Last scan time for each agent
 */
router.get('/scanner/stats', async (req: Request, res: Response) => {
  try {
    const scanner = getPaymentScannerService();
    const stats = await scanner.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Failed to get scanner stats:', error);
    res.status(500).json({
      error: 'Failed to get scanner stats',
      message: error.message
    });
  }
});

// ============================================================================
// Phase 2: MEV-Protected Rebalancing
// ============================================================================

/**
 * POST /api/privacy/commitment
 * 
 * Create Pedersen commitment for a value
 * 
 * Body:
 * - value: string - Value to commit to
 * 
 * Response:
 * - id: number - Commitment ID
 * - commitment: string - Hex-encoded commitment
 * - value: string - Original value
 * 
 * Requirements: 6.1
 */
router.post('/commitment', async (req: Request, res: Response) => {
  try {
    const { value } = req.body;

    if (!value) {
      return res.status(400).json({
        error: 'Missing required field: value'
      });
    }

    const manager = getCommitmentManager();
    const commitment = await manager.create(value);

    res.json({
      success: true,
      data: {
        id: commitment.id,
        commitment: commitment.commitment,
        value: commitment.value,
        created_at: commitment.created_at
      }
    });
  } catch (error: any) {
    console.error('Failed to create commitment:', error);
    res.status(500).json({
      error: 'Failed to create commitment',
      message: error.message
    });
  }
});

/**
 * POST /api/privacy/commitment/verify
 * 
 * Verify commitment opening
 * 
 * Body:
 * - commitmentId: number - Commitment ID
 * - value: string - Value to verify
 * 
 * Response:
 * - valid: boolean - Whether commitment is valid
 * 
 * Requirements: 8.1
 */
router.post('/commitment/verify', async (req: Request, res: Response) => {
  try {
    const { commitmentId, value } = req.body;

    if (!commitmentId || !value) {
      return res.status(400).json({
        error: 'Missing required fields: commitmentId, value'
      });
    }

    const manager = getCommitmentManager();
    const valid = await manager.verify(parseInt(commitmentId), value);

    res.json({
      success: true,
      data: { valid }
    });
  } catch (error: any) {
    console.error('Failed to verify commitment:', error);
    res.status(500).json({
      error: 'Failed to verify commitment',
      message: error.message
    });
  }
});

/**
 * POST /api/privacy/commitment/add
 * 
 * Add two commitments homomorphically
 * 
 * Body:
 * - commitmentIdA: number - First commitment ID
 * - commitmentIdB: number - Second commitment ID
 * 
 * Response:
 * - id: number - Combined commitment ID
 * - commitment: string - Combined commitment
 * - value: string - Sum of values
 * 
 * Requirements: 7.1, 7.2
 */
router.post('/commitment/add', async (req: Request, res: Response) => {
  try {
    const { commitmentIdA, commitmentIdB } = req.body;

    if (!commitmentIdA || !commitmentIdB) {
      return res.status(400).json({
        error: 'Missing required fields: commitmentIdA, commitmentIdB'
      });
    }

    const manager = getCommitmentManager();
    const sumCommitment = await manager.add(
      parseInt(commitmentIdA),
      parseInt(commitmentIdB)
    );

    res.json({
      success: true,
      data: {
        id: sumCommitment.id,
        commitment: sumCommitment.commitment,
        value: sumCommitment.value,
        created_at: sumCommitment.created_at
      }
    });
  } catch (error: any) {
    console.error('Failed to add commitments:', error);
    res.status(500).json({
      error: 'Failed to add commitments',
      message: error.message
    });
  }
});

/**
 * GET /api/privacy/score/:address
 * 
 * Get privacy score for an address
 * 
 * Params:
 * - address: string - Wallet/vault address
 * 
 * Query:
 * - limit?: number - Transaction limit for analysis (optional)
 * 
 * Response:
 * - address: string - Analyzed address
 * - score: number - Privacy score (0-100)
 * - grade: string - Letter grade (A-F)
 * - factors: string[] - Privacy-reducing factors
 * - recommendations: string[] - Improvement suggestions
 * 
 * Requirements: 9.1, 9.2
 */
router.get('/score/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    const analyzer = getPrivacyAnalyzer();
    const score = await analyzer.analyzePrivacy(address, limit);

    res.json({
      success: true,
      data: score
    });
  } catch (error: any) {
    console.error('Failed to analyze privacy score:', error);
    res.status(500).json({
      error: 'Failed to analyze privacy score',
      message: error.message
    });
  }
});

/**
 * GET /api/privacy/score/:address/trend
 * 
 * Get privacy score trend for an address
 * 
 * Params:
 * - address: string - Wallet/vault address
 * 
 * Query:
 * - limit?: number - Number of historical scores (default: 10)
 * 
 * Response:
 * - address: string - Analyzed address
 * - scores: Array - Historical scores
 * - averageScore: number - Average score
 * - trend: string - Trend direction (improving/stable/degrading)
 * 
 * Requirements: 9.4, 9.5
 */
router.get('/score/:address/trend', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const analyzer = getPrivacyAnalyzer();
    const trend = await analyzer.getScoreTrend(address, limit);

    res.json({
      success: true,
      data: trend
    });
  } catch (error: any) {
    console.error('Failed to get privacy score trend:', error);
    res.status(500).json({
      error: 'Failed to get privacy score trend',
      message: error.message
    });
  }
});

/**
 * POST /api/privacy/protected-swap
 * 
 * Execute MEV-protected swap
 * 
 * Body:
 * - vaultId: string - Vault address
 * - inputMint: string - Input token mint
 * - outputMint: string - Output token mint
 * - amount: string - Swap amount
 * - slippageBps: number - Slippage tolerance in basis points
 * 
 * Response:
 * - txSignature: string - Transaction signature
 * - metrics: MEVMetrics - MEV extraction metrics
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
router.post('/protected-swap', async (req: Request, res: Response) => {
  try {
    const { vaultId, inputMint, outputMint, amount, slippageBps } = req.body;

    if (!vaultId || !inputMint || !outputMint || !amount || !slippageBps) {
      return res.status(400).json({
        error: 'Missing required fields: vaultId, inputMint, outputMint, amount, slippageBps'
      });
    }

    const service = getMEVProtectionService();
    const result = await service.executeProtectedSwap(vaultId, {
      inputMint,
      outputMint,
      amount,
      slippageBps: parseInt(slippageBps)
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Failed to execute protected swap:', error);
    res.status(500).json({
      error: 'Failed to execute protected swap',
      message: error.message
    });
  }
});

/**
 * GET /api/privacy/mev-metrics/:vaultId
 * 
 * Get MEV metrics for a vault
 * 
 * Params:
 * - vaultId: string - Vault address
 * 
 * Response:
 * - mevBeforeIntegration: number - Baseline MEV extracted (USD)
 * - mevAfterIntegration: number - Current MEV extracted (USD)
 * - reductionPercentage: number - MEV reduction percentage
 * - privacyScoreTrend: number[] - Historical privacy scores
 * 
 * Requirements: 10.5
 */
router.get('/mev-metrics/:vaultId', async (req: Request, res: Response) => {
  try {
    const { vaultId } = req.params;

    const service = getMEVProtectionService();
    const metrics = await service.getMetrics(vaultId);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    console.error('Failed to get MEV metrics:', error);
    res.status(500).json({
      error: 'Failed to get MEV metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/privacy/low-privacy-addresses
 * 
 * Get all addresses with low privacy scores (<70)
 * 
 * Response:
 * - addresses: Array - Addresses needing enhanced protection
 * 
 * Requirements: 9.3, 9.4
 */
router.get('/low-privacy-addresses', async (req: Request, res: Response) => {
  try {
    const analyzer = getPrivacyAnalyzer();
    const addresses = await analyzer.getLowPrivacyAddresses();

    res.json({
      success: true,
      data: {
        addresses,
        total: addresses.length
      }
    });
  } catch (error: any) {
    console.error('Failed to get low privacy addresses:', error);
    res.status(500).json({
      error: 'Failed to get low privacy addresses',
      message: error.message
    });
  }
});

export default router;
