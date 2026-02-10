import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

export enum EventType {
  TRANSACTION_NEW = 'transaction.new',
  BALANCE_UPDATED = 'balance.updated',
  SECURITY_ANOMALY = 'security.anomaly',
  MARKET_ODDS_CHANGED = 'market.odds_changed',
  PNL_UPDATED = 'pnl.updated',
  SYSTEM_ERROR = 'system.error',
}

interface EventMessage {
  eventType: EventType;
  timestamp: number;
  data: any;
  subscriptionId: string;
}

interface Subscription {
  id: string;
  agentId: string;
  eventTypes: EventType[];
  walletAddresses?: string[];
  ws?: WebSocket;
  rateLimit: number; // events per second
  eventBuffer: EventMessage[];
  lastEmitTime: number;
}

/**
 * Memory Event Emitter Service
 * 
 * Broadcasts real-time events to subscribed agents via WebSocket.
 * Supports event filtering by type and wallet address, with per-agent rate limiting.
 * 
 * Features:
 * - WebSocket-based event broadcasting
 * - Event type and wallet address filtering
 * - Per-agent rate limiting (100 events/sec default)
 * - Event buffering and dropping for rate limit compliance
 * - Subscription management with unique IDs
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */
export class MemoryEventEmitter extends EventEmitter {
  private subscriptions: Map<string, Subscription> = new Map();
  private readonly DEFAULT_RATE_LIMIT = 100; // events per second

  constructor() {
    super();
    this.startRateLimitProcessor();
  }

  /**
   * Emit a new transaction event
   * Requirement 10.1
   */
  emitTransactionEvent(transaction: any): void {
    this.broadcastEvent(EventType.TRANSACTION_NEW, {
      signature: transaction.signature,
      walletAddress: transaction.wallet_address,
      timestamp: transaction.timestamp,
      type: transaction.transaction_type,
      amount: transaction.amount,
      tokenMint: transaction.token_mint,
    });
  }

