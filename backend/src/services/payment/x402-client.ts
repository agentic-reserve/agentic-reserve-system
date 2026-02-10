import axios, { AxiosInstance, AxiosError } from 'axios';
import { Connection, PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { config } from '../../config';

export interface X402PaymentRequest {
  amount: number; // USDC amount in smallest unit (6 decimals)
  currency: 'USDC';
  network: 'solana';
  recipient: string;
  memo?: string;
}

export interface X402PaymentResponse {
  paymentId: string;
  amount: number;
  currency: string;
  network: string;
  recipient: string;
  status: 'pending' | 'confirmed' | 'failed';
  transaction?: string;
  createdAt: number;
}

export interface X402Budget {
  total: number;
  spent: number;
  remaining: number;
  currency: 'USDC';
}

export interface X402PaymentVerification {
  paymentId: string;
  verified: boolean;
  amount: number;
  signature: string;
  confirmations: number;
}

/**
 * x402-PayAI Client
 * Implements HTTP 402 Payment Required protocol for USDC payments
 */
export class X402Client {
  private client: AxiosInstance;
  private connection: Connection;
  private budget: X402Budget;
  private paymentHistory: X402PaymentResponse[] = [];
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor(initialBudget: number = 100_000_000) {
    // 100 USDC default
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.connection = new Connection(config.solana.rpcUrl, 'confirmed');

    this.budget = {
      total: initialBudget,
      spent: 0,
      remaining: initialBudget,
      currency: 'USDC',
    };

    console.log('✅ x402-PayAI client initialized');
  }

  /**
   * Make HTTP request with x402 payment handling
   */
  async requestWithPayment<T>(params: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: any;
    payer: Keypair;
  }): Promise<{ success: true; data: T } | { success: false; error: string }> {
    try {
      // Initial request
      const response = await this.client.request({
        url: params.url,
        method: params.method || 'GET',
        data: params.data,
      });

      return { success: true, data: response.data };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 402) {
        // Payment required
        const paymentInfo = error.response.headers['x-payment-info'];
        if (!paymentInfo) {
          return { success: false, error: 'Payment required but no payment info provided' };
        }

        // Parse payment info
        const payment = JSON.parse(paymentInfo) as X402PaymentRequest;

        // Make payment
        const paymentResult = await this.makePayment({
          ...payment,
          payer: params.payer,
        });

        if (!paymentResult.success) {
          return { success: false, error: `Payment failed: ${paymentResult.error}` };
        }

        // Retry request with payment proof
        try {
          const retryResponse = await this.client.request({
            url: params.url,
            method: params.method || 'GET',
            data: params.data,
            headers: {
              'X-Payment-Id': paymentResult.data.paymentId,
              'X-Payment-Signature': paymentResult.data.transaction,
            },
          });

          return { success: true, data: retryResponse.data };
        } catch (retryError) {
          return {
            success: false,
            error: `Request failed after payment: ${retryError}`,
          };
        }
      }

      return {
        success: false,
        error: axios.isAxiosError(error) ? error.message : String(error),
      };
    }
  }

  /**
   * Make USDC payment on Solana
   */
  async makePayment(params: {
    amount: number;
    recipient: string;
    payer: Keypair;
    memo?: string;
  }): Promise<
    { success: true; data: X402PaymentResponse } | { success: false; error: string }
  > {
    try {
      // Check budget
      if (params.amount > this.budget.remaining) {
        return {
          success: false,
          error: `Insufficient budget. Required: ${params.amount}, Available: ${this.budget.remaining}`,
        };
      }

      // Create payment transaction
      const recipientPubkey = new PublicKey(params.recipient);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: params.payer.publicKey,
          toPubkey: recipientPubkey,
          lamports: params.amount,
        })
      );

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = params.payer.publicKey;

      // Sign and send transaction
      transaction.sign(params.payer);
      const signature = await this.connection.sendRawTransaction(transaction.serialize());

      // Wait for confirmation
      await this.connection.confirmTransaction(signature, 'confirmed');

      // Update budget
      this.budget.spent += params.amount;
      this.budget.remaining -= params.amount;

      // Create payment response
      const payment: X402PaymentResponse = {
        paymentId: signature.slice(0, 16),
        amount: params.amount,
        currency: 'USDC',
        network: 'solana',
        recipient: params.recipient,
        status: 'confirmed',
        transaction: signature,
        createdAt: Date.now(),
      };

      // Store in history
      this.paymentHistory.push(payment);

      return { success: true, data: payment };
    } catch (error) {
      console.error('x402 makePayment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Make payment with retry logic
   */
  async makePaymentWithRetry(params: {
    amount: number;
    recipient: string;
    payer: Keypair;
    memo?: string;
  }): Promise<
    { success: true; data: X402PaymentResponse } | { success: false; error: string }
  > {
    let lastError = '';

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      const result = await this.makePayment(params);

      if (result.success) {
        return result;
      }

      lastError = result.error;
      console.warn(`Payment attempt ${attempt} failed: ${lastError}`);

      if (attempt < this.MAX_RETRIES) {
        await this.sleep(this.RETRY_DELAY * attempt);
      }
    }

    return {
      success: false,
      error: `Payment failed after ${this.MAX_RETRIES} attempts: ${lastError}`,
    };
  }

  /**
   * Verify payment on-chain
   */
  async verifyPayment(
    signature: string
  ): Promise<
    { success: true; data: X402PaymentVerification } | { success: false; error: string }
  > {
    try {
      const status = await this.connection.getSignatureStatus(signature);

      if (!status.value) {
        return { success: false, error: 'Transaction not found' };
      }

      const transaction = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction) {
        return { success: false, error: 'Transaction details not found' };
      }

      const verification: X402PaymentVerification = {
        paymentId: signature.slice(0, 16),
        verified: status.value.confirmationStatus === 'finalized',
        amount: transaction.meta?.postBalances[1]! - transaction.meta?.preBalances[1]!,
        signature,
        confirmations: status.value.confirmations || 0,
      };

      return { success: true, data: verification };
    } catch (error) {
      console.error('x402 verifyPayment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get budget status
   */
  getBudget(): X402Budget {
    return { ...this.budget };
  }

  /**
   * Set budget
   */
  setBudget(amount: number): void {
    this.budget.total = amount;
    this.budget.remaining = amount - this.budget.spent;
  }

  /**
   * Add to budget
   */
  addBudget(amount: number): void {
    this.budget.total += amount;
    this.budget.remaining += amount;
  }

  /**
   * Get payment history
   */
  getPaymentHistory(): X402PaymentResponse[] {
    return [...this.paymentHistory];
  }

  /**
   * Get total spent
   */
  getTotalSpent(): number {
    return this.budget.spent;
  }

  /**
   * Clear payment history
   */
  clearHistory(): void {
    this.paymentHistory = [];
  }

  /**
   * Get payment by ID
   */
  getPayment(paymentId: string): X402PaymentResponse | undefined {
    return this.paymentHistory.find((p) => p.paymentId === paymentId);
  }

  /**
   * Get payments by status
   */
  getPaymentsByStatus(
    status: 'pending' | 'confirmed' | 'failed'
  ): X402PaymentResponse[] {
    return this.paymentHistory.filter((p) => p.status === status);
  }

  /**
   * Sleep helper for retry logic
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let x402Client: X402Client | null = null;

/**
 * Get or create x402 client instance
 */
export function getX402Client(initialBudget?: number): X402Client {
  if (!x402Client) {
    x402Client = new X402Client(initialBudget);
  }
  return x402Client;
}
