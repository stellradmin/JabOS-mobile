// WebSocket connection lifecycle management with automatic cleanup
// Manages WebSocket connections, subscriptions, and reconnection logic
// Prevents memory leaks from WebSocket connections and event listeners

import { useRef, useCallback, useEffect } from 'react';
import { useTimers } from './useTimers';
import { useAsyncOperations } from './useAsyncOperations';
import { logError, logWarn, logInfo, logDebug, logUserAction } from "../utils/logger";

interface WebSocketConnection {
  id: string;
  ws: WebSocket;
  url: string;
  protocols?: string[];
  state: 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error';
  createdAt: number;
  connectedAt?: number;
  disconnectedAt?: number;
  reconnectAttempts: number;
  lastHeartbeat?: number;
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  errors: Array<{
    timestamp: number;
    error: string;
    code?: number;
  }>;
  description?: string;
  cleanup?: () => void;
}

interface WebSocketSubscription {
  id: string;
  connectionId: string;
  eventType: string;
  callback: (data: any) => void;
  filter?: (data: any) => boolean;
  description?: string;
  isActive: boolean;
  messageCount: number;
  lastTriggered?: number;
  cleanup?: () => void;
}

interface ReconnectionConfig {
  enabled: boolean;
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

interface HeartbeatConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  message: string | object;
}

const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  enabled: true,
  maxAttempts: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
};

const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  enabled: true,
  interval: 30000, // 30 seconds
  timeout: 5000,   // 5 seconds
  message: { type: 'ping' },
};

