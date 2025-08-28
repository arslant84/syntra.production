/**
 * Request Deduplication Utility
 * 
 * Prevents duplicate submissions by implementing:
 * 1. In-memory request tracking with TTL
 * 2. Request fingerprinting based on content and user
 * 3. Database-level duplicate checking for critical operations
 */

import { createHash } from 'crypto';

interface PendingRequest {
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

// In-memory store for tracking pending requests
const pendingRequests = new Map<string, PendingRequest>();

// Default TTL: 30 seconds
const DEFAULT_TTL = 30 * 1000;

/**
 * Generate a unique fingerprint for a request
 */
export function generateRequestFingerprint(
  userId: string,
  operation: string,
  data: any,
  additionalKeys?: string[]
): string {
  // Create a consistent string representation of the request
  const requestData = {
    userId,
    operation,
    data: typeof data === 'object' ? JSON.stringify(data, Object.keys(data).sort()) : data,
    timestamp: Math.floor(Date.now() / 1000), // Round to nearest second
    ...additionalKeys?.reduce((acc, key) => ({ ...acc, [key]: key }), {})
  };
  
  const requestString = JSON.stringify(requestData);
  return createHash('sha256').update(requestString).digest('hex');
}

/**
 * Check if a request is a duplicate and mark it as pending
 */
export function checkAndMarkRequest(fingerprint: string, ttl: number = DEFAULT_TTL): {
  isDuplicate: boolean;
  timeRemaining?: number;
} {
  const now = Date.now();
  
  // Clean up expired requests
  cleanExpiredRequests();
  
  const existingRequest = pendingRequests.get(fingerprint);
  
  if (existingRequest) {
    const timeRemaining = (existingRequest.timestamp + existingRequest.ttl) - now;
    if (timeRemaining > 0) {
      return {
        isDuplicate: true,
        timeRemaining: Math.ceil(timeRemaining / 1000) // Return in seconds
      };
    }
  }
  
  // Mark request as pending
  pendingRequests.set(fingerprint, {
    timestamp: now,
    ttl
  });
  
  return { isDuplicate: false };
}

/**
 * Mark a request as completed (remove from pending)
 */
export function markRequestCompleted(fingerprint: string): void {
  pendingRequests.delete(fingerprint);
}

/**
 * Clean up expired requests from memory
 */
function cleanExpiredRequests(): void {
  const now = Date.now();
  for (const [fingerprint, request] of pendingRequests.entries()) {
    if (now > request.timestamp + request.ttl) {
      pendingRequests.delete(fingerprint);
    }
  }
}

/**
 * Get current pending requests count (for monitoring)
 */
export function getPendingRequestsCount(): number {
  cleanExpiredRequests();
  return pendingRequests.size;
}

/**
 * Middleware-style function for request deduplication
 */
export function withDeduplication<T extends any[], R>(
  operation: string,
  fn: (...args: T) => Promise<R>,
  options: {
    generateFingerprint: (...args: T) => string;
    ttl?: number;
    onDuplicate?: (timeRemaining: number) => R;
  }
) {
  return async (...args: T): Promise<R> => {
    const fingerprint = options.generateFingerprint(...args);
    const result = checkAndMarkRequest(fingerprint, options.ttl);
    
    if (result.isDuplicate) {
      if (options.onDuplicate) {
        return options.onDuplicate(result.timeRemaining || 0);
      }
      throw new Error(`Duplicate request detected. Please wait ${result.timeRemaining} seconds before trying again.`);
    }
    
    try {
      const response = await fn(...args);
      markRequestCompleted(fingerprint);
      return response;
    } catch (error) {
      markRequestCompleted(fingerprint);
      throw error;
    }
  };
}

/**
 * Database-level duplicate check for TRF submissions
 */
export async function checkForDuplicateTRF(
  userId: string,
  travelType: string,
  purpose: string,
  department: string,
  timeWindowMinutes: number = 5
): Promise<boolean> {
  const { sql } = await import('@/lib/db');
  
  const timeAgo = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  
  try {
    const duplicates = await sql`
      SELECT id FROM travel_requests 
      WHERE staff_id = ${userId}
        AND travel_type = ${travelType}
        AND purpose = ${purpose}
        AND department = ${department}
        AND submitted_at > ${timeAgo.toISOString()}
      LIMIT 1
    `;
    
    return duplicates.length > 0;
  } catch (error) {
    console.error('Error checking for duplicate TRF:', error);
    return false; // Fail open - allow submission if check fails
  }
}

/**
 * Database-level duplicate check for claim submissions
 */
export async function checkForDuplicateClaim(
  userId: string,
  documentType: string,
  purposeOfClaim: string,
  totalAmount: number,
  timeWindowMinutes: number = 5
): Promise<boolean> {
  const { sql } = await import('@/lib/db');
  
  const timeAgo = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
  
  try {
    const duplicates = await sql`
      SELECT id FROM expense_claims 
      WHERE staff_no = ${userId}
        AND document_type = ${documentType}
        AND purpose_of_claim = ${purposeOfClaim}
        AND total_advance_claim_amount = ${totalAmount}
        AND submitted_at > ${timeAgo.toISOString()}
      LIMIT 1
    `;
    
    return duplicates.length > 0;
  } catch (error) {
    console.error('Error checking for duplicate claim:', error);
    return false; // Fail open
  }
}

/**
 * Periodic cleanup function (call this from a cron job or similar)
 */
export function performMaintenanceCleanup(): void {
  cleanExpiredRequests();
  console.log(`Request deduplication cleanup completed. Pending requests: ${pendingRequests.size}`);
}

// Export the pending requests map for testing/monitoring
export { pendingRequests };