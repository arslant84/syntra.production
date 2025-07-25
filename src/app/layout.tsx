
import React from 'react';
import type { Metadata } from 'next';
// Temporarily removed font imports to avoid SWC requirement
// import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import AppProviders from '@/components/providers/AppProviders'; // Import the new wrapper
import { Toaster } from "@/components/ui/toaster";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

// Temporarily commented out font configurations
// const geistSans = Geist({
//   variable: '--font-geist-sans',
//   subsets: ['latin'],
// });

// const geistMono = Geist_Mono({
//   variable: '--font-geist-mono',
//   subsets: ['latin'],
// });

export const metadata: Metadata = {
  title: 'Synchronised Travel',
  description: 'PC(T)SB - Synchronised Travel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ backgroundImage: "url('/background.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', minHeight: '100vh' }}>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
