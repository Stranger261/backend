// services/dashboard/WebSocketService.js
import WebSocket from 'ws';
import OverviewService from '../services/dashboardOverview.service.js';
import AlertService from '../services/Alert.service.js';

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Set();
    this.interval = null;

    this.initialize();
  }

  initialize() {
    this.wss.on('connection', ws => {
      console.log('Dashboard client connected');
      this.clients.add(ws);

      // Send initial data
      this.sendDashboardData(ws);

      ws.on('close', () => {
        console.log('Dashboard client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', error => {
        console.error('WebSocket error:', error);
      });
    });

    // Broadcast updates every 30 seconds
    this.interval = setInterval(() => {
      this.broadcastDashboardUpdate();
    }, 30000);
  }

  async sendDashboardData(ws) {
    try {
      const overview = await OverviewService.getDashboardOverview();
      const alerts = await AlertService.getAllAlerts({ limit: 20 });

      ws.send(
        JSON.stringify({
          type: 'INITIAL_DATA',
          data: {
            overview,
            alerts,
          },
          timestamp: new Date(),
        }),
      );
    } catch (error) {
      console.error('Error sending dashboard data:', error);
    }
  }

  async broadcastDashboardUpdate() {
    if (this.clients.size === 0) return;

    try {
      const liveStats = await OverviewService.getLiveStats();
      const newAlerts = await AlertService.getAllAlerts({
        include_resolved: false,
        limit: 5,
      });

      const update = {
        type: 'UPDATE',
        data: {
          live_stats: liveStats,
          new_alerts: newAlerts,
          timestamp: new Date(),
        },
      };

      this.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(update));
        }
      });
    } catch (error) {
      console.error('Error broadcasting update:', error);
    }
  }

  broadcastAlert(alert) {
    const alertMessage = {
      type: 'NEW_ALERT',
      data: alert,
      timestamp: new Date(),
    };

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(alertMessage));
      }
    });
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.wss.close();
  }
}

export default WebSocketService;
