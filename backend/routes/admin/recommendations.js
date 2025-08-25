// backend/routes/admin/recommendations.js - Enhanced Version with Accurate Analytics
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../../models/User');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const { adminAuth } = require('../../middleware/adminAuth');

// ==================== CONFIGURATION ====================
const config = {
  analytics: {
    refreshInterval: 5 * 60 * 1000, // 5 minutes cache
    segmentationPeriods: {
      realtime: 15 * 60 * 1000,     // 15 minutes
      daily: 24 * 60 * 60 * 1000,   // 1 day
      weekly: 7 * 24 * 60 * 60 * 1000,  // 7 days
      monthly: 30 * 24 * 60 * 60 * 1000  // 30 days
    }
  },
  churnRisk: {
    weights: {
      lastActivity: 0.3,
      purchaseFrequency: 0.25,
      cartAbandonment: 0.15,
      engagement: 0.2,
      searchActivity: 0.1
    },
    thresholds: {
      high: 70,
      medium: 40,
      low: 20
    }
  },
  recommendations: {
    performanceThresholds: {
      excellent: 10,  // >10% conversion
      good: 5,        // 5-10% conversion
      average: 2,     // 2-5% conversion
      poor: 0         // <2% conversion
    }
  }
};

// ==================== CACHE MANAGEMENT ====================
class AnalyticsCache {
  constructor() {
    this.cache = new Map();
    this.lastUpdate = new Map();
  }

  get(key) {
    const cached = this.cache.get(key);
    const lastUpdate = this.lastUpdate.get(key) || 0;
    
    if (cached && (Date.now() - lastUpdate) < config.analytics.refreshInterval) {
      return cached;
    }
    return null;
  }

  set(key, data) {
    this.cache.set(key, data);
    this.lastUpdate.set(key, Date.now());
  }

  invalidate(pattern = null) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
          this.lastUpdate.delete(key);
        }
      }
    } else {
      this.cache.clear();
      this.lastUpdate.clear();
    }
  }
}

const analyticsCache = new AnalyticsCache();

// ==================== ENHANCED ANALYTICS ====================

// Get comprehensive dashboard analytics
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const cacheKey = 'dashboard_analytics';
    const cached = analyticsCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const now = new Date();
    const periods = {
      today: new Date(now.setHours(0, 0, 0, 0)),
      yesterday: new Date(now.setDate(now.getDate() - 1)),
      weekAgo: new Date(now.setDate(now.getDate() - 7)),
      monthAgo: new Date(now.setMonth(now.getMonth() - 1)),
      thirtyDaysAgo: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    };

    // Parallel execution for better performance
    const [
      userMetrics,
      productMetrics,
      behaviorMetrics,
      revenueMetrics,
      systemHealth,
      wishlistMetrics
    ] = await Promise.all([
      getUserMetrics(periods),
      getProductMetrics(periods),
      getBehaviorMetrics(periods),
      getRevenueMetrics(periods),
      getSystemHealth(),
      getWishlistMetrics(periods)
    ]);

    const dashboard = {
      timestamp: new Date(),
      userMetrics,
      productMetrics,
      behaviorMetrics,
      revenueMetrics,
      systemHealth,
      wishlistMetrics,
      recommendations: {
        totalGenerated: await getRecommendationCount(),
        conversionRate: await getRecommendationConversion(),
        topPerformers: await getTopPerformingRecommendations()
      }
    };

    analyticsCache.set(cacheKey, dashboard);
    res.json(dashboard);
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ 
      message: error.message,
      fallback: getEmptyDashboard()
    });
  }
});

