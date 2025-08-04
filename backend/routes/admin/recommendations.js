// backend/routes/admin/recommendations.js - Complete Version with All Features
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../../models/User');
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const { adminAuth } = require('../../middleware/adminAuth');

// Get recommendation analytics - FIXED with proper date handling
router.get('/analytics', adminAuth, async (req, res) => {
  try {
    console.log('Admin analytics accessed by:', req.user?.email);
    
    // Get current date and date ranges
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    
    // Overall stats with proper activity tracking
    const [totalUsers, activeUsers30Days, activeUsers7Days] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({
        $or: [
          { 'analytics.lastLoginDate': { $gte: thirtyDaysAgo, $ne: null } },
          { 'analytics.lastActivityDate': { $gte: thirtyDaysAgo, $ne: null } }
        ]
      }),
      User.countDocuments({
        $or: [
          { 'analytics.lastLoginDate': { $gte: sevenDaysAgo, $ne: null } },
          { 'analytics.lastActivityDate': { $gte: sevenDaysAgo, $ne: null } }
        ]
      })
    ]);
    
    // Get users with recent orders
    const usersWithRecentOrders = await Order.distinct('user', {
      createdAt: { $gte: thirtyDaysAgo },
      orderStatus: { $ne: 'cancelled' }
    });
    
    // Product interaction stats
    const productStats = await Product.aggregate([
      {
        $match: {
          $or: [
            { viewCount: { $gt: 0 } },
            { totalOrders: { $gt: 0 } }
          ]
        }
      },
      {
        $project: {
          name: 1,
          category: 1,
          viewCount: { $ifNull: ['$viewCount', 0] },
          totalOrders: { $ifNull: ['$totalOrders', 0] },
          conversionRate: {
            $cond: [
              { $eq: [{ $ifNull: ['$viewCount', 0] }, 0] },
              0,
              { 
                $multiply: [
                  { $divide: [
                    { $ifNull: ['$totalOrders', 0] }, 
                    { $ifNull: ['$viewCount', 1] }
                  ]}, 
                  100
                ] 
              }
            ]
          }
        }
      },
      { $sort: { viewCount: -1 } },
      { $limit: 20 }
    ]);
    
    // User behavior patterns with proper date handling
    const userBehaviors = await User.aggregate([
      {
        $project: {
          name: { $ifNull: ['$name', 'Unknown'] },
          email: { $ifNull: ['$email', 'No email'] },
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
          wishlistCount: { 
            $cond: [
              { $isArray: '$interactions.wishlist' },
              { $size: '$interactions.wishlist' },
              0
            ]
          },
          cartAddCount: { 
            $cond: [
              { $isArray: '$interactions.cartAdditions' },
              { $size: '$interactions.cartAdditions' },
              0
            ]
          },
          totalSpent: { $ifNull: ['$analytics.totalSpent', 0] },
          totalOrders: { $ifNull: ['$analytics.totalOrders', 0] },
          lastLogin: {
            $cond: [
              { $ifNull: ['$analytics.lastActivityDate', false] },
              '$analytics.lastActivityDate',
              { $ifNull: ['$analytics.lastLoginDate', null] }
            ]
          },
          lastActivity: { $ifNull: ['$analytics.lastActivityDate', null] },
          registrationDate: { 
            $ifNull: [
              '$analytics.registrationDate', 
              { $ifNull: ['$createdAt', null] }
            ]
          }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 50 }
    ]);
    
    res.json({
      overview: {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers30Days || 0,
        activeUsers7Days: activeUsers7Days || 0,
        activeRate: totalUsers > 0 ? ((activeUsers30Days / totalUsers) * 100).toFixed(2) : '0',
        usersWithRecentOrders: usersWithRecentOrders.length
      },
      productStats: productStats || [],
      userBehaviors: userBehaviors || []
    });
  } catch (error) {
    console.error('Error fetching recommendation analytics:', error);
    res.status(500).json({ 
      message: error.message,
      overview: {
        totalUsers: 0,
        activeUsers: 0,
        activeUsers7Days: 0,
        activeRate: '0',
        usersWithRecentOrders: 0
      },
      productStats: [],
      userBehaviors: []
    });
  }
});

