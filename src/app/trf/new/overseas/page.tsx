"use client";

import { Suspense } from 'react';
import OverseasFormContent from './OverseasFormContent';
import { Loader2 } from 'lucide-react';

export default function NewOverseasTSRPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="w-12 h-12 text-primary animate-spin mb-4" /><p className="text-muted-foreground">Loading form...</p></div>}>
      <OverseasFormContent />
    </Suspense>
  );
}