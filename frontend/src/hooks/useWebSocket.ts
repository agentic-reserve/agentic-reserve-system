import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';

type MessageHandler = (data: any) => void;

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        
        // Exponential backoff: 3s, 6s, 12s, max 30s
        const delay = Math.min(3000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        
        reconnectTimeout.current = setTimeout(() => {
          console.log(`Reconnecting... (attempt ${reconnectAttempts.current})`);
          connect();
        }, delay);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Call all handlers for this message type
          const messageHandlers = handlersRef.current.get(message.type);
          if (messageHandlers) {
            messageHandlers.forEach(handler => handler(message.data));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  const subscribe = useCallback((channel: string, handler?: MessageHandler) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, queuing subscription');
      setTimeout(() => subscribe(channel, handler), 1000);
      return;
    }

    ws.current.send(JSON.stringify({
      type: 'subscribe',
      channel,
    }));

    if (handler) {
      const channelHandlers = handlersRef.current.get(`${channel}_update`) || new Set();
      channelHandlers.add(handler);
      handlersRef.current.set(`${channel}_update`, channelHandlers);
    }
  }, []);

  const unsubscribe = useCallback((channel: string, handler?: MessageHandler) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    ws.current.send(JSON.stringify({
      type: 'unsubscribe',
      channel,
    }));

    if (handler) {
      const channelHandlers = handlersRef.current.get(`${channel}_update`);
      if (channelHandlers) {
        channelHandlers.delete(handler);
      }
    }
  }, []);

  const on = useCallback((messageType: string, handler: MessageHandler) => {
    const messageHandlers = handlersRef.current.get(messageType) || new Set();
    messageHandlers.add(handler);
    handlersRef.current.set(messageType, messageHandlers);

    return () => {
      const handlers = handlersRef.current.get(messageType);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }, []);

  return { connected, subscribe, unsubscribe, on };
}
