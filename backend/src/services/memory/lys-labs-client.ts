import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { metricsService } from './metrics';

/**
 * Transaction types supported by LYS Labs
 */
export enum TransactionType {
  TRANSFER = 'transfer',
  SWAP = 'swap',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  LIQUIDITY_ADD = 'liquidity_add',
  LIQUIDITY_REMOVE = 'liquidity_remove',
  VOTE = 'vote',
  UNKNOWN = 'unknown'
}

/**
 * Transaction data structure from LYS Labs
 */
export interface LYSTransaction {
  signature: string;
  walletAddress: string;
  timestamp: number;
  type: TransactionType;
  amount: number;
  tokenMint: string;
  metadata: Record<string, any>;
}

/**
 * WebSocket message types
 */
interface WSMessage {
  type: 'subscribe' | 'unsubscribe' | 'transaction' | 'error' | 'pong';
  data?: any;
}

/**
 * LYS Labs WebSocket Client
 * 
 * Maintains persistent WebSocket connection to LYS Labs API for real-time
 * Solana transaction indexing. Handles connection lifecycle, wallet subscriptions,
 * and event emission.
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Subscription management with re-subscription after reconnect
 * - Transaction data validation
 * - Event-based architecture using Node.js EventEmitter
 */
export class LYSLabsClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private apiKey: string;
  private subscriptions: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff in ms
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isManualDisconnect = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatIntervalMs = 30000; // 30 seconds
  private messageCount = 0;
  private lastMessageRateUpdate = Date.now();
  private totalReconnections = 0;

  /**
   * Create a new LYS Labs WebSocket client
   * @param url - WebSocket URL for LYS Labs API
   * @param apiKey - API key for authentication
   */
  constructor(url: string, apiKey: string) {
    super();
    this.url = url;
    this.apiKey = apiKey;
  }

  /**
   * Establish WebSocket connection to LYS Labs API
   * @returns Promise that resolves when connection is established
   */
  public async connect(): Promise<void> {
    if (this.isConnecting) {
      throw new Error('Connection already in progress');
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.isConnecting = true;
    this.isManualDisconnect = false;

    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket connection with API key in headers
        this.ws = new WebSocket(this.url, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        });

        // Connection opened
        this.ws.on('open', () => {
          console.log('[LYS Labs] WebSocket connection established');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.emit('connected');
          this.startHeartbeat();
          
          // Update metrics
          metricsService.recordWebSocketMetrics(true, this.calculateMessageRate(), this.totalReconnections);
          
          // Re-subscribe to all wallets after reconnection
          this.resubscribeAll();
          
          resolve();
        });

        // Message received
        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            this.messageCount++;
            const message = JSON.parse(data.toString()) as WSMessage;
            this.handleMessage(message);
            
            // Update message rate metrics periodically (every 10 seconds)
            const now = Date.now();
            if (now - this.lastMessageRateUpdate > 10000) {
              metricsService.recordWebSocketMetrics(true, this.calculateMessageRate(), this.totalReconnections);
              this.lastMessageRateUpdate = now;
            }
          } catch (error) {
            console.error('[LYS Labs] Error parsing message:', error);
            this.emit('error', new Error(`Failed to parse message: ${error}`));
          }
        });

        // Connection closed
        this.ws.on('close', (code: number, reason: string) => {
          console.log(`[LYS Labs] WebSocket connection closed: ${code} - ${reason}`);
          this.isConnecting = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code, reason });

          // Update metrics
          metricsService.recordWebSocketMetrics(false, this.calculateMessageRate(), this.totalReconnections);

          // Attempt reconnection if not manually disconnected
          if (!this.isManualDisconnect) {
            this.scheduleReconnect();
          }
        });

        // Connection error
        this.ws.on('error', (error: Error) => {
          console.error('[LYS Labs] WebSocket error:', error);
          this.isConnecting = false;
          this.emit('error', error);
          
          // Reject promise if this is initial connection attempt
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Close WebSocket connection
   * @returns Promise that resolves when connection is closed
   */
  public async disconnect(): Promise<void> {
    this.isManualDisconnect = true;
    
    // Clear reconnect timeout if scheduled
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Stop heartbeat
    this.stopHeartbeat();

    // Close WebSocket connection
    if (this.ws) {
      return new Promise((resolve) => {
        if (!this.ws) {
          resolve();
          return;
        }

        if (this.ws.readyState === WebSocket.CLOSED) {
          resolve();
          return;
        }

        this.ws.once('close', () => {
          this.ws = null;
          resolve();
        });

        this.ws.close();
      });
    }
  }

  /**
   * Check if WebSocket is connected
   * @returns true if connected, false otherwise
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Subscribe to transaction updates for a wallet address
   * @param address - Solana wallet address to subscribe to
   * @returns Promise that resolves when subscription is confirmed
   */
  public async subscribeWallet(address: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    // Add to subscription list
    this.subscriptions.add(address);

    // Send subscription message
    const message = {
      type: 'subscribe',
      data: {
        wallet: address,
      },
    };

    this.ws!.send(JSON.stringify(message));
    console.log(`[LYS Labs] Subscribed to wallet: ${address}`);
  }

  /**
   * Unsubscribe from transaction updates for a wallet address
   * @param address - Solana wallet address to unsubscribe from
   * @returns Promise that resolves when unsubscription is confirmed
   */
  public async unsubscribeWallet(address: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    // Remove from subscription list
    this.subscriptions.delete(address);

    // Send unsubscription message
    const message = {
      type: 'unsubscribe',
      data: {
        wallet: address,
      },
    };

    this.ws!.send(JSON.stringify(message));
    console.log(`[LYS Labs] Unsubscribed from wallet: ${address}`);
  }

  /**
   * Register transaction event handler
   * @param handler - Callback function to handle transaction events
   */
  public onTransaction(handler: (tx: LYSTransaction) => void): void {
    this.on('transaction', handler);
  }

  /**
   * Register error event handler
   * @param handler - Callback function to handle error events
   */
  public onError(handler: (error: Error) => void): void {
    this.on('error', handler);
  }

  /**
   * Register reconnect event handler
   * @param handler - Callback function to handle reconnect events
   */
  public onReconnect(handler: () => void): void {
    this.on('reconnected', handler);
  }

  /**
   * Handle incoming WebSocket messages
   * @param message - Parsed WebSocket message
   */
  private handleMessage(message: WSMessage): void {
    switch (message.type) {
      case 'transaction':
        this.handleTransactionMessage(message.data);
        break;

      case 'error':
        console.error('[LYS Labs] Server error:', message.data);
        this.emit('error', new Error(message.data?.message || 'Unknown server error'));
        break;

      case 'pong':
        // Heartbeat response received
        break;

      default:
        console.warn('[LYS Labs] Unknown message type:', message.type);
    }
  }

  /**
   * Handle transaction message and validate data
   * @param data - Transaction data from LYS Labs
   */
  private handleTransactionMessage(data: any): void {
    try {
      // Validate transaction data
      const transaction = this.validateTransaction(data);
      
      // Emit transaction event
      this.emit('transaction', transaction);
    } catch (error) {
      console.error('[LYS Labs] Invalid transaction data:', error);
      this.emit('error', new Error(`Invalid transaction data: ${error}`));
    }
  }

  /**
   * Validate transaction data against expected schema
   * @param data - Raw transaction data
   * @returns Validated LYSTransaction object
   * @throws Error if validation fails
   */
  private validateTransaction(data: any): LYSTransaction {
    // Required fields validation
    if (!data.signature || typeof data.signature !== 'string') {
      throw new Error('Missing or invalid signature');
    }

    if (!data.walletAddress || typeof data.walletAddress !== 'string') {
      throw new Error('Missing or invalid walletAddress');
    }

    if (!data.timestamp || typeof data.timestamp !== 'number') {
      throw new Error('Missing or invalid timestamp');
    }

    if (!data.type || !Object.values(TransactionType).includes(data.type)) {
      throw new Error('Missing or invalid transaction type');
    }

    if (typeof data.amount !== 'number') {
      throw new Error('Missing or invalid amount');
    }

    if (!data.tokenMint || typeof data.tokenMint !== 'string') {
      throw new Error('Missing or invalid tokenMint');
    }

    // Construct validated transaction
    const transaction: LYSTransaction = {
      signature: data.signature,
      walletAddress: data.walletAddress,
      timestamp: data.timestamp,
      type: data.type as TransactionType,
      amount: data.amount,
      tokenMint: data.tokenMint,
      metadata: data.metadata || {},
    };

    return transaction;
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[LYS Labs] Max reconnection attempts reached');
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    const delay = this.reconnectDelays[this.reconnectAttempts];
    console.log(`[LYS Labs] Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.totalReconnections++;
      console.log(`[LYS Labs] Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      this.connect()
        .then(() => {
          console.log('[LYS Labs] Reconnection successful');
          this.emit('reconnected');
        })
        .catch((error) => {
          console.error('[LYS Labs] Reconnection failed:', error);
          // scheduleReconnect will be called again by the 'close' event handler
        });
    }, delay);
  }

  /**
   * Re-subscribe to all wallets after reconnection
   */
  private async resubscribeAll(): Promise<void> {
    if (this.subscriptions.size === 0) {
      return;
    }

    console.log(`[LYS Labs] Re-subscribing to ${this.subscriptions.size} wallets`);
    
    for (const address of this.subscriptions) {
      try {
        await this.subscribeWallet(address);
      } catch (error) {
        console.error(`[LYS Labs] Failed to re-subscribe to wallet ${address}:`, error);
      }
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear any existing interval

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        try {
          this.ws!.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          console.error('[LYS Labs] Failed to send heartbeat:', error);
        }
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get current subscription count
   * @returns Number of active wallet subscriptions
   */
  public getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get list of subscribed wallet addresses
   * @returns Array of subscribed wallet addresses
   */
  public getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * Calculate current message rate (messages per second)
   * @returns Message rate in messages/second
   */
  private calculateMessageRate(): number {
    const now = Date.now();
    const timeDiff = (now - this.lastMessageRateUpdate) / 1000; // Convert to seconds
    
    if (timeDiff === 0) {
      return 0;
    }
    
    // Reset message count for next calculation
    const rate = this.messageCount / timeDiff;
    this.messageCount = 0;
    
    return rate;
  }
}
