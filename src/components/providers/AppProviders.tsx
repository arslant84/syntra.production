"use client";

import { SessionProvider } from "next-auth/react";

interface AppProvidersProps {
  children: React.ReactNode;
}

export default function AppProviders({ children }: AppProvidersProps) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
