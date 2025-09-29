"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus, Building, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LocationType } from '@/types/accommodation';

interface StaffHouse {
  id: string;
  name: string;
  location: LocationType;
  address?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  roomCount?: number;
}

interface LocationManagementProps {
  onLocationChange?: () => void;
}

export default function LocationManagement({ onLocationChange }: LocationManagementProps) {
  const [locations, setLocations] = useState<StaffHouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<StaffHouse | null>(null);
  const [formData, setFormData] = useState<Partial<StaffHouse>>({
    name: '',
    location: 'Ashgabat',
    address: '',
    description: ''
  });
  const { toast } = useToast();

  // Fetch locations on component mount with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLocations();
    }, 100); // Small delay to batch requests
    
    return () => clearTimeout(timer);
  }, []);

  const fetchLocations = async () => {
    if (isLoading) return; // Prevent concurrent requests
    
    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch('/api/accommodation/admin/locations', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'max-age=300' // 5min cache
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to fetch locations: ${response.status} ${response.statusText}`;
        
        if (contentType.includes('application/json')) {
          try {
            const errorData = await response.json();
            errorMessage = errorData?.error || errorData?.message || errorMessage;
          } catch {
            // If JSON parsing fails, use the default error message
          }
        } else {
          // For non-JSON responses (like HTML 503 pages), use status text
          errorMessage = `Failed to fetch locations: ${response.status}`;
        }
        
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setLocations(data.locations || []);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Location fetch request timed out');
        return;
      }
      console.error('Error fetching locations:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load accommodation locations',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = selectedLocation ? '/api/accommodation/admin/locations' : '/api/accommodation/admin/locations';
      const method = selectedLocation ? 'PUT' : 'POST';
      
      const payload = selectedLocation 
        ? { ...formData, id: selectedLocation.id } 
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
        let errorMessage = `Failed to save location: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorData?.message || errorMessage;
        }
        throw new Error(errorMessage);
      }

      toast({
        title: 'Success',
        description: selectedLocation 
          ? 'Accommodation location updated successfully' 
          : 'New accommodation location added successfully'
      });

      // Reset form and refresh data
      setFormData({
        name: '',
        location: 'Ashgabat',
        address: '',
        description: ''
      });
      setSelectedLocation(null);
      setIsDialogOpen(false);
      
      // Optimistic update followed by fetch
      setTimeout(fetchLocations, 100);
      
      // Notify parent component if needed
      if (onLocationChange) {
        onLocationChange();
      }
    } catch (error) {
      console.error('Error saving location:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save location',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (location: StaffHouse) => {
    setSelectedLocation(location);
    setFormData({
      name: location.name,
      location: location.location,
      address: location.address || '',
      description: location.description || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedLocation) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/accommodation/admin/locations?id=${selectedLocation.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to delete location: ${response.status} ${response.statusText}`;
        let errorData: any = null;

        if (contentType.includes('application/json')) {
          errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorData?.message || errorMessage;
        }

        // Handle specific error cases with more detailed messages
        if (response.status === 409 && errorData) {
          if (errorData.hasBookings) {
            toast({
              title: 'Cannot Delete Location',
              description: errorData.message || 'This location has active bookings. Please cancel or reassign all bookings before deleting.',
              variant: 'destructive'
            });
            // Return to prevent throwing a generic error
            return;
          } else if (errorData.hasRooms) {
            toast({
              title: 'Cannot Delete Location',
              description: errorData.message || 'This location has rooms assigned to it. Please delete all rooms first.',
              variant: 'destructive'
            });
            // Return to prevent throwing a generic error
            return;
          }
        }
        
        throw new Error(errorMessage);
      } else {
        toast({
          title: 'Success',
          description: 'Accommodation location deleted successfully'
        });

        // Reset and refresh
        setSelectedLocation(null);
        setIsDeleteDialogOpen(false);
        
        // Optimistic update
        setLocations(prev => prev.filter(loc => loc.id !== selectedLocation.id));
        setTimeout(fetchLocations, 100);
        
        // Notify parent component if needed
        if (onLocationChange) {
          onLocationChange();
        }
      }
    } catch (error) {
      console.error('Error deleting location:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete location',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setIsDeleteDialogOpen(false); // Always close the dialog, even on error
    }
  };

  const confirmDelete = (location: StaffHouse) => {
    setSelectedLocation(location);
    setIsDeleteDialogOpen(true);
  };

  const getLocationBadgeColor = (location: LocationType) => {
    switch (location) {
      case 'Ashgabat': return 'bg-blue-500';
      case 'Kiyanly': return 'bg-green-500';
      case 'Turkmenbashy': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Accommodation Locations
        </CardTitle>
        <CardDescription>
          Manage staff houses and camp locations in Ashgabat, Kiyanly, and Turkmenbashy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Available Locations</h3>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setSelectedLocation(null);
                setFormData({
                  name: '',
                  location: 'Ashgabat',
                  address: '',
                  description: ''
                });
              }}>
                <Plus className="mr-2 h-4 w-4" /> Add New Location
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {selectedLocation ? 'Edit Accommodation Location' : 'Add New Accommodation Location'}
                </DialogTitle>
                <DialogDescription>
                  {selectedLocation 
                    ? 'Update the details for this accommodation location.' 
                    : 'Add a new staff house or camp location to the system.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Location Name</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    placeholder="e.g., Staff House 41" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Area</Label>
                  <Select 
                    value={formData.location} 
                    onValueChange={(value) => handleSelectChange('location', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select area" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ashgabat">Ashgabat</SelectItem>
                      <SelectItem value="Kiyanly">Kiyanly</SelectItem>
                      <SelectItem value="Turkmenbashy">Turkmenbashy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address (Optional)</Label>
                  <Input 
                    id="address" 
                    name="address" 
                    value={formData.address} 
                    onChange={handleInputChange} 
                    placeholder="Street address" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea 
                    id="description" 
                    name="description" 
                    value={formData.description} 
                    onChange={handleInputChange} 
                    placeholder="Additional details about this location" 
                    rows={3}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : selectedLocation ? 'Update Location' : 'Add Location'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {locations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No accommodation locations found. Add your first location to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Rooms</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">{location.name}</TableCell>
                  <TableCell>
                    <Badge className={getLocationBadgeColor(location.location)}>
                      <MapPin className="mr-1 h-3 w-3" />
                      {location.location}
                    </Badge>
                  </TableCell>
                  <TableCell>{location.address || 'N/A'}</TableCell>
                  <TableCell>{location.roomCount || 0} rooms</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(location)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => confirmDelete(location)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the accommodation location 
                "{selectedLocation?.name}" and all associated data. 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                {isLoading ? 'Deleting...' : 'Delete Location'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
