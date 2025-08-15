// Performance Monitoring Utilities
// Track and analyze application performance improvements

export interface PerformanceMetrics {
  loadTime: number;
  apiResponseTime: number;
  renderTime: number;
  bundleSize?: number;
  timestamp: Date;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Track page load performance
  trackPageLoad(pageName: string): void {
    if (typeof window === 'undefined') return;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const loadTime = navigation.loadEventEnd - navigation.fetchStart;
    
    const metric: PerformanceMetrics = {
      loadTime,
      apiResponseTime: 0, // Will be set by API calls
      renderTime: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      timestamp: new Date()
    };

    this.metrics.push(metric);
    
    // Log performance for development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚀 Performance Metrics for ${pageName}`);
      console.log(`📊 Total Load Time: ${Math.round(loadTime)}ms`);
      console.log(`⚡ Render Time: ${Math.round(metric.renderTime)}ms`);
      console.log(`🎯 FCP: ${this.getFCP()}ms`);
      console.log(`🎯 LCP: ${this.getLCP()}ms`);
      console.groupEnd();
    }
  }

  // Track API response times
  trackAPICall(endpoint: string, startTime: number, endTime: number): void {
    const responseTime = endTime - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      const emoji = responseTime < 200 ? '🟢' : responseTime < 500 ? '🟡' : '🔴';
      console.log(`${emoji} API ${endpoint}: ${Math.round(responseTime)}ms`);
    }

    // Store for analysis
    this.updateLatestMetric('apiResponseTime', responseTime);
  }

  // Wrapper for fetch with performance tracking
  async trackFetch(url: string, options?: RequestInit): Promise<Response> {
    const startTime = performance.now();
    
    try {
      const response = await fetch(url, options);
      const endTime = performance.now();
      
      this.trackAPICall(url, startTime, endTime);
      return response;
    } catch (error) {
      const endTime = performance.now();
      this.trackAPICall(`${url} (ERROR)`, startTime, endTime);
      throw error;
    }
  }

  // Get Core Web Vitals
  private getFCP(): number {
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
    return fcpEntry ? Math.round(fcpEntry.startTime) : 0;
  }

  private getLCP(): number {
    // This would need to be implemented with the web-vitals library
    // For now, return 0 as placeholder
    return 0;
  }

  private updateLatestMetric(key: keyof PerformanceMetrics, value: number): void {
    if (this.metrics.length > 0) {
      const latest = this.metrics[this.metrics.length - 1];
      (latest as any)[key] = value;
    }
  }

  // Get performance summary
  getPerformanceSummary(): {
    avgLoadTime: number;
    avgApiResponse: number;
    avgRenderTime: number;
    totalMeasurements: number;
  } {
    if (this.metrics.length === 0) {
      return {
        avgLoadTime: 0,
        avgApiResponse: 0,
        avgRenderTime: 0,
        totalMeasurements: 0
      };
    }

    const totals = this.metrics.reduce((acc, metric) => ({
      loadTime: acc.loadTime + metric.loadTime,
      apiResponseTime: acc.apiResponseTime + metric.apiResponseTime,
      renderTime: acc.renderTime + metric.renderTime
    }), { loadTime: 0, apiResponseTime: 0, renderTime: 0 });

    const count = this.metrics.length;

    return {
      avgLoadTime: Math.round(totals.loadTime / count),
      avgApiResponse: Math.round(totals.apiResponseTime / count),
      avgRenderTime: Math.round(totals.renderTime / count),
      totalMeasurements: count
    };
  }

  // Export metrics for analysis
  exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }
}

// React hook for easy performance tracking
import { useEffect, useRef } from 'react';

export function usePerformanceTracking(pageName: string) {
  const monitor = useRef(PerformanceMonitor.getInstance());
  
  useEffect(() => {
    // Track page load performance
    monitor.current.trackPageLoad(pageName);
    
    // Cleanup function to log summary on unmount
    return () => {
      if (process.env.NODE_ENV === 'development') {
        const summary = monitor.current.getPerformanceSummary();
        console.log(`📈 ${pageName} Performance Summary:`, summary);
      }
    };
  }, [pageName]);

  return {
    trackFetch: monitor.current.trackFetch.bind(monitor.current),
    getPerformanceSummary: monitor.current.getPerformanceSummary.bind(monitor.current)
  };
}

// Bundle size analyzer for webpack/next.js
export function analyzeBundleSize(): void {
  if (typeof window === 'undefined') return;

  // This would integrate with webpack-bundle-analyzer
  console.log('💡 Bundle analysis: Add @next/bundle-analyzer for detailed analysis');
}

// Performance budget checker
export const PERFORMANCE_BUDGETS = {
  MAX_LOAD_TIME: 3000, // 3 seconds
  MAX_API_RESPONSE: 500, // 500ms
  MAX_RENDER_TIME: 100, // 100ms
  MAX_BUNDLE_SIZE: 1024 * 1024 // 1MB
} as const;

export function checkPerformanceBudget(metrics: PerformanceMetrics): {
  passed: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (metrics.loadTime > PERFORMANCE_BUDGETS.MAX_LOAD_TIME) {
    violations.push(`Load time ${Math.round(metrics.loadTime)}ms exceeds budget ${PERFORMANCE_BUDGETS.MAX_LOAD_TIME}ms`);
  }

  if (metrics.apiResponseTime > PERFORMANCE_BUDGETS.MAX_API_RESPONSE) {
    violations.push(`API response ${Math.round(metrics.apiResponseTime)}ms exceeds budget ${PERFORMANCE_BUDGETS.MAX_API_RESPONSE}ms`);
  }

  if (metrics.renderTime > PERFORMANCE_BUDGETS.MAX_RENDER_TIME) {
    violations.push(`Render time ${Math.round(metrics.renderTime)}ms exceeds budget ${PERFORMANCE_BUDGETS.MAX_RENDER_TIME}ms`);
  }

  return {
    passed: violations.length === 0,
    violations
  };
}