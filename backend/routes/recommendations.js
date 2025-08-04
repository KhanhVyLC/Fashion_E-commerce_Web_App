// backend/routes/recommendations.js - COMPLETE FIXED VERSION
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');
const { protect } = require('../middleware/auth');

// ==================== CONFIGURATION ====================
const config = {
  cache: {
    duration: 30 * 1000, // 30 seconds for faster updates
    personalizedDuration: 15 * 1000, // 15 seconds for personalized content
    maxSize: 500, // Reduced cache size for better memory management
  },
  limits: {
    defaultRecommendations: 20,
    maxRecommendations: 50,
    viewHistoryLimit: 100,
    searchHistoryLimit: 50,
    recentActivityWindow: 60 * 60 * 1000, // 1 hour for recent activity
  },
  weights: {
    purchase: 5,      // Increased weight for purchases
    view: 1,          // Increased weight for views
    search: 0.5,      // Increased weight for searches
    wishlist: 2,      // Increased weight for wishlist
    cart: 3,          // Increased weight for cart
    recentBoost: 2,   // Boost for recent activities
  },
  timeDecay: {
    purchaseDecayDays: 90,
    viewDecayDays: 3,      // Reduced from 7 days
    searchDecayDays: 14,   // Reduced from 30 days
  },
  tracking: {
    minViewDuration: 1,    // Reduced from 3 seconds
    viewCountThreshold: 3, // Minimum views before strong personalization
  }
};

// ==================== ENHANCED CACHE MANAGEMENT ====================
class RecommendationCache {
  constructor() {
    this.cache = new Map();
    this.userActivity = new Map(); // Track user activity for cache invalidation
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      invalidations: 0
    };
  }

  get(key, isPersonalized = false) {
    const item = this.cache.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Use shorter duration for personalized content
    const duration = isPersonalized ? config.cache.personalizedDuration : config.cache.duration;
    
    if (Date.now() - item.timestamp > duration) {
      this.cache.delete(key);
      this.stats.evictions++;
      return null;
    }

    this.stats.hits++;
    return item.data;
  }

  set(key, data, isPersonalized = false) {
    // Implement LRU eviction if cache is too large
    if (this.cache.size >= config.cache.maxSize) {
      const oldestKey = this.findOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      isPersonalized
    });
  }

  findOldestKey() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, value] of this.cache) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }

  invalidateUser(userId) {
    let count = 0;
    const userIdStr = userId.toString();
    
    for (const [key] of this.cache) {
      if (key.includes(userIdStr)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    this.stats.invalidations += count;
    return count;
  }

  invalidatePattern(pattern) {
    let count = 0;
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.invalidations += count;
    return count;
  }

  // Track user activity to determine if cache should be invalidated
  trackUserActivity(userId) {
    const now = Date.now();
    const lastActivity = this.userActivity.get(userId) || 0;
    this.userActivity.set(userId, now);
    
    // If user was active recently, invalidate their cache
    if (now - lastActivity < 5000) { // 5 seconds
      this.invalidateUser(userId);
    }
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.userActivity.clear();
    return size;
  }

  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      activeUsers: this.userActivity.size
    };
  }
}

const recommendationCache = new RecommendationCache();

// ==================== MIDDLEWARE ====================
const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key123456');
      req.user = await User.findById(decoded.id).select('-password').lean();
      req.userId = decoded.id;
      
      // Track user activity
      recommendationCache.trackUserActivity(decoded.id);
    } catch (error) {
      console.warn('Optional auth failed:', error.message);
    }
  }
  
  next();
};

// ==================== HELPER FUNCTIONS ====================
const toSafeObject = (item) => {
  if (!item) return null;
  return typeof item.toObject === 'function' ? item.toObject() : item;
};

const calculateTimeDecay = (date, decayDays) => {
  if (!date) return 0.1;
  const hoursSince = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
  
  // More aggressive decay for recent items
  if (hoursSince < 1) return 2.0;  // Within last hour
  if (hoursSince < 24) return 1.5; // Within last day
  
  const daysSince = hoursSince / 24;
  return Math.max(0.1, Math.exp(-daysSince / decayDays));
};

const calculateProductSimilarity = (product1, product2) => {
  if (!product1 || !product2) return 0;
  
  let score = 0;
  
  // Category similarity (40%)
  if (product1.category === product2.category) {
    score += 4;
    if (product1.subcategory === product2.subcategory) score += 2;
  }
  
  // Brand similarity (20%)
  if (product1.brand && product1.brand === product2.brand) {
    score += 2;
  }
  
  // Price similarity (20%)
  const priceDiff = Math.abs(product1.price - product2.price) / Math.max(product1.price, product2.price);
  score += (1 - priceDiff) * 2;
  
  // Tag similarity (10%)
  if (product1.tags?.length && product2.tags?.length) {
    const commonTags = product1.tags.filter(tag => product2.tags.includes(tag));
    score += (commonTags.length / Math.max(product1.tags.length, product2.tags.length)) * 1;
  }
  
  // Rating similarity (10%)
  const ratingDiff = Math.abs((product1.rating || 0) - (product2.rating || 0));
  score += (1 - ratingDiff / 5) * 1;
  
  return score;
};

// Get dynamic distribution based on user behavior
const getDynamicDistribution = async (userId, limit) => {
  try {
    const user = await User.findById(userId)
      .select('viewHistory searchHistory interactions analytics')
      .lean();
    
    if (!user) {
      return {
        content: Math.floor(limit * 0.4),
        collaborative: Math.floor(limit * 0.3),
        trending: Math.floor(limit * 0.2),
        new: Math.ceil(limit * 0.1)
      };
    }
    
    // Count recent activities
    const recentViews = user.viewHistory?.filter(v => 
      new Date(v.viewedAt) > new Date(Date.now() - config.limits.recentActivityWindow)
    ).length || 0;
    
    const recentSearches = user.searchHistory?.filter(s => 
      new Date(s.searchedAt) > new Date(Date.now() - config.limits.recentActivityWindow)
    ).length || 0;
    
    const totalOrders = user.analytics?.totalOrders || 0;
    
    // Adjust distribution based on activity
    if (recentViews > 10 || recentSearches > 5) {
      // Very active user - more personalized content
      return {
        content: Math.floor(limit * 0.6),
        collaborative: Math.floor(limit * 0.2),
        trending: Math.floor(limit * 0.1),
        new: Math.ceil(limit * 0.1)
      };
    } else if (recentViews > 5 || totalOrders > 0) {
      // Moderately active user
      return {
        content: Math.floor(limit * 0.5),
        collaborative: Math.floor(limit * 0.25),
        trending: Math.floor(limit * 0.15),
        new: Math.ceil(limit * 0.1)
      };
    } else {
      // New or inactive user - more discovery
      return {
        content: Math.floor(limit * 0.3),
        collaborative: Math.floor(limit * 0.2),
        trending: Math.floor(limit * 0.3),
        new: Math.ceil(limit * 0.2)
      };
    }
  } catch (error) {
    console.error('Error calculating distribution:', error);
    return {
      content: Math.floor(limit * 0.4),
      collaborative: Math.floor(limit * 0.3),
      trending: Math.floor(limit * 0.2),
      new: Math.ceil(limit * 0.1)
    };
  }
};

