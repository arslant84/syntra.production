import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/permissions';

// WebSocket connection manager for multi-instance deployments
class WebSocketManager {
  private static connections = new Map<string, Set<WebSocket>>();
  
  static addConnection(userId: string, ws: WebSocket) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(ws);
  }
  
  static removeConnection(userId: string, ws: WebSocket) {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }
  }
  
  static broadcastToUser(userId: string, data: any) {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      const message = JSON.stringify(data);
      userConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }
  
  static getActiveUsers(): string[] {
    return Array.from(this.connections.keys());
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (!await hasPermission('view_sidebar_counts')) {
      return new Response('Forbidden', { status: 403 });
    }

    const userId = session.id || session.email;
    
    // Check if the request is a WebSocket upgrade
    const upgrade = request.headers.get('upgrade');
    if (upgrade !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    // For Node.js runtime, we need to handle WebSocket upgrade differently
    // This is a simplified implementation - in production, consider using a WebSocket library
    return new Response('WebSocket upgrade not implemented in this runtime', { 
      status: 501,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
    
  } catch (error) {
    console.error('WebSocket error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Export the WebSocket manager for use in other parts of the application
export { WebSocketManager };