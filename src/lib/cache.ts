// Simple In-Memory Cache for High-Performance Operations
// =====================================================
// This provides fast caching for frequently accessed data to reduce database load

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Set a cache entry with TTL (time to live) in seconds
   */
  set<T>(key: string, data: T, ttl: number = 300): void {
    const expiry = Date.now() + (ttl * 1000);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry
    });
  }

  /**
   * Get a cache entry, returns null if expired or not found
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cache cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Destroy the cache and cleanup interval
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Create a singleton cache instance
export const cache = new MemoryCache();

/**
 * Cache wrapper for functions - automatically caches function results
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  // Try to get from cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    console.log(`Cache HIT: ${key}`);
    return cached;
  }

  // Cache miss - execute function and cache result
  console.log(`Cache MISS: ${key}`);
  const result = await fn();
  cache.set(key, result, ttl);
  return result;
}

/**
 * Generate cache key for user-specific data
 */
export function userCacheKey(userId: string, type: string, ...params: string[]): string {
  return `user:${userId}:${type}:${params.join(':')}`;
}

/**
 * Generate cache key for global data
 */
export function globalCacheKey(type: string, ...params: string[]): string {
  return `global:${type}:${params.join(':')}`;
}

/**
 * Clear all user-specific cache entries
 */
export function clearUserCache(userId: string): void {
  const stats = cache.getStats();
  const userPrefix = `user:${userId}:`;
  
  let clearedCount = 0;
  for (const key of stats.keys) {
    if (key.startsWith(userPrefix)) {
      cache.delete(key);
      clearedCount++;
    }
  }
  
  console.log(`Cleared ${clearedCount} cache entries for user ${userId}`);
}

/**
 * Clear cache entries by pattern
 */
export function clearCachePattern(pattern: string): void {
  const stats = cache.getStats();
  let clearedCount = 0;
  
  for (const key of stats.keys) {
    if (key.includes(pattern)) {
      cache.delete(key);
      clearedCount++;
    }
  }
  
  console.log(`Cleared ${clearedCount} cache entries matching pattern: ${pattern}`);
}

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  USER_SESSION: 300,        // 5 minutes - user session data
  DASHBOARD_STATS: 600,     // 10 minutes - dashboard statistics
  USER_PERMISSIONS: 1800,   // 30 minutes - user permissions
  NOTIFICATION_COUNT: 60,   // 1 minute - notification counts
  DROPDOWN_DATA: 3600,      // 1 hour - dropdown options, roles, etc.
  USER_REQUESTS: 300,       // 5 minutes - user's own requests
  APPROVAL_QUEUE: 120,      // 2 minutes - approval queue data
} as const;

export default cache;