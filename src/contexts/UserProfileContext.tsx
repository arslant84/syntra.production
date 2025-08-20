'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useUserProfile, UserProfile } from '@/hooks/use-user-profile';

interface UserProfileContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserProfile, 'name' | 'gender' | 'phone' | 'profile_photo'>>) => Promise<UserProfile>;
}

const UserProfileContext = createContext<UserProfileContextType | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const userProfileData = useUserProfile();

  return (
    <UserProfileContext.Provider value={userProfileData}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfileContext() {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfileContext must be used within a UserProfileProvider');
  }
  return context;
}

// Export a hook that's safe to use anywhere (returns null if not in provider)
export function useOptionalUserProfile() {
  return useContext(UserProfileContext);
}