export const useWebSocketManager = (
  reconnectionConfig: Partial<ReconnectionConfig> = {},
  heartbeatConfig: Partial<HeartbeatConfig> = {}
) => {
  const { createTimeout, createInterval, clearTimer } = useTimers();
  const { createCancellablePromise } = useAsyncOperations();
  
  const connectionsRef = useRef<Map<string, WebSocketConnection>>(new Map());
  const subscriptionsRef = useRef<Map<string, WebSocketSubscription>>(new Map());
  const heartbeatTimersRef = useRef<Map<string, string>>(new Map());
  const nextIdRef = useRef(0);
  
  const reconnectConfig: ReconnectionConfig = { ...DEFAULT_RECONNECTION_CONFIG, ...reconnectionConfig };
  const heartbeatConf: HeartbeatConfig = { ...DEFAULT_HEARTBEAT_CONFIG, ...heartbeatConfig };

  // Generate unique connection ID
  const generateConnectionId = useCallback((url: string) => {
    return `ws_conn_${btoa(url).slice(0, 8)}_${nextIdRef.current++}_${Date.now()}`;
  }, []);

  // Generate unique subscription ID
  const generateSubscriptionId = useCallback((eventType: string) => {
    return `ws_sub_${eventType}_${nextIdRef.current++}_${Date.now()}`;
  }, []);

  // Calculate reconnection delay with jitter
  const calculateReconnectDelay = useCallback((attemptNumber: number): number => {
    const delay = Math.min(
      reconnectConfig.baseDelay * Math.pow(reconnectConfig.backoffFactor, attemptNumber),
      reconnectConfig.maxDelay
    );
    
    if (reconnectConfig.jitter) {
      // Add ±25% jitter
      const jitterRange = delay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      return Math.max(100, delay + jitter);
    }
    
    return delay;
  }, [reconnectConfig]);

  // Set up heartbeat for connection
  const setupHeartbeat = useCallback((connectionId: string) => {
    if (!heartbeatConf.enabled) return;

    const connection = connectionsRef.current.get(connectionId);
    if (!connection || connection.state !== 'connected') return;

    const heartbeatId = createInterval(() => {
      if (connection.state === 'connected') {
        try {
          const message = typeof heartbeatConf.message === 'string' 
            ? heartbeatConf.message 
            : JSON.stringify(heartbeatConf.message);
          
          connection.ws.send(message);
          connection.lastHeartbeat = Date.now();
          connection.messagesSent++;
          
          if (typeof heartbeatConf.message === 'object') {
            connection.bytesTransferred += JSON.stringify(heartbeatConf.message).length;
          } else {
            connection.bytesTransferred += heartbeatConf.message.length;
          }
        } catch (error) {
          logError(`Heartbeat failed for connection ${connectionId}:`, "Error", error);
          connection.errors.push({
            timestamp: Date.now(),
            error: `Heartbeat failed: ${error}`,
          });
        }
      }
    }, heartbeatConf.interval, `heartbeat_${connectionId}`);

    heartbeatTimersRef.current.set(connectionId, heartbeatId);
  }, [heartbeatConf, createInterval]);

  // Clear heartbeat for connection
  const clearHeartbeat = useCallback((connectionId: string) => {
    const heartbeatId = heartbeatTimersRef.current.get(connectionId);
    if (heartbeatId) {
      clearTimer(heartbeatId);
      heartbeatTimersRef.current.delete(connectionId);
    }
  }, [clearTimer]);

  // Schedule reconnection for connection
  const scheduleReconnect = useCallback((connectionId: string) => {
    const connection = connectionsRef.current.get(connectionId);
    if (!connection || !reconnectConfig.enabled) return;

    if (connection.reconnectAttempts >= reconnectConfig.maxAttempts) {
      connection.state = 'error';
      connection.errors.push({
        timestamp: Date.now(),
        error: `Max reconnection attempts (${reconnectConfig.maxAttempts}) exceeded`,
      });
      return;
    }

    const delay = calculateReconnectDelay(connection.reconnectAttempts);
    connection.reconnectAttempts++;

    if (__DEV__) {
      logDebug(`⏳ Scheduling WebSocket reconnect for ${connection.url} in ${delay}ms (attempt ${connection.reconnectAttempts}, "Debug")`);
    }

    createTimeout(() => {
      const currentConnection = connectionsRef.current.get(connectionId);
      if (currentConnection && currentConnection.state === 'disconnected') {
        reconnectWebSocket(connectionId);
      }
    }, delay, `ws_reconnect_${connectionId}_${connection.reconnectAttempts}`);
  }, [reconnectConfig, calculateReconnectDelay, createTimeout]);

  // Reconnect WebSocket
  const reconnectWebSocket = useCallback((connectionId: string) => {
    const connection = connectionsRef.current.get(connectionId);
    if (!connection) return;

    try {
      // Create new WebSocket instance
      const newWs = new WebSocket(connection.url, connection.protocols);
      const oldWs = connection.ws;
      
      // Close old connection
      if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
        oldWs.close();
      }

      // Update connection with new WebSocket
      connection.ws = newWs;
      connection.state = 'connecting';
      setupWebSocketEventHandlers(connectionId);
      
    } catch (error) {
      logError(`Failed to reconnect WebSocket ${connectionId}:`, "Error", error);
      connection.state = 'error';
      connection.errors.push({
        timestamp: Date.now(),
        error: `Reconnection failed: ${error}`,
      });
      
      scheduleReconnect(connectionId);
    }
  }, [scheduleReconnect]);

  // Set up WebSocket event handlers
  const setupWebSocketEventHandlers = useCallback((connectionId: string) => {
    const connection = connectionsRef.current.get(connectionId);
    if (!connection) return;

    const { ws } = connection;

    ws.onopen = () => {
      connection.state = 'connected';
      connection.connectedAt = Date.now();
      connection.reconnectAttempts = 0;
      
      if (__DEV__) {
        logDebug(`🌐 WebSocket connected: ${connection.url}`, "Debug");
      }
      
      // Set up heartbeat
      setupHeartbeat(connectionId);
    };

    ws.onclose = (event) => {
      connection.state = 'disconnected';
      connection.disconnectedAt = Date.now();
      
      if (__DEV__) {
        logDebug(`🌐 WebSocket disconnected: ${connection.url} (code: ${event.code}, "Debug", reason: ${event.reason})`);
      }
      
      // Clear heartbeat
      clearHeartbeat(connectionId);
      
      // Schedule reconnection if not intentionally closed
      if (event.code !== 1000 && reconnectConfig.enabled) {
        scheduleReconnect(connectionId);
      }
    };

    ws.onerror = (error) => {
      connection.state = 'error';
      connection.errors.push({
        timestamp: Date.now(),
        error: `WebSocket error: ${error}`,
      });
      
      logError(`🚨 WebSocket error on ${connection.url}:`, "Error", error);
    };

    ws.onmessage = (event) => {
      connection.messagesReceived++;
      connection.bytesTransferred += event.data.length;
      
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        // Trigger relevant subscriptions
        subscriptionsRef.current.forEach((subscription) => {
          if (subscription.connectionId === connectionId && subscription.isActive) {
            // Check if message matches subscription
            const matchesFilter = !subscription.filter || subscription.filter(data);
            const matchesEventType = !subscription.eventType || 
              data.type === subscription.eventType || 
              subscription.eventType === '*';
            
            if (matchesEventType && matchesFilter) {
              subscription.messageCount++;
              subscription.lastTriggered = Date.now();
              
              try {
                subscription.callback(data);
              } catch (error) {
                logError(`Error in WebSocket subscription callback:`, "Error", error);
              }
            }
          }
        });
      } catch (error) {
        logError(`Error parsing WebSocket message:`, "Error", error);
        connection.errors.push({
          timestamp: Date.now(),
          error: `Message parsing failed: ${error}`,
        });
      }
    };
  }, [setupHeartbeat, clearHeartbeat, scheduleReconnect, reconnectConfig]);

  // Create WebSocket connection
  const createConnection = useCallback((
    url: string,
    options: {
      protocols?: string[];
      description?: string;
      autoConnect?: boolean;
    } = {}
  ): Promise<string> => {
    const { protocols, description, autoConnect = true } = options;

    return createCancellablePromise(async (signal) => {
      if (signal.aborted) throw new Error('Connection creation cancelled');

      const connectionId = generateConnectionId(url);
      
      try {
        const ws = new WebSocket(url, protocols);
        
        const connection: WebSocketConnection = {
          id: connectionId,
          ws,
          url,
          protocols,
          state: 'connecting',
          createdAt: Date.now(),
          reconnectAttempts: 0,
          messagesSent: 0,
          messagesReceived: 0,
          bytesTransferred: 0,
          errors: [],
          description: `websocket-${description || 'unnamed'}`,
          cleanup: () => {
            // Clear heartbeat
            clearHeartbeat(connectionId);
            
            // Close WebSocket connection
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
              ws.close(1000, 'Connection cleanup');
            }
            
            // Remove all subscriptions for this connection
            const subscriptionsToRemove: string[] = [];
            subscriptionsRef.current.forEach((sub, subId) => {
              if (sub.connectionId === connectionId) {
                subscriptionsToRemove.push(subId);
              }
            });
            
            subscriptionsToRemove.forEach(subId => {
              unsubscribe(subId);
            });
          },
        };

        connectionsRef.current.set(connectionId, connection);

        if (autoConnect) {
          setupWebSocketEventHandlers(connectionId);
          
          // Wait for connection to open or fail
          return new Promise<string>((resolve, reject) => {
            const timeout = createTimeout(() => {
              reject(new Error(`WebSocket connection timeout for ${url}`));
            }, 10000, `ws_connect_timeout_${connectionId}`);

            ws.onopen = () => {
              clearTimer(timeout);
              resolve(connectionId);
            };

            ws.onerror = (error) => {
              clearTimer(timeout);
              reject(new Error(`WebSocket connection failed for ${url}: ${error}`));
            };
          });
        }

        return connectionId;
      } catch (error) {
        connectionsRef.current.delete(connectionId);
        throw new Error(`Failed to create WebSocket connection to ${url}: ${error}`);
      }
    }, `create_ws_connection_${url}`);
  }, [generateConnectionId, createCancellablePromise, setupWebSocketEventHandlers, clearHeartbeat, createTimeout, clearTimer]);

  // Subscribe to WebSocket messages
  const subscribe = useCallback((
    connectionId: string,
    eventType: string,
    callback: (data: any) => void,
    options: {
      filter?: (data: any) => boolean;
      description?: string;
    } = {}
  ): string => {
    const { filter, description } = options;
    const subscriptionId = generateSubscriptionId(eventType);

    const subscription: WebSocketSubscription = {
      id: subscriptionId,
      connectionId,
      eventType,
      callback,
      filter,
      description: `websocket-subscription-${eventType}-${description || 'unnamed'}`,
      isActive: true,
      messageCount: 0,
      cleanup: () => {
        // Remove callback references
        subscription.callback = () => {};
        subscription.filter = undefined;
      },
    };

    subscriptionsRef.current.set(subscriptionId, subscription);
    return subscriptionId;
  }, [generateSubscriptionId]);

  // Send message through WebSocket
  const sendMessage = useCallback((
    connectionId: string,
    message: string | object,
    options: {
      requireConnection?: boolean;
      timeout?: number;
    } = {}
  ): Promise<void> => {
    const { requireConnection = true, timeout = 5000 } = options;

    return createCancellablePromise(async (signal) => {
      const connection = connectionsRef.current.get(connectionId);
      if (!connection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      if (requireConnection && connection.state !== 'connected') {
        throw new Error(`Connection ${connectionId} is not connected (state: ${connection.state})`);
      }

      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      
      return new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          reject(new Error('Send message cancelled'));
          return;
        }

        const timeoutId = createTimeout(() => {
          reject(new Error('Send message timeout'));
        }, timeout, `ws_send_timeout_${connectionId}`);

        try {
          connection.ws.send(messageStr);
          connection.messagesSent++;
          connection.bytesTransferred += messageStr.length;
          
          clearTimer(timeoutId);
          resolve();
        } catch (error) {
          clearTimer(timeoutId);
          connection.errors.push({
            timestamp: Date.now(),
            error: `Send failed: ${error}`,
          });
          reject(error);
        }
      });
    }, `ws_send_${connectionId}`);
  }, [createCancellablePromise, createTimeout, clearTimer]);

  // Get connection status
  const getConnectionStatus = useCallback(() => {
    const connections = Array.from(connectionsRef.current.values());
    const subscriptions = Array.from(subscriptionsRef.current.values());
    const now = Date.now();

    return {
      connections: {
        total: connections.length,
        byState: connections.reduce((acc, conn) => {
          acc[conn.state] = (acc[conn.state] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        withErrors: connections.filter(c => c.errors.length > 0).length,
        withHeartbeat: heartbeatTimersRef.current.size,
        averageUptime: connections
          .filter(c => c.connectedAt)
          .reduce((sum, c) => sum + (now - c.connectedAt!), 0) / 
          Math.max(1, connections.filter(c => c.connectedAt).length),
      },
      subscriptions: {
        total: subscriptions.length,
        active: subscriptions.filter(s => s.isActive).length,
        byEventType: subscriptions.reduce((acc, sub) => {
          acc[sub.eventType] = (acc[sub.eventType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        recentlyTriggered: subscriptions.filter(s => 
          s.lastTriggered && (now - s.lastTriggered) < 60000 // Last minute
        ).length,
        neverTriggered: subscriptions.filter(s => !s.lastTriggered).length,
      },
      performance: {
        totalMessagesSent: connections.reduce((sum, c) => sum + c.messagesSent, 0),
        totalMessagesReceived: connections.reduce((sum, c) => sum + c.messagesReceived, 0),
        totalBytesTransferred: connections.reduce((sum, c) => sum + c.bytesTransferred, 0),
        totalErrors: connections.reduce((sum, c) => sum + c.errors.length, 0),
      },
    };
  }, []);

  // Find potential WebSocket leaks
  const findWebSocketLeaks = useCallback(() => {
    const connections = Array.from(connectionsRef.current.values());
    const subscriptions = Array.from(subscriptionsRef.current.values());
    const now = Date.now();
    
    const leaks: Array<{
      id: string;
      type: 'connection' | 'subscription';
      issue: string;
      severity: 'low' | 'medium' | 'high';
      recommendation: string;
    }> = [];

    // Check for connections with high error rates
    connections.forEach(connection => {
      if (connection.errors.length > 10) {
        leaks.push({
          id: connection.id,
          type: 'connection',
          issue: `High error count: ${connection.errors.length} errors`,
          severity: 'high',
          recommendation: 'Review connection stability and error handling',
        });
      }

      // Check for connections stuck in connecting state
      if (connection.state === 'connecting' && (now - connection.createdAt) > 30000) {
        leaks.push({
          id: connection.id,
          type: 'connection',
          issue: 'Connection stuck in connecting state for 30+ seconds',
          severity: 'medium',
          recommendation: 'Check server availability and connection timeout settings',
        });
      }

      // Check for connections with excessive reconnect attempts
      if (connection.reconnectAttempts > reconnectConfig.maxAttempts) {
        leaks.push({
          id: connection.id,
          type: 'connection',
          issue: `Excessive reconnect attempts: ${connection.reconnectAttempts}`,
          severity: 'high',
          recommendation: 'Consider disabling reconnection or checking server status',
        });
      }
    });

    // Check for subscriptions that never receive messages
    subscriptions.forEach(subscription => {
      if (!subscription.lastTriggered && subscription.isActive) {
        const connection = connectionsRef.current.get(subscription.connectionId);
        if (connection && connection.connectedAt && (now - connection.connectedAt) > 300000) {
          leaks.push({
            id: subscription.id,
            type: 'subscription',
            issue: 'Subscription never triggered after 5+ minutes',
            severity: 'medium',
            recommendation: 'Check event type matching and message filtering',
          });
        }
      }

      // Check for inactive subscriptions not cleaned up
      if (!subscription.isActive && subscription.lastTriggered && 
          (now - subscription.lastTriggered) > 600000) { // 10 minutes
        leaks.push({
          id: subscription.id,
          type: 'subscription',
          issue: 'Inactive subscription not cleaned up',
          severity: 'low',
          recommendation: 'Clean up inactive subscriptions to free memory',
        });
      }
    });

    return leaks;
  }, [reconnectConfig]);

  // Unsubscribe from WebSocket messages
  const unsubscribe = useCallback((subscriptionId: string): boolean => {
    const subscription = subscriptionsRef.current.get(subscriptionId);
    if (!subscription) return false;

    try {
      if (subscription.cleanup) {
        subscription.cleanup();
      }
      
      subscriptionsRef.current.delete(subscriptionId);
      return true;
    } catch (error) {
      logError(`Error unsubscribing ${subscriptionId}:`, "Error", error);
      return false;
    }
  }, []);

  // Close WebSocket connection
  const closeConnection = useCallback((connectionId: string, code?: number, reason?: string): boolean => {
    const connection = connectionsRef.current.get(connectionId);
    if (!connection) return false;

    try {
      connection.state = 'disconnecting';
      
      if (connection.cleanup) {
        connection.cleanup();
      }
      
      connectionsRef.current.delete(connectionId);
      return true;
    } catch (error) {
      logError(`Error closing connection ${connectionId}:`, "Error", error);
      return false;
    }
  }, []);

  // Cleanup all WebSocket connections and subscriptions
  const cleanupAllConnections = useCallback((): {
    cleaned: { connections: number; subscriptions: number };
    errors: string[];
  } => {
    const result = {
      cleaned: { connections: 0, subscriptions: 0 },
      errors: [] as string[],
    };

    // Cleanup all subscriptions
    for (const [subscriptionId] of subscriptionsRef.current.entries()) {
      try {
        if (unsubscribe(subscriptionId)) {
          result.cleaned.subscriptions++;
        }
      } catch (error) {
        result.errors.push(`Failed to cleanup subscription ${subscriptionId}: ${error}`);
      }
    }

    // Cleanup all connections
    for (const [connectionId] of connectionsRef.current.entries()) {
      try {
        if (closeConnection(connectionId)) {
          result.cleaned.connections++;
        }
      } catch (error) {
        result.errors.push(`Failed to cleanup connection ${connectionId}: ${error}`);
      }
    }

    return result;
  }, [unsubscribe, closeConnection]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      const cleanupResult = cleanupAllConnections();
      if (__DEV__ && (cleanupResult.cleaned.connections > 0 || cleanupResult.cleaned.subscriptions > 0)) {
        logDebug(`🧹 WebSocket cleanup on unmount:`, "Debug", cleanupResult.cleaned);
        if (cleanupResult.errors.length > 0) {
          logWarn('🚨 WebSocket cleanup errors:', "Warning", cleanupResult.errors);
        }
      }
    };
  }, [cleanupAllConnections]);

  return {
    // Connection management
    createConnection,
    closeConnection,
    reconnectWebSocket,
    
    // Message management
    subscribe,
    unsubscribe,
    sendMessage,
    
    // Status and debugging
    getConnectionStatus,
    findWebSocketLeaks,
    
    // Cleanup operations
    cleanupAllConnections,
  };
};
