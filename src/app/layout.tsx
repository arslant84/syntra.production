
import type { Metadata } from 'next';
// Temporarily removed font imports to avoid SWC requirement
// import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import AppProviders from '@/components/providers/AppProviders'; // Import the new wrapper
import { Toaster } from "@/components/ui/toaster";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
        <Toaster />
      </body>
    </html>
  );
}
