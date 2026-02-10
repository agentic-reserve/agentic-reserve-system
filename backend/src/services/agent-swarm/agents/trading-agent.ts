import { EventEmitter } from 'events';
import { Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { getHeliusSenderClient } from '../../helius/helius-sender-client';
import { getJupiterClient } from '../../defi/jupiter-client';
import { getMagicBlockClient } from '../../defi/magicblock-client';
import { getRevenueTracker } from '../../revenue/revenue-tracker';

interface TradeParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
}

interface ArbitrageOpportunity {
  inputMint: string;
  outputMint: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitPercent: number;
}

/**
 * Trading Agent
 * High-frequency trading using Helius Sender for ultra-low latency
 */
export class TradingAgent extends EventEmitter {
  private agentId: string;
  private keypair: Keypair;
  private sender: any;
  private jupiter: any;
  private magicBlock: any;
  private revenueTracker: any;
  private isActive: boolean = false;
  private warmingInterval: NodeJS.Timeout | null = null;

  constructor(agentId: string, keypair: Keypair, region?: string) {
    super();
    
    this.agentId = agentId;
    this.keypair = keypair;
    
    // Initialize Helius Sender with regional endpoint for optimal latency
    this.sender = getHeliusSenderClient(region ? { region: region as any } : undefined);
    
    this.jupiter = getJupiterClient();
    this.magicBlock = getMagicBlockClient();
    this.revenueTracker = getRevenueTracker();

    console.log(`✅ Trading Agent initialized: ${agentId}`);
    console.log(`   Region: ${this.sender.getEndpointInfo().region}`);
  }

  /**
   * Start trading agent
   */
  async start(): Promise<void> {
    if (this.isActive) {
      console.log('Trading agent already active');
      return;
    }

    this.isActive = true;
    console.log(`🚀 Starting trading agent: ${this.agentId}`);

    // Start connection warming for optimal latency
    this.warmingInterval = this.sender.startConnectionWarming(30000);

    // Start monitoring for arbitrage opportunities
    this.startArbitrageMonitoring();

    console.log('✅ Trading agent started');
  }

  /**
   * Stop trading agent
   */
  async stop(): Promise<void> {
    this.isActive = false;

    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
    }

