const WebSocket = require('ws');
const logger = require('../utils/logger');
const { autoUpdateService } = require('./autoUpdateService');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.server = null;
    this.clients = new Set();
    this.isStarted = false;
    this.heartbeatInterval = null;
    this.stats = {
      connectedClients: 0,
      totalConnections: 0,
      messagesSent: 0,
      errors: 0
    };
  }

  initialize(server) {
    this.server = server;
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws',
      perMessageDeflate: false
    });

    this.setupWebSocketServer();
    this.setupAutoUpdateListeners();
    this.startHeartbeat();
    
    this.isStarted = true;
    logger.info('🔌 WebSocket service initialized');
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
      this.stats.errors++;
    });
  }

  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date()
    };

    ws.clientInfo = clientInfo;
    this.clients.add(ws);
    this.stats.connectedClients++;
    this.stats.totalConnections++;

    logger.info(`🔗 WebSocket client connected: ${clientId} from ${clientInfo.ip}`);

    // Send welcome message
    this.sendToClient(ws, {
      type: 'welcome',
      clientId: clientId,
      timestamp: new Date().toISOString(),
      services: ['news-updates', 'system-status']
    });

    // Set up client event handlers
    ws.on('message', (message) => {
      this.handleClientMessage(ws, message);
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(ws, code, reason);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket client error for ${clientId}:`, error);
      this.stats.errors++;
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.isAlive = true;
  }

  handleClientMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      const { type, payload } = data;

      switch (type) {
        case 'subscribe':
          this.handleSubscription(ws, payload);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(ws, payload);
          break;
        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
          break;
        case 'get-status':
          this.sendSystemStatus(ws);
          break;
        default:
          logger.warn(`Unknown message type from ${ws.clientInfo.id}: ${type}`);
      }
    } catch (error) {
      logger.error(`Error parsing client message from ${ws.clientInfo.id}:`, error);
      this.sendToClient(ws, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }

  handleSubscription(ws, payload) {
    const { channels = [] } = payload;
    
    if (!ws.subscriptions) {
      ws.subscriptions = new Set();
    }

    channels.forEach(channel => {
      if (this.isValidChannel(channel)) {
        ws.subscriptions.add(channel);
        logger.debug(`Client ${ws.clientInfo.id} subscribed to ${channel}`);
      }
    });

    this.sendToClient(ws, {
      type: 'subscribed',
      channels: Array.from(ws.subscriptions)
    });
  }

  handleUnsubscription(ws, payload) {
    const { channels = [] } = payload;
    
    if (ws.subscriptions) {
      channels.forEach(channel => {
        ws.subscriptions.delete(channel);
        logger.debug(`Client ${ws.clientInfo.id} unsubscribed from ${channel}`);
      });
    }

    this.sendToClient(ws, {
      type: 'unsubscribed',
      channels: channels
    });
  }

  handleDisconnection(ws, code, reason) {
    this.clients.delete(ws);
    this.stats.connectedClients--;
    
    logger.info(`🔌 WebSocket client disconnected: ${ws.clientInfo.id} (code: ${code})`);
  }

  setupAutoUpdateListeners() {
    // Listen for news updates
    autoUpdateService.on('update', (data) => {
      this.broadcastToChannel('news-updates', {
        type: 'news-update',
        data: {
          articlesProcessed: data.articlesProcessed,
          duration: data.duration,
          timestamp: data.timestamp
        }
      });
    });

    // Listen for service status changes
    autoUpdateService.on('started', () => {
      this.broadcastToChannel('system-status', {
        type: 'service-status',
        service: 'auto-update',
        status: 'started',
        timestamp: new Date().toISOString()
      });
    });

    autoUpdateService.on('stopped', () => {
      this.broadcastToChannel('system-status', {
        type: 'service-status',
        service: 'auto-update',
        status: 'stopped',
        timestamp: new Date().toISOString()
      });
    });

    autoUpdateService.on('error', (data) => {
      this.broadcastToChannel('system-status', {
        type: 'service-error',
        service: 'auto-update',
        error: data.error,
        failureCount: data.failureCount,
        timestamp: new Date().toISOString()
      });
    });

    autoUpdateService.on('alert', (data) => {
      this.broadcastToChannel('system-status', {
        type: 'service-alert',
        service: 'auto-update',
        alert: data,
        timestamp: new Date().toISOString()
      });
    });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          logger.debug(`Terminating inactive client: ${ws.clientInfo?.id}`);
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }

  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        this.stats.messagesSent++;
      } catch (error) {
        logger.error(`Error sending message to client ${ws.clientInfo?.id}:`, error);
        this.stats.errors++;
      }
    }
  }

  broadcastToChannel(channel, message) {
    let sentCount = 0;
    
    this.clients.forEach(ws => {
      if (ws.subscriptions && ws.subscriptions.has(channel)) {
        this.sendToClient(ws, message);
        sentCount++;
      }
    });

    logger.debug(`📡 Broadcast to ${channel}: ${sentCount} clients`);
    return sentCount;
  }

  broadcastToAll(message) {
    let sentCount = 0;
    
    this.clients.forEach(ws => {
      this.sendToClient(ws, message);
      sentCount++;
    });

    logger.debug(`📡 Broadcast to all: ${sentCount} clients`);
    return sentCount;
  }

  sendSystemStatus(ws) {
    const status = {
      type: 'system-status',
      data: {
        autoUpdate: autoUpdateService.getStatus(),
        websocket: this.getStats(),
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      }
    };

    this.sendToClient(ws, status);
  }

  isValidChannel(channel) {
    const validChannels = ['news-updates', 'system-status', 'market-data'];
    return validChannels.includes(channel);
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats() {
    return {
      ...this.stats,
      isRunning: this.isStarted,
      activeConnections: this.clients.size
    };
  }

  // Manually broadcast news update
  broadcastNewsUpdate(articles) {
    const message = {
      type: 'news-broadcast',
      data: {
        articles: articles,
        count: articles.length,
        timestamp: new Date().toISOString()
      }
    };

    return this.broadcastToChannel('news-updates', message);
  }

  // Manually broadcast system alert
  broadcastAlert(alert) {
    const message = {
      type: 'system-alert',
      data: {
        ...alert,
        timestamp: new Date().toISOString()
      }
    };

    return this.broadcastToAll(message);
  }

  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.wss) {
      logger.info('🔌 Shutting down WebSocket service...');
      
      // Notify all clients about shutdown
      this.broadcastToAll({
        type: 'server-shutdown',
        message: 'Server is shutting down',
        timestamp: new Date().toISOString()
      });

      // Close all connections
      this.wss.clients.forEach(ws => {
        ws.close(1000, 'Server shutdown');
      });

      this.wss.close();
    }

    this.isStarted = false;
    logger.info('🔌 WebSocket service shut down');
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

module.exports = {
  WebSocketService,
  websocketService
};