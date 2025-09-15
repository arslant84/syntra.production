'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { UserProfile } from '@/hooks/use-user-profile';
import { useOptionalUserProfile } from '@/contexts/UserProfileContext';

interface ProfileFormProps {
  user: UserProfile;
  onUserUpdate: () => void;
}

export default function ProfileForm({ user, onUserUpdate }: ProfileFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const userProfileContext = useOptionalUserProfile();
  
  // Use context user if available, otherwise fallback to prop user
  const currentUser = userProfileContext?.user || user;
  
  const [formData, setFormData] = useState({
    name: currentUser.name,
    gender: currentUser.gender || '',
    phone: currentUser.phone || '',
    profile_photo: currentUser.profile_photo || null
  });
  const [previewImage, setPreviewImage] = useState<string | null>(currentUser.profile_photo || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Update form data when currentUser changes (e.g., after successful update)
  useEffect(() => {
    setFormData({
      name: currentUser.name,
      gender: currentUser.gender || '',
      phone: currentUser.phone || '',
      profile_photo: currentUser.profile_photo || null
    });
    setPreviewImage(currentUser.profile_photo || null);
  }, [currentUser]);

  const getInitials = (name: string) => {
    if (!name) return '';
    const names = name.split(' ');
    return names.map((n) => n[0]).join('').toUpperCase();
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 2MB.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewImage(result);
      setFormData(prev => ({ ...prev, profile_photo: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPreviewImage(null);
    setFormData(prev => ({ ...prev, profile_photo: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Use context's updateProfile method if available, otherwise fall back to direct API call
      if (userProfileContext?.updateProfile) {
        await userProfileContext.updateProfile({
          name: formData.name,
          gender: formData.gender || null,
          phone: formData.phone || null,
          profile_photo: formData.profile_photo,
        });
      } else {
        // Fallback to direct API call
        const response = await fetch('/api/user-profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            gender: formData.gender || null,
            phone: formData.phone || null,
            profile_photo: formData.profile_photo,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update profile');
        }

        onUserUpdate(); // Trigger refetch only for fallback
      }
      
      setIsEditing(false);
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update profile.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: currentUser.name,
      gender: currentUser.gender || '',
      phone: currentUser.phone || '',
      profile_photo: currentUser.profile_photo || null
    });
    setPreviewImage(currentUser.profile_photo || null);
    setIsEditing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl">Personal Information</CardTitle>
          <CardDescription>View and manage your profile details.</CardDescription>
        </div>
        {!isEditing && (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Photo Section */}
        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={previewImage || undefined} alt={currentUser.name} />
              <AvatarFallback className="text-2xl">{getInitials(currentUser.name)}</AvatarFallback>
            </Avatar>
            {isEditing && (
              <Button
                size="sm"
                className="absolute -bottom-2 -right-2 rounded-full h-8 w-8 p-0"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-semibold">{currentUser.name}</h2>
            <p className="text-muted-foreground">{currentUser.email}</p>
            {isEditing && (
              <div className="mt-2 space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Photo
                </Button>
                {previewImage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRemovePhoto}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Editable Fields */}
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={isEditing ? formData.name : currentUser.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              disabled={!isEditing}
              className={isEditing ? '' : 'cursor-default'}
            />
          </div>
          
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={isEditing ? formData.phone : (currentUser.phone || 'Not provided')}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              disabled={!isEditing}
              placeholder="Enter phone number"
              className={isEditing ? '' : 'cursor-default'}
            />
          </div>

          <div>
            <Label htmlFor="gender">Gender</Label>
            <Input
              id="gender"
              value={isEditing ? formData.gender : (currentUser.gender || 'Not provided')}
              onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
              disabled={!isEditing}
              placeholder="Enter gender"
              className={isEditing ? '' : 'cursor-default'}
            />
          </div>

          {/* Read-only Fields */}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={currentUser.email} disabled className="cursor-default" />
          </div>
          
          <div>
            <Label htmlFor="role">Role</Label>
            <Input id="role" value={currentUser.role || 'N/A'} disabled className="cursor-default" />
          </div>
          
          <div>
            <Label htmlFor="department">Department</Label>
            <Input id="department" value={currentUser.department || 'N/A'} disabled className="cursor-default" />
          </div>
          
          <div>
            <Label htmlFor="staffId">Staff ID</Label>
            <Input id="staffId" value={currentUser.staff_id || 'N/A'} disabled className="cursor-default" />
          </div>
          
          <div>
            <Label htmlFor="status">Status</Label>
            <Input id="status" value={currentUser.status || 'N/A'} disabled className="cursor-default" />
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}