    console.log(`🛑 Trading agent stopped: ${this.agentId}`);
  }

  /**
   * Execute trade with ultra-low latency
   */
  async executeTrade(params: TradeParams): Promise<string> {
    console.log(`📊 Executing trade: ${params.inputMint} → ${params.outputMint}`);
    console.log(`   Amount: ${params.amount}`);
    console.log(`   Slippage: ${params.slippageBps / 100}%`);

    try {
      // Get quote from Jupiter
      const quote = await this.jupiter.getQuote({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount,
        slippageBps: params.slippageBps
      });

      console.log(`   Expected output: ${quote.outAmount}`);
      console.log(`   Price impact: ${quote.priceImpactPct}%`);

      // Get swap instructions
      const { swapInstruction } = await this.jupiter.getSwapInstructions(
        quote,
        this.keypair.publicKey
      );

      // Send via Helius Sender for ultra-low latency
      const result = await this.sender.sendTransaction(
        this.keypair,
        [swapInstruction]
      );

      if (result.confirmed) {
        console.log(`✅ Trade executed: ${result.signature}`);

        // Track transaction fee revenue
        await this.revenueTracker.trackTransactionFee(
          params.amount,
          this.agentId,
          {
            trade_type: 'swap',
            input_mint: params.inputMint,
            output_mint: params.outputMint,
            signature: result.signature
          }
        );

        this.emit('trade-executed', {
          signature: result.signature,
          params,
          quote
        });

        return result.signature;
      } else {
        throw new Error('Trade confirmation failed');
      }
    } catch (error) {
      console.error('Trade execution failed:', error);
      this.emit('trade-failed', { params, error });
      throw error;
    }
  }

  /**
   * Execute high-frequency trade using MagicBlock ER
   */
  async executeHFTrade(params: TradeParams): Promise<string> {
    console.log(`⚡ Executing HF trade via MagicBlock ER`);

    try {
      // Create ER session for high-frequency operations
      const session = await this.magicBlock.createSession({
        accounts: [this.keypair.publicKey],
        payer: this.keypair,
        duration: 3600 // 1 hour
      });

      console.log(`   ER Session: ${session.sessionId}`);

      // Get swap instructions
      const quote = await this.jupiter.getQuote({
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount,
        slippageBps: params.slippageBps
      });

      const { swapInstruction } = await this.jupiter.getSwapInstructions(
        quote,
        this.keypair.publicKey
      );

      // Execute on ER (sub-100ms latency)
      const erResult = await this.magicBlock.sendTransaction({
        transaction: swapInstruction,
        sessionId: session.sessionId
      });

      console.log(`   ER Transaction: ${erResult.signature}`);

      // Commit to base layer via Helius Sender
      const commitResult = await this.sender.sendTransaction(
        this.keypair,
        [await this.magicBlock.getCommitInstruction(session.sessionId)]
      );

      console.log(`✅ HF trade committed: ${commitResult.signature}`);

      // Track ER session fee
      await this.revenueTracker.trackERSessionFee(
        params.amount,
        this.agentId,
        {
          session_id: session.sessionId,
          er_signature: erResult.signature,
          commit_signature: commitResult.signature
        }
      );

      return commitResult.signature;
    } catch (error) {
      console.error('HF trade execution failed:', error);
      throw error;
    }
  }

  /**
   * Find arbitrage opportunities
   */
  async findArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    // Common trading pairs
    const pairs = [
      { input: 'SOL', output: 'USDC' },
      { input: 'USDC', output: 'SOL' },
      { input: 'mSOL', output: 'SOL' },
      { input: 'SOL', output: 'mSOL' }
    ];

    for (const pair of pairs) {
      try {
        // Get quote for buy
        const buyQuote = await this.jupiter.getQuote({
          inputMint: pair.input,
          outputMint: pair.output,
          amount: 1000000, // 1 token
          slippageBps: 50
        });

        // Get quote for sell
        const sellQuote = await this.jupiter.getQuote({
          inputMint: pair.output,
          outputMint: pair.input,
          amount: buyQuote.outAmount,
          slippageBps: 50
        });

        const profit = sellQuote.outAmount - 1000000;
        const profitPercent = (profit / 1000000) * 100;

        // Only consider if profit > 0.5%
        if (profitPercent > 0.5) {
          opportunities.push({
            inputMint: pair.input,
            outputMint: pair.output,
            buyPrice: buyQuote.outAmount / 1000000,
            sellPrice: 1000000 / sellQuote.outAmount,
            profit,
            profitPercent
          });

          console.log(`💰 Arbitrage opportunity found:`);
          console.log(`   ${pair.input} → ${pair.output} → ${pair.input}`);
          console.log(`   Profit: ${profitPercent.toFixed(2)}%`);
        }
      } catch (error) {
        // Skip if quote fails
        continue;
      }
    }

    return opportunities;
  }

  /**
   * Execute arbitrage trade
   */
  async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<void> {
    console.log(`⚡ Executing arbitrage: ${opportunity.profitPercent.toFixed(2)}% profit`);

    try {
      // Execute buy trade
      await this.executeTrade({
        inputMint: opportunity.inputMint,
        outputMint: opportunity.outputMint,
        amount: 1000000,
        slippageBps: 50
      });

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Execute sell trade
      await this.executeTrade({
        inputMint: opportunity.outputMint,
        outputMint: opportunity.inputMint,
        amount: Math.floor(opportunity.buyPrice * 1000000),
        slippageBps: 50
      });

      console.log(`✅ Arbitrage executed successfully`);

      this.emit('arbitrage-executed', opportunity);
    } catch (error) {
      console.error('Arbitrage execution failed:', error);
      this.emit('arbitrage-failed', { opportunity, error });
    }
  }

  /**
   * Start monitoring for arbitrage opportunities
   */
  private startArbitrageMonitoring(): void {
    console.log('👁️  Starting arbitrage monitoring...');

    // Check every 5 seconds
    const monitoringInterval = setInterval(async () => {
      if (!this.isActive) {
        clearInterval(monitoringInterval);
        return;
      }

      try {
        const opportunities = await this.findArbitrageOpportunities();

        if (opportunities.length > 0) {
          // Execute most profitable opportunity
          const best = opportunities.reduce((prev, current) =>
            current.profitPercent > prev.profitPercent ? current : prev
          );

          await this.executeArbitrage(best);
        }
      } catch (error) {
        console.error('Arbitrage monitoring error:', error);
      }
    }, 5000);
  }

  /**
   * Batch execute multiple trades
   */
  async batchExecuteTrades(trades: TradeParams[]): Promise<string[]> {
    console.log(`📦 Batch executing ${trades.length} trades`);

    const instructionSets: TransactionInstruction[][] = [];

    for (const trade of trades) {
      try {
        const quote = await this.jupiter.getQuote({
          inputMint: trade.inputMint,
          outputMint: trade.outputMint,
          amount: trade.amount,
          slippageBps: trade.slippageBps
        });

        const { swapInstruction } = await this.jupiter.getSwapInstructions(
          quote,
          this.keypair.publicKey
        );

        instructionSets.push([swapInstruction]);
      } catch (error) {
        console.error(`Failed to prepare trade:`, error);
      }
    }

    const results = await this.sender.batchSendTransactions(
      this.keypair,
      instructionSets
    );

    const signatures = results
      .filter(r => r.confirmed)
      .map(r => r.signature);

    console.log(`✅ Batch executed: ${signatures.length}/${trades.length} successful`);

    return signatures;
  }

  /**
   * Get trading statistics
   */
  getStatistics(): any {
    return {
      agentId: this.agentId,
      isActive: this.isActive,
      endpoint: this.sender.getEndpointInfo(),
      publicKey: this.keypair.publicKey.toBase58()
    };
  }
}

/**
 * Get trading agent instance
 */
const tradingAgents: Map<string, TradingAgent> = new Map();

export function getTradingAgent(
  agentId: string,
  keypair: Keypair,
  region?: string
): TradingAgent {
  if (!tradingAgents.has(agentId)) {
    tradingAgents.set(agentId, new TradingAgent(agentId, keypair, region));
  }
  return tradingAgents.get(agentId)!;
}
