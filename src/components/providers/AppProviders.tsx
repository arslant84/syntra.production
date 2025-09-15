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
      {/* Temporarily disable UserProfileProvider everywhere to stop API calls */}
      {children}
      <Toaster />
    </SessionProvider>
  );
}