// ==================== RECOMMENDATION STRATEGIES ====================

// 1. Random Products Fallback
async function getRandomProducts(limit = 20, excludeIds = []) {
  try {
    const validExcludeIds = excludeIds
      .filter(id => id && mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    // Get popular products instead of pure random
    const products = await Product.aggregate([
      { 
        $match: { 
          _id: { $nin: validExcludeIds },
          stock: { $exists: true, $ne: [] }
        } 
      },
      {
        $addFields: {
          popularityScore: {
            $add: [
              { $multiply: ['$viewCount', 0.1] },
              { $multiply: ['$totalOrders', 1] },
              { $multiply: ['$rating', 2] }
            ]
          }
        }
      },
      { $sort: { popularityScore: -1 } },
      { $limit: limit * 2 },
      { $sample: { size: limit } }
    ]);
    
    return products;
  } catch (error) {
    console.error('Random products error:', error);
    return [];
  }
}

// 2. Enhanced Collaborative Filtering
async function getCollaborativeRecommendations(userId, limit = 20) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return [];
  }

  const cacheKey = `collab_${userId}_${limit}`;
  const cached = recommendationCache.get(cacheKey, true);
  if (cached) return cached;

  try {
    // Get user's recent interactions
    const [userOrders, userInteractions] = await Promise.all([
      Order.find({ 
        user: userId,
        orderStatus: { $ne: 'cancelled' }
      })
        .select('items.product items.quantity createdAt')
        .sort('-createdAt')
        .limit(50)
        .lean(),
      
      User.findById(userId)
        .select('viewHistory interactions.wishlist')
        .lean()
    ]);

    if (userOrders.length === 0 && (!userInteractions?.viewHistory?.length)) {
      return [];
    }

    // Build user product interaction map with weights
    const userProducts = new Map();
    
    // Add order history
    userOrders.forEach(order => {
      const weight = calculateTimeDecay(order.createdAt, config.timeDecay.purchaseDecayDays);
      order.items.forEach(item => {
        if (item.product) {
          const productId = item.product.toString();
          userProducts.set(productId, 
            (userProducts.get(productId) || 0) + weight * config.weights.purchase * (item.quantity || 1)
          );
        }
      });
    });
    
    // Add recent views
    if (userInteractions?.viewHistory) {
      userInteractions.viewHistory
        .filter(v => v.product && new Date(v.viewedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .forEach(view => {
          const productId = view.product.toString();
          const weight = calculateTimeDecay(view.viewedAt, config.timeDecay.viewDecayDays);
          userProducts.set(productId, 
            (userProducts.get(productId) || 0) + weight * config.weights.view
          );
        });
    }
    
    // Add wishlist items
    if (userInteractions?.interactions?.wishlist) {
      userInteractions.interactions.wishlist.forEach(item => {
        if (item.product) {
          const productId = item.product.toString();
          userProducts.set(productId, 
            (userProducts.get(productId) || 0) + config.weights.wishlist
          );
        }
      });
    }

    if (userProducts.size === 0) {
      return [];
    }

    // Find similar users with better scoring
    const productIds = Array.from(userProducts.keys()).map(id => new mongoose.Types.ObjectId(id));
    
    const similarUsers = await Order.aggregate([
      {
        $match: {
          user: { $ne: new mongoose.Types.ObjectId(userId) },
          'items.product': { $in: productIds },
          orderStatus: { $ne: 'cancelled' },
          createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } // Last 6 months
        }
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.product': { $in: productIds }
        }
      },
      {
        $group: {
          _id: '$user',
          commonProducts: { $addToSet: '$items.product' },
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: '$items.quantity' }
        }
      },
      {
        $addFields: {
          similarity: {
            $add: [
              { $multiply: [{ $size: '$commonProducts' }, 2] },
              { $multiply: ['$totalQuantity', 0.1] }
            ]
          }
        }
      },
      { $sort: { similarity: -1 } },
      { $limit: 100 }
    ]);

    if (similarUsers.length === 0) {
      return [];
    }

    // Get recommendations from similar users with better scoring
    const recommendations = await Order.aggregate([
      {
        $match: {
          user: { $in: similarUsers.slice(0, 50).map(u => u._id) },
          orderStatus: { $ne: 'cancelled' },
          createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 3 months
        }
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.product': { $nin: productIds }
        }
      },
      {
        $group: {
          _id: '$items.product',
          score: { 
            $sum: {
              $multiply: [
                '$items.quantity',
                { $cond: [
                  { $gte: ['$createdAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                  2, // Recent orders get double weight
                  1
                ]}
              ]
            }
          },
          users: { $addToSet: '$user' },
          avgPrice: { $avg: '$items.price' }
        }
      },
      {
        $addFields: {
          userCount: { $size: '$users' },
          finalScore: {
            $add: [
              { $multiply: ['$score', 1] },
              { $multiply: [{ $size: '$users' }, 2] }
            ]
          }
        }
      },
      { $sort: { finalScore: -1, userCount: -1 } },
      { $limit: limit * 2 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $match: {
          'product.stock': { $exists: true, $ne: [] }
        }
      },
      {
        $addFields: {
          'product.recommendationScore': '$finalScore',
          'product.recommendedByUsers': '$userCount'
        }
      },
      { $replaceRoot: { newRoot: '$product' } },
      { $limit: limit }
    ]);

    recommendationCache.set(cacheKey, recommendations, true);
    return recommendations;
  } catch (error) {
    console.error('Collaborative filtering error:', error);
    return [];
  }
}