  /**
   * Emit a balance update event
   * Requirement 10.2
   */
  emitBalanceUpdateEvent(balance: any): void {
    this.broadcastEvent(EventType.BALANCE_UPDATED, {
      walletAddress: balance.wallet_address,
      tokenMint: balance.token_mint,
      amount: balance.amount,
      usdValue: balance.usd_value,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit a security anomaly event
   * Requirement 10.3
   */
  emitAnomalyEvent(anomaly: any): void {
    this.broadcastEvent(EventType.SECURITY_ANOMALY, {
      transactionSignature: anomaly.transaction_signature,
      walletAddress: anomaly.wallet_address,
      anomalyType: anomaly.anomaly_type,
      severity: anomaly.severity,
      score: anomaly.score,
      description: anomaly.description,
      timestamp: anomaly.timestamp,
    });
  }

  /**
   * Emit a market odds changed event
   * Requirement 10.4
   */
  emitMarketOddsEvent(market: any): void {
    this.broadcastEvent(EventType.MARKET_ODDS_CHANGED, {
      marketAddress: market.market_address,
      proposalId: market.proposal_id,
      outcomes: market.outcomes,
      totalVolume: market.total_volume,
      confidenceScore: market.confidence_score,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit a PnL updated event
   */
  emitPnLUpdatedEvent(pnl: any): void {
    this.broadcastEvent(EventType.PNL_UPDATED, {
      walletAddress: pnl.wallet_address,
      period: pnl.period,
      realizedPnL: pnl.realized_pnl,
      unrealizedPnL: pnl.unrealized_pnl,
      totalPnL: pnl.total_pnl,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit a system error event
   */
  emitSystemErrorEvent(error: any): void {
    this.broadcastEvent(EventType.SYSTEM_ERROR, {
      message: error.message,
      code: error.code,
      timestamp: Date.now(),
    });
  }

  /**
   * Subscribe to events
   * Requirements 10.5, 10.6
   * 
   * @param agentId - Unique agent identifier
   * @param eventTypes - Array of event types to subscribe to
   * @param walletAddresses - Optional array of wallet addresses to filter (use ['*'] for all)
   * @param ws - Optional WebSocket connection
   * @returns Subscription ID
   */
  subscribe(
    agentId: string,
    eventTypes: EventType[],
    walletAddresses?: string[],
    ws?: WebSocket
  ): string {
    const subscriptionId = this.generateSubscriptionId(agentId);

    const subscription: Subscription = {
      id: subscriptionId,
      agentId,
      eventTypes,
      walletAddresses,
      ws,
      rateLimit: this.DEFAULT_RATE_LIMIT,
      eventBuffer: [],
      lastEmitTime: Date.now(),
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Send confirmation message (Requirement 10.6)
    const confirmationMessage = {
      type: 'subscription_confirmed',
      subscriptionId,
      agentId,
      eventTypes,
      walletAddresses: walletAddresses || ['*'],
      timestamp: Date.now(),
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(confirmationMessage));
    }

    console.log(`[Event Emitter] Agent ${agentId} subscribed with ID ${subscriptionId}`);

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   * 
   * @param subscriptionId - Subscription ID to remove
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      console.log(`[Event Emitter] Unsubscribing ${subscriptionId} for agent ${subscription.agentId}`);
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Set rate limit for a specific agent
   * Requirement 10.7
   * 
   * @param agentId - Agent identifier
   * @param eventsPerSecond - Maximum events per second
   */
  setRateLimit(agentId: string, eventsPerSecond: number): void {
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription.agentId === agentId) {
        subscription.rateLimit = eventsPerSecond;
        console.log(`[Event Emitter] Rate limit set to ${eventsPerSecond} events/sec for agent ${agentId}`);
      }
    }
  }

  /**
   * Broadcast event to all matching subscriptions
   * 
   * @param eventType - Type of event
   * @param data - Event data
   */
  private broadcastEvent(eventType: EventType, data: any): void {
    const walletAddress = data.walletAddress || data.wallet_address;

    for (const [id, subscription] of this.subscriptions.entries()) {
      // Check if subscription matches event type
      if (!subscription.eventTypes.includes(eventType)) {
        continue;
      }

      // Check if subscription matches wallet address
      if (subscription.walletAddresses && subscription.walletAddresses.length > 0) {
        const matchesWallet =
          subscription.walletAddresses.includes('*') ||
          (walletAddress && subscription.walletAddresses.includes(walletAddress));

        if (!matchesWallet) {
          continue;
        }
      }

      // Create event message
      const eventMessage: EventMessage = {
        eventType,
        timestamp: Date.now(),
        data,
        subscriptionId: id,
      };

      // Add to buffer for rate-limited delivery
      subscription.eventBuffer.push(eventMessage);
    }
  }

  /**
   * Process event buffers and send events respecting rate limits
   * Requirement 10.7
   */
  private startRateLimitProcessor(): void {
    setInterval(() => {
      const now = Date.now();

      for (const [id, subscription] of this.subscriptions.entries()) {
        if (subscription.eventBuffer.length === 0) {
          continue;
        }

        // Calculate how many events we can send based on rate limit
        const timeSinceLastEmit = now - subscription.lastEmitTime;
        const maxEvents = Math.floor((timeSinceLastEmit / 1000) * subscription.rateLimit);

        if (maxEvents <= 0) {
          continue;
        }

        // Get events to send (up to maxEvents)
        const eventsToSend = subscription.eventBuffer.splice(0, maxEvents);

        // Send events
        for (const event of eventsToSend) {
          this.sendEvent(subscription, event);
        }

        subscription.lastEmitTime = now;

        // Drop excess events if buffer is too large (> 1000 events)
        if (subscription.eventBuffer.length > 1000) {
          const dropped = subscription.eventBuffer.length - 1000;
          subscription.eventBuffer = subscription.eventBuffer.slice(-1000);
          console.warn(
            `[Event Emitter] Dropped ${dropped} events for subscription ${id} due to buffer overflow`
          );
        }
      }
    }, 100); // Process every 100ms
  }

  /**
   * Send event to subscription
   * 
   * @param subscription - Subscription to send to
   * @param event - Event message to send
   */
  private sendEvent(subscription: Subscription, event: EventMessage): void {
    if (subscription.ws && subscription.ws.readyState === WebSocket.OPEN) {
      try {
        subscription.ws.send(JSON.stringify(event));
      } catch (error) {
        console.error(`[Event Emitter] Failed to send event to subscription ${subscription.id}:`, error);
        // Remove subscription if WebSocket is broken
        this.unsubscribe(subscription.id);
      }
    } else {
      // Emit as Node.js event for non-WebSocket subscribers
      this.emit(event.eventType, event.data);
    }
  }

  /**
   * Generate unique subscription ID
   * 
   * @param agentId - Agent identifier
   * @returns Unique subscription ID
   */
  private generateSubscriptionId(agentId: string): string {
    return `${agentId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get subscriptions for an agent
   * 
   * @param agentId - Agent identifier
   * @returns Array of subscription IDs
   */
  getAgentSubscriptions(agentId: string): string[] {
    const subscriptionIds: string[] = [];
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription.agentId === agentId) {
        subscriptionIds.push(id);
      }
    }
    return subscriptionIds;
  }
}

// Export singleton instance
export const memoryEventEmitter = new MemoryEventEmitter();
