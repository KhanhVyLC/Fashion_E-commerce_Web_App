// src/hooks/useRecommendations.js
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from '../utils/axios'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const useRecommendations = (options = {}) => {
  const {
    userId,
    productId,
    type = 'mixed',
    autoRefresh = false,
    refreshInterval = 300000, // 5 minutes
    enableTracking = true
  } = options;

  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  
  const abortControllerRef = useRef(null);
  const refreshIntervalRef = useRef(null);
  const trackingQueueRef = useRef([]);
  const isTrackingRef = useRef(false);

  // Get auth headers
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Fetch recommendations
  const fetchRecommendations = useCallback(async (forceRefresh = false) => {
    if (loading && !forceRefresh) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      let url = `${API_BASE_URL}/api/recommendations`;
      const params = new URLSearchParams();

      if (productId) {
        url = `${url}/product/${productId}`;
      } else {
        params.append('type', type);
        if (forceRefresh) {
          params.append('_t', Date.now().toString());
        }
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await axios.get(url, {
        headers: getAuthHeaders(),
        signal: abortControllerRef.current.signal,
        timeout: 10000
      });

      const data = productId ? response.data.similar || [] : response.data || [];
      setRecommendations(data);

      // Track successful load
      if (enableTracking && data.length > 0) {
        trackInteraction('recommendation_load', '', 0, {
          type,
          count: data.length,
          hasProductId: !!productId
        });
      }

    } catch (error) {
      if (!axios.isCancel(error)) {
        console.error('Error fetching recommendations:', error);
        setError(error.response?.data?.message || 'Không thể tải đề xuất');
      }
    } finally {
      setLoading(false);
    }
  }, [type, productId, loading, getAuthHeaders, enableTracking]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await axios.get(`${API_BASE_URL}/api/recommendations/stats`, {
        headers: getAuthHeaders(),
        timeout: 5000
      });
      setStats(response.data);
    } catch (error) {
      console.warn('Failed to fetch recommendation stats:', error);
    }
  }, [userId, getAuthHeaders]);

  // Track interaction (with queue for performance)
  const trackInteraction = useCallback(async (action, productId = '', duration = 0, metadata = {}) => {
    if (!enableTracking || !userId) return;

    // Add to queue
    trackingQueueRef.current.push({
      action,
      productId,
      duration,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        source: 'hook'
      }
    });

    // Process queue if not already processing
    if (!isTrackingRef.current) {
      processTrackingQueue();
    }
  }, [enableTracking, userId]);

  // Process tracking queue
  const processTrackingQueue = useCallback(async () => {
    if (isTrackingRef.current || trackingQueueRef.current.length === 0) return;

    isTrackingRef.current = true;

    try {
      const queue = [...trackingQueueRef.current];
      trackingQueueRef.current = [];

      // Send all tracking events in batch
      await Promise.allSettled(
        queue.map(event =>
          axios.post(
            `${API_BASE_URL}/api/recommendations/track`,
            event,
            {
              headers: getAuthHeaders(),
              timeout: 3000
            }
          )
        )
      );
    } catch (error) {
      console.warn('Failed to process tracking queue:', error);
    } finally {
      isTrackingRef.current = false;

      // Process remaining items if any
      if (trackingQueueRef.current.length > 0) {
        setTimeout(processTrackingQueue, 1000);
      }
    }
  }, [getAuthHeaders]);

  // Track product view with duration
  const trackProductView = useCallback((productId, duration) => {
    trackInteraction('view', productId, duration, {
      source: 'recommendation_hook'
    });
  }, [trackInteraction]);

  // Track product click
  const trackProductClick = useCallback((productId, position, metadata = {}) => {
    trackInteraction('click', productId, 0, {
      position,
      ...metadata,
      source: 'recommendation_hook'
    });
  }, [trackInteraction]);

  // Track add to cart
  const trackAddToCart = useCallback((productId, metadata = {}) => {
    trackInteraction('addToCart', productId, 0, {
      ...metadata,
      source: 'recommendation_hook'
    });
  }, [trackInteraction]);

  // Track search
  const trackSearch = useCallback((query, resultsCount = 0, metadata = {}) => {
    trackInteraction('search', '', 0, {
      query,
      resultsCount,
      ...metadata,
      source: 'recommendation_hook'
    });
  }, [trackInteraction]);

  // Refresh recommendations
  const refresh = useCallback(() => {
    fetchRecommendations(true);
  }, [fetchRecommendations]);

  // Reset user data (GDPR)
  const resetUserData = useCallback(async () => {
    try {
      await axios.delete(`${API_BASE_URL}/api/recommendations/reset`, {
        headers: getAuthHeaders()
      });
      
      // Clear local state
      setRecommendations([]);
      setStats(null);
      
      return { success: true };
    } catch (error) {
      console.error('Failed to reset user data:', error);
      return { success: false, error: error.message };
    }
  }, [getAuthHeaders]);

  // Setup auto refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        fetchRecommendations(true);
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, fetchRecommendations]);

  // Initial load
  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Load stats when userId changes
  useEffect(() => {
    if (userId) {
      fetchStats();
    }
  }, [userId, fetchStats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      // Process remaining tracking events
      if (trackingQueueRef.current.length > 0) {
        processTrackingQueue();
      }
    };
  }, [processTrackingQueue]);

  return {
    // Data
    recommendations,
    stats,
    loading,
    error,
    
    // Actions
    refresh,
    fetchStats,
    resetUserData,
    
    // Tracking
    trackProductView,
    trackProductClick,
    trackAddToCart,
    trackSearch,
    trackInteraction,
    
    // Utils
    hasData: recommendations.length > 0,
    isEmpty: !loading && recommendations.length === 0,
    isPersonalized: stats?.recommendationQuality?.personalizedAvailable || false
  };
};

// Hook for product-specific recommendations
export const useProductRecommendations = (productId, options = {}) => {
  return useRecommendations({
    ...options,
    productId,
    type: 'similar'
  });
};

// Hook for user recommendations with specific type
export const useUserRecommendations = (userId, type = 'mixed', options = {}) => {
  return useRecommendations({
    ...options,
    userId,
    type
  });
};

// Hook for tracking only (lightweight)
export const useRecommendationTracking = (userId) => {
  const trackingQueueRef = useRef([]);
  const isTrackingRef = useRef(false);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const processTrackingQueue = useCallback(async () => {
    if (isTrackingRef.current || trackingQueueRef.current.length === 0) return;

    isTrackingRef.current = true;

    try {
      const queue = [...trackingQueueRef.current];
      trackingQueueRef.current = [];

      await Promise.allSettled(
        queue.map(event =>
          axios.post(`${API_BASE_URL}/api/recommendations/track`, event, {
            headers: getAuthHeaders(),
            timeout: 3000
          })
        )
      );
    } catch (error) {
      console.warn('Failed to process tracking queue:', error);
    } finally {
      isTrackingRef.current = false;
    }
  }, [getAuthHeaders]);

  const track = useCallback((action, productId = '', duration = 0, metadata = {}) => {
    if (!userId) return;

    trackingQueueRef.current.push({
      action,
      productId,
      duration,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        source: 'tracking_hook'
      }
    });

    if (!isTrackingRef.current) {
      processTrackingQueue();
    }
  }, [userId, processTrackingQueue]);

  useEffect(() => {
    return () => {
      if (trackingQueueRef.current.length > 0) {
        processTrackingQueue();
      }
    };
  }, [processTrackingQueue]);

  return { track };
};