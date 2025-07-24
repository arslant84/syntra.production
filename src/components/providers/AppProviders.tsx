"use client";

import React from 'react';
import { SessionProvider } from "next-auth/react";
import AppLayout from '@/components/layout/AppLayout';

interface AppProvidersProps {
  children: React.ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <SessionProvider>
      <AppLayout>{children}</AppLayout>
    </SessionProvider>
  );
}
