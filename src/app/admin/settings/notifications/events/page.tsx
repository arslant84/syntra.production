'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Users, Settings, Search, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NotificationEventType {
  id: string;
  name: string;
  description?: string;
  category: 'approval' | 'status_update' | 'system' | 'reminder';
  module: 'trf' | 'visa' | 'claims' | 'transport' | 'accommodation' | 'general';
  isActive: boolean;
}

interface UserSubscription {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  eventTypeId: string;
  eventName: string;
  permissionRequired?: string;
  roleRequired?: string;
  departmentFilter?: string;
  isEnabled: boolean;
  notificationMethod: 'email' | 'in_app' | 'both';
}

export default function NotificationEventsPage() {
  const [eventTypes, setEventTypes] = useState<NotificationEventType[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('events');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const fetchEventTypes = async () => {
    try {
      console.log('Fetching notification event types...');
      const response = await fetch('/api/admin/notification-events');
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Failed to fetch event types: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API response data:', data);
      console.log('Event types count:', data.eventTypes?.length || 0);
      
      setEventTypes(data.eventTypes || []);
    } catch (error) {
      console.error('Error fetching event types:', error);
      toast({
        title: 'Error',
        description: `Failed to fetch notification event types: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const fetchUserSubscriptions = async () => {
    try {
      const response = await fetch('/api/admin/notification-subscriptions');
      if (!response.ok) throw new Error('Failed to fetch user subscriptions');
      const data = await response.json();
      setUserSubscriptions(data.subscriptions || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch user subscriptions.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchEventTypes(), fetchUserSubscriptions()]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleToggleEventActive = async (eventId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/notification-events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      
      if (!response.ok) throw new Error('Failed to update event');
      
      setEventTypes(prev => prev.map(event => 
        event.id === eventId ? { ...event, isActive } : event
      ));
      
      toast({
        title: 'Success',
        description: `Event ${isActive ? 'activated' : 'deactivated'} successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update event status.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleSubscription = async (subscriptionId: string, isEnabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/notification-subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled }),
      });
      
      if (!response.ok) throw new Error('Failed to update subscription');
      
      setUserSubscriptions(prev => prev.map(sub => 
        sub.id === subscriptionId ? { ...sub, isEnabled } : sub
      ));
      
      toast({
        title: 'Success',
        description: `Subscription ${isEnabled ? 'enabled' : 'disabled'} successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update subscription.',
        variant: 'destructive',
      });
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'approval': return 'bg-red-100 text-red-800';
      case 'status_update': return 'bg-blue-100 text-blue-800';
      case 'system': return 'bg-gray-100 text-gray-800';
      case 'reminder': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getModuleColor = (module: string) => {
    switch (module) {
      case 'trf': return 'bg-green-100 text-green-800';
      case 'visa': return 'bg-purple-100 text-purple-800';
      case 'claims': return 'bg-orange-100 text-orange-800';
      case 'transport': return 'bg-blue-100 text-blue-800';
      case 'accommodation': return 'bg-pink-100 text-pink-800';
      case 'general': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter event types based on search and filters
  const filteredEventTypes = eventTypes.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModule = filterModule === 'all' || event.module === filterModule;
    const matchesCategory = filterCategory === 'all' || event.category === filterCategory;
    
    return matchesSearch && matchesModule && matchesCategory;
  });

  // Group subscriptions by event type
  const subscriptionsByEvent = userSubscriptions.reduce((acc, sub) => {
    if (!acc[sub.eventTypeId]) {
      acc[sub.eventTypeId] = [];
    }
    acc[sub.eventTypeId].push(sub);
    return acc;
  }, {} as Record<string, UserSubscription[]>);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Event-Based Notification Management
          </h1>
          <p className="text-muted-foreground">Manage notification events and user subscriptions.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Event Types
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Subscriptions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Event Types</CardTitle>
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <Input
                    placeholder="Search events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <Select value={filterModule} onValueChange={setFilterModule}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modules</SelectItem>
                      <SelectItem value="trf">TRF</SelectItem>
                      <SelectItem value="visa">Visa</SelectItem>
                      <SelectItem value="claims">Claims</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="accommodation">Accommodation</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="approval">Approval</SelectItem>
                    <SelectItem value="status_update">Status Update</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="reminder">Reminder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Subscribers</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Loading event types...
                      </TableCell>
                    </TableRow>
                  ) : filteredEventTypes.length > 0 ? (
                    filteredEventTypes.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">{event.name}</TableCell>
                        <TableCell className="max-w-md truncate" title={event.description}>
                          {event.description || 'No description'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getModuleColor(event.module)}>
                            {event.module.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getCategoryColor(event.category)}>
                            {event.category.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {subscriptionsByEvent[event.id]?.length || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={event.isActive}
                            onCheckedChange={(checked) => handleToggleEventActive(event.id, checked)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No event types found matching your filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Notification Subscriptions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage which users receive notifications for specific events based on their roles and permissions.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Permission Required</TableHead>
                    <TableHead>Department Filter</TableHead>
                    <TableHead>Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Loading user subscriptions...
                      </TableCell>
                    </TableRow>
                  ) : userSubscriptions.length > 0 ? (
                    userSubscriptions.map((subscription) => (
                      <TableRow key={subscription.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{subscription.userName}</div>
                            <div className="text-sm text-muted-foreground">{subscription.userEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{subscription.eventName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {subscription.notificationMethod}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {subscription.permissionRequired || 'None'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {subscription.departmentFilter || 'All'}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={subscription.isEnabled}
                            onCheckedChange={(checked) => handleToggleSubscription(subscription.id, checked)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        No user subscriptions found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}