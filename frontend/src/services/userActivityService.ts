// src/services/userActivityService.ts - Enhanced version
import axios from '../utils/axios';

interface TrackingEvent {
  action: 'view' | 'search' | 'addToCart' | 'wishlist' | 'purchase' | 'click' | 'login' | 'pageView';
  productId?: string;
  duration?: number;
  metadata?: any;
}

class UserActivityService {
  private batchQueue: TrackingEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();
  private activityCheckInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_DELAY = 5000; // 5 seconds
  private readonly ACTIVITY_PING_INTERVAL = 60000; // 1 minute

  constructor() {
    // Start activity monitoring
    this.startActivityMonitoring();
    
    // Track when user returns to tab
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Track user activity
    ['click', 'scroll', 'keypress', 'mousemove'].forEach(event => {
      document.addEventListener(event, this.updateLastActivity, { passive: true });
    });
  }

  // Start periodic activity monitoring
  private startActivityMonitoring = () => {
    this.activityCheckInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - this.lastActivityTime;
      
      // If user has been active in the last minute, ping the server
      if (timeSinceLastActivity < this.ACTIVITY_PING_INTERVAL) {
        this.pingActivity();
      }
    }, this.ACTIVITY_PING_INTERVAL);
  };

  // Update last activity timestamp
  private updateLastActivity = () => {
    this.lastActivityTime = Date.now();
  };

  // Handle tab visibility changes
  private handleVisibilityChange = () => {
    if (!document.hidden) {
      // User returned to tab, update activity
      this.updateLastActivity();
      this.pingActivity();
    }
  };

  // Ping server to update last activity
  private async pingActivity() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Send a lightweight ping to update lastLoginDate
      await axios.post('/users/ping', {}, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {
        // Silently fail, don't interrupt user experience
      });
    } catch (error) {
      // Silent fail
    }
  }

  // Track login event
  async trackLogin(): Promise<void> {
    await this.track({
      action: 'login',
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'web'
      }
    });
  }

  // Track page view
  async trackPageView(page: string): Promise<void> {
    await this.track({
      action: 'pageView',
      metadata: {
        page,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Track a single event
  async track(event: TrackingEvent): Promise<void> {
    try {
      // Update activity timestamp
      this.updateLastActivity();
      
      // Add to batch queue
      this.batchQueue.push(event);

      // Send immediately if batch is full
      if (this.batchQueue.length >= this.BATCH_SIZE) {
        await this.flushBatch();
      } else {
        // Schedule batch send
        this.scheduleBatchSend();
      }
    } catch (error) {
      console.error('Tracking error:', error);
    }
  }

  // Track product view with duration tracking
  trackProductView(productId: string, source: string = 'direct'): () => void {
    const startTime = Date.now();
    
    // Update activity
    this.updateLastActivity();
    
    // Return cleanup function to be called when user leaves
    return () => {
      const duration = Math.round((Date.now() - startTime) / 1000);
      this.track({
        action: 'view',
        productId,
        duration,
        metadata: { source }
      });
    };
  }

  // Track search
  async trackSearch(query: string, resultsCount: number, clickedResults: string[] = []): Promise<void> {
    await this.track({
      action: 'search',
      metadata: {
        query,
        resultsCount,
        clickedResults
      }
    });
  }

  // Track add to cart
  async trackAddToCart(productId: string, quantity: number = 1, price?: number): Promise<void> {
    await this.track({
      action: 'addToCart',
      productId,
      metadata: { 
        quantity,
        price,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Track wishlist action
  async trackWishlist(productId: string, wishlistAction: 'add' | 'remove'): Promise<void> {
    await this.track({
      action: 'wishlist',
      productId,
      metadata: { wishlistAction }
    });
  }

  // Track recommendation click
  async trackRecommendationClick(productId: string, recommendationType: string, position?: number): Promise<void> {
    await this.track({
      action: 'click',
      productId,
      metadata: { 
        recommendationType,
        position,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Private methods
  private scheduleBatchSend(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.flushBatch();
    }, this.BATCH_DELAY);
  }

  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const events = [...this.batchQueue];
    this.batchQueue = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.post('/recommendations/track/batch', {
        events
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Batch tracking failed:', error);
      // Could implement retry logic here
    }
  }

  // Clean up when user logs out or app unmounts
  async cleanup(): Promise<void> {
    // Flush any remaining events
    await this.flushBatch();
    
    // Clear intervals
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
    }
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    ['click', 'scroll', 'keypress', 'mousemove'].forEach(event => {
      document.removeEventListener(event, this.updateLastActivity);
    });
  }

  // Call this when user logs out
  async flush(): Promise<void> {
    await this.flushBatch();
  }
}

// Create singleton instance
const userActivityService = new UserActivityService();

// Auto cleanup on page unload
window.addEventListener('beforeunload', () => {
  userActivityService.flush();
});

export default userActivityService;