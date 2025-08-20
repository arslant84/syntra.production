/**
 * Safe toast hook that prevents duplicate notifications
 * Use this instead of useToast() to avoid double toast issues
 */

import { useToast } from '@/hooks/use-toast';
import { useRef, useCallback } from 'react';

interface ToastParams {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
}

export function useSafeToast() {
  const { toast } = useToast();
  const lastToastRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const safeToast = useCallback(({ title, description, variant = 'default' }: ToastParams) => {
    // Create a unique key for this toast
    const toastKey = `${title}:${description}:${variant}`;
    
    // If this exact toast was just shown, ignore the duplicate
    if (lastToastRef.current === toastKey) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Show the toast
    toast({ title, description, variant });
    
    // Remember this toast
    lastToastRef.current = toastKey;
    
    // Clear the memory after 1 second to allow legitimate duplicates
    timeoutRef.current = setTimeout(() => {
      lastToastRef.current = null;
    }, 1000);
  }, [toast]);

  return { toast: safeToast };
}