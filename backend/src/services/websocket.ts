import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { supabase } from './supabase';

interface Client {
  ws: WebSocket;
  channels: Set<string>;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, Client> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupWebSocketServer();
    this.setupSupabaseSubscriptions();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New WebSocket connection');
      
      const client: Client = {
        ws,
        channels: new Set(),
      };
      
      this.clients.set(ws, client);

      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private handleMessage(ws: WebSocket, message: any) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        if (message.channel) {
          client.channels.add(message.channel);
          ws.send(JSON.stringify({
            type: 'subscribed',
            channel: message.channel,
          }));
        }
        break;

      case 'unsubscribe':
        if (message.channel) {
          client.channels.delete(message.channel);
          ws.send(JSON.stringify({
            type: 'unsubscribed',
            channel: message.channel,
          }));
        }
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Unknown message type',
        }));
    }
  }

  private setupSupabaseSubscriptions() {
    // Subscribe to ILI updates
    supabase
      .channel('ili_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ili_history',
        },
        (payload: any) => {
          this.broadcast('ili', {
            type: 'ili_update',
            data: {
              ili: parseFloat(payload.new.ili_value),
              timestamp: payload.new.timestamp,
              components: {
                avgYield: parseFloat(payload.new.avg_yield || '0'),
                volatility: parseFloat(payload.new.volatility || '0'),
                tvl: parseFloat(payload.new.tvl_usd || '0'),
              },
            },
          });
        }
      )
      .subscribe();

    // Subscribe to proposal updates
    supabase
      .channel('proposal_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proposals',
        },
        (payload: any) => {
          this.broadcast('proposals', {
            type: 'proposal_update',
            data: {
              proposalId: payload.new.id,
              yesStake: payload.new.yes_stake,
              noStake: payload.new.no_stake,
              status: payload.new.status,
            },
          });
        }
      )
      .subscribe();

    // Subscribe to reserve updates
    supabase
      .channel('reserve_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reserve_events',
        },
        (payload: any) => {
          this.broadcast('reserve', {
            type: 'reserve_update',
            data: {
              eventType: payload.new.event_type,
              vhrAfter: parseFloat(payload.new.vhr_after || '0'),
              timestamp: payload.new.timestamp,
            },
          });
        }
      )
      .subscribe();

    // Subscribe to revenue updates
    supabase
      .channel('revenue_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'revenue_events',
        },
        (payload: any) => {
          this.broadcast('revenue', {
            type: 'revenue_update',
            data: {
              revenueType: payload.new.revenue_type,
              amount: parseFloat(payload.new.amount_usd),
              timestamp: payload.new.timestamp,
            },
          });
        }
      )
      .subscribe();
  }

  private broadcast(channel: string, message: any) {
    this.clients.forEach((client) => {
      if (client.channels.has(channel) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  public close() {
    this.wss.close();
  }
}
