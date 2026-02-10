import axios, { AxiosInstance } from 'axios';
import { config } from '../../config';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface OpenRouterStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

export interface ModelInfo {
  id: string;
  name: string;
  pricing: {
    prompt: number;
    completion: number;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
  };
}

export type OpenRouterResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * OpenRouter AI Client
 * Provides multi-model AI capabilities with cost tracking
 */
export class OpenRouterClient {
  private client: AxiosInstance;
  private totalCost: number = 0;
  private requestCount: number = 0;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      timeout: 60000, // 60s for AI responses
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apis.openRouterApiKey}`,
        'HTTP-Referer': config.apis.openRouterReferer || 'https://internet-capital-bank.com',
        'X-Title': 'Agentic Reserve System',
      },
    });

    console.log('✅ OpenRouter client initialized');
  }

  /**
   * Call AI model with messages
   */
  async callModel(params: {
    model: string;
    messages: OpenRouterMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  }): Promise<OpenRouterResult<OpenRouterResponse>> {
    try {
      const response = await this.client.post('/chat/completions', {
        model: params.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens ?? 1000,
        top_p: params.top_p ?? 1,
      });

      const data = response.data;

      // Track cost
      if (data.cost) {
        this.totalCost += data.cost.total;
      }
      this.requestCount++;

      return { success: true, data };
    } catch (error: any) {
      console.error('OpenRouter callModel error:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * Call AI model with streaming response
   */
  async callModelStream(params: {
    model: string;
    messages: OpenRouterMessage[];
    temperature?: number;
    max_tokens?: number;
    onChunk: (chunk: OpenRouterStreamChunk) => void;
  }): Promise<OpenRouterResult<void>> {
    try {
      const response = await this.client.post(
        '/chat/completions',
        {
          model: params.model,
          messages: params.messages,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.max_tokens ?? 1000,
          stream: true,
        },
        {
          responseType: 'stream',
        }
      );

      return new Promise((resolve) => {
        let buffer = '';

        response.data.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                resolve({ success: true, data: undefined });
                return;
              }

              try {
                const parsed = JSON.parse(data);
                params.onChunk(parsed);
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        });

        response.data.on('error', (error: Error) => {
          resolve({ success: false, error: error.message });
        });
      });
    } catch (error: any) {
      console.error('OpenRouter callModelStream error:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<OpenRouterResult<ModelInfo[]>> {
    try {
      const response = await this.client.get('/models');
      return { success: true, data: response.data.data };
    } catch (error: any) {
      console.error('OpenRouter getModels error:', error);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * Get model info
   */
  async getModelInfo(modelId: string): Promise<OpenRouterResult<ModelInfo>> {
    try {
      const modelsResult = await this.getModels();
      if (!modelsResult.success) {
        return modelsResult as OpenRouterResult<ModelInfo>;
      }

      const model = modelsResult.data.find((m) => m.id === modelId);
      if (!model) {
        return { success: false, error: `Model ${modelId} not found` };
      }

      return { success: true, data: model };
    } catch (error: any) {
      console.error('OpenRouter getModelInfo error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze ILI data with AI
   */
  async analyzeILI(params: {
    currentILI: number;
    historicalILI: number[];
    marketData: any;
  }): Promise<OpenRouterResult<string>> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content:
          'You are an expert DeFi analyst for Agentic Reserve System. Analyze ILI (Internet Liquidity Index) data and provide insights.',
      },
      {
        role: 'user',
        content: `Current ILI: ${params.currentILI}
Historical ILI (last 24h): ${params.historicalILI.join(', ')}
Market Data: ${JSON.stringify(params.marketData, null, 2)}

Provide a brief analysis of the ILI trend and market conditions.`,
      },
    ];

    const result = await this.callModel({
      model: 'anthropic/claude-sonnet-4',
      messages,
      temperature: 0.3,
      max_tokens: 500,
    });

    if (!result.success) {
      return result as OpenRouterResult<string>;
    }

    return {
      success: true,
      data: result.data.choices[0].message.content,
    };
  }

  /**
   * Generate policy recommendation
   */
  async generatePolicyRecommendation(params: {
    ili: number;
    icr: number;
    vhr: number;
    marketConditions: string;
  }): Promise<OpenRouterResult<string>> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content:
          'You are a monetary policy advisor for Agentic Reserve System. Generate policy recommendations based on market data.',
      },
      {
        role: 'user',
        content: `ILI: ${params.ili}
ICR: ${params.icr}%
VHR: ${params.vhr}%
Market Conditions: ${params.marketConditions}

What monetary policy action should ARS take? Consider mint/burn ARU, adjust reserves, or maintain status quo.`,
      },
    ];

    const result = await this.callModel({
      model: 'anthropic/claude-sonnet-4',
      messages,
      temperature: 0.5,
      max_tokens: 800,
    });

    if (!result.success) {
      return result as OpenRouterResult<string>;
    }

    return {
      success: true,
      data: result.data.choices[0].message.content,
    };
  }

  /**
   * Analyze proposal with AI
   */
  async analyzeProposal(params: {
    proposalType: string;
    proposalData: any;
    currentState: any;
  }): Promise<OpenRouterResult<{ analysis: string; recommendation: 'approve' | 'reject' }>> {
    const messages: OpenRouterMessage[] = [
      {
        role: 'system',
        content:
          'You are a governance analyst for Agentic Reserve System. Analyze proposals and provide recommendations.',
      },
      {
        role: 'user',
        content: `Proposal Type: ${params.proposalType}
Proposal Data: ${JSON.stringify(params.proposalData, null, 2)}
Current State: ${JSON.stringify(params.currentState, null, 2)}

Analyze this proposal and recommend approve or reject with reasoning.`,
      },
    ];

    const result = await this.callModel({
      model: 'anthropic/claude-sonnet-4',
      messages,
      temperature: 0.3,
      max_tokens: 600,
    });

    if (!result.success) {
      return result as OpenRouterResult<{ analysis: string; recommendation: 'approve' | 'reject' }>;
    }

    const content = result.data.choices[0].message.content;
    const recommendation = content.toLowerCase().includes('approve') ? 'approve' : 'reject';

    return {
      success: true,
      data: {
        analysis: content,
        recommendation,
      },
    };
  }

  /**
   * Get total cost spent
   */
  getTotalCost(): number {
    return this.totalCost;
  }

  /**
   * Get request count
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset cost tracking
   */
  resetCostTracking(): void {
    this.totalCost = 0;
    this.requestCount = 0;
  }

  /**
   * Get cost statistics
   */
  getCostStats(): {
    totalCost: number;
    requestCount: number;
    avgCostPerRequest: number;
  } {
    return {
      totalCost: this.totalCost,
      requestCount: this.requestCount,
      avgCostPerRequest: this.requestCount > 0 ? this.totalCost / this.requestCount : 0,
    };
  }
}

// Singleton instance
let openRouterClient: OpenRouterClient | null = null;

/**
 * Get or create OpenRouter client instance
 */
export function getOpenRouterClient(): OpenRouterClient {
  if (!openRouterClient) {
    openRouterClient = new OpenRouterClient();
  }
  return openRouterClient;
}
