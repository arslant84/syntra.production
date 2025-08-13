// WebSocket service for real-time notifications
export class WebSocketService {
  private static instance: WebSocketService;
  private connections: Map<string, WebSocket[]> = new Map();
  
  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }
  
  // Connect user to WebSocket for real-time updates
  connect(userId: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        // In a production environment, this would connect to your WebSocket server
        // For now, we'll return a mock WebSocket-like object
        const mockWs = {
          readyState: 1, // OPEN
          send: (data: string) => console.log(`Mock WS send to ${userId}:`, data),
          close: () => console.log(`Mock WS closed for ${userId}`),
          onmessage: null,
          onclose: null,
          onerror: null
        } as any;
        
        // Add to connections
        if (!this.connections.has(userId)) {
          this.connections.set(userId, []);
        }
        this.connections.get(userId)!.push(mockWs);
        
        resolve(mockWs);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Disconnect user WebSocket
  disconnect(userId: string, ws: WebSocket) {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      const index = userConnections.indexOf(ws);
      if (index > -1) {
        userConnections.splice(index, 1);
      }
      if (userConnections.length === 0) {
        this.connections.delete(userId);
      }
    }
  }
  
  // Broadcast notification to all user connections
  broadcastToUser(userId: string, notification: any) {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      const message = JSON.stringify({
        type: 'notification',
        data: notification
      });
      
      userConnections.forEach(ws => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(message);
        }
      });
    }
  }
  
  // Broadcast notification count updates
  broadcastCountUpdate(userId: string, counts: any) {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      const message = JSON.stringify({
        type: 'count_update',
        data: counts
      });
      
      userConnections.forEach(ws => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(message);
        }
      });
    }
  }
  
  // Get active user connections
  getActiveUsers(): string[] {
    return Array.from(this.connections.keys()).filter(
      userId => this.connections.get(userId)!.length > 0
    );
  }
  
  // Get connection count for a user
  getUserConnectionCount(userId: string): number {
    return this.connections.get(userId)?.length || 0;
  }
}