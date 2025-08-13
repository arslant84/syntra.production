// Server-Sent Events API for real-time notification updates
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NotificationService } from '@/lib/notification-service';

// Store active connections
const connections = new Map<string, WritableStreamDefaultWriter>();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Set up Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        
        // Send initial connection message
        const initialData = `data: ${JSON.stringify({ 
          type: 'connected', 
          message: 'Connected to notification stream',
          timestamp: new Date().toISOString()
        })}\n\n`;
        controller.enqueue(encoder.encode(initialData));

        // Send initial notification counts
        NotificationService.getNotificationCounts(session.user!.id)
          .then(counts => {
            const countData = `data: ${JSON.stringify({ 
              type: 'counts', 
              data: counts,
              timestamp: new Date().toISOString()
            })}\n\n`;
            controller.enqueue(encoder.encode(countData));
          })
          .catch(error => {
            console.error('Error fetching initial counts:', error);
          });

        // Store connection for broadcasting
        const connectionId = `${session.user!.id}-${Date.now()}`;
        const writer = controller;
        
        // Keep connection alive with periodic heartbeat
        const heartbeat = setInterval(() => {
          try {
            const heartbeatData = `data: ${JSON.stringify({ 
              type: 'heartbeat', 
              timestamp: new Date().toISOString()
            })}\n\n`;
            controller.enqueue(encoder.encode(heartbeatData));
          } catch (error) {
            console.log('Connection closed, cleaning up heartbeat');
            clearInterval(heartbeat);
            connections.delete(connectionId);
          }
        }, 30000); // 30 second heartbeat

        // Clean up on connection close
        request.signal.addEventListener('abort', () => {
          console.log(`SSE connection closed for user ${session.user!.id}`);
          clearInterval(heartbeat);
          connections.delete(connectionId);
          controller.close();
        });
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('Error setting up SSE connection:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// Helper function to broadcast notification updates to specific user
export async function broadcastToUser(userId: string, data: any) {
  // In a production environment, you'd want to use Redis or similar for cross-instance communication
  // For now, this handles single-instance real-time updates
  
  console.log(`Broadcasting notification update to user ${userId}:`, data);
  
  // Find active connections for this user
  for (const [connectionId, writer] of connections.entries()) {
    if (connectionId.startsWith(userId)) {
      try {
        const encoder = new TextEncoder();
        const message = `data: ${JSON.stringify({
          type: 'notification_update',
          data,
          timestamp: new Date().toISOString()
        })}\n\n`;
        
        // Note: This is a simplified approach. In production, you'd need proper connection management
        console.log('Would broadcast to connection:', connectionId);
      } catch (error) {
        console.error('Error broadcasting to connection:', error);
        connections.delete(connectionId);
      }
    }
  }
}