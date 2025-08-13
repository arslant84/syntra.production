// Custom hook for managing notifications and real-time updates
'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserNotification, NotificationCounts } from '@/types/notifications';
import { WebSocketService } from '@/lib/websocket-service';

interface UseNotificationsReturn {
  notifications: UserNotification[];
  counts: NotificationCounts;
  loading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  fetchNotifications: (options?: { unreadOnly?: boolean; category?: string }) => Promise<void>;
  refreshCounts: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({
    total: 0,
    unread: 0,
    pendingActions: 0,
    approvalRequests: 0,
    statusUpdates: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch notification counts
  const refreshCounts = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/counts');
      if (response.ok) {
        const countsData = await response.json();
        setCounts(countsData);
      } else if (response.status === 403) {
        // User doesn't have permission - silently handle
        setCounts({ total: 0, unread: 0, pendingActions: 0, approvalRequests: 0, statusUpdates: 0 });
      }
    } catch (err) {
      console.error('Error fetching notification counts:', err);
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async (options: { unreadOnly?: boolean; category?: string } = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (options.unreadOnly) params.append('unreadOnly', 'true');
      if (options.category) params.append('category', options.category);
      
      const response = await fetch(`/api/notifications?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      } else if (response.status === 403) {
        // User doesn't have permission - silently handle
        setNotifications([]);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch notifications');
      }
    } catch (err) {
      setError('Network error fetching notifications');
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', notificationId })
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
        );
        
        // Refresh counts
        await refreshCounts();
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, [refreshCounts]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' })
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        
        // Refresh counts
        await refreshCounts();
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [refreshCounts]);

  // Dismiss notification
  const dismissNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', notificationId })
      });

      if (response.ok) {
        // Remove from local state
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        
        // Refresh counts
        await refreshCounts();
      }
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  }, [refreshCounts]);

  // Set up real-time updates with Server-Sent Events and WebSocket fallback
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let websocket: WebSocket | null = null;

    const setupSSE = () => {
      try {
        eventSource = new EventSource('/api/notifications/stream');
        
        eventSource.onopen = () => {
          console.log('Notification stream connected');
          setError(null);
        };
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'connected':
                console.log('Connected to notification stream');
                break;
                
              case 'counts':
                setCounts(data.data);
                break;
                
              case 'notification_update':
                // Refresh both notifications and counts
                fetchNotifications();
                refreshCounts();
                break;
                
              case 'heartbeat':
                // Keep connection alive
                break;
                
              default:
                console.log('Unknown SSE message type:', data.type);
            }
          } catch (err) {
            console.error('Error parsing SSE data:', err);
          }
        };
        
        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          
          // Try WebSocket fallback for multi-instance deployments
          if (eventSource && eventSource.readyState === EventSource.CLOSED) {
            console.log('SSE failed, trying WebSocket fallback');
            setupWebSocket();
          }
        };
        
      } catch (err) {
        console.error('Error setting up SSE:', err);
        setupWebSocket(); // Fallback to WebSocket
      }
    };

    // WebSocket setup for multi-instance deployments
    const setupWebSocket = async () => {
      try {
        const wsService = WebSocketService.getInstance();
        websocket = await wsService.connect('current-user-id'); // In real app, get from session
        
        websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'notification':
                fetchNotifications();
                refreshCounts();
                break;
                
              case 'count_update':
                setCounts(data.data);
                break;
                
              default:
                console.log('Unknown WebSocket message type:', data.type);
            }
          } catch (err) {
            console.error('Error parsing WebSocket data:', err);
          }
        };
        
        websocket.onclose = () => {
          console.log('WebSocket connection closed');
          // Attempt SSE reconnect after delay
          setTimeout(setupSSE, 5000);
        };
        
      } catch (err) {
        console.error('Error setting up WebSocket:', err);
        // Fallback to polling
        setTimeout(() => refreshCounts(), 30000);
      }
    };

    setupSSE();

    // Cleanup on unmount
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (websocket) {
        websocket.close();
      }
    };
  }, [fetchNotifications, refreshCounts]);

  // Initial data fetch
  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  return {
    notifications,
    counts,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    fetchNotifications,
    refreshCounts
  };
}