'use client';

import React from 'react';
import { User as UserIcon } from "lucide-react";
import ProfileForm from '@/components/profile/ProfileForm';
import { useUserProfileContext } from '@/contexts/UserProfileContext';

export default function ProfilePage() {
  const { user, loading, error, refetch } = useUserProfileContext();

  const handleUserUpdate = () => {
    refetch(); // Refresh user data after update - this will update all components using the context
  };

  if (loading) {
    return (
      <div className="w-full px-2 md:px-6 py-8 space-y-8">
        <div className="flex items-center space-x-4">
          <UserIcon className="w-10 h-10 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">User Profile</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="w-full px-2 md:px-6 py-8 space-y-8">
        <div className="flex items-center space-x-4">
          <UserIcon className="w-10 h-10 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">User Profile</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-red-600">{error || 'Failed to load profile'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-2 md:px-6 py-8 space-y-8">
      <div className="flex items-center space-x-4">
        <UserIcon className="w-10 h-10 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">User Profile</h1>
      </div>
      <ProfileForm user={user} onUserUpdate={handleUserUpdate} />
    </div>
  );
}
