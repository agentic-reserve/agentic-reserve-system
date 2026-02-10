import {
  Connection,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  TransactionInstruction
} from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from '../../config';

// Jito tip accounts for mainnet-beta
const TIP_ACCOUNTS = [
  "4ACfpUFoaSD9bfPdeu6DBt89gB6ENTeHBXCAi87NhDEE",
  "D2L6yPZ2FmmmTKPgzaMKdhu6EWZcTpLy1Vhx8uvZe7NZ",
  "9bnz4RShgq1hAnLnZbP8kbgBg1kEmcJBYQq3gQbmnSta",
  "5VY91ws6B2hMmBFRsXkoAAdsPHBJwRfBht4DXox3xkwn",
  "2nyhqdwKcJZR2vcqCyrYsaPVdAnFoJjiksCXJ7hfEYgD",
  "2q5pghRs6arqVjRvT5gfgWfWcHWmw1ZuCzphgd5KfWGJ",
  "wyvPkWjVZz1M8fHQnMMCDTQDbkManefNNhweYk5WkcF",
  "3KCKozbAaF75qEU33jtzozcJ29yJuaLJTy2jFdzUY8bT",
  "4vieeGHPYPG2MmyPRcYjdiDmmhN3ww7hsFNap8pVN3Ey",
  "4TQLFNWK8AovT1gFvda5jfw2oJeRMKEmw7aH6MGBJ3or"
];

interface SendResult {
  signature: string;
  confirmed: boolean;
}

interface SenderConfig {
  endpoint?: string;
  region?: 'slc' | 'ewr' | 'lon' | 'fra' | 'ams' | 'sg' | 'tyo';
  useSWQOSOnly?: boolean;
  maxRetries?: number;
}

/**
 * Helius Sender Client
 * Ultra-low latency transaction submission with dual routing
 */
export class HeliusSenderClient {
  private connection: Connection;
  private senderEndpoint: string;
  private maxRetries: number;

  constructor(config?: SenderConfig) {
    this.connection = new Connection(
      `https://mainnet.helius-rpc.com/?api-key=${config?.endpoint || process.env.HELIUS_API_KEY}`
    );

    // Determine endpoint based on configuration
    if (config?.endpoint) {
      this.senderEndpoint = config.endpoint;
    } else if (config?.region) {
      // Backend: Use regional HTTP endpoint
      this.senderEndpoint = `http://${config.region}-sender.helius-rpc.com/fast`;
    } else {
      // Frontend: Use HTTPS endpoint (auto-routes to nearest location)
      this.senderEndpoint = 'https://sender.helius-rpc.com/fast';
    }

    // Add SWQOS-only parameter if specified
    if (config?.useSWQOSOnly) {
      this.senderEndpoint += '?swqos_only=true';
    }

    this.maxRetries = config?.maxRetries || 3;

    console.log('✅ Helius Sender Client initialized');
    console.log(`   Endpoint: ${this.senderEndpoint}`);
  }

  /**
   * Get dynamic tip amount from Jito API (75th percentile)
   */
  async getDynamicTipAmount(): Promise<number> {
    try {
      const response = await fetch('https://bundles.jito.wtf/api/v1/bundles/tip_floor');
      const data = await response.json();

      if (data && data[0] && typeof data[0].landed_tips_75th_percentile === 'number') {
        const tip75th = data[0].landed_tips_75th_percentile;
        // Use 75th percentile but minimum 0.0002 SOL (or 0.000005 for SWQOS-only)
        const minTip = this.senderEndpoint.includes('swqos_only') ? 0.000005 : 0.0002;
        return Math.max(tip75th, minTip);
      }

      // Fallback to minimum
      return this.senderEndpoint.includes('swqos_only') ? 0.000005 : 0.0002;
    } catch (error) {
      console.warn('Failed to fetch dynamic tip amount, using fallback:', error);
      return this.senderEndpoint.includes('swqos_only') ? 0.000005 : 0.0002;
    }
  }

