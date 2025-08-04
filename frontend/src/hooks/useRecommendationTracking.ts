// src/hooks/useRecommendationTracking.ts
import { useEffect, useRef, useCallback } from 'react';
import axios from '../utils/axios';
import { useAuth } from '../context/AuthContext';

interface TrackingOptions {
  minDuration?: number; // Minimum duration in seconds to track
  source?: string; // Source of the view (e.g., 'recommendation', 'search', 'direct')
  metadata?: Record<string, any>; // Additional metadata
}

export const useRecommendationTracking = (
  productId: string | undefined,
  options: TrackingOptions = {}
) => {
  const { user } = useAuth();
  const startTimeRef = useRef<number>(Date.now());
  const trackingRef = useRef<AbortController | null>(null);
  const hasTrackedRef = useRef(false);
  
  const { 
    minDuration = 3, // Default 3 seconds
    source = 'direct',
    metadata = {}
  } = options;

  // Track view function
  const trackView = useCallback(async (duration: number) => {
    if (!user || !productId || hasTrackedRef.current || duration < minDuration) {
      return;
    }

    // Cancel any pending request
    if (trackingRef.current) {
      trackingRef.current.abort();
    }

    trackingRef.current = new AbortController();
    hasTrackedRef.current = true;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.post(
        '/recommendations/track',
        {
          action: 'view',
          productId,
          duration,
          metadata: {
            ...metadata,
            source,
            timestamp: Date.now()
          }
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: trackingRef.current.signal,
          timeout: 5000
        }
      );
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error tracking view:', error);
      }
    }
  }, [user, productId, minDuration, source, metadata]);

  // Effect to handle tracking
  useEffect(() => {
    if (!user || !productId) return;

    // Reset tracking state when product changes
    startTimeRef.current = Date.now();
    hasTrackedRef.current = false;

    // Track on visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
        trackView(duration);
      } else {
        // Reset start time when page becomes visible again
        if (!hasTrackedRef.current) {
          startTimeRef.current = Date.now();
        }
      }
    };

    // Track on page unload
    const handleBeforeUnload = () => {
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (duration >= minDuration && !hasTrackedRef.current) {
        // Use sendBeacon for reliable tracking on unload
        const token = localStorage.getItem('token');
        if (token) {
          const data = JSON.stringify({
            action: 'view',
            productId,
            duration,
            metadata: { ...metadata, source, timestamp: Date.now() }
          });
          
          navigator.sendBeacon(
            `${axios.defaults.baseURL}/recommendations/track`,
            new Blob([data], { type: 'application/json' })
          );
          hasTrackedRef.current = true;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Track view duration when component unmounts
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      trackView(duration);

      // Cancel any pending requests
      if (trackingRef.current) {
        trackingRef.current.abort();
      }
    };
  }, [productId, user, trackView, minDuration, metadata, source]);

  // Manual track function for other actions
  const trackAction = useCallback(async (
    action: string,
    actionMetadata: Record<string, any> = {}
  ) => {
    if (!user || !productId) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.post(
        '/recommendations/track',
        {
          action,
          productId,
          duration: 0,
          metadata: {
            ...metadata,
            ...actionMetadata,
            source,
            timestamp: Date.now()
          }
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        }
      );
    } catch (error) {
      console.error(`Error tracking ${action}:`, error);
    }
  }, [user, productId, metadata, source]);

  return {
    trackAction,
    // Expose these for manual control if needed
    startTracking: () => {
      startTimeRef.current = Date.now();
      hasTrackedRef.current = false;
    },
    stopTracking: () => {
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      trackView(duration);
    }
  };
};

// Simplified hook for component-level tracking
export const useProductViewTracking = (productId: string | undefined) => {
  return useRecommendationTracking(productId, {
    minDuration: 2,
    source: 'product_detail'
  });
};