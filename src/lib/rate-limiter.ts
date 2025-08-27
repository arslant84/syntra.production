// Rate Limiter for API Protection
// ===============================
// Protects against abuse and ensures fair resource usage

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  /**
   * Check if a request should be allowed based on rate limiting rules
   */
  checkLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number = 60
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const resetTime = now + windowMs;

    const entry = this.limits.get(identifier);

    if (!entry || now >= entry.resetTime) {
      // First request or window has reset
      this.limits.set(identifier, {
        count: 1,
        resetTime
      });
      
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime
      };
    }

    if (entry.count >= maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }

    // Increment counter
    entry.count++;
    this.limits.set(identifier, entry);

    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetTime) {
        this.limits.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Rate limiter cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Get current stats
   */
  getStats(): { totalEntries: number; entries: Array<{key: string; count: number; resetTime: number}> } {
    return {
      totalEntries: this.limits.size,
      entries: Array.from(this.limits.entries()).map(([key, entry]) => ({
        key,
        count: entry.count,
        resetTime: entry.resetTime
      }))
    };
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.limits.clear();
  }

  /**
   * Destroy the rate limiter and cleanup interval
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.limits.clear();
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

/**
 * Rate limiting configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Authentication endpoints - stricter limits
  AUTH: { requests: 5, window: 60 },        // 5 requests per minute for login/auth
  
  // API endpoints - moderate limits
  API_READ: { requests: 100, window: 60 },   // 100 reads per minute per user
  API_WRITE: { requests: 30, window: 60 },   // 30 writes per minute per user
  
  // Dashboard/summary endpoints - more generous
  DASHBOARD: { requests: 50, window: 60 },   // 50 requests per minute for dashboard
  
  // File uploads - very strict
  UPLOAD: { requests: 10, window: 300 },     // 10 uploads per 5 minutes
  
  // Notification endpoints
  NOTIFICATIONS: { requests: 200, window: 60 }, // 200 notifications per minute
  
  // Search endpoints
  SEARCH: { requests: 50, window: 60 },      // 50 searches per minute
} as const;

/**
 * Apply rate limiting to an API endpoint
 */
export function rateLimit(
  identifier: string,
  config: { requests: number; window: number }
): { allowed: boolean; remaining: number; resetTime: number } {
  return rateLimiter.checkLimit(identifier, config.requests, config.window);
}

/**
 * Generate rate limit identifier from request
 */
export function getRateLimitIdentifier(
  request: { headers: any },
  userId?: string
): string {
  // Prefer user ID if available, fallback to IP
  if (userId) {
    return `user:${userId}`;
  }

  // Try to get IP from various headers
  const forwardedFor = request.headers['x-forwarded-for'];
  const realIP = request.headers['x-real-ip'];
  const remoteAddr = request.headers['x-remote-addr'];
  
  const ip = forwardedFor || realIP || remoteAddr || 'unknown';
  return `ip:${Array.isArray(ip) ? ip[0] : ip}`;
}

/**
 * Middleware function for Next.js API routes
 */
export function withRateLimit(
  config: { requests: number; window: number },
  getIdentifier?: (request: any) => string
) {
  return function (handler: Function) {
    return async (request: any, ...args: any[]) => {
      const identifier = getIdentifier 
        ? getIdentifier(request)
        : getRateLimitIdentifier(request, request.user?.id);

      const result = rateLimit(identifier, config);

      if (!result.allowed) {
        const resetDate = new Date(result.resetTime).toISOString();
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many requests. Try again after ${resetDate}`,
            resetTime: result.resetTime
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': config.requests.toString(),
              'X-RateLimit-Remaining': result.remaining.toString(),
              'X-RateLimit-Reset': result.resetTime.toString(),
              'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString()
            }
          }
        );
      }

      // Add rate limit headers to successful responses
      const response = await handler(request, ...args);
      
      if (response && typeof response.headers?.set === 'function') {
        response.headers.set('X-RateLimit-Limit', config.requests.toString());
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
      }

      return response;
    };
  };
}

/**
 * Get rate limiter statistics
 */
export function getRateLimiterStats() {
  return rateLimiter.getStats();
}

/**
 * Clear all rate limiting data
 */
export function clearRateLimits() {
  rateLimiter.clear();
}

export default rateLimiter;