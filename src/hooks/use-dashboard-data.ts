import { useState, useCallback } from 'react';

// Types for dashboard data
export type SummaryData = {
  pendingTsrs: number;
  visaUpdates: number;
  draftClaims: number;
  pendingAccommodation: number;
  pendingTransport: number;
};

export type ActivityItem = {
  id: string;
  type: string;
  title: string;
  status: string;
  dateInfo: string;
  link: string;
  statusVariant: 'default' | 'outline';
  icon: string;
};

interface DashboardState {
  summary: SummaryData;
  activities: ActivityItem[];
  isLoading: boolean;
  error: string | null;
  lastFetched: Date | null;
}

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache
const STALE_TIME = 30 * 1000; // 30 seconds stale time

// In-memory cache for dashboard data
let dashboardCache: {
  data: { summary: SummaryData; activities: ActivityItem[] } | null;
  timestamp: number;
  promise: Promise<any> | null;
} = {
  data: null,
  timestamp: 0,
  promise: null
};

export function useDashboardData() {
  const [state] = useState<DashboardState>({
    summary: {
      pendingTsrs: 0,
      visaUpdates: 0,
      draftClaims: 0,
      pendingAccommodation: 0,
      pendingTransport: 0,
    },
    activities: [],
    isLoading: false,
    error: null,
    lastFetched: null
  });
  
  // Hook is disabled to prevent AbortError - all functionality moved to HomePage component
  // const abortControllerRef = useRef<AbortController | null>(null);
  // const mountedRef = useRef(true);

  const fetchDashboardData = useCallback(async (force = false) => {
    // Hook disabled - functionality moved to HomePage component to prevent AbortError
    console.log('useDashboardData hook is disabled - use HomePage implementation instead');
    return;
  }, []);

  // Refresh function disabled 
  const refresh = useCallback(() => {
    console.log('Refresh disabled in useDashboardData hook');
  }, []);

  // Check if data is stale - always return false since hook is disabled
  const isStale = useCallback(() => {
    return false;
  }, []);

  // No effects to prevent AbortError
  // useEffect(() => {
  //   // All functionality moved to HomePage component
  // }, []);

  return {
    summary: state.summary,
    activities: state.activities,
    isLoading: state.isLoading,
    error: state.error,
    lastFetched: state.lastFetched,
    refresh,
    isStale: isStale()
  };
}

// Function to clear cache (useful for logout or other state changes)
export function clearDashboardCache() {
  dashboardCache = {
    data: null,
    timestamp: 0,
    promise: null
  };
}