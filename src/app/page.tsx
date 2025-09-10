"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from "@/components/ui/icons";

// Dynamic import with no SSR to completely eliminate hydration mismatches
const HomePageContent = dynamic(() => import('@/components/HomePage'), {
  ssr: false,
  loading: () => (
    <div className="space-y-8">
      <div className="text-center py-8 md:py-12">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-800 dark:text-white">
          Welcome to <span className="text-primary">SynTra</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mt-4">
          Travel is Synchronised
        </p>
      </div>
      <div className="flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  )
});

export default function HomePage() {
  return <HomePageContent />;
}