// 3. Enhanced Content-Based Filtering
async function getContentBasedRecommendations(userId, limit = 20) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return [];
  }

  const cacheKey = `content_${userId}_${limit}`;
  const cached = recommendationCache.get(cacheKey, true);
  if (cached) return cached;

  try {
    const user = await User.findById(userId)
      .select('viewHistory searchHistory interactions analytics preferences')
      .lean();

    if (!user) return [];

    // Build enhanced user preference profile
    const preferences = {
      categories: new Map(),
      brands: new Map(),
      priceRange: { min: 0, max: 10000000 },
      tags: new Map(),
      colors: new Map(),
      sizes: new Map(),
      recentProducts: []
    };

    // Analyze recent view history with time weighting
    if (user.viewHistory && user.viewHistory.length > 0) {
      const recentViews = user.viewHistory
        .filter(v => v.product && new Date(v.viewedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))
        .slice(0, 30);
      
      const viewedProductIds = recentViews.map(v => v.product);
      preferences.recentProducts = viewedProductIds.slice(0, 10);
      
      const viewedProducts = await Product.find({
        _id: { $in: viewedProductIds }
      }).lean();

      viewedProducts.forEach((product, index) => {
        // Recent views get higher weight
        const recencyWeight = 1 + (1 / (index + 1));
        const baseWeight = config.weights.view * recencyWeight;
        
        if (product.category) {
          preferences.categories.set(product.category, 
            (preferences.categories.get(product.category) || 0) + baseWeight);
        }
        if (product.brand) {
          preferences.brands.set(product.brand, 
            (preferences.brands.get(product.brand) || 0) + baseWeight);
        }
        
        // Track colors and sizes
        product.colors?.forEach(color => {
          preferences.colors.set(color, (preferences.colors.get(color) || 0) + baseWeight * 0.5);
        });
        
        product.sizes?.forEach(size => {
          preferences.sizes.set(size, (preferences.sizes.get(size) || 0) + baseWeight * 0.5);
        });
        
        // Track tags
        product.tags?.forEach(tag => {
          preferences.tags.set(tag, (preferences.tags.get(tag) || 0) + baseWeight * 0.7);
        });
      });
    }

    // Analyze search history
    if (user.searchHistory && user.searchHistory.length > 0) {
      const recentSearches = user.searchHistory
        .filter(s => new Date(s.searchedAt) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))
        .slice(0, 20);
      
      recentSearches.forEach((search, index) => {
        const weight = config.weights.search * (1 + (1 / (index + 1)));
        const query = search.query.toLowerCase();
        
        // Extract potential tags from search queries
        const words = query.split(/\s+/);
        words.forEach(word => {
          if (word.length > 2) {
            preferences.tags.set(word, (preferences.tags.get(word) || 0) + weight);
          }
        });
      });
    }

    // Analyze purchase history with enhanced weighting
    const orders = await Order.find({ 
      user: userId,
      orderStatus: { $ne: 'cancelled' }
    })
      .populate('items.product')
      .sort('-createdAt')
      .limit(30)
      .lean();

    const prices = [];
    orders.forEach((order, orderIndex) => {
      const orderWeight = calculateTimeDecay(order.createdAt, config.timeDecay.purchaseDecayDays) * 
                         config.weights.purchase * (1 + (1 / (orderIndex + 1)));
      
      order.items.forEach(item => {
        if (item.product) {
          // Categories
          if (item.product.category) {
            preferences.categories.set(item.product.category, 
              (preferences.categories.get(item.product.category) || 0) + orderWeight);
          }
          
          // Brands
          if (item.product.brand) {
            preferences.brands.set(item.product.brand, 
              (preferences.brands.get(item.product.brand) || 0) + orderWeight);
          }
          
          // Price
          if (item.product.price) {
            prices.push(item.product.price);
          }
          
          // Tags
          item.product.tags?.forEach(tag => {
            preferences.tags.set(tag, (preferences.tags.get(tag) || 0) + orderWeight * 0.8);
          });
          
          // Colors and sizes from actual purchases
          if (item.color) {
            preferences.colors.set(item.color, 
              (preferences.colors.get(item.color) || 0) + orderWeight * 1.5);
          }
          if (item.size) {
            preferences.sizes.set(item.size, 
              (preferences.sizes.get(item.size) || 0) + orderWeight * 1.5);
          }
        }
      });
    });

    // Analyze wishlist
    if (user.interactions?.wishlist) {
      const wishlistProducts = await Product.find({
        _id: { $in: user.interactions.wishlist.map(w => w.product).filter(Boolean) }
      }).lean();
      
      wishlistProducts.forEach(product => {
        if (product.category) {
          preferences.categories.set(product.category, 
            (preferences.categories.get(product.category) || 0) + config.weights.wishlist);
        }
        if (product.brand) {
          preferences.brands.set(product.brand, 
            (preferences.brands.get(product.brand) || 0) + config.weights.wishlist);
        }
        prices.push(product.price);
      });
    }

    // Calculate dynamic price range
    if (prices.length > 0) {
      prices.sort((a, b) => a - b);
      const q1 = prices[Math.floor(prices.length * 0.25)];
      const q3 = prices[Math.floor(prices.length * 0.75)];
      const iqr = q3 - q1;
      preferences.priceRange = {
        min: Math.max(0, q1 - iqr * 0.5),
        max: q3 + iqr * 0.5
      };
    } else if (user.preferences?.priceRange) {
      preferences.priceRange = user.preferences.priceRange;
    }

    // Get top preferences
    const topCategories = Array.from(preferences.categories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);

    const topBrands = Array.from(preferences.brands.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([brand]) => brand);

    const topTags = Array.from(preferences.tags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    const topColors = Array.from(preferences.colors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([color]) => color);

    // Build smart query
    const mustConditions = [
      { stock: { $exists: true, $ne: [] } },
      { _id: { $nin: preferences.recentProducts } } // Exclude recently viewed
    ];

    const shouldConditions = [];
    
    if (topCategories.length > 0) {
      shouldConditions.push({ category: { $in: topCategories } });
    }
    
    if (topBrands.length > 0) {
      shouldConditions.push({ brand: { $in: topBrands } });
    }
    
    if (topTags.length > 0) {
      shouldConditions.push({ tags: { $in: topTags } });
    }
    
    if (topColors.length > 0) {
      shouldConditions.push({ colors: { $in: topColors } });
    }

    const query = {
      $and: [
        ...mustConditions,
        shouldConditions.length > 0 ? { $or: shouldConditions } : {},
        {
          price: { 
            $gte: preferences.priceRange.min * 0.7, 
            $lte: preferences.priceRange.max * 1.3 
          }
        }
      ]
    };

    // Get and score products
    const products = await Product.find(query)
      .limit(limit * 3)
      .lean();

    // Advanced scoring algorithm
    const scoredProducts = products.map(product => {
      let score = 0;
      
      // Category score (highest weight)
      const categoryScore = preferences.categories.get(product.category) || 0;
      score += categoryScore * 3;
      
      // Brand score
      if (product.brand) {
        const brandScore = preferences.brands.get(product.brand) || 0;
        score += brandScore * 2;
      }
      
      // Tag score
      let tagScore = 0;
      product.tags?.forEach(tag => {
        tagScore += (preferences.tags.get(tag) || 0);
      });
      score += tagScore * 1.5;
      
      // Color preference score
      let colorScore = 0;
      product.colors?.forEach(color => {
        colorScore += (preferences.colors.get(color) || 0);
      });
      score += colorScore;
      
      // Size preference score
      let sizeScore = 0;
      product.sizes?.forEach(size => {
        sizeScore += (preferences.sizes.get(size) || 0);
      });
      score += sizeScore * 0.5;
      
      // Quality signals
      score += (product.rating || 0) * 3;
      score += Math.log(Math.max(1, product.totalReviews || 0)) * 0.5;
      score += Math.log(Math.max(1, product.totalOrders || 0)) * 0.3;
      
      // Popularity boost for newer users
      if (user.viewHistory?.length < 10) {
        score += Math.log(Math.max(1, product.viewCount || 0)) * 0.5;
      }
      
      // Recency bonus
      const daysSinceCreated = (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated < 30) {
        score += (30 - daysSinceCreated) / 30 * 2;
      }
      
      // Price match bonus
      if (product.price >= preferences.priceRange.min && product.price <= preferences.priceRange.max) {
        score += 2;
      }
      
      return { product, score };
    });

    // Sort and deduplicate
    const recommendations = scoredProducts
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        ...item.product,
        contentScore: item.score
      }));

    recommendationCache.set(cacheKey, recommendations, true);
    return recommendations;
  } catch (error) {
    console.error('Content-based filtering error:', error);
    return [];
  }
}