  /**
   * Get priority fee estimate from Helius
   */
  async getPriorityFee(
    instructions: TransactionInstruction[],
    payerKey: PublicKey,
    blockhash: string
  ): Promise<number> {
    try {
      const tempTx = new VersionedTransaction(
        new TransactionMessage({
          instructions,
          payerKey,
          recentBlockhash: blockhash,
        }).compileToV0Message()
      );

      const response = await fetch(this.connection.rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          method: 'getPriorityFeeEstimate',
          params: [{
            transaction: bs58.encode(tempTx.serialize()),
            options: { recommended: true },
          }],
        }),
      });

      const data = await response.json();
      
      if (data.result?.priorityFeeEstimate) {
        // Add 20% buffer to recommended fee
        return Math.ceil(data.result.priorityFeeEstimate * 1.2);
      }

      return 50_000; // Fallback fee
    } catch (error) {
      console.warn('Failed to get priority fee, using fallback:', error);
      return 50_000;
    }
  }

  /**
   * Send transaction with automatic optimization
   */
  async sendTransaction(
    keypair: Keypair,
    instructions: TransactionInstruction[]
  ): Promise<SendResult> {
    // Validate user hasn't included compute budget instructions
    const hasComputeBudget = instructions.some(ix =>
      ix.programId.equals(ComputeBudgetProgram.programId)
    );

    if (hasComputeBudget) {
      throw new Error('Do not include compute budget instructions - they are added automatically');
    }

    // Create copy of instructions
    const allInstructions = [...instructions];

    // Get dynamic tip amount
    const tipAmountSOL = await this.getDynamicTipAmount();
    const tipAccount = new PublicKey(
      TIP_ACCOUNTS[Math.floor(Math.random() * TIP_ACCOUNTS.length)]
    );

    console.log(`💰 Using dynamic tip: ${tipAmountSOL} SOL`);

    // Add tip instruction
    allInstructions.push(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: tipAccount,
        lamports: tipAmountSOL * LAMPORTS_PER_SOL,
      })
    );

    // Get recent blockhash with context
    const { value: blockhashInfo } = await this.connection.getLatestBlockhashAndContext('confirmed');
    const { blockhash, lastValidBlockHeight } = blockhashInfo;

    // Simulate transaction to get compute units
    const testInstructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
      ...allInstructions,
    ];

    const testTransaction = new VersionedTransaction(
      new TransactionMessage({
        instructions: testInstructions,
        payerKey: keypair.publicKey,
        recentBlockhash: blockhash,
      }).compileToV0Message()
    );

    testTransaction.sign([keypair]);

    const simulation = await this.connection.simulateTransaction(testTransaction, {
      replaceRecentBlockhash: true,
      sigVerify: false,
    });

    if (!simulation.value.unitsConsumed) {
      throw new Error('Simulation failed to return compute units');
    }

    // Set compute unit limit with 10% margin
    const units = simulation.value.unitsConsumed;
    const computeUnits = units < 1000 ? 1000 : Math.ceil(units * 1.1);

    // Get dynamic priority fee
    const priorityFee = await this.getPriorityFee(allInstructions, keypair.publicKey, blockhash);

    // Add compute budget instructions at the beginning
    allInstructions.unshift(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee })
    );
    allInstructions.unshift(
      ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits })
    );

    // Build final optimized transaction
    const transaction = new VersionedTransaction(
      new TransactionMessage({
        instructions: allInstructions,
        payerKey: keypair.publicKey,
        recentBlockhash: blockhash,
      }).compileToV0Message()
    );

    transaction.sign([keypair]);

    // Send with retry logic
    return await this.sendWithRetry(transaction, lastValidBlockHeight);
  }

  /**
   * Send transaction with retry logic
   */
  private async sendWithRetry(
    transaction: VersionedTransaction,
    lastValidBlockHeight: number
  ): Promise<SendResult> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Check blockhash validity
        const currentHeight = await this.connection.getBlockHeight('confirmed');
        if (currentHeight > lastValidBlockHeight) {
          throw new Error('Blockhash expired');
        }

        // Send transaction via Sender endpoint
        const response = await fetch(this.senderEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now().toString(),
            method: 'sendTransaction',
            params: [
              Buffer.from(transaction.serialize()).toString('base64'),
              {
                encoding: 'base64',
                skipPreflight: true, // Required for Sender
                maxRetries: 0 // Implement own retry logic
              }
            ]
          })
        });

        const result = await response.json();

        if (result.error) {
          throw new Error(result.error.message);
        }

        const signature = result.result;
        console.log(`✅ Transaction sent: ${signature}`);

        // Confirm transaction
        const confirmed = await this.confirmTransaction(signature);

        return {
          signature,
          confirmed
        };
      } catch (error) {
        console.warn(`Attempt ${attempt + 1} failed:`, error);
        
        if (attempt === this.maxRetries - 1) {
          throw error;
        }

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }

    throw new Error('All retry attempts failed');
  }

  /**
   * Confirm transaction
   */
  private async confirmTransaction(signature: string): Promise<boolean> {
    const timeout = 15000; // 15 seconds
    const interval = 500; // Check every 500ms
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const status = await this.connection.getSignatureStatuses([signature]);
        
        if (status?.value[0]?.confirmationStatus === 'confirmed') {
          console.log(`✅ Transaction confirmed: ${signature}`);
          return true;
        }

        if (status?.value[0]?.err) {
          console.error(`❌ Transaction failed: ${signature}`);
          return false;
        }
      } catch (error) {
        console.warn('Status check failed:', error);
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    console.warn(`⏱️ Transaction confirmation timeout: ${signature}`);
    return false;
  }

  /**
   * Warm connection to reduce cold start latency
   */
  async warmConnection(): Promise<void> {
    try {
      const pingEndpoint = this.senderEndpoint.replace('/fast', '/ping');
      const response = await fetch(pingEndpoint);
      
      if (response.ok) {
        console.log('🔥 Connection warmed');
      }
    } catch (error) {
      console.warn('Failed to warm connection:', error);
    }
  }

  /**
   * Start periodic connection warming
   */
  startConnectionWarming(intervalMs: number = 30000): NodeJS.Timeout {
    console.log(`🔥 Starting connection warming (every ${intervalMs}ms)`);
    
    return setInterval(() => {
      this.warmConnection();
    }, intervalMs);
  }

  /**
   * Send simple SOL transfer (for testing)
   */
  async sendSOLTransfer(
    keypair: Keypair,
    recipient: PublicKey,
    amountSOL: number
  ): Promise<SendResult> {
    const instructions = [
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: recipient,
        lamports: amountSOL * LAMPORTS_PER_SOL,
      })
    ];

    return await this.sendTransaction(keypair, instructions);
  }

  /**
   * Batch send multiple transactions
   */
  async batchSendTransactions(
    keypair: Keypair,
    instructionSets: TransactionInstruction[][]
  ): Promise<SendResult[]> {
    const results: SendResult[] = [];

    for (const instructions of instructionSets) {
      try {
        const result = await this.sendTransaction(keypair, instructions);
        results.push(result);
        
        // Small delay between transactions to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Batch transaction failed:', error);
        results.push({
          signature: '',
          confirmed: false
        });
      }
    }

    return results;
  }

  /**
   * Get sender endpoint info
   */
  getEndpointInfo(): {
    endpoint: string;
    region: string;
    swqosOnly: boolean;
  } {
    const isSWQOS = this.senderEndpoint.includes('swqos_only');
    const isHTTPS = this.senderEndpoint.startsWith('https');
    
    let region = 'global';
    if (!isHTTPS) {
      const match = this.senderEndpoint.match(/\/\/(\w+)-sender/);
      region = match ? match[1] : 'unknown';
    }

    return {
      endpoint: this.senderEndpoint,
      region,
      swqosOnly: isSWQOS
    };
  }
}

/**
 * Get Helius Sender client instance
 */
let senderClientInstance: HeliusSenderClient | null = null;

export function getHeliusSenderClient(config?: SenderConfig): HeliusSenderClient {
  if (!senderClientInstance) {
    senderClientInstance = new HeliusSenderClient(config);
  }
  return senderClientInstance;
}

/**
 * Create regional sender client for backend
 */
export function createRegionalSenderClient(
  region: 'slc' | 'ewr' | 'lon' | 'fra' | 'ams' | 'sg' | 'tyo'
): HeliusSenderClient {
  return new HeliusSenderClient({ region });
}

/**
 * Create SWQOS-only sender client (lower fees)
 */
export function createSWQOSSenderClient(): HeliusSenderClient {
  return new HeliusSenderClient({ useSWQOSOnly: true });
}
