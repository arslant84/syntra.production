"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";
import { UserProfileProvider } from "@/contexts/UserProfileContext";

interface AppProvidersProps {
  children: React.ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <SessionProvider>
      <UserProfileProvider>
        {children}
        <Toaster />
      </UserProfileProvider>
    </SessionProvider>
  );
}
