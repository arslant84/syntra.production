"use client";

import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/toaster";
import { UserProfileProvider } from "@/contexts/UserProfileContext";

interface AppProvidersProps {
  children: React.ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <SessionProvider>
      {isLoginPage ? (
        // Don't wrap login page with UserProfileProvider to avoid unnecessary API calls
        <>
          {children}
          <Toaster />
        </>
      ) : (
        // Wrap other pages with UserProfileProvider
        <UserProfileProvider>
          {children}
          <Toaster />
        </UserProfileProvider>
      )}
    </SessionProvider>
  );
}