// 4. Real-time Trending Products
async function getTrendingProducts(limit = 20) {
  const cacheKey = `trending_${limit}`;
  const cached = recommendationCache.get(cacheKey);
  if (cached) return cached;

  try {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    // Multi-timeframe trending analysis
    const trending = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: oneWeekAgo },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          // Different weights for different time periods
          recentOrders: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', oneDayAgo] },
                3, // Last 24 hours - highest weight
                {
                  $cond: [
                    { $gte: ['$createdAt', threeDaysAgo] },
                    2, // Last 3 days
                    1  // Last week
                  ]
                }
              ]
            }
          },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          uniqueUsers: { $addToSet: '$user' },
          avgOrderValue: { $avg: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      {
        $addFields: {
          userCount: { $size: '$uniqueUsers' },
          // Complex trending score
          trendScore: {
            $add: [
              { $multiply: ['$recentOrders', 5] },
              { $multiply: ['$userCount', 3] },
              { $multiply: ['$totalQuantity', 1] },
              { $multiply: [{ $log10: { $add: ['$totalRevenue', 1] } }, 2] }
            ]
          }
        }
      },
      { $sort: { trendScore: -1 } },
      { $limit: limit * 2 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $match: {
          'product.stock': { $exists: true, $ne: [] }
        }
      },
      {
        $addFields: {
          'product.trendingScore': '$trendScore',
          'product.trendingUsers': '$userCount',
          'product.trendingOrders': '$recentOrders'
        }
      },
      { $replaceRoot: { newRoot: '$product' } },
      { $limit: limit }
    ]);

    // Also consider view-based trending
    const viewTrending = await User.aggregate([
      {
        $match: {
          'viewHistory.viewedAt': { $gte: threeDaysAgo }
        }
      },
      { $unwind: '$viewHistory' },
      {
        $match: {
          'viewHistory.viewedAt': { $gte: threeDaysAgo }
        }
      },
      {
        $group: {
          _id: '$viewHistory.product',
          viewCount: { $sum: 1 },
          uniqueViewers: { $addToSet: '$_id' },
          avgDuration: { $avg: '$viewHistory.duration' }
        }
      },
      {
        $addFields: {
          viewerCount: { $size: '$uniqueViewers' },
          viewScore: {
            $add: [
              { $multiply: ['$viewCount', 0.5] },
              { $multiply: ['$viewerCount', 2] },
              { $multiply: [{ $ifNull: ['$avgDuration', 0] }, 0.1] }
            ]
          }
        }
      },
      { $sort: { viewScore: -1 } },
      { $limit: 10 }
    ]);

    // Merge order-based and view-based trending
    const viewTrendingMap = new Map(viewTrending.map(v => [v._id.toString(), v.viewScore]));
    
    trending.forEach(product => {
      const viewScore = viewTrendingMap.get(product._id.toString()) || 0;
      product.combinedTrendScore = (product.trendingScore || 0) + viewScore;
    });
    
    trending.sort((a, b) => (b.combinedTrendScore || 0) - (a.combinedTrendScore || 0));

    recommendationCache.set(cacheKey, trending.slice(0, limit));
    return trending.slice(0, limit);
  } catch (error) {
    console.error('Trending products error:', error);
    return [];
  }
}

// 5. Personalized New Arrivals
async function getPersonalizedNewArrivals(userId, limit = 20) {
  try {
    const preferences = userId ? await getUserPreferences(userId) : null;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    let query = {
      createdAt: { $gte: thirtyDaysAgo },
      stock: { $exists: true, $ne: [] }
    };
    
    // Personalize for logged-in users
    if (preferences) {
      const conditions = [];
      
      if (preferences.categories.length > 0) {
        conditions.push({ category: { $in: preferences.categories.slice(0, 3) } });
      }
      if (preferences.brands.length > 0) {
        conditions.push({ brand: { $in: preferences.brands.slice(0, 3) } });
      }
      if (preferences.tags && preferences.tags.length > 0) {
        conditions.push({ tags: { $in: preferences.tags.slice(0, 5) } });
      }
      
      if (conditions.length > 0) {
        query.$or = conditions;
      }
      
      if (preferences.priceRange) {
        query.price = {
          $gte: preferences.priceRange.min * 0.7,
          $lte: preferences.priceRange.max * 1.3
        };
      }
    }
    
    const products = await Product.aggregate([
      { $match: query },
      {
        $addFields: {
          isVeryNew: { $gte: ['$createdAt', sevenDaysAgo] },
          newScore: {
            $add: [
              // Recency score
              {
                $multiply: [
                  { $subtract: [1, { $divide: [
                    { $subtract: [Date.now(), '$createdAt'] },
                    { $subtract: [Date.now(), thirtyDaysAgo.getTime()] }
                  ]}]},
                  10
                ]
              },
              // Quality score
              { $multiply: [{ $ifNull: ['$rating', 0] }, 2] },
              // Popularity score
              { $log10: { $add: [{ $ifNull: ['$viewCount', 0] }, 1] } }
            ]
          }
        }
      },
      { $sort: { newScore: -1, createdAt: -1 } },
      { $limit: limit }
    ]);
    
    return products;
  } catch (error) {
    console.error('New arrivals error:', error);
    return [];
  }
}

// Helper: Get enhanced user preferences
async function getUserPreferences(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return null;

  try {
    const user = await User.findById(userId)
      .select('preferences analytics viewHistory searchHistory interactions')
      .lean();
    
    if (!user) return null;
    
    // Use stored preferences if available
    if (user.preferences?.preferredCategories?.length > 0) {
      return {
        categories: user.preferences.preferredCategories,
        brands: user.preferences.preferredBrands || [],
        tags: user.preferences.preferredTags || [],
        priceRange: user.preferences.priceRange
      };
    }

    // Otherwise, analyze user behavior
    const categories = new Map();
    const brands = new Map();
    const tags = new Map();
    const prices = [];
    
    // Analyze view history
    if (user.viewHistory && user.viewHistory.length > 0) {
      const recentProductIds = user.viewHistory
        .filter(v => v.product && new Date(v.viewedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        .map(v => v.product)
        .slice(0, 50);
      
      if (recentProductIds.length > 0) {
        const viewedProducts = await Product.find({
          _id: { $in: recentProductIds }
        }).select('category brand tags price').lean();
        
        viewedProducts.forEach(product => {
          if (product.category) {
            categories.set(product.category, (categories.get(product.category) || 0) + 1);
          }
          if (product.brand) {
            brands.set(product.brand, (brands.get(product.brand) || 0) + 1);
          }
          product.tags?.forEach(tag => {
            tags.set(tag, (tags.get(tag) || 0) + 1);
          });
          if (product.price) prices.push(product.price);
        });
      }
    }
    
    // Analyze order history
    const orders = await Order.find({ 
      user: userId,
      orderStatus: { $ne: 'cancelled' }
    })
      .populate('items.product', 'category brand tags price')
      .sort('-createdAt')
      .limit(20)
      .lean();
    
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.product) {
          if (item.product.category) {
            categories.set(item.product.category, 
              (categories.get(item.product.category) || 0) + 3); // Higher weight for purchases
          }
          if (item.product.brand) {
            brands.set(item.product.brand, 
              (brands.get(item.product.brand) || 0) + 3);
          }
          item.product.tags?.forEach(tag => {
            tags.set(tag, (tags.get(tag) || 0) + 2);
          });
          if (item.product.price) prices.push(item.product.price);
        }
      });
    });
    
    // Calculate price range
    let priceRange = null;
    if (prices.length > 0) {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const stdDev = Math.sqrt(
        prices.reduce((sq, n) => sq + Math.pow(n - avgPrice, 2), 0) / prices.length
      );
      priceRange = {
        min: Math.max(0, avgPrice - stdDev),
        max: avgPrice + stdDev
      };
    }
    
    // Get top items
    const topCategories = Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);
    
    const topBrands = Array.from(brands.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([brand]) => brand);
    
    const topTags = Array.from(tags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
    
    return {
      categories: topCategories,
      brands: topBrands,
      tags: topTags,
      priceRange
    };
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return null;
  }
}

