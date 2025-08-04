// src/services/recommendationService.ts
import axios from '../utils/axios';

class RecommendationService {
  private baseURL = '/recommendations';

  // Get recommendations by type
  async getRecommendations(type: string = 'mixed', options: any = {}) {
    try {
      const params = new URLSearchParams();
      params.append('type', type);
      
      if (options.forceRefresh) {
        params.append('_t', Date.now().toString());
      }

      const response = await axios.get(`${this.baseURL}?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }
  }

  // Get product-specific recommendations
  async getProductRecommendations(productId: string) {
    try {
      const response = await axios.get(`${this.baseURL}/product/${productId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching product recommendations:', error);
      throw error;
    }
  }

  // Get user recommendation stats
  async getStats() {
    try {
      const response = await axios.get(`${this.baseURL}/stats`);
      return response.data;
    } catch (error) {
      console.error('Error fetching recommendation stats:', error);
      throw error;
    }
  }

  // Track user interactions
  async trackInteraction(action: string, productId: string = '', duration: number = 0, metadata: any = {}) {
    try {
      await axios.post(`${this.baseURL}/track`, {
        action,
        productId,
        duration,
        metadata: {
          ...metadata,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          source: metadata.source || 'web'
        }
      });
    } catch (error) {
      console.warn('Failed to track interaction:', error);
      // Don't throw error for tracking failures
    }
  }

  // Specific tracking methods
  async trackView(productId: string, duration: number, source: string = 'direct') {
    return this.trackInteraction('view', productId, duration, { source });
  }

  async trackClick(productId: string, metadata: any = {}) {
    return this.trackInteraction('click', productId, 0, metadata);
  }

  async trackAddToCart(productId: string, metadata: any = {}) {
    return this.trackInteraction('addToCart', productId, 0, metadata);
  }

  async trackSearch(query: string, results: any[] = [], metadata: any = {}) {
    return this.trackInteraction('search', '', 0, {
      query,
      resultsCount: results.length,
      ...metadata
    });
  }

  async trackPurchase(productIds: string[], orderTotal: number, metadata: any = {}) {
    // Track purchase for multiple products
    const promises = productIds.map(productId =>
      this.trackInteraction('purchase', productId, 0, {
        orderTotal,
        productCount: productIds.length,
        ...metadata
      })
    );
    
    await Promise.allSettled(promises);
  }

  async trackLike(productId: string, metadata: any = {}) {
    return this.trackInteraction('like', productId, 0, metadata);
  }

  async trackDislike(productId: string, metadata: any = {}) {
    return this.trackInteraction('dislike', productId, 0, metadata);
  }

  // Reset user recommendation data (GDPR)
  async resetUserData() {
    try {
      const response = await axios.delete(`${this.baseURL}/reset`);
      return response.data;
    } catch (error) {
      console.error('Error resetting user data:', error);
      throw error;
    }
  }

  // Batch tracking for performance
  private trackingQueue: Array<{
    action: string;
    productId: string;
    duration: number;
    metadata: any;
    timestamp: number;
  }> = [];

  private isProcessingQueue = false;

  async queueInteraction(action: string, productId: string = '', duration: number = 0, metadata: any = {}) {
    this.trackingQueue.push({
      action,
      productId,
      duration,
      metadata,
      timestamp: Date.now()
    });

    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      this.processTrackingQueue();
    }
  }

  private async processTrackingQueue() {
    if (this.isProcessingQueue || this.trackingQueue.length === 0) return;

    this.isProcessingQueue = true;

    try {
      // Process in batches of 10
      while (this.trackingQueue.length > 0) {
        const batch = this.trackingQueue.splice(0, 10);
        
        const promises = batch.map(item =>
          this.trackInteraction(item.action, item.productId, item.duration, item.metadata)
        );

        await Promise.allSettled(promises);
        
        // Small delay between batches
        if (this.trackingQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.warn('Error processing tracking queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // Utility methods
  calculateViewDuration(startTime: number): number {
    return Math.round((Date.now() - startTime) / 1000);
  }

  // Get recommendation explanation
  getRecommendationReason(type: string, confidence?: number): string {
    const reasons = {
      collaborative: 'Những người khác cũng thích sản phẩm này',
      content: 'Phù hợp với sở thích của bạn',
      trending: 'Đang được ưa chuộng',
      new: 'Sản phẩm mới về',
      mixed: 'Được đề xuất dành cho bạn'
    };

    let reason = reasons[type as keyof typeof reasons] || 'Sản phẩm đề xuất';
    
    if (confidence && confidence > 0.8) {
      reason += ' (Độ tin cậy cao)';
    } else if (confidence && confidence > 0.6) {
      reason += ' (Độ tin cậy trung bình)';
    }

    return reason;
  }

  // Validate recommendation data
  validateRecommendation(recommendation: any): boolean {
    return !!(
      recommendation &&
      recommendation._id &&
      recommendation.name &&
      recommendation.price &&
      typeof recommendation.price === 'number'
    );
  }

  // Format recommendations for display
  formatRecommendations(recommendations: any[]): any[] {
    return recommendations
      .filter(this.validateRecommendation)
      .map(rec => ({
        ...rec,
        formattedPrice: rec.price.toLocaleString('vi-VN'),
        displayRating: rec.rating || 0,
        hasDiscount: rec.originalPrice && rec.originalPrice > rec.price,
        discountPercent: rec.originalPrice 
          ? Math.round(((rec.originalPrice - rec.price) / rec.originalPrice) * 100)
          : 0
      }));
  }

  // A/B Testing support
  async getRecommendationVariant(userId: string): Promise<'A' | 'B'> {
    // Simple hash-based A/B testing
    const hash = this.hashCode(userId);
    return Math.abs(hash) % 2 === 0 ? 'A' : 'B';
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  // Performance monitoring
  async measureRecommendationPerformance<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - startTime;
      
      // Track performance
      this.queueInteraction('performance', '', duration, {
        operation: operationName,
        success: true
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      // Track performance failure
      this.queueInteraction('performance', '', duration, {
        operation: operationName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }
}

// Create singleton instance
const recommendationService = new RecommendationService();

export default recommendationService;