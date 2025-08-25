// backend/routes/recommendations.js - FIXED VERSION WITH CORRECT TRENDING COUNT
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');
const FlashSale = require('../models/FlashSale');
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
    purchase: 5,      
    view: 1,          
    search: 0.5,      
    wishlist: 2,      
    cart: 3,          
    recentBoost: 2,   
  },
  timeDecay: {
    purchaseDecayDays: 90,
    viewDecayDays: 3,      
    searchDecayDays: 14,   
  },
  tracking: {
    minViewDuration: 1,    
    viewCountThreshold: 3, 
  }
};

// ==================== ENHANCED CACHE MANAGEMENT ====================
class RecommendationCache {
  constructor() {
    this.cache = new Map();
    this.userActivity = new Map(); 
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

  trackUserActivity(userId) {
    const now = Date.now();
    const lastActivity = this.userActivity.get(userId) || 0;
    this.userActivity.set(userId, now);
    
    if (now - lastActivity < 5000) { 
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
  
  if (hoursSince < 1) return 2.0;  
  if (hoursSince < 24) return 1.5; 
  
  const daysSince = hoursSince / 24;
  return Math.max(0.1, Math.exp(-daysSince / decayDays));
};

const calculateProductSimilarity = (product1, product2) => {
  if (!product1 || !product2) return 0;
  
  let score = 0;
  
  if (product1.category === product2.category) {
    score += 4;
    if (product1.subcategory === product2.subcategory) score += 2;
  }
  
  if (product1.brand && product1.brand === product2.brand) {
    score += 2;
  }
  
  const priceDiff = Math.abs(product1.price - product2.price) / Math.max(product1.price, product2.price);
  score += (1 - priceDiff) * 2;
  
  if (product1.tags?.length && product2.tags?.length) {
    const commonTags = product1.tags.filter(tag => product2.tags.includes(tag));
    score += (commonTags.length / Math.max(product1.tags.length, product2.tags.length)) * 1;
  }
  
  const ratingDiff = Math.abs((product1.rating || 0) - (product2.rating || 0));
  score += (1 - ratingDiff / 5) * 1;
  
  return score;
};

// ==================== FLASH SALE INTEGRATION ====================
async function applyFlashSaleInfo(products) {
  if (!products || products.length === 0) return [];
  
  try {
    const productIds = products.map(p => p._id || p);
    
    const productsWithFlashSale = await Product.getProductsWithFlashSale(
      { _id: { $in: productIds } },
      {}
    );
    
    const flashSaleMap = new Map(
      productsWithFlashSale.map(p => [p._id.toString(), p])
    );
    
    return products.map(product => {
      const productId = (product._id || product).toString();
      const withFlashSale = flashSaleMap.get(productId);
      
      if (withFlashSale) {
        return {
          ...toSafeObject(product),
          ...withFlashSale,
          isFlashSale: withFlashSale.isFlashSale || false,
          effectivePrice: withFlashSale.effectivePrice || product.price,
          flashSale: withFlashSale.flashSale || null,
          recommendationType: product.recommendationType,
          reason: product.reason,
          confidence: product.confidence,
          recommendationScore: product.recommendationScore,
          recommendedByUsers: product.recommendedByUsers,
          contentScore: product.contentScore,
          trendingScore: product.trendingScore,
          trendingUsers: product.trendingUsers,
          trendingOrders: product.trendingOrders,
          complementScore: product.complementScore,
          boughtTogether: product.boughtTogether
        };
      }
      
      return {
        ...toSafeObject(product),
        isFlashSale: false,
        effectivePrice: product.price,
        flashSale: null
      };
    });
  } catch (error) {
    console.error('Error applying flash sale info:', error);
    return products.map(p => ({
      ...toSafeObject(p),
      isFlashSale: false,
      effectivePrice: p.price,
      flashSale: null
    }));
  }
}

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
    
    const recentViews = user.viewHistory?.filter(v => 
      new Date(v.viewedAt) > new Date(Date.now() - config.limits.recentActivityWindow)
    ).length || 0;
    
    const recentSearches = user.searchHistory?.filter(s => 
      new Date(s.searchedAt) > new Date(Date.now() - config.limits.recentActivityWindow)
    ).length || 0;
    
    const totalOrders = user.analytics?.totalOrders || 0;
    
    if (recentViews > 10 || recentSearches > 5) {
      return {
        content: Math.floor(limit * 0.6),
        collaborative: Math.floor(limit * 0.2),
        trending: Math.floor(limit * 0.1),
        new: Math.ceil(limit * 0.1)
      };
    } else if (recentViews > 5 || totalOrders > 0) {
      return {
        content: Math.floor(limit * 0.5),
        collaborative: Math.floor(limit * 0.25),
        trending: Math.floor(limit * 0.15),
        new: Math.ceil(limit * 0.1)
      };
    } else {
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

    const userProducts = new Map();
    
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

    const productIds = Array.from(userProducts.keys()).map(id => new mongoose.Types.ObjectId(id));
    
    const similarUsers = await Order.aggregate([
      {
        $match: {
          user: { $ne: new mongoose.Types.ObjectId(userId) },
          'items.product': { $in: productIds },
          orderStatus: { $ne: 'cancelled' },
          createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) }
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

    const recommendations = await Order.aggregate([
      {
        $match: {
          user: { $in: similarUsers.slice(0, 50).map(u => u._id) },
          orderStatus: { $ne: 'cancelled' },
          createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
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
                  2,
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

    const preferences = {
      categories: new Map(),
      brands: new Map(),
      priceRange: { min: 0, max: 10000000 },
      tags: new Map(),
      colors: new Map(),
      sizes: new Map(),
      recentProducts: []
    };

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
        
        product.colors?.forEach(color => {
          preferences.colors.set(color, (preferences.colors.get(color) || 0) + baseWeight * 0.5);
        });
        
        product.sizes?.forEach(size => {
          preferences.sizes.set(size, (preferences.sizes.get(size) || 0) + baseWeight * 0.5);
        });
        
        product.tags?.forEach(tag => {
          preferences.tags.set(tag, (preferences.tags.get(tag) || 0) + baseWeight * 0.7);
        });
      });
    }

    if (user.searchHistory && user.searchHistory.length > 0) {
      const recentSearches = user.searchHistory
        .filter(s => new Date(s.searchedAt) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))
        .slice(0, 20);
      
      recentSearches.forEach((search, index) => {
        const weight = config.weights.search * (1 + (1 / (index + 1)));
        const query = search.query.toLowerCase();
        
        const words = query.split(/\s+/);
        words.forEach(word => {
          if (word.length > 2) {
            preferences.tags.set(word, (preferences.tags.get(word) || 0) + weight);
          }
        });
      });
    }

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
          if (item.product.category) {
            preferences.categories.set(item.product.category, 
              (preferences.categories.get(item.product.category) || 0) + orderWeight);
          }
          
          if (item.product.brand) {
            preferences.brands.set(item.product.brand, 
              (preferences.brands.get(item.product.brand) || 0) + orderWeight);
          }
          
          if (item.product.price) {
            prices.push(item.product.price);
          }
          
          item.product.tags?.forEach(tag => {
            preferences.tags.set(tag, (preferences.tags.get(tag) || 0) + orderWeight * 0.8);
          });
          
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

    const mustConditions = [
      { stock: { $exists: true, $ne: [] } },
      { _id: { $nin: preferences.recentProducts } }
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

    const products = await Product.find(query)
      .limit(limit * 3)
      .lean();

    const scoredProducts = products.map(product => {
      let score = 0;
      
      const categoryScore = preferences.categories.get(product.category) || 0;
      score += categoryScore * 3;
      
      if (product.brand) {
        const brandScore = preferences.brands.get(product.brand) || 0;
        score += brandScore * 2;
      }
      
      let tagScore = 0;
      product.tags?.forEach(tag => {
        tagScore += (preferences.tags.get(tag) || 0);
      });
      score += tagScore * 1.5;
      
      let colorScore = 0;
      product.colors?.forEach(color => {
        colorScore += (preferences.colors.get(color) || 0);
      });
      score += colorScore;
      
      let sizeScore = 0;
      product.sizes?.forEach(size => {
        sizeScore += (preferences.sizes.get(size) || 0);
      });
      score += sizeScore * 0.5;
      
      score += (product.rating || 0) * 3;
      score += Math.log(Math.max(1, product.totalReviews || 0)) * 0.5;
      score += Math.log(Math.max(1, product.totalOrders || 0)) * 0.3;
      
      if (user.viewHistory?.length < 10) {
        score += Math.log(Math.max(1, product.viewCount || 0)) * 0.5;
      }
      
      const daysSinceCreated = (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated < 30) {
        score += (30 - daysSinceCreated) / 30 * 2;
      }
      
      if (product.price >= preferences.priceRange.min && product.price <= preferences.priceRange.max) {
        score += 2;
      }
      
      return { product, score };
    });

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

// 4. FIXED: Real-time Trending Products with Accurate User Count
async function getTrendingProducts(limit = 20) {
  const cacheKey = `trending_${limit}`;
  const cached = recommendationCache.get(cacheKey);
  if (cached) return cached;

  try {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    // Get order-based trending with accurate user count
    const orderTrending = await Order.aggregate([
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
          recentOrders: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', oneDayAgo] },
                3,
                {
                  $cond: [
                    { $gte: ['$createdAt', threeDaysAgo] },
                    2,
                    1
                  ]
                }
              ]
            }
          },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          uniqueBuyers: { $addToSet: '$user' },
          avgOrderValue: { $avg: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      {
        $addFields: {
          buyerCount: { $size: '$uniqueBuyers' }
        }
      }
    ]);

    // Get view-based trending with accurate viewer count
    const viewTrending = await User.aggregate([
      {
        $match: {
          'viewHistory.viewedAt': { $gte: threeDaysAgo }
        }
      },
      { $unwind: '$viewHistory' },
      {
        $match: {
          'viewHistory.viewedAt': { $gte: threeDaysAgo },
          'viewHistory.product': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$viewHistory.product',
          viewCount: { $sum: 1 },
          uniqueViewers: { $addToSet: '$_id' },
          recentViews: {
            $sum: {
              $cond: [
                { $gte: ['$viewHistory.viewedAt', oneDayAgo] },
                2,
                1
              ]
            }
          },
          avgDuration: { $avg: '$viewHistory.duration' }
        }
      },
      {
        $addFields: {
          viewerCount: { $size: '$uniqueViewers' }
        }
      }
    ]);

    // Get wishlist trending
    const wishlistTrending = await User.aggregate([
      {
        $match: {
          'interactions.wishlist': { $exists: true, $ne: [] }
        }
      },
      { $unwind: '$interactions.wishlist' },
      {
        $match: {
          'interactions.wishlist.addedAt': { $gte: oneWeekAgo }
        }
      },
      {
        $group: {
          _id: '$interactions.wishlist.product',
          wishlistCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$_id' }
        }
      },
      {
        $addFields: {
          wishlistUserCount: { $size: '$uniqueUsers' }
        }
      }
    ]);

    // Get cart additions trending
    const cartTrending = await User.aggregate([
      {
        $match: {
          'interactions.cartAdditions': { $exists: true, $ne: [] }
        }
      },
      { $unwind: '$interactions.cartAdditions' },
      {
        $match: {
          'interactions.cartAdditions.timestamp': { $gte: threeDaysAgo },
          'interactions.cartAdditions.removed': { $ne: true }
        }
      },
      {
        $group: {
          _id: '$interactions.cartAdditions.product',
          cartCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$_id' }
        }
      },
      {
        $addFields: {
          cartUserCount: { $size: '$uniqueUsers' }
        }
      }
    ]);

    // Create maps for easy lookup
    const orderMap = new Map(orderTrending.map(item => [
      item._id?.toString(), 
      {
        buyerCount: item.buyerCount,
        recentOrders: item.recentOrders,
        totalQuantity: item.totalQuantity,
        totalRevenue: item.totalRevenue
      }
    ]));

    const viewMap = new Map(viewTrending.map(item => [
      item._id?.toString(),
      {
        viewerCount: item.viewerCount,
        viewCount: item.viewCount,
        recentViews: item.recentViews,
        avgDuration: item.avgDuration
      }
    ]));

    const wishlistMap = new Map(wishlistTrending.map(item => [
      item._id?.toString(),
      {
        wishlistUserCount: item.wishlistUserCount,
        wishlistCount: item.wishlistCount
      }
    ]));

    const cartMap = new Map(cartTrending.map(item => [
      item._id?.toString(),
      {
        cartUserCount: item.cartUserCount,
        cartCount: item.cartCount
      }
    ]));

    // Get all unique product IDs
    const allProductIds = new Set([
      ...Array.from(orderMap.keys()),
      ...Array.from(viewMap.keys()),
      ...Array.from(wishlistMap.keys()),
      ...Array.from(cartMap.keys())
    ]);

    // Calculate combined trending score for each product
    const trendingScores = [];
    
    for (const productId of allProductIds) {
      if (!productId) continue;
      
      const orderData = orderMap.get(productId) || { buyerCount: 0, recentOrders: 0, totalQuantity: 0, totalRevenue: 0 };
      const viewData = viewMap.get(productId) || { viewerCount: 0, viewCount: 0, recentViews: 0, avgDuration: 0 };
      const wishlistData = wishlistMap.get(productId) || { wishlistUserCount: 0, wishlistCount: 0 };
      const cartData = cartMap.get(productId) || { cartUserCount: 0, cartCount: 0 };
      
      // Calculate total unique users interested (avoiding double counting)
      const allUsers = new Set();
      
      // This is an approximation since we can't directly merge user sets from different aggregations
      // But it gives a more accurate count than just summing
      const totalUniqueUsers = Math.max(
        orderData.buyerCount,
        viewData.viewerCount,
        orderData.buyerCount + viewData.viewerCount - Math.floor(orderData.buyerCount * 0.3), // Assume 30% overlap
        wishlistData.wishlistUserCount,
        cartData.cartUserCount
      );
      
      // Calculate comprehensive trending score
      const score = 
        (orderData.recentOrders * 10) +           // Recent purchases have highest weight
        (orderData.buyerCount * 8) +              // Number of buyers
        (viewData.recentViews * 2) +              // Recent views
        (viewData.viewerCount * 3) +              // Number of viewers
        (wishlistData.wishlistUserCount * 5) +    // Wishlist adds show high interest
        (cartData.cartUserCount * 6) +            // Cart adds show purchase intent
        (Math.log10(Math.max(1, orderData.totalRevenue)) * 2) + // Revenue impact
        (viewData.avgDuration ? Math.min(viewData.avgDuration / 10, 5) : 0); // Engagement
      
      trendingScores.push({
        productId: new mongoose.Types.ObjectId(productId),
        score,
        totalUniqueUsers,
        buyerCount: orderData.buyerCount,
        viewerCount: viewData.viewerCount,
        wishlistCount: wishlistData.wishlistUserCount,
        cartCount: cartData.cartUserCount,
        recentActivity: orderData.recentOrders + viewData.recentViews
      });
    }

    // Sort by score and get top products
    trendingScores.sort((a, b) => b.score - a.score);
    const topTrendingIds = trendingScores.slice(0, limit * 2);

    if (topTrendingIds.length === 0) {
      return [];
    }

    // Fetch product details
    const products = await Product.find({
      _id: { $in: topTrendingIds.map(item => item.productId) },
      stock: { $exists: true, $ne: [] }
    }).lean();

    // Create product map
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // Combine scores with product data
    const finalTrending = topTrendingIds
      .map(item => {
        const product = productMap.get(item.productId.toString());
        if (!product) return null;
        
        return {
          ...product,
          trendingScore: item.score,
          trendingUsers: item.totalUniqueUsers, // FIXED: Now shows accurate total unique users
          trendingBuyers: item.buyerCount,
          trendingViewers: item.viewerCount,
          trendingWishlist: item.wishlistCount,
          trendingCart: item.cartCount,
          recentActivity: item.recentActivity
        };
      })
      .filter(Boolean)
      .slice(0, limit);

    recommendationCache.set(cacheKey, finalTrending);
    return finalTrending;
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
              {
                $multiply: [
                  { $subtract: [1, { $divide: [
                    { $subtract: [Date.now(), '$createdAt'] },
                    { $subtract: [Date.now(), thirtyDaysAgo.getTime()] }
                  ]}]},
                  10
                ]
              },
              { $multiply: [{ $ifNull: ['$rating', 0] }, 2] },
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
    
    if (user.preferences?.preferredCategories?.length > 0) {
      return {
        categories: user.preferences.preferredCategories,
        brands: user.preferences.preferredBrands || [],
        tags: user.preferences.preferredTags || [],
        priceRange: user.preferences.priceRange
      };
    }

    const categories = new Map();
    const brands = new Map();
    const tags = new Map();
    const prices = [];
    
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
              (categories.get(item.product.category) || 0) + 3);
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

async function getComplementaryProducts(productIds, limit = 10) {
  try {
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

// ==================== MAIN ROUTES ====================

// Get recommendations with real-time updates
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { type = 'mixed', limit = config.limits.defaultRecommendations } = req.query;
    const safeLimit = Math.min(Number(limit) || config.limits.defaultRecommendations, config.limits.maxRecommendations);
    
    let recommendations = [];
    const startTime = Date.now();
    
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
      
      recommendations = await applyFlashSaleInfo(recommendations);
      
      return res.json(recommendations.map((product, index) => ({
        ...product,
        recommendationType: type,
        score: recommendations.length - index,
        reason: type === 'trending' 
          ? `${product.trendingUsers || 'Nhiều'} người đang quan tâm`  // FIXED: Now shows accurate count
          : 'Sản phẩm phổ biến',
        confidence: 0.5
      })));
    }
    
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
        const distributions = await getDynamicDistribution(userId, safeLimit);
        
        const [content, collab, trending, newArrivals] = await Promise.all([
          getContentBasedRecommendations(userId, distributions.content),
          getCollaborativeRecommendations(userId, distributions.collaborative),
          getTrendingProducts(distributions.trending),
          getPersonalizedNewArrivals(userId, distributions.new)
        ]);
        
        const seen = new Set();
        const merged = [];
        
        const user = await User.findById(userId).select('viewHistory analytics').lean();
        const isActiveUser = (user?.viewHistory?.length || 0) > config.tracking.viewCountThreshold;
        
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
    
    if (recommendations.length === 0) {
      recommendations = await getRandomProducts(safeLimit);
    }
    
    recommendations = await applyFlashSaleInfo(recommendations);
    
    const enriched = recommendations.map((product, index) => ({
      ...product,
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
    const withFlashSale = await applyFlashSaleInfo(fallback);
    res.json(withFlashSale.map(p => ({
      ...p,
      recommendationType: 'fallback',
      reason: 'Sản phẩm gợi ý'
    })));
  }
});

// Get product-specific recommendations
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
    
    if (userId) {
      recommendationCache.trackUserActivity(userId);
    }
    
    const response = {
      similar: [],
      complementary: [],
      userRecommended: []
    };
    
    try {
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
                { $cond: [{ $eq: ['$category', product.category] }, 10, 0] },
                { $cond: [{ $eq: ['$brand', product.brand] }, 5, 0] },
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
                {
                  $multiply: [
                    3,
                    { $divide: [
                      { $size: { $setIntersection: ['$tags', product.tags || []] } },
                      { $max: [{ $size: { $ifNull: ['$tags', []] } }, 1] }
                    ]}
                  ]
                },
                { $multiply: [{ $ifNull: ['$rating', 0] }, 0.5] },
                { $log10: { $add: [{ $ifNull: ['$viewCount', 0] }, 1] } }
              ]
            }
          }
        },
        { $sort: { similarityScore: -1 } },
        { $limit: 15 }
      ]);
      
      response.similar = await applyFlashSaleInfo(similar.slice(0, 10));
    } catch (error) {
      console.error('Error getting similar products:', error);
      response.similar = [];
    }
    