// ==================== MAIN ROUTES ====================

// Get recommendations with real-time updates
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { type = 'mixed', limit = config.limits.defaultRecommendations } = req.query;
    const safeLimit = Math.min(Number(limit) || config.limits.defaultRecommendations, config.limits.maxRecommendations);
    
    let recommendations = [];
    const startTime = Date.now();
    
    // For non-authenticated users, serve popular products
    if (!userId) {
      const cacheKey = `guest_${type}_${safeLimit}`;
      recommendations = recommendationCache.get(cacheKey);
      
      if (!recommendations) {
        if (type === 'trending') {
          recommendations = await getTrendingProducts(safeLimit);
        } else {
          recommendations = await getRandomProducts(safeLimit);
        }
        recommendationCache.set(cacheKey, recommendations);
      }
      
      return res.json(recommendations.map((product, index) => ({
        ...toSafeObject(product),
        recommendationType: type,
        score: recommendations.length - index,
        reason: type === 'trending' ? 'Đang thịnh hành' : 'Sản phẩm phổ biến',
        confidence: 0.5
      })));
    }
    
    // Authenticated user recommendations
    switch (type) {
      case 'collaborative':
        recommendations = await getCollaborativeRecommendations(userId, safeLimit);
        break;
        
      case 'content':
        recommendations = await getContentBasedRecommendations(userId, safeLimit);
        break;
        
      case 'trending':
        recommendations = await getTrendingProducts(safeLimit);
        break;
        
      case 'new':
        recommendations = await getPersonalizedNewArrivals(userId, safeLimit);
        break;
        
      case 'mixed':
      default: {
        // Get dynamic distribution based on user activity
        const distributions = await getDynamicDistribution(userId, safeLimit);
        
        // Fetch all types in parallel for better performance
        const [content, collab, trending, newArrivals] = await Promise.all([
          getContentBasedRecommendations(userId, distributions.content),
          getCollaborativeRecommendations(userId, distributions.collaborative),
          getTrendingProducts(distributions.trending),
          getPersonalizedNewArrivals(userId, distributions.new)
        ]);
        
        // Smart merging with priority and deduplication
        const seen = new Set();
        const merged = [];
        
        // Priority based on user activity level
        const user = await User.findById(userId).select('viewHistory analytics').lean();
        const isActiveUser = (user?.viewHistory?.length || 0) > config.tracking.viewCountThreshold;
        
        // Active users get more personalized content first
        const priorityOrder = isActiveUser 
          ? [content, collab, trending, newArrivals]
          : [trending, content, newArrivals, collab];
        
        priorityOrder.forEach(list => {
          list.forEach(product => {
            if (product && product._id) {
              const id = product._id.toString();
              if (!seen.has(id) && merged.length < safeLimit) {
                seen.add(id);
                merged.push(product);
              }
            }
          });
        });
        
        recommendations = merged;
      }
    }
    
    // Fallback to popular products if no recommendations
    if (recommendations.length === 0) {
      recommendations = await getRandomProducts(safeLimit);
    }
    
    // Enrich recommendations with metadata
    const enriched = recommendations.map((product, index) => ({
      ...toSafeObject(product),
      recommendationType: type,
      score: recommendations.length - index,
      reason: getRecommendationReason(type, product),
      confidence: calculateConfidence(type, index, recommendations.length),
      responseTime: Date.now() - startTime
    }));
    
    res.json(enriched);
  } catch (error) {
    console.error('Recommendation error:', error);
    const fallback = await getRandomProducts(20);
    res.json(fallback.map(p => ({
      ...toSafeObject(p),
      recommendationType: 'fallback',
      reason: 'Sản phẩm gợi ý'
    })));
  }
});

