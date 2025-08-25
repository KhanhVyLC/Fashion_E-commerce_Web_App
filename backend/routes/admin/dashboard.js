// backend/routes/admin/dashboard.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const Order = require('../../models/Order');
const User = require('../../models/User');
const Product = require('../../models/Product');
const Review = require('../../models/Review');
const Cart = require('../../models/Cart');
const { protect } = require('../../middleware/auth');
const { adminAuth } = require('../../middleware/adminAuth');

router.use(protect, adminAuth);

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    // Get date ranges
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    // ==================== REVENUE CALCULATIONS (ONLY DELIVERED) ====================
    // Total revenue (ONLY delivered orders)
    const totalRevenueResult = await Order.aggregate([
      { $match: { orderStatus: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = totalRevenueResult[0]?.total || 0;

    // Today's revenue (ONLY delivered orders)
    const todayRevenueResult = await Order.aggregate([
      { 
        $match: { 
          orderStatus: 'delivered',
          deliveredAt: { $gte: startOfToday } // Use deliveredAt instead of createdAt
        } 
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const todayRevenue = todayRevenueResult[0]?.total || 0;

    // ==================== ORDER STATISTICS ====================
    // Order counts by status
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      todayOrders
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: 'pending' }),
      Order.countDocuments({ orderStatus: 'processing' }),
      Order.countDocuments({ orderStatus: 'shipped' }),
      Order.countDocuments({ orderStatus: 'delivered' }),
      Order.countDocuments({ orderStatus: 'cancelled' }),
      Order.countDocuments({ createdAt: { $gte: startOfToday } })
    ]);

    // ==================== USER STATISTICS ====================
    // Total customers (excluding admin)
    const totalCustomers = await User.countDocuments({ 
      role: { $ne: 'admin' }
    });

    // New customers this month
    const newCustomersThisMonth = await User.countDocuments({
      role: { $ne: 'admin' },
      createdAt: { $gte: startOfMonth }
    });

    // Active users (users with orders in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = await Order.distinct('user', {
      createdAt: { $gte: thirtyDaysAgo }
    });

    // ==================== PRODUCT STATISTICS ====================
    const totalProducts = await Product.countDocuments();
    
    // Products with low stock (less than 10 items total)
    const lowStockProducts = await Product.aggregate([
      {
        $project: {
          name: 1,
          totalStock: { $sum: '$stock.quantity' }
        }
      },
      { $match: { totalStock: { $lt: 10 } } },
      { $count: 'count' }
    ]);
    const lowStockCount = lowStockProducts[0]?.count || 0;

    // ==================== TOP SELLING PRODUCTS (Based on delivered orders) ====================
    const topProducts = await Order.aggregate([
      {
        $match: {
          orderStatus: 'delivered' // ONLY count delivered orders
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
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
        $project: {
          totalSold: 1,
          revenue: 1,
          product: {
            _id: 1,
            name: 1,
            price: 1,
            images: 1,
            category: 1,
            brand: 1,
            rating: 1
          }
        }
      }
    ]);

    // ==================== MONTHLY REVENUE (ONLY DELIVERED) ====================
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: twelveMonthsAgo },
          orderStatus: 'delivered' // ONLY delivered orders
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$deliveredAt' }, // Group by deliveredAt
            month: { $month: '$deliveredAt' }
          },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Fill missing months with zero values
    const completeMonthlyRevenue = [];
    const currentDate = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(currentDate.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      const monthData = monthlyRevenue.find(
        m => m._id.year === year && m._id.month === month
      );
      
      completeMonthlyRevenue.push({
        _id: { year, month },
        revenue: monthData?.revenue || 0,
        orders: monthData?.orders || 0,
        avgOrderValue: monthData?.avgOrderValue || 0
      });
    }

    // ==================== WEEKLY REVENUE (ONLY DELIVERED) ====================
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const weeklyRevenue = await Order.aggregate([
      {
        $match: {
          deliveredAt: { $gte: sevenDaysAgo }, // Use deliveredAt
          orderStatus: 'delivered' // ONLY delivered
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$deliveredAt' },
            month: { $month: '$deliveredAt' },
            day: { $dayOfMonth: '$deliveredAt' }
          },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // ==================== GROWTH CALCULATIONS (ONLY DELIVERED) ====================
    // Revenue growth (compare with last month - only delivered)
    const lastMonthRevenue = await Order.aggregate([
      {
        $match: {
          deliveredAt: {
            $gte: startOfLastMonth,
            $lt: startOfMonth
          },
          orderStatus: 'delivered'
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const thisMonthRevenue = await Order.aggregate([
      {
        $match: {
          deliveredAt: { $gte: startOfMonth },
          orderStatus: 'delivered'
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const lastMonthTotal = lastMonthRevenue[0]?.total || 1;
    const thisMonthTotal = thisMonthRevenue[0]?.total || 0;
    const revenueGrowth = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;

    // Order growth (all orders)
    const lastMonthOrders = await Order.countDocuments({
      createdAt: {
        $gte: startOfLastMonth,
        $lt: startOfMonth
      }
    });
    const thisMonthOrders = await Order.countDocuments({
      createdAt: { $gte: startOfMonth }
    });
    const orderGrowth = lastMonthOrders > 0 
      ? ((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100 
      : 0;

    // Customer growth
    const lastMonthCustomers = await User.countDocuments({
      role: { $ne: 'admin' },
      createdAt: {
        $gte: startOfLastMonth,
        $lt: startOfMonth
      }
    });
    const customerGrowth = lastMonthCustomers > 0
      ? ((newCustomersThisMonth - lastMonthCustomers) / lastMonthCustomers) * 100
      : 0;

    // Average order value (only delivered)
    const avgOrderValue = deliveredOrders > 0 ? Math.round(totalRevenue / deliveredOrders) : 0;

    // ==================== RECENT ORDERS ====================
    const recentOrders = await Order.find()
      .sort('-createdAt')
      .limit(10)
      .populate('user', 'name email')
      .select('totalAmount orderStatus createdAt paymentMethod')
      .lean();

    const formattedRecentOrders = recentOrders.map(order => ({
      orderNumber: `ORD${order._id.toString().slice(-8).toUpperCase()}`,
      customerName: order.user?.name || 'Unknown',
      customerEmail: order.user?.email || '',
      totalAmount: order.totalAmount,
      status: order.orderStatus,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt
    }));

    // ==================== CATEGORY PERFORMANCE (ONLY DELIVERED) ====================
    const categoryPerformance = await Order.aggregate([
      {
        $match: {
          orderStatus: 'delivered' // ONLY delivered orders
        }
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo'
        }
      },
      { $unwind: '$productInfo' },
      {
        $group: {
          _id: '$productInfo.category',
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
          orders: { $sum: 1 },
          quantity: { $sum: '$items.quantity' }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ]);

    // ==================== PAYMENT METHOD STATISTICS (ALL ORDERS) ====================
    const paymentMethodStats = await Order.aggregate([
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: { 
            $sum: {
              $cond: [
                { $eq: ['$orderStatus', 'delivered'] },
                '$totalAmount',
                0
              ]
            }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // ==================== ABANDONED CARTS ====================
    const abandonedCarts = await Cart.countDocuments({
      updatedAt: { $lt: thirtyDaysAgo },
      'items.0': { $exists: true }
    });

    // ==================== RESPONSE ====================
    res.json({
      // Revenue metrics (only from delivered orders)
      totalRevenue,
      todayRevenue,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
      avgOrderValue,
      
      // Order metrics (all orders)
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      todayOrders,
      orderGrowth: Math.round(orderGrowth * 100) / 100,
      
      // Customer metrics
      totalCustomers,
      newCustomersThisMonth,
      activeUsers: activeUsers.length,
      customerGrowth: Math.round(customerGrowth * 100) / 100,
      
      // Product metrics
      totalProducts,
      lowStockCount,
      
      // Arrays
      topProducts,
      monthlyRevenue: completeMonthlyRevenue,
      weeklyRevenue,
      recentOrders: formattedRecentOrders,
      categoryPerformance,
      paymentMethodStats,
      
      // Additional metrics
      abandonedCarts
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      message: 'Error fetching dashboard statistics',
      error: error.message 
    });
  }
});

// Get real-time stats (for live updates)
router.get('/stats/realtime', async (req, res) => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    // Recent activity
    const [recentOrders, recentUsers, recentViews] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: fiveMinutesAgo } }),
      User.countDocuments({ 
        'analytics.lastLoginDate': { $gte: fiveMinutesAgo },
        role: { $ne: 'admin' }
      }),
      Product.aggregate([
        { $unwind: '$viewHistory' },
        { $match: { 'viewHistory.viewedAt': { $gte: fiveMinutesAgo } } },
        { $count: 'views' }
      ])
    ]);
    
    res.json({
      recentOrders,
      recentUsers,
      recentViews: recentViews[0]?.views || 0,
      timestamp: now
    });
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get hourly stats for today
router.get('/stats/hourly', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const hourlyStats = await Order.aggregate([
      {
        $match: {
          deliveredAt: { $gte: today },
          orderStatus: 'delivered'
        }
      },
      {
        $group: {
          _id: { $hour: '$deliveredAt' },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    // Fill in missing hours
    const completeHourlyData = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourData = hourlyStats.find(h => h._id === hour);
      completeHourlyData.push({
        label: `${hour}:00`,
        revenue: hourData?.revenue || 0,
        orders: hourData?.orders || 0
      });
    }
    
    res.json(completeHourlyData);
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get detailed order analytics
router.get('/analytics/orders', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    const matchStage = Object.keys(dateFilter).length > 0 
      ? { createdAt: dateFilter }
      : {};
    
    const orderAnalytics = await Order.aggregate([
      { $match: matchStage },
      {
        $facet: {
          // Hourly distribution (all orders)
          hourlyDistribution: [
            {
              $group: {
                _id: { $hour: '$createdAt' },
                count: { $sum: 1 },
                revenue: { 
                  $sum: {
                    $cond: [
                      { $eq: ['$orderStatus', 'delivered'] },
                      '$totalAmount',
                      0
                    ]
                  }
                }
              }
            },
            { $sort: { '_id': 1 } }
          ],
          
          // Day of week distribution (all orders)
          dayOfWeekDistribution: [
            {
              $group: {
                _id: { $dayOfWeek: '$createdAt' },
                count: { $sum: 1 },
                revenue: { 
                  $sum: {
                    $cond: [
                      { $eq: ['$orderStatus', 'delivered'] },
                      '$totalAmount',
                      0
                    ]
                  }
                }
              }
            },
            { $sort: { '_id': 1 } }
          ],
          
          // Average processing time (delivered orders only)
          processingTime: [
            {
              $match: {
                orderStatus: 'delivered',
                deliveredAt: { $exists: true }
              }
            },
            {
              $project: {
                processingDays: {
                  $divide: [
                    { $subtract: ['$deliveredAt', '$createdAt'] },
                    1000 * 60 * 60 * 24
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                avgProcessingDays: { $avg: '$processingDays' },
                minProcessingDays: { $min: '$processingDays' },
                maxProcessingDays: { $max: '$processingDays' }
              }
            }
          ]
        }
      }
    ]);
    
    res.json(orderAnalytics[0]);
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get customer analytics
router.get('/analytics/customers', async (req, res) => {
  try {
    const customerAnalytics = await User.aggregate([
      { $match: { role: { $ne: 'admin' } } },
      {
        $facet: {
          // Customer lifetime value distribution
          lifetimeValue: [
            {
              $bucket: {
                groupBy: '$analytics.totalSpent',
                boundaries: [0, 1000000, 5000000, 10000000, 50000000, 100000000],
                default: 'Other',
                output: {
                  count: { $sum: 1 },
                  avgOrders: { $avg: '$analytics.totalOrders' }
                }
              }
            }
          ],
          
          // Top customers
          topCustomers: [
            { $sort: { 'analytics.totalSpent': -1 } },
            { $limit: 10 },
            {
              $project: {
                name: 1,
                email: 1,
                totalSpent: '$analytics.totalSpent',
                totalOrders: '$analytics.totalOrders',
                avgOrderValue: '$analytics.averageOrderValue',
                lastPurchase: '$analytics.lastPurchaseDate'
              }
            }
          ],
          
          // Registration trend
          registrationTrend: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            { $limit: 12 }
          ]
        }
      }
    ]);
    
    res.json(customerAnalytics[0]);
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