// Get real-time user segmentation
router.get('/segmentation', adminAuth, async (req, res) => {
  try {
    const segments = await getUserSegments();
    res.json(segments);
  } catch (error) {
    console.error('Segmentation error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get personalization effectiveness metrics
router.get('/personalization-metrics', adminAuth, async (req, res) => {
  try {
    const { period = 'weekly' } = req.query;
    const metrics = await getPersonalizationMetrics(period);
    res.json(metrics);
  } catch (error) {
    console.error('Personalization metrics error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Enhanced churn prediction with ML-like scoring
router.post('/predict-churn/advanced', adminAuth, async (req, res) => {
  try {
    const { 
      includeRecommendations = true,
      segmentSize = 'all',
      riskLevel = 'all'
    } = req.body;

    const predictions = await advancedChurnPrediction({
      includeRecommendations,
      segmentSize,
      riskLevel
    });

    res.json(predictions);
  } catch (error) {
    console.error('Advanced churn prediction error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get recommendation performance by algorithm
router.get('/algorithm-performance', adminAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const performance = await getAlgorithmPerformance(days);
    res.json(performance);
  } catch (error) {
    console.error('Algorithm performance error:', error);
    res.status(500).json({ message: error.message });
  }
});

// A/B testing results for recommendations
router.get('/ab-testing', adminAuth, async (req, res) => {
  try {
    const tests = await getABTestResults();
    res.json(tests);
  } catch (error) {
    console.error('A/B testing error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user journey analysis
router.get('/user-journey/:userId', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const journey = await analyzeUserJourney(userId);
    res.json(journey);
  } catch (error) {
    console.error('User journey error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Export analytics data
router.get('/export/:type', adminAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'json', startDate, endDate } = req.query;

    const data = await exportAnalytics(type, { startDate, endDate });

    if (format === 'csv') {
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${type}-${Date.now()}.csv`);
      res.send(csv);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== HELPER FUNCTIONS ====================

async function getUserMetrics(periods) {
  const [
    totalUsers,
    newUsers,
    activeUsers,
    churnedUsers,
    usersBySegment
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: periods.monthAgo } }),
    User.countDocuments({
      $or: [
        { 'analytics.lastActivityDate': { $gte: periods.weekAgo } },
        { 'analytics.lastLoginDate': { $gte: periods.weekAgo } }
      ]
    }),
    User.countDocuments({
      $and: [
        { 'analytics.lastActivityDate': { $lt: periods.monthAgo } },
        { 'analytics.totalOrders': { $gt: 0 } }
      ]
    }),
    getUserSegmentCounts()
  ]);

  return {
    total: totalUsers,
    new: newUsers,
    active: activeUsers,
    churned: churnedUsers,
    activeRate: ((activeUsers / totalUsers) * 100).toFixed(2),
    churnRate: ((churnedUsers / totalUsers) * 100).toFixed(2),
    segments: usersBySegment,
    growth: {
      daily: await calculateGrowthRate('daily'),
      weekly: await calculateGrowthRate('weekly'),
      monthly: await calculateGrowthRate('monthly')
    }
  };
}

async function getProductMetrics(periods) {
  const metrics = await Product.aggregate([
    {
      $facet: {
        topViewed: [
          { $sort: { viewCount: -1 } },
          { $limit: 10 },
          { $project: { name: 1, category: 1, viewCount: 1, totalOrders: 1 } }
        ],
        topConverting: [
          { $match: { viewCount: { $gt: 0 }, totalOrders: { $gt: 0 } } },
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
          { $project: { name: 1, category: 1, conversionRate: 1, viewCount: 1, totalOrders: 1 } }
        ],
        categoryPerformance: [
          {
            $group: {
              _id: '$category',
              products: { $sum: 1 },
              totalViews: { $sum: '$viewCount' },
              totalOrders: { $sum: '$totalOrders' },
              avgRating: { $avg: '$rating' }
            }
          },
          { $sort: { totalOrders: -1 } }
        ]
      }
    }
  ]);

  return metrics[0];
}

async function getBehaviorMetrics(periods) {
  // Get daily activity for the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const [behaviors, dailyActivity] = await Promise.all([
    User.aggregate([
      {
        $facet: {
          viewPatterns: [
            { $unwind: '$viewHistory' },
            { $match: { 'viewHistory.viewedAt': { $gte: periods.weekAgo } } },
            {
              $group: {
                _id: {
                  hour: { $hour: '$viewHistory.viewedAt' },
                  dayOfWeek: { $dayOfWeek: '$viewHistory.viewedAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } }
          ],
          searchPatterns: [
            { $unwind: '$searchHistory' },
            { $match: { 'searchHistory.searchedAt': { $gte: periods.weekAgo } } },
            {
              $group: {
                _id: '$searchHistory.query',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 20 }
          ],
          cartPatterns: [
            { $unwind: '$interactions.cartAdditions' },
            { $match: { 'interactions.cartAdditions.timestamp': { $gte: periods.weekAgo } } },
            {
              $group: {
                _id: '$_id',
                cartAdditions: { $sum: 1 },
                cartRemovals: {
                  $sum: {
                    $cond: ['$interactions.cartAdditions.removed', 1, 0]
                  }
                }
              }
            },
            {
              $group: {
                _id: null,
                avgAdditions: { $avg: '$cartAdditions' },
                avgRemovals: { $avg: '$cartRemovals' },
                totalUsers: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]),
    // Get daily activity aggregated by date for last 30 days
    getDailyActivity(thirtyDaysAgo)
  ]);

  return {
    ...behaviors[0],
    dailyActivity
  };
}

// New function to get daily activity data
async function getDailyActivity(startDate) {
  try {
    const activities = await User.aggregate([
      {
        $facet: {
          views: [
            { $unwind: '$viewHistory' },
            { $match: { 'viewHistory.viewedAt': { $gte: startDate } } },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$viewHistory.viewedAt' }
                },
                count: { $sum: 1 }
              }
            }
          ],
          searches: [
            { $unwind: '$searchHistory' },
            { $match: { 'searchHistory.searchedAt': { $gte: startDate } } },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$searchHistory.searchedAt' }
                },
                count: { $sum: 1 }
              }
            }
          ],
          cartAdds: [
            { $unwind: '$interactions.cartAdditions' },
            { $match: { 'interactions.cartAdditions.timestamp': { $gte: startDate } } },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$interactions.cartAdditions.timestamp' }
                },
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    // Get purchase data
    const purchases = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Merge all activity data by date
    const dailyMap = new Map();
    
    // Initialize all days with 0
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dailyMap.set(dateStr, {
        date: dateStr,
        views: 0,
        searches: 0,
        cartAdds: 0,
        purchases: 0
      });
    }

    // Populate with actual data
    activities[0].views.forEach(item => {
      if (dailyMap.has(item._id)) {
        dailyMap.get(item._id).views = item.count;
      }
    });

    activities[0].searches.forEach(item => {
      if (dailyMap.has(item._id)) {
        dailyMap.get(item._id).searches = item.count;
      }
    });

    activities[0].cartAdds.forEach(item => {
      if (dailyMap.has(item._id)) {
        dailyMap.get(item._id).cartAdds = item.count;
      }
    });

    purchases.forEach(item => {
      if (dailyMap.has(item._id)) {
        dailyMap.get(item._id).purchases = item.count;
      }
    });

    // Convert to array and sort by date
    return Array.from(dailyMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  } catch (error) {
    console.error('Error getting daily activity:', error);
    return [];
  }
}

// New function to get wishlist metrics
async function getWishlistMetrics(periods) {
  try {
    const [totalWishlist, monthlyAdds, topWishlisted] = await Promise.all([
      // Total wishlist items across all users
      User.aggregate([
        { $unwind: '$interactions.wishlist' },
        { $count: 'total' }
      ]),
      // Wishlist additions in the last month
      User.aggregate([
        { $unwind: '$interactions.wishlist' },
        { $match: { 'interactions.wishlist.addedAt': { $gte: periods.monthAgo } } },
        { $count: 'total' }
      ]),
      // Top wishlisted products
      User.aggregate([
        { $unwind: '$interactions.wishlist' },
        {
          $group: {
            _id: '$interactions.wishlist.product',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'productInfo'
          }
        },
        { $unwind: '$productInfo' },
        {
          $project: {
            _id: 1,
            name: '$productInfo.name',
            category: '$productInfo.category',
            wishlistCount: '$count'
          }
        }
      ])
    ]);

    return {
      totalWishlistItems: totalWishlist[0]?.total || 0,
      monthlyWishlistAdds: monthlyAdds[0]?.total || 0,
      topWishlistedProducts: topWishlisted || []
    };
  } catch (error) {
    console.error('Error getting wishlist metrics:', error);
    return {
      totalWishlistItems: 0,
      monthlyWishlistAdds: 0,
      topWishlistedProducts: []
    };
  }
}

async function getRevenueMetrics(periods) {
  const revenue = await Order.aggregate([
    {
      $facet: {
        daily: [
          { $match: { createdAt: { $gte: periods.today } } },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$totalAmount' },
              orders: { $sum: 1 },
              avgOrderValue: { $avg: '$totalAmount' }
            }
          }
        ],
        weekly: [
          { $match: { createdAt: { $gte: periods.weekAgo } } },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$totalAmount' },
              orders: { $sum: 1 },
              avgOrderValue: { $avg: '$totalAmount' }
            }
          }
        ],
        monthly: [
          { $match: { createdAt: { $gte: periods.monthAgo } } },
          {
            $group: {
              _id: null,
              revenue: { $sum: '$totalAmount' },
              orders: { $sum: 1 },
              avgOrderValue: { $avg: '$totalAmount' }
            }
          }
        ],
        bySource: [
          { $match: { createdAt: { $gte: periods.weekAgo } } },
          {
            $lookup: {
              from: 'users',
              localField: 'user',
              foreignField: '_id',
              as: 'userData'
            }
          },
          { $unwind: '$userData' },
          {
            $group: {
              _id: {
                $cond: [
                  { $gt: [{ $size: '$userData.viewHistory' }, 10] },
                  'returning',
                  'new'
                ]
              },
              revenue: { $sum: '$totalAmount' },
              orders: { $sum: 1 }
            }
          }
        ]
      }
    }
  ]);

  return revenue[0];
}

async function getSystemHealth() {
  const health = {
    database: 'healthy',
    recommendations: 'healthy',
    tracking: 'healthy',
    performance: {}
  };

  try {
    // Check database response time
    const start = Date.now();
    await User.findOne().limit(1);
    health.performance.dbResponseTime = Date.now() - start;

    // Check recommendation system
    const recentRecommendations = await User.countDocuments({
      'viewHistory.source': 'recommendation',
      'viewHistory.viewedAt': { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    });
    
    health.recommendations = recentRecommendations > 0 ? 'healthy' : 'warning';

    // Check tracking system
    const recentTracking = await User.countDocuments({
      'analytics.lastActivityDate': { $gte: new Date(Date.now() - 15 * 60 * 1000) }
    });
    
    health.tracking = recentTracking > 0 ? 'healthy' : 'warning';

    // Overall health
    health.overall = (health.database === 'healthy' && 
                     health.recommendations === 'healthy' && 
                     health.tracking === 'healthy') ? 'healthy' : 'warning';

  } catch (error) {
    health.overall = 'error';
    health.error = error.message;
  }

  return health;
}

async function getUserSegments() {
  const segments = await User.aggregate([
    {
      $addFields: {
        segment: {
          $switch: {
            branches: [
              {
                case: { $gte: ['$analytics.totalSpent', 5000000] },
                then: 'VIP'
              },
              {
                case: { $gte: ['$analytics.totalOrders', 10] },
                then: 'Loyal'
              },
              {
                case: { $gte: ['$analytics.totalOrders', 3] },
                then: 'Regular'
              },
              {
                case: { $gte: ['$analytics.totalOrders', 1] },
                then: 'Occasional'
              },
              {
                case: { $gte: [{ $size: { $ifNull: ['$viewHistory', []] } }, 5] },
                then: 'Browser'
              }
            ],
            default: 'New'
          }
        }
      }
    },
    {
      $group: {
        _id: '$segment',
        count: { $sum: 1 },
        avgSpent: { $avg: '$analytics.totalSpent' },
        avgOrders: { $avg: '$analytics.totalOrders' },
        users: { $push: { _id: '$_id', name: '$name', email: '$email' } }
      }
    },
    { $sort: { avgSpent: -1 } }
  ]);

  return segments.map(segment => ({
    ...segment,
    users: segment.users.slice(0, 5) // Limit user list for performance
  }));
}

async function getUserSegmentCounts() {
  const segments = await getUserSegments();
  return segments.reduce((acc, segment) => {
    acc[segment._id] = segment.count;
    return acc;
  }, {});
}

async function calculateGrowthRate(period) {
  const now = new Date();
  let currentStart, previousStart, previousEnd;

  switch (period) {
    case 'daily':
      currentStart = new Date(now.setHours(0, 0, 0, 0));
      previousEnd = new Date(currentStart);
      previousStart = new Date(previousEnd.setDate(previousEnd.getDate() - 1));
      break;
    case 'weekly':
      currentStart = new Date(now.setDate(now.getDate() - 7));
      previousEnd = new Date(currentStart);
      previousStart = new Date(previousEnd.setDate(previousEnd.getDate() - 7));
      break;
    case 'monthly':
      currentStart = new Date(now.setMonth(now.getMonth() - 1));
      previousEnd = new Date(currentStart);
      previousStart = new Date(previousEnd.setMonth(previousEnd.getMonth() - 1));
      break;
  }

  const [current, previous] = await Promise.all([
    User.countDocuments({ createdAt: { $gte: currentStart } }),
    User.countDocuments({ 
      createdAt: { 
        $gte: previousStart,
        $lt: previousEnd
      }
    })
  ]);

  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous * 100).toFixed(2);
}

async function getRecommendationCount() {
  const count = await User.aggregate([
    { $unwind: '$viewHistory' },
    { $match: { 'viewHistory.source': 'recommendation' } },
    { $count: 'total' }
  ]);
  
  return count[0]?.total || 0;
}

async function getRecommendationConversion() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const [views, purchases] = await Promise.all([
    User.aggregate([
      { $unwind: '$viewHistory' },
      { 
        $match: { 
          'viewHistory.source': 'recommendation',
          'viewHistory.viewedAt': { $gte: thirtyDaysAgo }
        }
      },
      { $count: 'total' }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'users',
          let: { userId: '$user', productId: '$items.product' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$userId'] } } },
            { $unwind: '$viewHistory' },
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$viewHistory.product', '$productId'] },
                    { $eq: ['$viewHistory.source', 'recommendation'] }
                  ]
                }
              }
            }
          ],
          as: 'recommendedView'
        }
      },
      { $match: { recommendedView: { $ne: [] } } },
      { $count: 'total' }
    ])
  ]);

  const viewCount = views[0]?.total || 0;
  const purchaseCount = purchases[0]?.total || 0;
  
  return viewCount > 0 ? ((purchaseCount / viewCount) * 100).toFixed(2) : 0;
}

async function getTopPerformingRecommendations() {
  const topProducts = await Product.aggregate([
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
                  { $eq: ['$viewHistory.source', 'recommendation'] }
                ]
              }
            }
          }
        ],
        as: 'recommendedViews'
      }
    },
    {
      $addFields: {
        recommendationViews: { $size: '$recommendedViews' }
      }
    },
    { $match: { recommendationViews: { $gt: 0 } } },
    {
      $project: {
        name: 1,
        category: 1,
        recommendationViews: 1,
        totalOrders: 1,
        conversionRate: {
          $cond: [
            { $eq: ['$recommendationViews', 0] },
            0,
            { $multiply: [{ $divide: ['$totalOrders', '$recommendationViews'] }, 100] }
          ]
        }
      }
    },
    { $sort: { conversionRate: -1 } },
    { $limit: 10 }
  ]);

  return topProducts;
}

async function getPersonalizationMetrics(period) {
  const periodMs = config.analytics.segmentationPeriods[period] || 
                   config.analytics.segmentationPeriods.weekly;
  const startDate = new Date(Date.now() - periodMs);

  const metrics = await User.aggregate([
    {
      $facet: {
        personalized: [
          {
            $match: {
              $or: [
                { 'viewHistory.source': 'content' },
                { 'viewHistory.source': 'collaborative' }
              ]
            }
          },
          { $count: 'total' }
        ],
        generic: [
          {
            $match: {
              $or: [
                { 'viewHistory.source': 'trending' },
                { 'viewHistory.source': 'random' }
              ]
            }
          },
          { $count: 'total' }
        ],
        engagement: [
          { $unwind: '$viewHistory' },
          { $match: { 'viewHistory.viewedAt': { $gte: startDate } } },
          {
            $group: {
              _id: '$viewHistory.source',
              avgDuration: { $avg: '$viewHistory.duration' },
              count: { $sum: 1 }
            }
          }
        ]
      }
    }
  ]);

  return {
    personalized: metrics[0].personalized[0]?.total || 0,
    generic: metrics[0].generic[0]?.total || 0,
    engagement: metrics[0].engagement,
    effectiveness: calculatePersonalizationEffectiveness(metrics[0])
  };
}

function calculatePersonalizationEffectiveness(metrics) {
  const personalized = metrics.personalized[0]?.total || 0;
  const generic = metrics.generic[0]?.total || 0;
  const total = personalized + generic;
  
  if (total === 0) return 0;
  
  const personalizedEngagement = metrics.engagement.find(e => 
    ['content', 'collaborative'].includes(e._id)
  );
  const genericEngagement = metrics.engagement.find(e => 
    ['trending', 'random'].includes(e._id)
  );
  
  const personalizedScore = personalizedEngagement?.avgDuration || 0;
  const genericScore = genericEngagement?.avgDuration || 0;
  
  if (genericScore === 0) return 100;
  return ((personalizedScore / genericScore - 1) * 100).toFixed(2);
}

async function advancedChurnPrediction(options) {
  const query = {};
  
  if (options.segmentSize !== 'all') {
    // Add segment filtering logic
  }

  const users = await User.find(query)
    .select('name email analytics interactions viewHistory searchHistory')
    .lean();

  const predictions = await Promise.all(
    users.map(user => predictUserChurnAdvanced(user, options))
  );

  // Filter by risk level if specified
  let filtered = predictions;
  if (options.riskLevel !== 'all') {
    filtered = predictions.filter(p => 
      p.riskLevel.toLowerCase() === options.riskLevel.toLowerCase()
    );
  }

  return filtered.sort((a, b) => b.riskScore - a.riskScore);
}

async function predictUserChurnAdvanced(user, options) {
  const factors = [];
  let totalScore = 0;

  // Advanced scoring algorithm
  const scores = {
    lastActivity: calculateActivityScore(user),
    purchasePattern: await calculatePurchasePatternScore(user._id),
    engagement: calculateEngagementScore(user),
    cartBehavior: calculateCartBehaviorScore(user),
    searchBehavior: calculateSearchBehaviorScore(user)
  };

  // Apply weights
  for (const [factor, score] of Object.entries(scores)) {
    const weight = config.churnRisk.weights[factor] || 0.1;
    const weightedScore = score * weight;
    totalScore += weightedScore;
    
    factors.push({
      factor: factor,
      score: score,
      weight: weight,
      weightedScore: weightedScore
    });
  }

  const riskLevel = 
    totalScore >= config.churnRisk.thresholds.high ? 'High' :
    totalScore >= config.churnRisk.thresholds.medium ? 'Medium' : 'Low';

  const result = {
    userId: user._id,
    name: user.name,
    email: user.email,
    riskScore: Math.min(100, Math.round(totalScore)),
    riskLevel,
    factors,
    lastActivity: user.analytics?.lastActivityDate || user.analytics?.lastLoginDate
  };

  if (options.includeRecommendations) {
    result.recommendations = generateRetentionRecommendations(factors, riskLevel);
  }

  return result;
}

function calculateActivityScore(user) {
  const lastActivity = user.analytics?.lastActivityDate || 
                       user.analytics?.lastLoginDate;
  
  if (!lastActivity) return 100;
  
  const daysSince = (Date.now() - new Date(lastActivity).getTime()) / 
                    (1000 * 60 * 60 * 24);
  
  if (daysSince > 60) return 100;
  if (daysSince > 30) return 70;
  if (daysSince > 14) return 40;
  if (daysSince > 7) return 20;
  return 0;
}

async function calculatePurchasePatternScore(userId) {
  const orders = await Order.find({ 
    user: userId,
    orderStatus: { $ne: 'cancelled' }
  })
  .select('createdAt totalAmount')
  .sort('createdAt')
  .lean();

  if (orders.length === 0) return 80;
  if (orders.length === 1) return 60;

  // Calculate purchase frequency trend
  const intervals = [];
  for (let i = 1; i < orders.length; i++) {
    const days = (new Date(orders[i].createdAt) - new Date(orders[i-1].createdAt)) / 
                 (1000 * 60 * 60 * 24);
    intervals.push(days);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const lastOrderDays = (Date.now() - new Date(orders[orders.length - 1].createdAt)) / 
                        (1000 * 60 * 60 * 24);

  if (lastOrderDays > avgInterval * 3) return 80;
  if (lastOrderDays > avgInterval * 2) return 50;
  if (lastOrderDays > avgInterval * 1.5) return 30;
  return 10;
}

function calculateEngagementScore(user) {
  const viewCount = user.viewHistory?.length || 0;
  const searchCount = user.searchHistory?.length || 0;
  const wishlistCount = user.interactions?.wishlist?.length || 0;

  const recentViews = user.viewHistory?.filter(v => 
    new Date(v.viewedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length || 0;

  if (viewCount === 0 && searchCount === 0) return 90;
  if (recentViews === 0 && viewCount > 10) return 70;
  if (recentViews < 3) return 40;
  
  const engagementScore = Math.max(0, 100 - (
    (viewCount * 0.5) + 
    (searchCount * 0.3) + 
    (wishlistCount * 2) + 
    (recentViews * 5)
  ));
  
  return Math.min(100, engagementScore);
}

function calculateCartBehaviorScore(user) {
  const cartAdditions = user.interactions?.cartAdditions || [];
  const recentCarts = cartAdditions.filter(item => 
    new Date(item.timestamp) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  
  const abandonmentRate = recentCarts.filter(item => item.removed).length / 
                          (recentCarts.length || 1);
  
  if (abandonmentRate > 0.8) return 80;
  if (abandonmentRate > 0.6) return 60;
  if (abandonmentRate > 0.4) return 40;
  return 20;
}

function calculateSearchBehaviorScore(user) {
  const searches = user.searchHistory || [];
  const recentSearches = searches.filter(s => 
    new Date(s.searchedAt) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  );
  
  if (searches.length > 20 && recentSearches.length === 0) return 60;
  if (searches.length > 10 && recentSearches.length < 2) return 40;
  return 20;
}

function generateRetentionRecommendations(factors, riskLevel) {
  const recommendations = [];
  
  if (riskLevel === 'High') {
    recommendations.push({
      action: 'immediate_engagement',
      priority: 'critical',
      tactics: [
        'Gửi email cá nhân hóa với ưu đãi đặc biệt',
        'Liên hệ trực tiếp qua điện thoại',
        'Tạo mã giảm giá độc quyền 20-30%'
      ]
    });
  }
  
  factors.forEach(factor => {
    if (factor.score > 60) {
      switch (factor.factor) {
        case 'lastActivity':
          recommendations.push({
            action: 'reactivation_campaign',
            priority: 'high',
            tactics: [
              'Email "Chúng tôi nhớ bạn" với sản phẩm mới',
              'Push notification về ưu đãi thời gian giới hạn',
              'SMS nhắc nhở với link trực tiếp'
            ]
          });
          break;
        case 'purchasePattern':
          recommendations.push({
            action: 'purchase_incentive',
            priority: 'high',
            tactics: [
              'Gợi ý sản phẩm bổ sung cho đơn hàng trước',
              'Chương trình điểm thưởng x2',
              'Free shipping cho đơn hàng tiếp theo'
            ]
          });
          break;
        case 'cartBehavior':
          recommendations.push({
            action: 'cart_recovery',
            priority: 'medium',
            tactics: [
              'Email nhắc nhở giỏ hàng sau 2 giờ',
              'Giảm giá 10% cho sản phẩm trong giỏ',
              'Chat support chủ động'
            ]
          });
          break;
      }
    }
  });
  
  return recommendations;
}

async function getAlgorithmPerformance(days) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const performance = await User.aggregate([
    { $unwind: '$viewHistory' },
    { $match: { 'viewHistory.viewedAt': { $gte: startDate } } },
    {
      $group: {
        _id: '$viewHistory.source',
        totalViews: { $sum: 1 },
        avgDuration: { $avg: '$viewHistory.duration' },
        uniqueUsers: { $addToSet: '$_id' }
      }
    },
    {
      $lookup: {
        from: 'orders',
        let: { source: '$_id' },
        pipeline: [
          { $match: { createdAt: { $gte: startDate } } },
          { $unwind: '$items' },
          {
            $lookup: {
              from: 'users',
              let: { userId: '$user', productId: '$items.product' },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$userId'] } } },
                { $unwind: '$viewHistory' },
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$viewHistory.product', '$productId'] },
                        { $eq: ['$viewHistory.source', '$source'] }
                      ]
                    }
                  }
                }
              ],
              as: 'matchedView'
            }
          },
          { $match: { matchedView: { $ne: [] } } },
          { $count: 'conversions' }
        ],
        as: 'conversionData'
      }
    },
    {
      $project: {
        algorithm: '$_id',
        totalViews: 1,
        avgDuration: { $round: ['$avgDuration', 2] },
        uniqueUsers: { $size: '$uniqueUsers' },
        conversions: { $ifNull: [{ $arrayElemAt: ['$conversionData.conversions', 0] }, 0] },
        conversionRate: {
          $multiply: [
            {
              $divide: [
                { $ifNull: [{ $arrayElemAt: ['$conversionData.conversions', 0] }, 0] },
                '$totalViews'
              ]
            },
            100
          ]
        }
      }
    },
    { $sort: { conversionRate: -1 } }
  ]);
  
  return performance;
}

async function getABTestResults() {
  // Simulated A/B test results - in production, this would query actual test data
  return {
    tests: [
      {
        id: 'test_001',
        name: 'Collaborative vs Content-Based',
        status: 'completed',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        variants: [
          {
            name: 'Collaborative',
            users: 500,
            conversions: 45,
            conversionRate: 9.0,
            avgOrderValue: 450000
          },
          {
            name: 'Content-Based',
            users: 500,
            conversions: 52,
            conversionRate: 10.4,
            avgOrderValue: 480000
          }
        ],
        winner: 'Content-Based',
        confidence: 95.2
      }
    ]
  };
}

async function analyzeUserJourney(userId) {
  const user = await User.findById(userId).lean();
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const orders = await Order.find({ user: userId })
    .populate('items.product')
    .sort('createdAt')
    .lean();
  
  // Create timeline of events
  const timeline = [];
  
  // Add registration
  timeline.push({
    type: 'registration',
    date: user.createdAt || user.analytics?.registrationDate,
    details: {}
  });
  
  // Add view events
  if (user.viewHistory) {
    user.viewHistory.forEach(view => {
      timeline.push({
        type: 'view',
        date: view.viewedAt,
        details: {
          productId: view.product,
          duration: view.duration,
          source: view.source
        }
      });
    });
  }
  
  // Add search events
  if (user.searchHistory) {
    user.searchHistory.forEach(search => {
      timeline.push({
        type: 'search',
        date: search.searchedAt,
        details: {
          query: search.query,
          resultsCount: search.resultsCount
        }
      });
    });
  }
  
  // Add cart events
  if (user.interactions?.cartAdditions) {
    user.interactions.cartAdditions.forEach(cart => {
      timeline.push({
        type: cart.removed ? 'cart_remove' : 'cart_add',
        date: cart.timestamp,
        details: {
          productId: cart.product,
          quantity: cart.quantity
        }
      });
    });
  }
  
  // Add wishlist events
  if (user.interactions?.wishlist) {
    user.interactions.wishlist.forEach(item => {
      timeline.push({
        type: 'wishlist',
        date: item.addedAt,
        details: {
          productId: item.product
        }
      });
    });
  }
  
  // Add order events
  orders.forEach(order => {
    timeline.push({
      type: 'purchase',
      date: order.createdAt,
      details: {
        orderId: order._id,
        totalAmount: order.totalAmount,
        items: order.items.length
      }
    });
  });
  
  // Sort timeline by date
  timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Calculate journey metrics
  const metrics = {
    totalEvents: timeline.length,
    timeToFirstPurchase: calculateTimeToFirstPurchase(timeline),
    averageTimeBetweenPurchases: calculateAvgTimeBetweenPurchases(timeline),
    mostViewedCategory: await getMostViewedCategory(user.viewHistory),
    purchaseFunnel: calculatePurchaseFunnel(timeline),
    customerLifetimeValue: user.analytics?.totalSpent || 0
  };
  
  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      registrationDate: user.createdAt || user.analytics?.registrationDate
    },
    timeline: timeline.slice(-100), // Limit to last 100 events
    metrics,
    segment: determineUserSegment(user, orders)
  };
}

function calculateTimeToFirstPurchase(timeline) {
  const registration = timeline.find(e => e.type === 'registration');
  const firstPurchase = timeline.find(e => e.type === 'purchase');
  
  if (!registration || !firstPurchase) return null;
  
  const days = (new Date(firstPurchase.date) - new Date(registration.date)) / 
               (1000 * 60 * 60 * 24);
  
  return Math.round(days);
}

function calculateAvgTimeBetweenPurchases(timeline) {
  const purchases = timeline.filter(e => e.type === 'purchase');
  
  if (purchases.length < 2) return null;
  
  const intervals = [];
  for (let i = 1; i < purchases.length; i++) {
    const days = (new Date(purchases[i].date) - new Date(purchases[i-1].date)) / 
                 (1000 * 60 * 60 * 24);
    intervals.push(days);
  }
  
  return Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
}

async function getMostViewedCategory(viewHistory) {
  if (!viewHistory || viewHistory.length === 0) return null;
  
  const productIds = viewHistory.map(v => v.product).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } })
    .select('category')
    .lean();
  
  const categories = {};
  products.forEach(p => {
    if (p.category) {
      categories[p.category] = (categories[p.category] || 0) + 1;
    }
  });
  
  const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || null;
}

function calculatePurchaseFunnel(timeline) {
  const funnel = {
    views: timeline.filter(e => e.type === 'view').length,
    searches: timeline.filter(e => e.type === 'search').length,
    cartAdds: timeline.filter(e => e.type === 'cart_add').length,
    purchases: timeline.filter(e => e.type === 'purchase').length
  };
  
  funnel.viewToCart = funnel.views > 0 ? 
    ((funnel.cartAdds / funnel.views) * 100).toFixed(2) : 0;
  funnel.cartToPurchase = funnel.cartAdds > 0 ? 
    ((funnel.purchases / funnel.cartAdds) * 100).toFixed(2) : 0;
  funnel.overallConversion = funnel.views > 0 ? 
    ((funnel.purchases / funnel.views) * 100).toFixed(2) : 0;
  
  return funnel;
}

function determineUserSegment(user, orders) {
  const totalSpent = user.analytics?.totalSpent || 0;
  const orderCount = orders.length;
  const lastOrderDays = orders.length > 0 ? 
    (Date.now() - new Date(orders[orders.length - 1].createdAt)) / (1000 * 60 * 60 * 24) : 
    999;
  
  if (totalSpent > 10000000 && orderCount > 20) return 'Champion';
  if (totalSpent > 5000000 && orderCount > 10) return 'Loyal Customer';
  if (orderCount > 5 && lastOrderDays < 30) return 'Potential Loyalist';
  if (orderCount === 1 && lastOrderDays < 30) return 'New Customer';
  if (orderCount > 3 && lastOrderDays > 90) return 'At Risk';
  if (orderCount > 0 && lastOrderDays > 180) return 'Lost';
  
  return 'Prospect';
}

async function exportAnalytics(type, options) {
  const { startDate, endDate } = options;
  const dateFilter = {};
  
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);
  
  switch (type) {
    case 'users':
      return await exportUserAnalytics(dateFilter);
    case 'products':
      return await exportProductAnalytics(dateFilter);
    case 'recommendations':
      return await exportRecommendationAnalytics(dateFilter);
    case 'revenue':
      return await exportRevenueAnalytics(dateFilter);
    case 'churn':
      return await exportChurnAnalytics(dateFilter);
    default:
      throw new Error('Invalid export type');
  }
}

async function exportUserAnalytics(dateFilter) {
  const users = await User.find(
    dateFilter.$gte || dateFilter.$lte ? 
    { createdAt: dateFilter } : {}
  )
  .select('name email analytics viewHistory searchHistory interactions createdAt')
  .lean();
  
  return users.map(user => ({
    name: user.name,
    email: user.email,
    registrationDate: user.createdAt,
    totalSpent: user.analytics?.totalSpent || 0,
    totalOrders: user.analytics?.totalOrders || 0,
    viewCount: user.viewHistory?.length || 0,
    searchCount: user.searchHistory?.length || 0,
    wishlistCount: user.interactions?.wishlist?.length || 0,
    lastActivity: user.analytics?.lastActivityDate || user.analytics?.lastLoginDate
  }));
}

async function exportProductAnalytics(dateFilter) {
  const products = await Product.find({})
    .select('name category brand price viewCount totalOrders rating createdAt')
    .lean();
  
  return products.map(product => ({
    name: product.name,
    category: product.category,
    brand: product.brand,
    price: product.price,
    viewCount: product.viewCount || 0,
    totalOrders: product.totalOrders || 0,
    conversionRate: product.viewCount > 0 ? 
      ((product.totalOrders / product.viewCount) * 100).toFixed(2) : 0,
    rating: product.rating || 0,
    createdAt: product.createdAt
  }));
}

async function exportRecommendationAnalytics(dateFilter) {
  const recommendations = await User.aggregate([
    { $unwind: '$viewHistory' },
    {
      $match: {
        'viewHistory.source': { $exists: true },
        'viewHistory.viewedAt': dateFilter
      }
    },
    {
      $group: {
        _id: {
          source: '$viewHistory.source',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$viewHistory.viewedAt' } }
        },
        views: { $sum: 1 },
        avgDuration: { $avg: '$viewHistory.duration' },
        uniqueUsers: { $addToSet: '$_id' }
      }
    },
    {
      $project: {
        date: '$_id.date',
        algorithm: '$_id.source',
        views: 1,
        avgDuration: { $round: ['$avgDuration', 2] },
        uniqueUsers: { $size: '$uniqueUsers' }
      }
    },
    { $sort: { date: -1, algorithm: 1 } }
  ]);
  
  return recommendations;
}

async function exportRevenueAnalytics(dateFilter) {
  const revenue = await Order.aggregate([
    { $match: { createdAt: dateFilter } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        orders: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
        avgOrderValue: { $avg: '$totalAmount' },
        uniqueCustomers: { $addToSet: '$user' }
      }
    },
    {
      $project: {
        date: '$_id',
        orders: 1,
        revenue: 1,
        avgOrderValue: { $round: ['$avgOrderValue', 0] },
        uniqueCustomers: { $size: '$uniqueCustomers' }
      }
    },
    { $sort: { date: -1 } }
  ]);
  
  return revenue;
}

async function exportChurnAnalytics(dateFilter) {
  const options = {
    includeRecommendations: false,
    segmentSize: 'all',
    riskLevel: 'all'
  };
  
  const predictions = await advancedChurnPrediction(options);
  
  return predictions.map(p => ({
    name: p.name,
    email: p.email,
    riskScore: p.riskScore,
    riskLevel: p.riskLevel,
    lastActivity: p.lastActivity,
    topFactor: p.factors[0]?.factor || 'N/A',
    topFactorScore: p.factors[0]?.score || 0
  }));
}

function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
      return value;
    }).join(',');
  });
  
  return [csvHeaders, ...csvRows].join('\n');
}

function getEmptyDashboard() {
  return {
    userMetrics: {
      total: 0,
      new: 0,
      active: 0,
      churned: 0,
      activeRate: '0',
      churnRate: '0',
      segments: {},
      growth: { daily: 0, weekly: 0, monthly: 0 }
    },
    productMetrics: {
      topViewed: [],
      topConverting: [],
      categoryPerformance: []
    },
    behaviorMetrics: {
      viewPatterns: [],
      searchPatterns: [],
      cartPatterns: [],
      dailyActivity: []
    },
    revenueMetrics: {
      daily: [],
      weekly: [],
      monthly: [],
      bySource: []
    },
    systemHealth: {
      overall: 'unknown',
      database: 'unknown',
      recommendations: 'unknown',
      tracking: 'unknown'
    },
    recommendations: {
      totalGenerated: 0,
      conversionRate: 0,
      topPerformers: []
    },
    wishlistMetrics: {
      totalWishlistItems: 0,
      monthlyWishlistAdds: 0,
      topWishlistedProducts: []
    }
  };
}

// Cleanup old cache periodically
setInterval(() => {
  analyticsCache.invalidate();
}, config.analytics.refreshInterval);

module.exports = router;
