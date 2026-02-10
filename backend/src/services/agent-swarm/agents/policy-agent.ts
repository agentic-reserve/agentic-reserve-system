import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { config } from '../../../config';
import { getOpenRouterClient } from '../../ai/openrouter-client';
import { getOracleAggregator } from '../../oracles/oracle-aggregator';

export interface PolicyRecommendation {
  action: 'mint' | 'burn' | 'rebalance' | 'maintain';
  amount?: number;
  reasoning: string;
  confidence: number;
  aiAnalysis: string;
}

/**
 * Policy Agent
 * Analyzes ILI/ICR and recommends monetary policy actions
 */
export class PolicyAgent extends EventEmitter {
  private redis: Redis;
  private agentId = 'policy-agent';

  constructor() {
    super();
    this.redis = new Redis(config.redis.url);
    this.startMessageListener();
    console.log('✅ Policy Agent initialized');
  }

  /**
   * Start listening for messages
   */
  private startMessageListener(): void {
    this.redis.subscribe('icb:policy', (err) => {
      if (err) {
        console.error('Policy Agent: Failed to subscribe:', err);
      }
    });

    this.redis.on('message', async (channel, message) => {
      try {
        const msg = JSON.parse(message);
        await this.handleMessage(msg);
      } catch (error) {
        console.error('Policy Agent: Error handling message:', error);
      }
    });
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: any): Promise<void> {
    if (message.to !== this.agentId) return;

    console.log(`📋 Policy Agent: ${message.type}`);

    switch (message.type) {
      case 'action-request':
        await this.handleActionRequest(message);
        break;
      case 'approval-request':
        await this.handleApprovalRequest(message);
        break;
      case 'consensus-vote':
        await this.handleConsensusVote(message);
        break;
    }
  }

  /**
   * Handle action request
   */
  private async handleActionRequest(message: any): Promise<void> {
    const { action, inputs } = message.payload;

    let result;
    switch (action) {
      case 'calculate-ili':
        result = await this.calculateILI(inputs);
        break;
      case 'analyze-with-ai':
        result = await this.analyzeWithAI(inputs);
        break;
      case 'recommend-policy':
        result = await this.recommendPolicy(inputs);
        break;
      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }

    await this.sendResponse(result);
  }

  /**
   * Calculate ILI (Internet Liquidity Index)
   */
  private async calculateILI(inputs: any): Promise<any> {
    try {
      const aggregator = getOracleAggregator();

      // Get aggregated price data
      const solPrice = await aggregator.aggregatePrice('SOL/USD');
      const usdcPrice = await aggregator.aggregatePrice('USDC/USD');

      // Get DeFi metrics from inputs
      const { metrics } = inputs;

      // Calculate ILI components
      const yieldComponent = this.calculateYieldComponent(metrics);
      const volatilityComponent = this.calculateVolatilityComponent(solPrice);
      const tvlComponent = this.calculateTVLComponent(metrics);

      // Weighted ILI calculation
      const ili =
        yieldComponent * 0.4 + volatilityComponent * 0.3 + tvlComponent * 0.3;

      // Store in Redis
      await this.redis.set('icb:ili:current', ili.toString());
      await this.redis.lpush('icb:ili:history', JSON.stringify({
        value: ili,
        timestamp: Date.now(),
        components: { yieldComponent, volatilityComponent, tvlComponent },
      }));

      console.log(`📊 ILI calculated: ${ili.toFixed(2)}`);

      return {
        success: true,
        data: {
          ili,
          components: { yieldComponent, volatilityComponent, tvlComponent },
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Analyze with AI
   */
  private async analyzeWithAI(inputs: any): Promise<any> {
    try {
      const openRouter = getOpenRouterClient();
      const { market_data, historical_ili } = inputs;

      const result = await openRouter.analyzeILI({
        currentILI: market_data.ili,
        historicalILI: historical_ili,
        marketData: market_data,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          analysis: result.data,
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Recommend policy action
   */
  private async recommendPolicy(inputs: any): Promise<any> {
    try {
      const openRouter = getOpenRouterClient();
      const { ili, icr, vhr, market_conditions } = inputs;

      const result = await openRouter.generatePolicyRecommendation({
        ili,
        icr,
        vhr,
        marketConditions: market_conditions,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Parse AI recommendation
      const recommendation = this.parseRecommendation(result.data);

      return {
        success: true,
        data: recommendation,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Calculate yield component
   */
  private calculateYieldComponent(metrics: any): number {
    const avgYield =
      (metrics.jupiter?.apy || 0 +
        metrics.meteora?.apy || 0 +
        metrics.kamino?.apy || 0) / 3;
    return Math.min(avgYield / 100, 1); // Normalize to 0-1
  }

  /**
   * Calculate volatility component
   */
  private calculateVolatilityComponent(priceData: any): number {
    // Lower volatility = higher score
    const volatility = priceData.confidence || 0.95;
    return volatility;
  }

  /**
   * Calculate TVL component
   */
  private calculateTVLComponent(metrics: any): number {
    const totalTVL =
      (metrics.jupiter?.tvl || 0) +
      (metrics.meteora?.tvl || 0) +
      (metrics.kamino?.tvl || 0);
    // Normalize to 0-1 (assuming 1B TVL = 1.0)
    return Math.min(totalTVL / 1_000_000_000, 1);
  }

  /**
   * Parse AI recommendation
   */
  private parseRecommendation(aiResponse: string): PolicyRecommendation {
    const lowerResponse = aiResponse.toLowerCase();

    let action: PolicyRecommendation['action'] = 'maintain';
    if (lowerResponse.includes('mint')) action = 'mint';
    else if (lowerResponse.includes('burn')) action = 'burn';
    else if (lowerResponse.includes('rebalance')) action = 'rebalance';

    // Extract confidence (simple heuristic)
    let confidence = 0.7;
    if (lowerResponse.includes('strongly recommend')) confidence = 0.9;
    else if (lowerResponse.includes('recommend')) confidence = 0.8;
    else if (lowerResponse.includes('suggest')) confidence = 0.6;

    return {
      action,
      reasoning: aiResponse,
      confidence,
      aiAnalysis: aiResponse,
    };
  }

  /**
   * Handle approval request
   */
  private async handleApprovalRequest(message: any): Promise<void> {
    const { step } = message.payload;

    // Policy agent approves if risk is acceptable
    const approved = step.action !== 'execute-policy' || step.inputs.risk_score < 0.7;

    await this.sendResponse({
      success: true,
      data: { approved },
    });
  }

  /**
   * Handle consensus vote
   */
  private async handleConsensusVote(message: any): Promise<void> {
    const { topic, data } = message.payload;

    // Policy agent votes based on ILI impact
    let vote = false;

    if (topic === 'policy-execution') {
      vote = data.ili_impact < 0.1; // Approve if ILI impact < 10%
    }

    await this.sendResponse({
      success: true,
      data: { vote },
    });
  }

  /**
   * Send response to orchestrator
   */
  private async sendResponse(response: any): Promise<void> {
    const message = {
      type: 'agent-response',
      from: this.agentId,
      to: 'ars-orchestrator',
      payload: {
        ...response,
        agent: this.agentId,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
      priority: 'normal',
    };

    await this.redis.publish('icb:orchestrator', JSON.stringify(message));
  }

  /**
   * Shutdown agent
   */
  async shutdown(): Promise<void> {
    await this.redis.quit();
  }
}

// Singleton instance
let policyAgent: PolicyAgent | null = null;

export function getPolicyAgent(): PolicyAgent {
  if (!policyAgent) {
    policyAgent = new PolicyAgent();
  }
  return policyAgent;
}
