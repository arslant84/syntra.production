"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BedDouble, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LocationManagement from "@/components/accommodation/LocationManagement";
import RoomManagement from "@/components/accommodation/RoomManagement";
import { useSessionPermissions } from '@/hooks/use-session-permissions';

export default function AccommodationAdminPage() {
  const [activeTab, setActiveTab] = useState("locations");
  const { role, userId, isLoading: sessionLoading } = useSessionPermissions();

  const fetchTrfsAwaitingAccommodation = useCallback(async () => {
    // Placeholder for maintaining compatibility with components
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BedDouble className="w-8 h-8 text-primary" />
            Accommodation Administration
          </h1>
          <p className="text-muted-foreground">Manage accommodation locations, rooms, and processing.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/admin/accommodation/processing">
              <FileText className="mr-2 h-4 w-4" />
              Processing Dashboard
            </Link>
          </Button>
        </div>
      </div>

      {/* Processing Dashboard Notice */}
      <div className="mb-6">
        <div className="text-center py-8 bg-blue-50 border border-blue-200 rounded-lg">
          <BedDouble className="mx-auto h-16 w-16 text-blue-600 mb-4" />
          <h3 className="text-lg font-medium text-blue-900">Accommodation Processing Moved</h3>
          <p className="text-sm text-blue-700 mt-1 mb-4">
            Accommodation booking, calendar view, and pending requests are now integrated into the Processing Dashboard 
            for a streamlined workflow that connects requests to available rooms.
          </p>
          <Button asChild variant="default" size="lg">
            <Link href="/admin/accommodation/processing">
              <FileText className="mr-2 h-4 w-4" />
              Go to Processing Dashboard
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-4">
          <LocationManagement onLocationChange={() => fetchTrfsAwaitingAccommodation()} />
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          <RoomManagement onRoomChange={() => fetchTrfsAwaitingAccommodation()} />
        </TabsContent>
      </Tabs>
    </div>
  );
}