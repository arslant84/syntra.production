'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Bell, X, Check, CheckCheck, AlertCircle, FileText, DollarSign, Plane, Car } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { UserNotification } from '@/types/notifications';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
  notification: UserNotification;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
}

function NotificationItem({ notification, onMarkAsRead, onDismiss }: NotificationItemProps) {
  const getEntityIcon = (entityType?: string) => {
    switch (entityType) {
      case 'trf': return <FileText className="h-4 w-4" />;
      case 'claim': return <DollarSign className="h-4 w-4" />;
      case 'visa': return <Plane className="h-4 w-4" />;
      case 'transport': return <Car className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'normal': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'low': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDismiss(notification.id);
  };

  const content = (
    <div
      className={cn(
        "p-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer relative",
        !notification.isRead && "bg-blue-50/50 border-l-4 border-l-blue-500"
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-1 p-1 rounded-full", getPriorityColor(notification.priority))}>
          {getEntityIcon(notification.relatedEntityType)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className={cn(
                "text-sm font-medium text-gray-900 mb-1",
                !notification.isRead && "font-semibold"
              )}>
                {notification.title}
              </p>
              <p className="text-sm text-gray-600 line-clamp-2">
                {notification.message}
              </p>
            </div>
            
            <div className="flex items-center gap-1 ml-2">
              {!notification.isRead && (
                <Badge variant="secondary" className="h-2 w-2 p-0 rounded-full bg-blue-500" />
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-red-100"
                onClick={handleDismiss}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
            </span>
            
            {notification.actionRequired && (
              <Badge variant="outline" className="text-xs">
                Action Required
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (notification.actionUrl) {
    return (
      <Link href={notification.actionUrl} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const {
    notifications,
    counts,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    fetchNotifications
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'approval_requests' | 'status_updates'>('all');

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const category = activeTab === 'approval_requests' ? 'workflow_approval' : 
                     activeTab === 'status_updates' ? 'personal_status' : undefined;
      fetchNotifications({ category });
    }
  }, [isOpen, activeTab, fetchNotifications]);

  const filteredNotifications = notifications.filter(notification => {
    if (activeTab === 'all') return true;
    if (activeTab === 'approval_requests') return notification.category === 'workflow_approval';
    if (activeTab === 'status_updates') return notification.category === 'personal_status';
    return true;
  });

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'approval_requests': return counts.approvalRequests;
      case 'status_updates': return counts.statusUpdates;
      default: return counts.unread;
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative h-10 w-10 rounded-full", className)}>
          <Bell className="h-6 w-6" />
          {counts.unread > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center text-xs font-bold"
            >
              {counts.unread > 99 ? '99+' : counts.unread}
            </Badge>
          )}
          <span className="sr-only">
            Notifications ({counts.unread} unread)
          </span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-80 max-w-sm p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Notifications</h3>
            {counts.unread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-blue-600 hover:text-blue-800"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
          
          {/* Tab Navigation */}
          <div className="flex mt-3 space-x-1">
            {[
              { id: 'all', label: 'All', count: counts.unread },
              { id: 'approval_requests', label: 'Approvals', count: counts.approvalRequests },
              { id: 'status_updates', label: 'Updates', count: counts.statusUpdates }
            ].map(tab => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab(tab.id as any)}
                className="flex-1 relative"
              >
                {tab.label}
                {tab.count > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 text-xs">
                    {tab.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              Loading notifications...
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">
              {error}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No notifications</p>
              <p className="text-sm mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDismiss={dismissNotification}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {filteredNotifications.length > 0 && (
          <div className="p-3 border-t bg-gray-50">
            <Link 
              href="/notifications" 
              className="text-sm text-blue-600 hover:text-blue-800 font-medium block text-center"
              onClick={() => setIsOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}