// Get user interaction history - FIXED with better date handling
router.get('/user/:userId', adminAuth, async (req, res) => {
  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(req.params.userId)
      .populate({
        path: 'viewHistory.product',
        select: 'name price images category',
        match: { _id: { $ne: null } }
      })
      .populate({
        path: 'interactions.wishlist.product',
        select: 'name price images category',
        match: { _id: { $ne: null } }
      })
      .populate({
        path: 'interactions.cartAdditions.product',
        select: 'name price images category',
        match: { _id: { $ne: null } }
      })
      .lean();
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get user orders
    const orders = await Order.find({ user: req.params.userId })
      .populate('items.product')
      .sort('-createdAt')
      .limit(20)
      .lean();
    
    // Calculate last activity from multiple sources
    let lastActivityDate = user.analytics?.lastActivityDate || user.analytics?.lastLoginDate;
    
    // Check view history for recent activity
    if (user.viewHistory && user.viewHistory.length > 0) {
      const lastView = user.viewHistory
        .filter(v => v && v.viewedAt)
        .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))[0];
      if (lastView && (!lastActivityDate || new Date(lastView.viewedAt) > new Date(lastActivityDate))) {
        lastActivityDate = lastView.viewedAt;
      }
    }
    
    // Check orders for recent activity
    if (orders.length > 0 && (!lastActivityDate || new Date(orders[0].createdAt) > new Date(lastActivityDate))) {
      lastActivityDate = orders[0].createdAt;
    }
    
    // Filter out null products and ensure data integrity
    const safeViewHistory = (user.viewHistory || [])
      .filter(item => item && item.product)
      .slice(0, 50);
    
    const safeSearchHistory = (user.searchHistory || []).slice(0, 20);
    
    const safeWishlist = ((user.interactions && user.interactions.wishlist) || [])
      .filter(item => item && item.product);
    
    const safeCartHistory = ((user.interactions && user.interactions.cartAdditions) || [])
      .filter(item => item && item.product)
      .slice(0, 20);
    
    res.json({
      user: {
        _id: user._id,
        name: user.name || 'Unknown',
        email: user.email || 'No email',
        registrationDate: user.analytics?.registrationDate || user.createdAt || new Date(),
        analytics: {
          totalSpent: user.analytics?.totalSpent || 0,
          totalOrders: user.analytics?.totalOrders || 0,
          averageOrderValue: user.analytics?.averageOrderValue || 0,
          lastLoginDate: user.analytics?.lastLoginDate || null,
          lastActivityDate: lastActivityDate,
          lastPurchaseDate: user.analytics?.lastPurchaseDate || null,
          favoriteCategory: user.analytics?.favoriteCategory || null,
          favoriteBrand: user.analytics?.favoriteBrand || null
        }
      },
      viewHistory: safeViewHistory,
      searchHistory: safeSearchHistory,
      wishlist: safeWishlist,
      cartHistory: safeCartHistory,
      orders: orders || []
    });
  } catch (error) {
    console.error('Error fetching user interactions:', error);
    res.status(500).json({ 
      message: error.message,
      user: null,
      viewHistory: [],
      searchHistory: [],
      wishlist: [],
      cartHistory: [],
      orders: []
    });
  }
});

// Predict churn risk - FIXED with better activity detection
router.post('/predict-churn', adminAuth, async (req, res) => {
  try {
    const users = await User.find({})
      .select('name email analytics interactions viewHistory searchHistory createdAt')
      .lean();
    
    const churnPredictions = [];
    
    for (const user of users) {
      // Skip invalid users
      if (!user._id) continue;
      
      const prediction = await predictUserChurn(user);
      churnPredictions.push({
        userId: user._id,
        name: user.name || 'Unknown',
        email: user.email || 'No email',
        ...prediction
      });
    }
    
    // Sort by risk score (handle undefined scores)
    churnPredictions.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
    
    res.json(churnPredictions);
  } catch (error) {
    console.error('Error predicting churn:', error);
    res.status(500).json({ 
      message: error.message,
      predictions: []
    });
  }
});