// Get product-specific recommendations - FIXED VERSION
router.get('/product/:productId', optionalAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.userId;
    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findById(productId).lean();
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Invalidate cache for better real-time updates
    if (userId) {
      recommendationCache.trackUserActivity(userId);
    }
    
    // Initialize response object with empty arrays
    const response = {
      similar: [],
      complementary: [],
      userRecommended: []
    };
    
    try {
      // Get similar products with enhanced algorithm
      const similar = await Product.aggregate([
        {
          $match: {
            _id: { $ne: new mongoose.Types.ObjectId(productId) },
            category: product.category,
            stock: { $exists: true, $ne: [] },
            price: {
              $gte: product.price * 0.6,
              $lte: product.price * 1.5
            }
          }
        },
        {
          $addFields: {
            similarityScore: {
              $add: [
                // Category match
                { $cond: [{ $eq: ['$category', product.category] }, 10, 0] },
                // Brand match
                { $cond: [{ $eq: ['$brand', product.brand] }, 5, 0] },
                // Price similarity
                {
                  $multiply: [
                    5,
                    { $subtract: [
                      1,
                      { $divide: [
                        { $abs: { $subtract: ['$price', product.price] } },
                        { $add: ['$price', product.price] }
                      ]}
                    ]}
                  ]
                },
                // Tag overlap
                {
                  $multiply: [
                    3,
                    { $divide: [
                      { $size: { $setIntersection: ['$tags', product.tags || []] } },
                      { $max: [{ $size: { $ifNull: ['$tags', []] } }, 1] }
                    ]}
                  ]
                },
                // Quality score
                { $multiply: [{ $ifNull: ['$rating', 0] }, 0.5] },
                // Popularity
                { $log10: { $add: [{ $ifNull: ['$viewCount', 0] }, 1] } }
              ]
            }
          }
        },
        { $sort: { similarityScore: -1 } },
        { $limit: 15 }
      ]);
      
      response.similar = similar.slice(0, 10) || [];
    } catch (error) {
      console.error('Error getting similar products:', error);
      response.similar = [];
    }
    
    try {
      // Get complementary products
      const complementary = await getComplementaryProducts([productId], 10);
      response.complementary = complementary || [];
    } catch (error) {
      console.error('Error getting complementary products:', error);
      response.complementary = [];
    }
    
    // Get products frequently bought by similar users
    if (userId) {
      try {
        const userCacheKey = `product_user_${productId}_${userId}`;
        let userRecommended = recommendationCache.get(userCacheKey);
        
        if (!userRecommended) {
          // Find users who bought/viewed this product
          const similarUserActions = await Order.aggregate([
            {
              $match: {
                'items.product': new mongoose.Types.ObjectId(productId),
                user: { $ne: new mongoose.Types.ObjectId(userId) },
                orderStatus: { $ne: 'cancelled' }
              }
            },
            { $group: { _id: '$user' } },
            { $limit: 50 }
          ]);
          
          if (similarUserActions.length > 0) {
            const similarUserIds = similarUserActions.map(u => u._id);
            
            // Get their other purchases
            userRecommended = await Order.aggregate([
              {
                $match: {
                  user: { $in: similarUserIds },
                  'items.product': { $ne: new mongoose.Types.ObjectId(productId) },
                  orderStatus: { $ne: 'cancelled' }
                }
              },
              { $unwind: '$items' },
              {
                $group: {
                  _id: '$items.product',
                  count: { $sum: 1 },
                  users: { $addToSet: '$user' }
                }
              },
              { $sort: { count: -1 } },
              { $limit: 5 },
              {
                $lookup: {
                  from: 'products',
                  localField: '_id',
                  foreignField: '_id',
                  as: 'product'
                }
              },
              { $unwind: '$product' },
              {
                $match: {
                  'product.stock': { $exists: true, $ne: [] }
                }
              },
              { $replaceRoot: { newRoot: '$product' } }
            ]);
            
            recommendationCache.set(userCacheKey, userRecommended || [], true);
          } else {
            userRecommended = [];
          }
        }
        
        response.userRecommended = userRecommended?.slice(0, 5) || [];
      } catch (error) {
        console.error('Error getting user recommendations:', error);
        response.userRecommended = [];
      }
    }
    
    // IMPORTANT: Always return a valid response object with arrays
    res.json({
      similar: Array.isArray(response.similar) ? response.similar : [],
      complementary: Array.isArray(response.complementary) ? response.complementary : [],
      userRecommended: Array.isArray(response.userRecommended) ? response.userRecommended : []
    });
    
  } catch (error) {
    console.error('Product recommendation error:', error);
    // Return empty arrays on error instead of error message
    res.json({
      similar: [],
      complementary: [],
      userRecommended: []
    });
  }
});

// Enhanced tracking endpoint with immediate cache invalidation
router.post('/track', protect, async (req, res) => {
  try {
    const { action, productId, duration, metadata = {} } = req.body;
    const userId = req.user._id;
    
    // Validate action
    const validActions = ['view', 'search', 'addToCart', 'wishlist', 'purchase', 'click', 'recommendation_load', 'scroll'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ message: 'Invalid action type' });
    }
    
    // Validate productId for actions that require it
    if (['view', 'addToCart', 'wishlist', 'click'].includes(action) && !productId) {
      return res.status(400).json({ message: 'Product ID is required for this action' });
    }
    
    // Immediately invalidate user-specific caches for real-time updates
    recommendationCache.invalidateUser(userId);
    
    // Common update object
    const commonUpdate = {
      $set: {
        'analytics.lastActivityDate': new Date()
      }
    };
    
    switch (action) {
      case 'view':
        // Track views with shorter minimum duration
        if (duration && duration >= config.tracking.minViewDuration) {
          await Promise.all([
            User.findByIdAndUpdate(
              userId,
              {
                $push: {
                  viewHistory: {
                    $each: [{
                      product: productId,
                      viewedAt: new Date(),
                      duration: Math.min(duration, 3600),
                      source: metadata.source || 'direct'
                    }],
                    $position: 0,
                    $slice: config.limits.viewHistoryLimit
                  }
                },
                ...commonUpdate
              },
              { new: false }
            ),
            // Increment product view count
            Product.findByIdAndUpdate(
              productId,
              { $inc: { viewCount: 1 } },
              { new: false }
            )
          ]);
          
          // Invalidate trending cache as well
          recommendationCache.invalidatePattern('trending');
        }
        break;
        
      case 'search':
        if (metadata.query) {
          await User.findByIdAndUpdate(
            userId,
            {
              $push: {
                searchHistory: {
                  $each: [{
                    query: metadata.query.toLowerCase().trim(),
                    searchedAt: new Date(),
                    resultsCount: metadata.resultsCount || 0,
                    clickedResults: metadata.clickedResults || []
                  }],
                  $position: 0,
                  $slice: config.limits.searchHistoryLimit
                }
              },
              ...commonUpdate
            },
            { new: false }
          );
        }
        break;
        
      case 'addToCart':
        if (productId) {
          await User.findByIdAndUpdate(
            userId,
            {
              $push: {
                'interactions.cartAdditions': {
                  product: productId,
                  timestamp: new Date(),
                  quantity: metadata.quantity || 1,
                  size: metadata.size,
                  color: metadata.color,
                  removed: false
                }
              },
              ...commonUpdate
            },
            { new: false }
          );
        }
        break;
        
      case 'wishlist':
        if (productId && metadata.wishlistAction) {
          const wishlistUpdate = metadata.wishlistAction === 'add'
            ? {
                $addToSet: {
                  'interactions.wishlist': {
                    product: productId,
                    addedAt: new Date()
                  }
                }
              }
            : {
                $pull: {
                  'interactions.wishlist': { product: productId }
                }
              };
          
          await User.findByIdAndUpdate(
            userId,
            {
              ...wishlistUpdate,
              ...commonUpdate
            },
            { new: false }
          );
        }
        break;
        
      case 'purchase':
        if (metadata.orderId) {
          await User.findByIdAndUpdate(
            userId,
            {
              $inc: {
                'analytics.totalOrders': 1,
                'analytics.totalSpent': metadata.totalAmount || 0
              },
              $set: {
                'analytics.lastPurchaseDate': new Date(),
                'analytics.lastActivityDate': new Date()
              }
            },
            { new: false }
          );
          
          // Invalidate collaborative filtering cache
          recommendationCache.invalidatePattern('collab');
        }
        break;
        
      case 'click':
        // Track recommendation clicks for analytics
        if (productId && metadata.recommendationType) {
          console.log(`Recommendation click: ${metadata.recommendationType} -> ${productId} by user ${userId}`);
          // Could store in analytics collection for detailed tracking
        }
        break;
        
      case 'recommendation_load':
        // Track when recommendations are loaded
        console.log(`Recommendations loaded: ${metadata.type} - ${metadata.count} items`);
        break;
        
      case 'scroll':
        // Track scrolling behavior
        console.log(`Scroll event: ${metadata.direction} from ${metadata.fromIndex} to ${metadata.toIndex}`);
        break;
    }
    
    res.json({ 
      success: true, 
      message: 'Tracking recorded',
      cacheInvalidated: true 
    });
  } catch (error) {
    console.error('Tracking error:', error);
    res.json({ success: false, message: 'Tracking failed but request continued' });
  }
});

