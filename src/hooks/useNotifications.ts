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
      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          // User doesn't have permission or not authenticated - silently handle
          setCounts({ total: 0, unread: 0, pendingActions: 0, approvalRequests: 0, statusUpdates: 0 });
          return;
        }
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to fetch notification counts: ${response.status} ${response.statusText}`;
        
        if (contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData?.error || errorData?.message || errorMessage;
          } catch {
            // If JSON parsing fails, use the default error message
          }
        } else {
          // For non-JSON responses (like HTML 503 pages), use status text
          errorMessage = `Failed to fetch notification counts: ${response.status}`;
        }
        
        throw new Error(errorMessage);
      }
      const countsData = await response.json();
      setCounts(countsData);
    } catch (err) {
      // Silently handle network errors to avoid console spam
      setCounts({ total: 0, unread: 0, pendingActions: 0, approvalRequests: 0, statusUpdates: 0 });
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
      
      if (!response.ok) {
        if (response.status === 403) {
          // User doesn't have permission - silently handle
          setNotifications([]);
          return;
        }
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to fetch notifications: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setNotifications(data.notifications || []);
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

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to mark notification as read: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
      
      // Refresh counts
      await refreshCounts();
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

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to mark all notifications as read: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      
      // Refresh counts
      await refreshCounts();
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

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to dismiss notification: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Refresh counts
      await refreshCounts();
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
        // Only set up SSE if we're in a browser environment and authenticated
        if (typeof window === 'undefined') return;
        
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
          console.warn('SSE connection issue, will retry automatically');
          
          // Only try WebSocket fallback if completely failed, not just network hiccups
          if (eventSource && eventSource.readyState === EventSource.CLOSED) {
            console.log('SSE failed permanently, trying WebSocket fallback');
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

    // Temporarily disable real-time notifications to avoid console errors
    // setupSSE();
    
    // Use polling instead for now
    const pollInterval = setInterval(() => {
      refreshCounts();
    }, 30000); // Poll every 30 seconds

    // Cleanup on unmount
    return () => {
      clearInterval(pollInterval);
      if (eventSource) {
        eventSource.close();
      }
      if (websocket) {
        websocket.close();
      }
    };
  }, [refreshCounts]);

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