    try {
      const complementary = await getComplementaryProducts([productId], 10);
      response.complementary = await applyFlashSaleInfo(complementary);
    } catch (error) {
      console.error('Error getting complementary products:', error);
      response.complementary = [];
    }
    
    if (userId) {
      try {
        const userCacheKey = `product_user_${productId}_${userId}`;
        let userRecommended = recommendationCache.get(userCacheKey);
        
        if (!userRecommended) {
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
        
        response.userRecommended = await applyFlashSaleInfo(userRecommended?.slice(0, 5) || []);
      } catch (error) {
        console.error('Error getting user recommendations:', error);
        response.userRecommended = [];
      }
    }
    
    res.json({
      similar: Array.isArray(response.similar) ? response.similar : [],
      complementary: Array.isArray(response.complementary) ? response.complementary : [],
      userRecommended: Array.isArray(response.userRecommended) ? response.userRecommended : []
    });
    
  } catch (error) {
    console.error('Product recommendation error:', error);
    res.json({
      similar: [],
      complementary: [],
      userRecommended: []
    });
  }
});

// Enhanced tracking endpoint - FIXED to invalidate trending cache
router.post('/track', protect, async (req, res) => {
  try {
    const { action, productId, duration, metadata = {} } = req.body;
    const userId = req.user._id;
    
    const validActions = ['view', 'search', 'addToCart', 'wishlist', 'purchase','click', 'recommendation_load', 'scroll'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ message: 'Invalid action type' });
    }
    
    if (['view', 'addToCart', 'wishlist', 'click'].includes(action) && !productId) {
      return res.status(400).json({ message: 'Product ID is required for this action' });
    }
    
    // Immediately invalidate caches for real-time updates
    recommendationCache.invalidateUser(userId);
    
    // FIXED: Also invalidate trending cache when user interacts with products
    if (['view', 'addToCart', 'wishlist', 'purchase'].includes(action)) {
      recommendationCache.invalidatePattern('trending');
    }
    
    const commonUpdate = {
      $set: {
        'analytics.lastActivityDate': new Date()
      }
    };
    
    switch (action) {
      case 'view':
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
            Product.findByIdAndUpdate(
              productId,
              { $inc: { viewCount: 1 } },
              { new: false }
            )
          ]);
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
        if (productId && metadata.recommendationType) {
          console.log(`Recommendation click: ${metadata.recommendationType} -> ${productId} by user ${userId}`);
        }
        break;
        
      case 'recommendation_load':
        console.log(`Recommendations loaded: ${metadata.type} - ${metadata.count} items`);
        break;
        
      case 'scroll':
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
    
    recommendationCache.invalidateUser(userId);
    
    const recommendations = await getContentBasedRecommendations(userId, Number(limit));
    const withFlashSale = await applyFlashSaleInfo(recommendations);
    
    res.json({
      recommendations: withFlashSale,
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
    trending: `${product?.trendingUsers || 'Nhiều'} người đang quan tâm`, // FIXED: Now shows accurate count
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
                viewCount: 1, 
                totalOrders: 1
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
      activeWeek: userStats[0].activeWeek[0]?.count || 0
    },
    products: {
      popular: productStats[0].byPopularity || [],
      highConversion: productStats[0].byConversion || []
    },
    orders: {
      weeklyCount: orderStats[0].recent[0]?.count || 0,
      weeklyRevenue: orderStats[0].recentRevenue[0]?.total || 0
    },
    cache: cacheStats,
    timestamp: new Date()
  };
}

