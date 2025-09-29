"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, BedDouble, Building, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LocationType } from '@/types/accommodation';

interface StaffHouse {
  id: string;
  name: string;
  location: LocationType;
}

interface Room {
  id: string;
  staffHouseId: string;
  staffHouseName: string;
  location: LocationType;
  name: string;
  roomType: 'Single' | 'Double' | 'Suite' | 'Tent';
  capacity: number;
  status: 'Available' | 'Maintenance' | 'Reserved';
  createdAt?: string;
  updatedAt?: string;
}

interface RoomManagementProps {
  onRoomChange?: () => void;
}

export default function RoomManagement({ onRoomChange }: RoomManagementProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staffHouses, setStaffHouses] = useState<StaffHouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterStaffHouse, setFilterStaffHouse] = useState<string>('all');
  
  const [formData, setFormData] = useState<Partial<Room>>({
    staffHouseId: '',
    name: '',
    roomType: 'Single',
    capacity: 1,
    status: 'Available'
  });
  
  const { toast } = useToast();

  // Fetch data on component mount with optimized loading
  useEffect(() => {
    const timer = setTimeout(() => {
      Promise.all([
        fetchStaffHouses(),
        fetchRooms()
      ]).catch(console.error);
    }, 150); // Slight delay to avoid concurrent requests with LocationManagement
    
    return () => clearTimeout(timer);
  }, []);

  const fetchStaffHouses = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch('/api/accommodation/admin/locations', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'max-age=300'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to fetch locations: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setStaffHouses(data.locations || []);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Staff houses fetch timed out');
        return;
      }
      console.error('Error fetching locations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load accommodation locations',
        variant: 'destructive'
      });
    }
  };

  const fetchRooms = async () => {
    if (isLoading) return; // Prevent concurrent requests
    
    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch('/api/accommodation/admin/rooms', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'max-age=300'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to fetch rooms: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setRooms(data.rooms || []);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Rooms fetch timed out');
        return;
      }
      console.error('Error fetching rooms:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rooms',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Handle numeric values
    if (name === 'capacity') {
      const numValue = parseInt(value);
      if (!isNaN(numValue) && numValue > 0) {
        setFormData(prev => ({ ...prev, [name]: numValue }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = '/api/accommodation/admin/rooms';
      const method = selectedRoom ? 'PUT' : 'POST';
      
      const payload = selectedRoom 
        ? { ...formData, id: selectedRoom.id } 
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to save room: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      toast({
        title: 'Success',
        description: selectedRoom 
          ? 'Room updated successfully' 
          : 'New room added successfully'
      });

      // Reset form and refresh data
      setFormData({
        staffHouseId: '',
        name: '',
        roomType: 'Single',
        capacity: 1,
        status: 'Available'
      });
      setSelectedRoom(null);
      setIsDialogOpen(false);
      
      // Optimistic update
      setTimeout(fetchRooms, 100);
      
      // Notify parent component if needed
      if (onRoomChange) {
        onRoomChange();
      }
    } catch (error) {
      console.error('Error saving room:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save room',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (room: Room) => {
    setSelectedRoom(room);
    setFormData({
      staffHouseId: room.staffHouseId,
      name: room.name,
      roomType: room.roomType,
      capacity: room.capacity,
      status: room.status
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedRoom) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/accommodation/admin/rooms?id=${selectedRoom.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to delete room: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      toast({
        title: 'Success',
        description: 'Room deleted successfully'
      });

      // Reset and refresh
      setSelectedRoom(null);
      setIsDeleteDialogOpen(false);
      
      // Optimistic update
      setRooms(prev => prev.filter(room => room.id !== selectedRoom.id));
      setTimeout(fetchRooms, 100);
      
      // Notify parent component if needed
      if (onRoomChange) {
        onRoomChange();
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete room',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = (room: Room) => {
    setSelectedRoom(room);
    setIsDeleteDialogOpen(true);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-green-500';
      case 'Maintenance': return 'bg-amber-500';
      case 'Reserved': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getRoomTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'Single': return 'bg-blue-500';
      case 'Double': return 'bg-purple-500';
      case 'Suite': return 'bg-indigo-500';
      case 'Tent': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getLocationBadgeVariant = (location: LocationType) => {
    switch (location) {
      case 'Ashgabat': return 'bg-blue-500';
      case 'Kiyanly': return 'bg-green-500';
      case 'Turkmenbashy': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  // Memoized filtered rooms for performance
  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      if (filterLocation !== 'all' && room.location !== filterLocation) {
        return false;
      }
      if (filterStaffHouse !== 'all' && room.staffHouseId !== filterStaffHouse) {
        return false;
      }
      return true;
    });
  }, [rooms, filterLocation, filterStaffHouse]);

  // Memoized computed values for performance
  const uniqueLocations = useMemo(() => {
    return Array.from(new Set(staffHouses.map(house => house.location)));
  }, [staffHouses]);

  const filteredStaffHouses = useMemo(() => {
    return filterLocation === 'all' 
      ? staffHouses 
      : staffHouses.filter(house => house.location === filterLocation);
  }, [staffHouses, filterLocation]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BedDouble className="h-5 w-5" />
          Room Management
        </CardTitle>
        <CardDescription>
          Manage rooms in staff houses and camps across all locations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filter:</span>
              </div>
              
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {uniqueLocations.map(location => (
                    <SelectItem key={location} value={location}>{location}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select 
                value={filterStaffHouse} 
                onValueChange={setFilterStaffHouse}
                disabled={filteredStaffHouses.length === 0}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Filter by staff house" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff Houses</SelectItem>
                  {filteredStaffHouses.map(house => (
                    <SelectItem key={house.id} value={house.id}>{house.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setSelectedRoom(null);
                  setFormData({
                    staffHouseId: '',
                    name: '',
                    roomType: 'Single',
                    capacity: 1,
                    status: 'Available'
                  });
                }}>
                  <Plus className="mr-2 h-4 w-4" /> Add New Room
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {selectedRoom ? 'Edit Room' : 'Add New Room'}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedRoom 
                      ? 'Update the details for this room.' 
                      : 'Add a new room to an accommodation location.'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="staffHouseId">Staff House/Location</Label>
                    <Select 
                      value={formData.staffHouseId} 
                      onValueChange={(value) => handleSelectChange('staffHouseId', value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select staff house" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffHouses.map(house => (
                          <SelectItem key={house.id} value={house.id}>
                            {house.name} ({house.location})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Room Name</Label>
                    <Input 
                      id="name" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      placeholder="e.g., Room #101" 
                      required 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="roomType">Room Type</Label>
                      <Select 
                        value={formData.roomType} 
                        onValueChange={(value) => handleSelectChange('roomType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Single">Single</SelectItem>
                          <SelectItem value="Double">Double</SelectItem>
                          <SelectItem value="Suite">Suite</SelectItem>
                          <SelectItem value="Tent">Tent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capacity">Capacity</Label>
                      <Input 
                        id="capacity" 
                        name="capacity" 
                        type="number"
                        min="1"
                        value={formData.capacity} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={formData.status} 
                      onValueChange={(value) => handleSelectChange('status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Available">Available</SelectItem>
                        <SelectItem value="Maintenance">Maintenance</SelectItem>
                        <SelectItem value="Reserved">Reserved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Saving...' : selectedRoom ? 'Update Room' : 'Add Room'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {rooms.length === 0 
                ? 'No rooms found. Add your first room to get started.'
                : 'No rooms match the current filters.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Staff House</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.name}</TableCell>
                    <TableCell>
                      <Badge className={getLocationBadgeVariant(room.location)}>
                        {room.location}
                      </Badge>
                    </TableCell>
                    <TableCell>{room.staffHouseName}</TableCell>
                    <TableCell>
                      <Badge className={getRoomTypeBadgeVariant(room.roomType)}>
                        {room.roomType}
                      </Badge>
                    </TableCell>
                    <TableCell>{room.capacity}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeVariant(room.status)}>
                        {room.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(room)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => confirmDelete(room)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the room "{selectedRoom?.name}" from 
                {selectedRoom?.staffHouseName}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                {isLoading ? 'Deleting...' : 'Delete Room'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
