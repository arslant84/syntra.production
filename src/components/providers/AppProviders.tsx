"use client";

import React from 'react';
// import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"; // Removed
import AppLayout from '@/components/layout/AppLayout';

interface AppProvidersProps {
  children: React.ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    // <NextAuthSessionProvider> // Removed
      <AppLayout>{children}</AppLayout>
    // </NextAuthSessionProvider> // Removed
  );
}