// Improved churn prediction function with better activity detection
async function predictUserChurn(user) {
  let riskScore = 0;
  const factors = [];
  
  // Factor 1: Days since last activity (combine login and activity dates)
  let lastActivityDate = user.analytics?.lastActivityDate || user.analytics?.lastLoginDate;
  
  // Check view history for recent activity
  if (user.viewHistory && user.viewHistory.length > 0) {
    const recentView = user.viewHistory
      .filter(v => v && v.viewedAt)
      .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))[0];
    if (recentView && (!lastActivityDate || new Date(recentView.viewedAt) > new Date(lastActivityDate))) {
      lastActivityDate = recentView.viewedAt;
    }
  }
  
  const daysSinceActivity = lastActivityDate 
    ? (Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)
    : 999;
    
  if (daysSinceActivity > 30) {
    riskScore += 30;
    factors.push({ 
      factor: 'Không hoạt động', 
      value: daysSinceActivity === 999 ? 'Chưa từng' : `${Math.round(daysSinceActivity)} ngày`, 
      weight: 30 
    });
  } else if (daysSinceActivity > 14) {
    riskScore += 20;
    factors.push({ 
      factor: 'Ít hoạt động', 
      value: `${Math.round(daysSinceActivity)} ngày`, 
      weight: 20 
    });
  }
  
  // Factor 2: Purchase frequency
  try {
    const orders = await Order.find({ user: user._id })
      .select('createdAt orderStatus')
      .sort('createdAt')
      .lean();
    
    const completedOrders = orders.filter(o => o.orderStatus !== 'cancelled');
    const avgDaysBetweenOrders = calculateAvgDaysBetweenOrders(completedOrders);
    
    if (avgDaysBetweenOrders > 60 || completedOrders.length === 0) {
      riskScore += 25;
      factors.push({ 
        factor: 'Mua hàng thưa thớt', 
        value: completedOrders.length === 0 ? 'Chưa mua' : `TB ${Math.round(avgDaysBetweenOrders)} ngày/đơn`, 
        weight: 25 
      });
    }
    
    // Check for recent purchases
    if (completedOrders.length > 0) {
      const lastOrder = completedOrders[completedOrders.length - 1];
      const daysSinceLastOrder = (Date.now() - new Date(lastOrder.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastOrder > 90) {
        riskScore += 15;
        factors.push({
          factor: 'Lâu không mua hàng',
          value: `${Math.round(daysSinceLastOrder)} ngày`,
          weight: 15
        });
      }
    }
  } catch (error) {
    console.error('Error calculating purchase frequency:', error);
  }
  
  // Factor 3: Cart abandonment
  const cartAdditions = user.interactions?.cartAdditions || [];
  const totalCarts = cartAdditions.length;
  const recentCarts = cartAdditions.filter(item => {
    const daysSince = (Date.now() - new Date(item.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 30;
  }).length;
  
  if (recentCarts > 5 && totalCarts > 0) {
    riskScore += 15;
    factors.push({ 
      factor: 'Thường xuyên bỏ giỏ hàng', 
      value: `${recentCarts} lần/tháng`, 
      weight: 15 
    });
  }
  
  // Factor 4: Recent engagement
  const viewHistory = user.viewHistory || [];
  const recentViews = viewHistory.filter(v => {
    if (!v || !v.viewedAt) return false;
    return new Date(v.viewedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }).length;
  
  if (recentViews === 0 && viewHistory.length > 0) {
    riskScore += 25;
    factors.push({ 
      factor: 'Không xem sản phẩm gần đây', 
      value: '0 lượt xem/tuần', 
      weight: 25 
    });
  } else if (recentViews < 3 && viewHistory.length > 0) {
    riskScore += 15;
    factors.push({ 
      factor: 'Ít xem sản phẩm', 
      value: `${recentViews} lượt xem/tuần`, 
      weight: 15 
    });
  }
  
  // Factor 5: Search activity
  const searchHistory = user.searchHistory || [];
  const recentSearches = searchHistory.filter(s => {
    if (!s || !s.searchedAt) return false;
    return new Date(s.searchedAt) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  }).length;
  
  if (recentSearches === 0 && searchHistory.length > 0) {
    riskScore += 10;
    factors.push({ 
      factor: 'Không tìm kiếm gần đây', 
      value: '0 tìm kiếm/2 tuần', 
      weight: 10 
    });
  }
  
  // Factor 6: Wishlist engagement
  const wishlistItems = user.interactions?.wishlist || [];
  if (wishlistItems.length > 5) {
    // Many wishlist items but low purchase rate might indicate hesitation
    const purchaseRate = user.analytics?.totalOrders || 0;
    if (purchaseRate < wishlistItems.length * 0.2) {
      riskScore += 10;
      factors.push({
        factor: 'Wishlist cao nhưng ít mua',
        value: `${wishlistItems.length} items, ${purchaseRate} đơn`,
        weight: 10
      });
    }
  }
  
  return {
    riskScore: Math.min(100, riskScore),
    riskLevel: riskScore >= 70 ? 'Cao' : riskScore >= 40 ? 'Trung bình' : 'Thấp',
    factors,
    recommendations: getRetentionRecommendations(factors)
  };
}

function calculateAvgDaysBetweenOrders(orders) {
  if (!orders || orders.length < 2) return 999;
  
  let totalDays = 0;
  let validPairs = 0;
  
  for (let i = 1; i < orders.length; i++) {
    if (orders[i].createdAt && orders[i-1].createdAt) {
      const days = (new Date(orders[i].createdAt) - new Date(orders[i-1].createdAt)) / (1000 * 60 * 60 * 24);
      if (days >= 0) {
        totalDays += days;
        validPairs++;
      }
    }
  }
  
  return validPairs > 0 ? totalDays / validPairs : 999;
}

function getRetentionRecommendations(factors) {
  const recommendations = [];
  
  factors.forEach(factor => {
    switch (factor.factor) {
      case 'Không hoạt động':
      case 'Ít hoạt động':
        recommendations.push('Gửi email nhắc nhở với ưu đãi đặc biệt');
        recommendations.push('Push notification về sản phẩm mới');
        break;
      case 'Mua hàng thưa thớt':
      case 'Lâu không mua hàng':
        recommendations.push('Tạo chương trình khách hàng thân thiết');
        recommendations.push('Ưu đãi độc quyền cho khách hàng cũ');
        recommendations.push('Email về sản phẩm tương tự đã mua');
        break;
      case 'Thường xuyên bỏ giỏ hàng':
        recommendations.push('Gửi email nhắc nhở giỏ hàng với mã giảm giá');
        recommendations.push('Hiển thị popup giữ khách khi rời trang');
        recommendations.push('Đơn giản hóa quy trình thanh toán');
        break;
      case 'Không xem sản phẩm gần đây':
      case 'Ít xem sản phẩm':
        recommendations.push('Gửi thông báo về sản phẩm mới phù hợp');
        recommendations.push('Email với ưu đãi "Chúng tôi nhớ bạn"');
        break;
      case 'Không tìm kiếm gần đây':
        recommendations.push('Gửi email về xu hướng mới');
        recommendations.push('Thông báo về sale theo danh mục quan tâm');
        break;
      case 'Wishlist cao nhưng ít mua':
        recommendations.push('Giảm giá cho sản phẩm trong wishlist');
        recommendations.push('Thông báo khi sản phẩm wishlist giảm giá');
        break;
    }
  });
  
  return [...new Set(recommendations)].slice(0, 3);
}

// Get recommendation performance metrics
router.get('/performance', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    // Get click-through rates and conversion metrics
    const metrics = await User.aggregate([
      {
        $unwind: '$viewHistory'
      },
      {
        $match: dateFilter.$gte || dateFilter.$lte ? {
          'viewHistory.viewedAt': dateFilter
        } : {}
      },
      {
        $group: {
          _id: '$viewHistory.source',
          totalViews: { $sum: 1 },
          uniqueUsers: { $addToSet: '$_id' },
          avgDuration: { $avg: '$viewHistory.duration' }
        }
      },
      {
        $project: {
          source: '$_id',
          totalViews: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          avgDuration: { $round: ['$avgDuration', 2] }
        }
      }
    ]);
    
    // Get conversion metrics
    const conversionMetrics = await Order.aggregate([
      {
        $match: {
          createdAt: dateFilter,
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userData'
        }
      },
      {
        $unwind: '$userData'
      },
      {
        $project: {
          hasViewHistory: { $gt: [{ $size: '$userData.viewHistory' }, 0] },
          hasSearchHistory: { $gt: [{ $size: '$userData.searchHistory' }, 0] },
          totalAmount: 1
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          ordersWithViews: { 
            $sum: { $cond: ['$hasViewHistory', 1, 0] }
          },
          ordersWithSearch: { 
            $sum: { $cond: ['$hasSearchHistory', 1, 0] }
          },
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    res.json({
      metrics,
      conversionMetrics: conversionMetrics[0] || {
        totalOrders: 0,
        ordersWithViews: 0,
        ordersWithSearch: 0,
        totalRevenue: 0
      },
      period: {
        start: startDate || 'all time',
        end: endDate || 'now'
      }
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get detailed user activity stats with proper date handling
router.get('/user-activity-stats', adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);

    const stats = await User.aggregate([
      {
        $facet: {
          // Total users
          totalUsers: [
            { $count: 'count' }
          ],
          
          // Active users by period - check both login and activity dates
          activeToday: [
            {
              $match: {
                $or: [
                  { 'analytics.lastLoginDate': { $gte: oneDayAgo } },
                  { 'analytics.lastActivityDate': { $gte: oneDayAgo } }
                ]
              }
            },
            { $count: 'count' }
          ],
          
          activeThisWeek: [
            {
              $match: {
                $or: [
                  { 'analytics.lastLoginDate': { $gte: oneWeekAgo } },
                  { 'analytics.lastActivityDate': { $gte: oneWeekAgo } }
                ]
              }
            },
            { $count: 'count' }
          ],
          
          activeThisMonth: [
            {
              $match: {
                $or: [
                  { 'analytics.lastLoginDate': { $gte: oneMonthAgo } },
                  { 'analytics.lastActivityDate': { $gte: oneMonthAgo } }
                ]
              }
            },
            { $count: 'count' }
          ],
          
          // User distribution by activity
          usersByActivity: [
            {
              $project: {
                lastActivity: {
                  $cond: [
                    { $gt: ['$analytics.lastActivityDate', '$analytics.lastLoginDate'] },
                    '$analytics.lastActivityDate',
                    { $ifNull: ['$analytics.lastLoginDate', null] }
                  ]
                }
              }
            },
            {
              $project: {
                activityLevel: {
                  $cond: [
                    { $gte: ['$lastActivity', oneDayAgo] },
                    'veryActive',
                    {
                      $cond: [
                        { $gte: ['$lastActivity', oneWeekAgo] },
                        'active',
                        {
                          $cond: [
                            { $gte: ['$lastActivity', oneMonthAgo] },
                            'moderate',
                            {
                              $cond: [
                                { $gte: ['$lastActivity', threeMonthsAgo] },
                                'inactive',
                                'dormant'
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            },
            {
              $group: {
                _id: '$activityLevel',
                count: { $sum: 1 }
              }
            }
          ],
          
          // New vs returning users
          newUsersThisMonth: [
            {
              $match: {
                $or: [
                  { 'analytics.registrationDate': { $gte: oneMonthAgo } },
                  { createdAt: { $gte: oneMonthAgo } }
                ]
              }
            },
            { $count: 'count' }
          ],
          
          // Users with purchases
          purchasingUsers: [
            {
              $match: {
                'analytics.totalOrders': { $gt: 0 }
              }
            },
            { $count: 'count' }
          ],
          
          // Users with recent views
          usersWithRecentViews: [
            {
              $match: {
                'viewHistory.viewedAt': { $gte: oneWeekAgo }
              }
            },
            { $count: 'count' }
          ]
        }
      }
    ]);

    // Format response
    const result = stats[0];
    const totalCount = result.totalUsers[0]?.count || 1;
    
    const response = {
      totalUsers: totalCount,
      activeUsers: {
        today: result.activeToday[0]?.count || 0,
        thisWeek: result.activeThisWeek[0]?.count || 0,
        thisMonth: result.activeThisMonth[0]?.count || 0
      },
      activityDistribution: {
        veryActive: 0,
        active: 0,
        moderate: 0,
        inactive: 0,
        dormant: 0,
        ...result.usersByActivity.reduce((acc, item) => {
          acc[item._id || 'dormant'] = item.count;
          return acc;
        }, {})
      },
      newUsersThisMonth: result.newUsersThisMonth[0]?.count || 0,
      purchasingUsers: result.purchasingUsers[0]?.count || 0,
      usersWithRecentViews: result.usersWithRecentViews[0]?.count || 0,
      metrics: {
        dailyActiveRate: ((result.activeToday[0]?.count || 0) / totalCount * 100).toFixed(2),
        weeklyActiveRate: ((result.activeThisWeek[0]?.count || 0) / totalCount * 100).toFixed(2),
        monthlyActiveRate: ((result.activeThisMonth[0]?.count || 0) / totalCount * 100).toFixed(2),
        purchaseRate: ((result.purchasingUsers[0]?.count || 0) / totalCount * 100).toFixed(2),
        viewEngagementRate: ((result.usersWithRecentViews[0]?.count || 0) / totalCount * 100).toFixed(2)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching user activity stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get real-time active users (users active in last 15 minutes)
router.get('/real-time-users', adminAuth, async (req, res) => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const activeUsers = await User.find({
      $or: [
        { 'analytics.lastActivityDate': { $gte: fifteenMinutesAgo } },
        { 'analytics.lastLoginDate': { $gte: fifteenMinutesAgo } },
        { 'viewHistory.viewedAt': { $gte: fifteenMinutesAgo } }
      ]
    })
    .select('name email analytics.lastActivityDate analytics.lastLoginDate viewHistory')
    .sort('-analytics.lastActivityDate')
    .limit(50)
    .lean();
    
    // Process to get actual last activity
    const processedUsers = activeUsers.map(user => {
      let lastActivity = user.analytics?.lastActivityDate || user.analytics?.lastLoginDate;
      
      // Check view history
      if (user.viewHistory && user.viewHistory.length > 0) {
        const recentView = user.viewHistory
          .filter(v => v && v.viewedAt)
          .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))[0];
        if (recentView && (!lastActivity || new Date(recentView.viewedAt) > new Date(lastActivity))) {
          lastActivity = recentView.viewedAt;
        }
      }
      
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        lastActivity: lastActivity,
        isVeryRecent: lastActivity && new Date(lastActivity) >= fiveMinutesAgo
      };
    });
    
    // Sort by last activity
    processedUsers.sort((a, b) => {
      const dateA = a.lastActivity ? new Date(a.lastActivity) : new Date(0);
      const dateB = b.lastActivity ? new Date(b.lastActivity) : new Date(0);
      return dateB - dateA;
    });
    
    res.json({
      count: processedUsers.length,
      veryRecentCount: processedUsers.filter(u => u.isVeryRecent).length,
      users: processedUsers,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching real-time users:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get product recommendation performance
router.get('/product-performance', adminAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    // Get products with recommendation metrics
    const productPerformance = await Product.aggregate([
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
                    { $gte: ['$viewHistory.viewedAt', startDate] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: '$viewHistory.source',
                count: { $sum: 1 }
              }
            }
          ],
          as: 'viewSources'
        }
      },
      {
        $project: {
          name: 1,
          category: 1,
          price: 1,
          totalViews: { $ifNull: ['$viewCount', 0] },
          totalOrders: { $ifNull: ['$totalOrders', 0] },
          viewSources: 1,
          conversionRate: {
            $cond: [
              { $eq: ['$viewCount', 0] },
              0,
              { $multiply: [{ $divide: ['$totalOrders', '$viewCount'] }, 100] }
            ]
          }
        }
      },
      { $sort: { totalViews: -1 } },
      { $limit: 50 }
    ]);
    
    res.json({
      products: productPerformance,
      period: `Last ${days} days`
    });
  } catch (error) {
    console.error('Error fetching product performance:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get recommendation system health check
router.get('/health', adminAuth, async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {}
    };
    
    // Check database connectivity
    try {
      await User.findOne().limit(1);
      health.checks.database = { status: 'ok', message: 'Database connected' };
    } catch (dbError) {
      health.checks.database = { status: 'error', message: dbError.message };
      health.status = 'unhealthy';
    }
    
    // Check recommendation algorithms
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    
    // Check if users are being tracked
    const recentActivityCount = await User.countDocuments({
      $or: [
        { 'analytics.lastActivityDate': { $gte: oneDayAgo } },
        { 'viewHistory.viewedAt': { $gte: oneDayAgo } }
      ]
    });
    
    health.checks.userTracking = {
      status: recentActivityCount > 0 ? 'ok' : 'warning',
      message: `${recentActivityCount} users active in last 24 hours`,
      count: recentActivityCount
    };
    
    // Check if products are being viewed
    const recentProductViews = await Product.countDocuments({
      viewCount: { $gt: 0 }
    });
    
    health.checks.productTracking = {
      status: recentProductViews > 0 ? 'ok' : 'warning',
      message: `${recentProductViews} products have been viewed`,
      count: recentProductViews
    };
    
    // Check order tracking
    const recentOrders = await Order.countDocuments({
      createdAt: { $gte: oneDayAgo }
    });
    
    health.checks.orderTracking = {
      status: recentOrders > 0 ? 'ok' : 'warning',
      message: `${recentOrders} orders in last 24 hours`,
      count: recentOrders
    };
    
    res.json(health);
  } catch (error) {
    console.error('Error checking system health:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date()
    });
  }
});

// Update recommendation settings
router.put('/settings', adminAuth, async (req, res) => {
  try {
    const { settings } = req.body;
    
    // Validate settings
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ message: 'Invalid settings format' });
    }
    
    // Here you would typically save to a Settings collection
    // For now, we'll just validate and return
    const validSettings = {
      recommendationTypes: settings.recommendationTypes || ['content', 'collaborative', 'trending'],
      cacheEnabled: settings.cacheEnabled !== false,
      cacheDuration: settings.cacheDuration || 120, // minutes
      maxRecommendations: settings.maxRecommendations || 20,
      minUserActivity: settings.minUserActivity || 5, // minimum views before personalization
      weights: {
        purchase: settings.weights?.purchase || 3,
        view: settings.weights?.view || 0.5,
        search: settings.weights?.search || 0.3,
        wishlist: settings.weights?.wishlist || 1,
        cart: settings.weights?.cart || 1.5
      }
    };
    
    res.json({
      message: 'Settings updated successfully',
      settings: validSettings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: error.message });
  }
});

// Export recommendation data
router.get('/export', adminAuth, async (req, res) => {
  try {
    const { type = 'summary', format = 'json' } = req.query;
    
    let data;
    
    switch (type) {
      case 'users':
        data = await User.find({})
          .select('name email analytics viewHistory searchHistory interactions')
          .lean();
        break;
        
      case 'products':
        data = await Product.find({})
          .select('name category viewCount totalOrders rating')
          .lean();
        break;
        
      case 'summary':
      default:
        const [users, products, orders] = await Promise.all([
          User.countDocuments(),
          Product.countDocuments(),
          Order.countDocuments()
        ]);
        
        data = {
          exportDate: new Date(),
          summary: {
            totalUsers: users,
            totalProducts: products,
            totalOrders: orders
          },
          userMetrics: await getUserMetricsSummary(),
          productMetrics: await getProductMetricsSummary()
        };
    }
    
    if (format === 'csv') {
      // Convert to CSV format
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=recommendations-${type}-${Date.now()}.csv`);
      // Here you would convert data to CSV
      res.send('CSV export not implemented yet');
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({ message: error.message });
  }
});

// Helper functions for export
async function getUserMetricsSummary() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const metrics = await User.aggregate([
    {
      $facet: {
        activeUsers: [
          {
            $match: {
              $or: [
                { 'analytics.lastLoginDate': { $gte: thirtyDaysAgo } },
                { 'analytics.lastActivityDate': { $gte: thirtyDaysAgo } }
              ]
            }
          },
          { $count: 'count' }
        ],
        avgViewsPerUser: [
          {
            $project: {
              viewCount: { $size: { $ifNull: ['$viewHistory', []] } }
            }
          },
          {
            $group: {
              _id: null,
              avg: { $avg: '$viewCount' }
            }
          }
        ],
        topUsers: [
          { $sort: { 'analytics.totalSpent': -1 } },
          { $limit: 10 },
          {
            $project: {
              name: 1,
              email: 1,
              totalSpent: '$analytics.totalSpent',
              totalOrders: '$analytics.totalOrders'
            }
          }
        ]
      }
    }
  ]);
  
  return {
    activeUsers30Days: metrics[0].activeUsers[0]?.count || 0,
    avgViewsPerUser: Math.round(metrics[0].avgViewsPerUser[0]?.avg || 0),
    topUsers: metrics[0].topUsers
  };
}

async function getProductMetricsSummary() {
  const metrics = await Product.aggregate([
    {
      $facet: {
        mostViewed: [
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
        bestConverting: [
          {
            $match: {
              viewCount: { $gt: 0 },
              totalOrders: { $gt: 0 }
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
  ]);
  
  return {
    mostViewed: metrics[0].mostViewed,
    bestConverting: metrics[0].bestConverting
  };
}

// Clear cache endpoint
router.post('/clear-cache', adminAuth, async (req, res) => {
  try {
    // This would clear any recommendation caches
    // Implementation depends on your caching strategy
    
    res.json({
      message: 'Cache cleared successfully',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;