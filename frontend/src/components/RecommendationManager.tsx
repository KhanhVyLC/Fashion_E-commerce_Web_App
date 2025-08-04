// src/components/RecommendationManager.tsx - IMPROVED VERSION
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import RecommendationSection from './RecommendationSection';
import { 
  AdjustmentsHorizontalIcon, 
  EyeIcon, 
  ChartBarIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import axios from '../utils/axios';

interface RecommendationStats {
  totalViews: number;
  totalPurchases: number;
  favoriteCategories: Array<{
    _id: string;
    count: number;
    totalSpent: number;
  }>;
  recentActivity: {
    recentViews: any[];
    recentSearches: any[];
  };
  recommendationQuality: {
    personalizedAvailable: boolean;
    dataRichness: 'high' | 'medium' | 'low';
  };
}

interface RecommendationManagerProps {
  userId?: string;
  productId?: string;
  showControls?: boolean;
  onProductView?: (productId: string, duration: number) => void;
  sections?: Array<{
    type: 'mixed' | 'collaborative' | 'content' | 'trending' | 'new';
    title: string;
    enabled: boolean;
  }>;
}

const DEFAULT_SECTIONS = [
  { type: 'mixed' as const, title: 'Đề xuất cho bạn', enabled: true },
  { type: 'trending' as const, title: 'Đang thịnh hành', enabled: true },
  { type: 'new' as const, title: 'Sản phẩm mới', enabled: true },
  { type: 'collaborative' as const, title: 'Người khác cũng thích', enabled: false },
  { type: 'content' as const, title: 'Phù hợp với sở thích', enabled: false }
];

const RecommendationManager: React.FC<RecommendationManagerProps> = ({
  userId,
  productId,
  showControls = true,
  onProductView,
  sections = DEFAULT_SECTIONS
}) => {
  const location = useLocation();
  const [enabledSections, setEnabledSections] = useState(sections);
  const [stats, setStats] = useState<RecommendationStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [trackingData, setTrackingData] = useState(new Map());
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  
  // Track previous location to detect navigation
  const prevLocationRef = useRef(location.pathname);
  const isHomePageRef = useRef(location.pathname === '/' || location.pathname === '/home');

  // Detect page changes and refresh if not on home page
  useEffect(() => {
    const isHomePage = location.pathname === '/' || location.pathname === '/home';
    const wasHomePage = isHomePageRef.current;
    
    // If navigating away from home or to a different page (not home)
    if (prevLocationRef.current !== location.pathname) {
      if (!isHomePage || (wasHomePage && !isHomePage)) {
        // Refresh recommendations when navigating to non-home pages
        setRefreshTrigger(prev => prev + 1);
      }
    }
    
    prevLocationRef.current = location.pathname;
    isHomePageRef.current = isHomePage;
  }, [location.pathname]);

  // Fetch recommendation stats
  const fetchStats = useCallback(async () => {
    if (!userId || isLoadingStats) return;

    try {
      setIsLoadingStats(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get('/recommendations/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.warn('Failed to fetch recommendation stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, [userId, isLoadingStats]);

  // Load stats when showStats changes
  useEffect(() => {
    if (showStats && !stats) {
      fetchStats();
    }
  }, [showStats, stats, fetchStats]);

  // Handle section toggle
  const toggleSection = useCallback((type: string) => {
    setEnabledSections(prev => 
      prev.map(section => 
        section.type === type 
          ? { ...section, enabled: !section.enabled }
          : section
      )
    );
  }, []);

  // Handle product view tracking with debouncing
  const trackingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  const handleProductView = useCallback((productId: string, duration: number) => {
    // Clear any existing timeout for this product
    const existingTimeout = trackingTimeoutRef.current.get(productId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set a new timeout to batch updates
    const timeout = setTimeout(() => {
      setTrackingData(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(productId) || { views: 0, totalDuration: 0 };
        newMap.set(productId, {
          views: existing.views + 1,
          totalDuration: existing.totalDuration + duration,
          lastViewed: Date.now()
        });
        return newMap;
      });
      
      trackingTimeoutRef.current.delete(productId);
    }, 500); // Debounce for 500ms

    trackingTimeoutRef.current.set(productId, timeout);

    // Call parent callback if provided
    onProductView?.(productId, duration);
  }, [onProductView]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      trackingTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Refresh all recommendations
  const refreshAll = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Calculate recommendation quality score
  const qualityScore = useMemo(() => {
    if (!stats) return 0;
    
    let score = 0;
    if (stats.totalPurchases > 0) score += 40;
    if (stats.totalViews > 10) score += 30;
    if (stats.favoriteCategories.length > 0) score += 20;
    if (stats.recentActivity.recentViews.length > 0) score += 10;
    
    return Math.min(100, score);
  }, [stats]);

  // Get recommendation insights
  const getInsights = useMemo(() => {
    if (!stats) return [];
    
    const insights = [];
    
    if (stats.totalPurchases === 0) {
      insights.push({
        type: 'info',
        message: 'Mua sắm để nhận được đề xuất cá nhân hóa tốt hơn'
      });
    }
    
    if (stats.totalViews < 10) {
      insights.push({
        type: 'tip',
        message: 'Xem thêm sản phẩm để cải thiện độ chính xác đề xuất'
      });
    }
    
    if (stats.recommendationQuality.dataRichness === 'high') {
      insights.push({
        type: 'success',
        message: 'Dữ liệu phong phú - đề xuất sẽ rất chính xác!'
      });
    }
    
    return insights;
  }, [stats]);

  // Memoize enabled sections to prevent unnecessary re-renders
  const memoizedEnabledSections = useMemo(
    () => enabledSections.filter(section => section.enabled),
    [enabledSections]
  );

  return (
    <div className="space-y-6">
      {/* Controls Panel */}
      {showControls && (
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2" />
              Tùy chỉnh đề xuất
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowStats(!showStats)}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
              >
                <ChartBarIcon className="h-4 w-4" />
                <span>Thống kê</span>
              </button>
              <button
                onClick={refreshAll}
                className="flex items-center space-x-1 px-3 py-1 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4" />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {/* Section Toggles */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {enabledSections.map((section) => (
              <label
                key={section.type}
                className="flex items-center space-x-2 p-2 rounded border hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={() => toggleSection(section.type)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{section.title}</span>
              </label>
            ))}
          </div>

          {/* Quality Indicator */}
          {stats && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Chất lượng đề xuất
                </span>
                <span className="text-sm text-gray-600">{qualityScore}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    qualityScore >= 80 ? 'bg-green-500' :
                    qualityScore >= 60 ? 'bg-yellow-500' :
                    qualityScore >= 40 ? 'bg-orange-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${qualityScore}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Panel */}
      {showStats && stats && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            Thống kê cá nhân hóa
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Basic Stats */}
            <div>
              <h5 className="font-medium text-gray-700 mb-3">Hoạt động</h5>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Lượt xem:</span>
                  <span className="font-medium">{stats.totalViews}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Đơn hàng:</span>
                  <span className="font-medium">{stats.totalPurchases}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Dữ liệu:</span>
                  <span className={`font-medium capitalize ${
                    stats.recommendationQuality.dataRichness === 'high' ? 'text-green-600' :
                    stats.recommendationQuality.dataRichness === 'medium' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {stats.recommendationQuality.dataRichness === 'high' ? 'Phong phú' :
                     stats.recommendationQuality.dataRichness === 'medium' ? 'Trung bình' : 'Ít'}
                  </span>
                </div>
              </div>
            </div>

            {/* Favorite Categories */}
            <div>
              <h5 className="font-medium text-gray-700 mb-3">Danh mục yêu thích</h5>
              <div className="space-y-2">
                {stats.favoriteCategories.slice(0, 3).map((category, index) => (
                  <div key={category._id} className="flex justify-between">
                    <span className="text-gray-600 truncate">{category._id}</span>
                    <span className="font-medium text-blue-600">{category.count}</span>
                  </div>
                ))}
                {stats.favoriteCategories.length === 0 && (
                  <p className="text-gray-500 text-sm">Chưa có dữ liệu</p>
                )}
              </div>
            </div>

            {/* Insights */}
            <div>
              <h5 className="font-medium text-gray-700 mb-3">Gợi ý cải thiện</h5>
              <div className="space-y-2">
                {getInsights.map((insight, index) => (
                  <div
                    key={index}
                    className={`text-xs p-2 rounded ${
                      insight.type === 'success' ? 'bg-green-50 text-green-700' :
                      insight.type === 'info' ? 'bg-blue-50 text-blue-700' :
                      'bg-yellow-50 text-yellow-700'
                    }`}
                  >
                    {insight.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendation Sections */}
      <div className="space-y-8">
        {memoizedEnabledSections.map((section) => (
          <RecommendationSection
            key={`${section.type}-${refreshTrigger}`}
            title={section.title}
            type={section.type}
            productId={productId}
            userId={userId}
            onProductView={handleProductView}
            refreshTrigger={refreshTrigger}
          />
        ))}
      </div>

      {/* Tracking Info (Development) */}
      {process.env.NODE_ENV === 'development' && trackingData.size > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 text-xs">
          <h5 className="font-medium mb-2">Tracking Data (Dev)</h5>
          <div className="space-y-1">
            {Array.from(trackingData.entries()).slice(0, 5).map(([productId, data]) => (
              <div key={productId} className="flex justify-between">
                <span className="truncate">{productId}</span>
                <span>{data.views} views, {data.totalDuration}s</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationManager;