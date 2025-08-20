'use client';

import { useState, useEffect } from 'react';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: string;
  department?: string;
  staff_id?: string;
  gender?: string;
  phone?: string;
  profile_photo?: string;
  status?: string;
}

export function useUserProfile() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/user-profile');
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      
      const data = await response.json();
      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfile = async (updates: Partial<Pick<UserProfile, 'name' | 'gender' | 'phone' | 'profile_photo'>>) => {
    try {
      const response = await fetch('/api/user-profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const { user: updatedUser } = await response.json();
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  return {
    user,
    loading,
    error,
    refetch: fetchUserProfile,
    updateProfile: updateUserProfile,
  };
}