// Real-time recommendations update endpoint
router.get('/realtime', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 10 } = req.query;
    
    // Force cache invalidation for real-time results
    recommendationCache.invalidateUser(userId);
    
    // Get fresh recommendations
    const recommendations = await getContentBasedRecommendations(userId, Number(limit));
    
    res.json({
      recommendations,
      timestamp: new Date(),
      cached: false
    });
  } catch (error) {
    console.error('Real-time recommendations error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get recommendation stats
router.get('/stats', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId)
      .select('viewHistory searchHistory interactions analytics')
      .lean();
    
    // Get favorite categories
    const categoryCount = new Map();
    const orders = await Order.find({
      user: userId,
      orderStatus: { $ne: 'cancelled' }
    })
      .populate('items.product', 'category price')
      .lean();
    
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.product?.category) {
          const cat = item.product.category;
          const totalSpent = (categoryCount.get(cat)?.totalSpent || 0) + (item.price * item.quantity);
          const count = (categoryCount.get(cat)?.count || 0) + item.quantity;
          categoryCount.set(cat, { count, totalSpent });
        }
      });
    });
    
    const favoriteCategories = Array.from(categoryCount.entries())
      .map(([_id, data]) => ({
        _id,
        count: data.count,
        totalSpent: data.totalSpent
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const stats = {
      totalViews: user?.viewHistory?.length || 0,
      totalPurchases: user?.analytics?.totalOrders || 0,
      favoriteCategories: favoriteCategories,
      recentActivity: {
        recentViews: user?.viewHistory?.filter(v => 
          new Date(v.viewedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ) || [],
        recentSearches: user?.searchHistory?.filter(s => 
          new Date(s.searchedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        ) || []
      },
      recommendationQuality: {
        personalizedAvailable: (user?.viewHistory?.length || 0) > config.tracking.viewCountThreshold || (user?.analytics?.totalOrders || 0) > 0,
        dataRichness: calculateDataRichness(user)
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get analytics
router.get('/admin/analytics', protect, async (req, res) => {
  try {
    if (req.user.email !== 'admin@gmail.com' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }
    
    const analytics = await getAdminAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== HELPER FUNCTIONS ====================

function getRecommendationReason(type, product) {
  const reasons = {
    collaborative: 'Người có sở thích tương tự đã mua',
    content: 'Phù hợp với sở thích của bạn',
    trending: `${product?.trendingUsers || 'Nhiều'} người đang quan tâm`,
    new: 'Sản phẩm mới phù hợp với bạn',
    mixed: 'Được đề xuất cho bạn',
    fallback: 'Sản phẩm phổ biến'
  };
  return reasons[type] || 'Sản phẩm đề xuất';
}

function calculateConfidence(type, index, total) {
  const baseConfidence = {
    collaborative: 0.85,
    content: 0.9,
    trending: 0.7,
    new: 0.6,
    mixed: 0.8,
    fallback: 0.5
  };
  
  const base = baseConfidence[type] || 0.5;
  const positionPenalty = (index / total) * 0.2;
  
  return Math.max(0.3, base - positionPenalty);
}

function calculateDataRichness(user) {
  if (!user) return 'low';
  
  const score = 
    (user.viewHistory?.length || 0) * 1 +
    (user.searchHistory?.length || 0) * 0.5 +
    (user.interactions?.wishlist?.length || 0) * 2 +
    (user.interactions?.cartAdditions?.length || 0) * 1.5 +
    (user.analytics?.totalOrders || 0) * 3;
  
  if (score > 50) return 'high';
  if (score > 20) return 'medium';
  return 'low';
}

function getPersonalizationLevel(user) {
  if (!user) return 'none';
  
  const viewCount = user.viewHistory?.length || 0;
  const orderCount = user.analytics?.totalOrders || 0;
  
  if (viewCount > 20 && orderCount > 3) return 'high';
  if (viewCount > 10 || orderCount > 1) return 'medium';
  if (viewCount > 5) return 'low';
  return 'minimal';
}

async function getComplementaryProducts(productIds, limit = 10) {
  try {
    // Validate product IDs
    const validProductIds = productIds
      .filter(id => id && mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));
    
    if (validProductIds.length === 0) return [];
    
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    const complements = await Order.aggregate([
      {
        $match: {
          'items.product': { $in: validProductIds },
          createdAt: { $gte: threeMonthsAgo },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      { $unwind: '$items' },
      {
        $match: {
          'items.product': { $nin: validProductIds }
        }
      },
      {
        $group: {
          _id: '$items.product',
          coOccurrences: { $sum: 1 },
          orders: { $addToSet: '$_id' },
          avgQuantity: { $avg: '$items.quantity' },
          buyers: { $addToSet: '$user' }
        }
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ['$coOccurrences', 3] },
              { $multiply: [{ $size: '$orders' }, 2] },
              { $multiply: [{ $size: '$buyers' }, 1] }
            ]
          }
        }
      },
      { $sort: { score: -1 } },
      { $limit: limit * 2 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $match: {
          'product.stock': { $exists: true, $ne: [] }
        }
      },
      {
        $addFields: {
          'product.complementScore': '$score',
          'product.boughtTogether': '$coOccurrences'
        }
      },
      { $replaceRoot: { newRoot: '$product' } },
      { $limit: limit }
    ]);
    
    return complements || [];
  } catch (error) {
    console.error('Complementary products error:', error);
    return [];
  }
}

async function getAdminAnalytics() {
  const now = new Date();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  
  const [userStats, productStats, orderStats, cacheStats] = await Promise.all([
    User.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          activeToday: [
            { 
              $match: { 
                $or: [
                  { 'analytics.lastActivityDate': { $gte: oneDayAgo } },
                  { 'viewHistory.viewedAt': { $gte: oneDayAgo } }
                ]
              } 
            },
            { $count: 'count' }
          ],
          activeWeek: [
            { 
              $match: { 
                $or: [
                  { 'analytics.lastActivityDate': { $gte: oneWeekAgo } },
                  { 'viewHistory.viewedAt': { $gte: oneWeekAgo } }
                ]
              } 
            },
            { $count: 'count' }
          ],
          activeMonth: [
            { 
              $match: { 
                $or: [
                  { 'analytics.lastActivityDate': { $gte: oneMonthAgo } },
                  { 'analytics.lastLoginDate': { $gte: oneMonthAgo } }
                ]
              } 
            },
            { $count: 'count' }
          ],
          byActivity: [
            {
              $project: {
                viewCount: { 
                  $cond: [
                    { $isArray: '$viewHistory' },
                    { $size: '$viewHistory' },
                    0
                  ]
                },
                searchCount: {
                  $cond: [
                    { $isArray: '$searchHistory' },
                    { $size: '$searchHistory' },
                    0
                  ]
                },
                orderCount: { $ifNull: ['$analytics.totalOrders', 0] },
                spent: { $ifNull: ['$analytics.totalSpent', 0] }
              }
            },
            {
              $group: {
                _id: null,
                avgViews: { $avg: '$viewCount' },
                avgSearches: { $avg: '$searchCount' },
                avgOrders: { $avg: '$orderCount' },
                avgSpent: { $avg: '$spent' },
                totalViews: { $sum: '$viewCount' },
                totalSearches: { $sum: '$searchCount' },
                usersWithViews: { 
                  $sum: { $cond: [{ $gt: ['$viewCount', 0] }, 1, 0] } 
                },
                usersWithOrders: { 
                  $sum: { $cond: [{ $gt: ['$orderCount', 0] }, 1, 0] } 
                }
              }
            }
          ]
        }
      }
    ]),
    
    Product.aggregate([
      {
        $facet: {
          byPopularity: [
            { $match: { viewCount: { $exists: true, $gt: 0 } } },
            { $sort: { viewCount: -1 } },
            { $limit: 10 },
            { 
              $project: { 
                name: 1, 
                category: 1,
                viewCount: { $ifNull: ['$viewCount', 0] }, 
                totalOrders: { $ifNull: ['$totalOrders', 0] },
                conversionRate: {
                  $cond: [
                    { $eq: ['$viewCount', 0] },
                    0,
                    { $multiply: [
                      { $divide: [{ $ifNull: ['$totalOrders', 0] }, '$viewCount'] },
                      100
                    ]}
                  ]
                }
              } 
            }
          ],
          byConversion: [
            {
              $match: {
                viewCount: { $exists: true, $gt: 0 },
                totalOrders: { $exists: true, $gt: 0 }
              }
            },
            {
              $addFields: {
                conversionRate: {
                  $multiply: [
                    { $divide: ['$totalOrders', '$viewCount'] },
                    100
                  ]
                }
              }
            },
            { $sort: { conversionRate: -1 } },
            { $limit: 10 },
            { 
              $project: { 
                name: 1, 
                category: 1,
                conversionRate: { $round: ['$conversionRate', 2] }, 
                viewCount: 1, 
                totalOrders: 1
              } 
            }
          ],
          recentlyViewed: [
            {
              $lookup: {
                from: 'users',
                let: { productId: '$_id' },
                pipeline: [
                  { $unwind: '$viewHistory' },
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$viewHistory.product', '$productId'] },
                          { $gte: ['$viewHistory.viewedAt', oneDayAgo] }
                        ]
                      }
                    }
                  },
                  { $count: 'recentViews' }
                ],
                as: 'recentViewData'
              }
            },
            {
              $match: {
                'recentViewData.recentViews': { $gt: 0 }
              }
            },
            {
              $project: {
                name: 1,
                category: 1,
                recentViews: { $arrayElemAt: ['$recentViewData.recentViews', 0] }
              }
            },
            { $sort: { recentViews: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ]),
    
    Order.aggregate([
      {
        $facet: {
          recent: [
            { 
              $match: { 
                createdAt: { $gte: oneWeekAgo },
                orderStatus: { $ne: 'cancelled' }
              } 
            },
            { $count: 'count' }
          ],
          recentRevenue: [
            { 
              $match: { 
                createdAt: { $gte: oneWeekAgo },
                orderStatus: { $ne: 'cancelled' }
              } 
            },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ],
          todayOrders: [
            { 
              $match: { 
                createdAt: { $gte: oneDayAgo },
                orderStatus: { $ne: 'cancelled' }
              } 
            },
            { $count: 'count' }
          ],
          todayRevenue: [
            { 
              $match: { 
                createdAt: { $gte: oneDayAgo },
                orderStatus: { $ne: 'cancelled' }
              } 
            },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]
        }
      }
    ]),
    
    Promise.resolve(recommendationCache.getStats())
  ]);
  
  return {
    users: {
      total: userStats[0].total[0]?.count || 0,
      activeToday: userStats[0].activeToday[0]?.count || 0,
      activeWeek: userStats[0].activeWeek[0]?.count || 0,
      activeMonth: userStats[0].activeMonth[0]?.count || 0,
      averages: userStats[0].byActivity[0] || {
        avgViews: 0,
        avgSearches: 0,
        avgOrders: 0,
        avgSpent: 0,
        totalViews: 0,
        totalSearches: 0,
        usersWithViews: 0,
        usersWithOrders: 0
      },
      engagement: {
        viewRate: userStats[0].byActivity[0] 
          ? (userStats[0].byActivity[0].usersWithViews / (userStats[0].total[0]?.count || 1) * 100).toFixed(2)
          : 0,
        purchaseRate: userStats[0].byActivity[0]
          ? (userStats[0].byActivity[0].usersWithOrders / (userStats[0].total[0]?.count || 1) * 100).toFixed(2)
          : 0
      }
    },
    products: {
      popular: productStats[0].byPopularity || [],
      highConversion: productStats[0].byConversion || [],
      trending: productStats[0].recentlyViewed || []
    },
    orders: {
      weeklyCount: orderStats[0].recent[0]?.count || 0,
      weeklyRevenue: orderStats[0].recentRevenue[0]?.total || 0,
      todayCount: orderStats[0].todayOrders[0]?.count || 0,
      todayRevenue: orderStats[0].todayRevenue[0]?.total || 0
    },
    cache: cacheStats,
    timestamp: new Date()
  };
}

// ==================== SCHEDULED TASKS ====================

// Clean up old cache entries every 5 minutes (more frequent for real-time updates)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of recommendationCache.cache) {
    const maxAge = value.isPersonalized 
      ? config.cache.personalizedDuration * 2 
      : config.cache.duration * 2;
      
    if (now - value.timestamp > maxAge) {
      recommendationCache.cache.delete(key);
      cleaned++;
    }
  }
  
  // Clean up old user activity tracking
  for (const [userId, lastActivity] of recommendationCache.userActivity) {
    if (now - lastActivity > 30 * 60 * 1000) { // 30 minutes
      recommendationCache.userActivity.delete(userId);
    }
  }
  
  if (cleaned > 0) {
    console.log(`[Cache Cleanup] Removed ${cleaned} expired entries at ${new Date().toISOString()}`);
  }
}, 5 * 60 * 1000);

// Periodic cache stats logging (every hour)
setInterval(() => {
  const stats = recommendationCache.getStats();
  console.log('[Cache Stats]', {
    ...stats,
    timestamp: new Date().toISOString()
  });
}, 60 * 60 * 1000);

// ==================== ERROR HANDLING ====================

// Global error handler for this router
router.use((error, req, res, next) => {
  console.error('[Recommendation Error]', {
    error: error.message,
    stack: error.stack,
    userId: req.userId,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // Send fallback recommendations on error
  getRandomProducts(20)
    .then(products => {
      res.json(products.map(p => ({
        ...toSafeObject(p),
        recommendationType: 'fallback',
        reason: 'Sản phẩm gợi ý',
        confidence: 0.5,
        error: true
      })));
    })
    .catch(() => {
      res.status(500).json({ 
        message: 'Unable to fetch recommendations',
        fallback: true,
        error: true
      });
    });
});

module.exports = router;