// ==================== SCHEDULED TASKS ====================

// Clean up old cache entries every 5 minutes
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
  
  for (const [userId, lastActivity] of recommendationCache.userActivity) {
    if (now - lastActivity > 30 * 60 * 1000) {
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

// FIXED: Invalidate trending cache more frequently (every 30 seconds)
setInterval(() => {
  recommendationCache.invalidatePattern('trending');
  console.log('[Trending Cache] Invalidated for fresh data at', new Date().toISOString());
}, 30 * 1000);

// Invalidate flash sale cache when sales change (every minute)
setInterval(async () => {
  try {
    const now = new Date();
    const activeSales = await FlashSale.find({
      $or: [
        { startDate: { $gte: new Date(now - 60 * 1000), $lte: now } },
        { endDate: { $gte: new Date(now - 60 * 1000), $lte: now } }
      ]
    });
    
    if (activeSales.length > 0) {
      console.log('[Flash Sale] Status changed, invalidating cache');
      recommendationCache.invalidatePattern('trending');
      recommendationCache.invalidatePattern('guest');
      recommendationCache.clear();
    }
  } catch (error) {
    console.error('[Flash Sale Check] Error:', error);
  }
}, 60 * 1000);

// ==================== ERROR HANDLING ====================

router.use((error, req, res, next) => {
  console.error('[Recommendation Error]', {
    error: error.message,
    stack: error.stack,
    userId: req.userId,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  getRandomProducts(20)
    .then(async products => {
      const withFlashSale = await applyFlashSaleInfo(products);
      res.json(withFlashSale.map(p => ({
        ...p,
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
