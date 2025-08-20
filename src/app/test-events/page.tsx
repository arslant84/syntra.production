'use client';

import React, { useState, useEffect } from 'react';

interface NotificationEventType {
  id: string;
  name: string;
  description?: string;
  category: string;
  module: string;
  isActive: boolean;
}

export default function TestEventsPage() {
  const [eventTypes, setEventTypes] = useState<NotificationEventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching from debug API...');
        const response = await fetch('/api/admin/debug/notification-events');
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (!response.ok) {
          throw new Error(`API Error: ${response.status} - ${data.error || 'Unknown error'}`);
        }
        
        setEventTypes(data.eventTypes || []);
        setDebugInfo(data.debug);
        
      } catch (err) {
        console.error('Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8">Loading notification events...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Events</h1>
        <p className="text-red-500 mb-4">{error}</p>
        <details className="bg-gray-100 p-4 rounded">
          <summary>Debug Information</summary>
          <pre className="text-sm mt-2">{JSON.stringify(debugInfo, null, 2)}</pre>
        </details>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Notification Events Test Page</h1>
      
      {debugInfo && (
        <div className="bg-blue-50 p-4 rounded mb-6">
          <h2 className="text-lg font-semibold mb-2">Debug Info:</h2>
          <p><strong>User Role:</strong> {debugInfo.userRole || 'N/A'}</p>
          <p><strong>Total Events in DB:</strong> {debugInfo.totalCount}</p>
          <p><strong>Table Exists:</strong> {debugInfo.tableExists ? 'Yes' : 'No'}</p>
          <details className="mt-2">
            <summary>User Permissions</summary>
            <pre className="text-sm mt-1">{JSON.stringify(debugInfo.userPermissions, null, 2)}</pre>
          </details>
        </div>
      )}
      
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">
            Event Types ({eventTypes.length} found)
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Module
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Active
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {eventTypes.map((event) => (
                <tr key={event.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {event.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.description || 'No description'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {event.module}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      event.category === 'approval' ? 'bg-red-100 text-red-800' :
                      event.category === 'status_update' ? 'bg-blue-100 text-blue-800' :
                      event.category === 'system' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {event.category.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.isActive ? '✅' : '❌'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}