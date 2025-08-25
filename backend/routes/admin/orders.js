// backend/routes/admin/orders.js - Complete Version with Payment Features
const express = require('express');
const router = express.Router();
const Order = require('../../models/Order');
const User = require('../../models/User');
const Product = require('../../models/Product');
const { protectAdmin } = require('../../middleware/adminAuth');

// Use combined middleware for better performance
router.use(protectAdmin);

// Get all orders with advanced filtering and pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || '';
    const search = req.query.search || '';
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;
    const paymentStatus = req.query.paymentStatus;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    // Build query
    const query = {};
    
    if (status) {
      query.orderStatus = status;
    }
    
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Search by order ID or customer name/email
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const users = await User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex }
        ]
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      
      query.$or = [
        { _id: searchRegex },
        { user: { $in: userIds } }
      ];
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const total = await Order.countDocuments(query);
    
    const orders = await Order.find(query)
      .populate('user', 'name email phone address analytics')
      .populate({
        path: 'items.product',
        select: 'name price images category brand stock',
        options: { lean: true }
      })
      .sort(sortObj)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    // Calculate additional stats for each order
    const ordersWithStats = orders.map(order => ({
      ...order,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      profit: calculateProfit(order),
      customerLTV: order.user?.analytics?.totalSpent || 0
    }));

    res.json({
      orders: ordersWithStats,
      total,
      page,
      pages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: error.message });
  }
});

// Batch update order statuses
router.patch('/batch-update', async (req, res) => {
  try {
    const { orderIds, status, notifyCustomers = false } = req.body;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'Invalid order IDs' });
    }
    
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updateResults = [];
    const errors = [];

    for (const orderId of orderIds) {
      try {
        const order = await Order.findById(orderId)
          .populate('items.product', 'category brand');
        
        if (!order) {
          errors.push({ orderId, error: 'Order not found' });
          continue;
        }

        const previousStatus = order.orderStatus;
        
        // Update order
        order.orderStatus = status;
        if (status === 'delivered') {
          order.deliveredAt = new Date();
          order.paymentStatus = 'paid';
        } else if (status === 'cancelled') {
          order.cancelledAt = new Date();
          // Restore stock for cancelled orders
          await restoreStock(order);
        }
        
        await order.save();
        
        // Update user analytics if delivered
        if (previousStatus !== 'delivered' && status === 'delivered') {
          await updateUserAnalytics(order.user);
        }
        
        updateResults.push({
          orderId,
          success: true,
          previousStatus,
          newStatus: status
        });
        
        // Notify customer if requested
        if (notifyCustomers && req.io) {
          req.io.to(`user-${order.user}`).emit('orderStatusUpdate', {
            orderId: order._id,
            status: status,
            message: getStatusMessage(status)
          });
        }
      } catch (error) {
        errors.push({ orderId, error: error.message });
      }
    }

    res.json({
      success: updateResults,
      errors,
      message: `Updated ${updateResults.length} orders, ${errors.length} errors`
    });
  } catch (error) {
    console.error('Error batch updating orders:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update single order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findById(req.params.id)
      .populate('items.product', 'category brand stock');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const previousStatus = order.orderStatus;
    
    // Validate status transition
    if (!isValidStatusTransition(previousStatus, status)) {
      return res.status(400).json({ 
        message: `Cannot change status from ${previousStatus} to ${status}` 
      });
    }
    
    // Update order
    order.orderStatus = status;
    if (note) order.notes = note;
    
    if (status === 'delivered') {
      order.deliveredAt = new Date();
      order.paymentStatus = 'paid';
    } else if (status === 'cancelled') {
      order.cancelledAt = new Date();
      order.cancelReason = note || 'Cancelled by admin';
      await restoreStock(order);
    }

    await order.save();
    
    // Update user analytics if delivered
    if (previousStatus !== 'delivered' && status === 'delivered') {
      await updateUserAnalytics(order.user);
    }
    
    // Populate for response
    await order.populate('user', 'name email');
    await order.populate('items.product', 'name price images');

    // Send real-time notification
    if (req.io) {
      req.io.to(`user-${order.user._id}`).emit('orderStatusUpdate', {
        orderId: order._id,
        status: status,
        message: getStatusMessage(status)
      });
    }

    res.json(order);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: error.message });
  }
});

// Confirm payment for an order
router.patch('/:id/payment', async (req, res) => {
  try {
    const { transactionId, paidAt, method, amount, notes } = req.body;
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Validate payment amount if provided
    if (amount && Math.abs(amount - order.totalAmount) > 1000) {
      // Allow small difference for rounding
      return res.status(400).json({ 
        message: `Payment amount (${amount}) does not match order total (${order.totalAmount})` 
      });
    }
    
    // Auto-generate transaction ID if not provided
    const finalTransactionId = transactionId || `TXN${Date.now()}${Math.floor(Math.random() * 10000)}`;
    
    // Update payment status
    order.paymentStatus = 'paid';
    order.paymentDetails = {
      transactionId: finalTransactionId,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      method: method || order.paymentMethod,
      amount: amount || order.totalAmount
    };
    
    // Add notes if provided
    if (notes) {
      order.notes = (order.notes ? order.notes + '\n' : '') + `Payment confirmed: ${notes}`;
    }
    
    // Auto update to processing if payment successful and still pending
    if (order.orderStatus === 'pending') {
      order.orderStatus = 'processing';
    }
    
    await order.save();
    
    // Update user analytics for payment
    const user = await User.findById(order.user);
    if (user) {
      // Track payment method preference
      if (!user.preferences) user.preferences = {};
      user.preferences.preferredPaymentMethod = method || order.paymentMethod;
      await user.save({ validateBeforeSave: false });
    }
    
    // Populate for response
    await order.populate('user', 'name email');
    await order.populate('items.product', 'name price images');
    
    // Send notification to customer
    if (req.io) {
      req.io.to(`user-${order.user}`).emit('paymentConfirmed', {
        orderId: order._id,
        transactionId: finalTransactionId,
        message: 'Thanh toán của bạn đã được xác nhận'
      });
    }
    
    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      transactionId: finalTransactionId,
      order
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Refund payment for an order
router.patch('/:id/refund', async (req, res) => {
  try {
    const { amount, reason, refundTransactionId } = req.body;
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ message: 'Order has not been paid yet' });
    }
    
    const refundAmount = amount || order.totalAmount;
    
    // Update payment status
    order.paymentStatus = 'refunded';
    if (!order.paymentDetails) order.paymentDetails = {};
    order.paymentDetails.refundedAt = new Date();
    order.paymentDetails.refundAmount = refundAmount;
    order.paymentDetails.refundTransactionId = refundTransactionId;
    order.paymentDetails.refundReason = reason;
    
    // Update order status to cancelled if not already
    if (order.orderStatus !== 'cancelled') {
      order.orderStatus = 'cancelled';
      order.cancelledAt = new Date();
      order.cancelReason = `Refunded: ${reason}`;
      
      // Restore stock
      await restoreStock(order);
    }
    
    await order.save();
    
    // Update user analytics
    const user = await User.findById(order.user);
    if (user && user.analytics) {
      // Recalculate totals excluding refunded orders
      const validOrders = await Order.find({
        user: user._id,
        orderStatus: 'delivered',
        paymentStatus: { $ne: 'refunded' }
      });
      
      const totalSpent = validOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const totalOrders = validOrders.length;
      
      user.analytics.totalSpent = totalSpent;
      user.analytics.totalOrders = totalOrders;
      user.analytics.averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
      
      await user.save({ validateBeforeSave: false });
    }
    
    // Send notification
    if (req.io) {
      req.io.to(`user-${order.user}`).emit('paymentRefunded', {
        orderId: order._id,
        amount: refundAmount,
        message: 'Đơn hàng của bạn đã được hoàn tiền'
      });
    }
    
    res.json({
      success: true,
      message: 'Refund processed successfully',
      order
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get order details with full information
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'name email phone address analytics preferences',
        populate: {
          path: 'analytics'
        }
      })
      .populate({
        path: 'items.product',
        select: 'name price images category brand description stock'
      })
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Add calculated fields
    order.timeline = getOrderTimeline(order);
    order.canBeCancelled = ['pending', 'processing'].includes(order.orderStatus);
    order.refundAmount = calculateRefundAmount(order);

    res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get comprehensive order statistics
router.get('/stats/dashboard', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const dateRange = getDateRange(period);
    
    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: today }
    });
    
    const todayRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: today },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    // Period stats
    const periodStats = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: dateRange.start,
            $lte: dateRange.end
          }
        }
      },
      {
        $facet: {
          statusBreakdown: [
            {
              $group: {
                _id: '$orderStatus',
                count: { $sum: 1 },
                revenue: { $sum: '$totalAmount' }
              }
            }
          ],
          paymentBreakdown: [
            {
              $group: {
                _id: '$paymentMethod',
                count: { $sum: 1 },
                revenue: { $sum: '$totalAmount' }
              }
            }
          ],
          dailyTrend: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                },
                orders: { $sum: 1 },
                revenue: { $sum: '$totalAmount' }
              }
            },
            { $sort: { '_id': 1 } }
          ],
          topProducts: [
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.product',
                quantity: { $sum: '$items.quantity' },
                revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
              }
            },
            { $sort: { quantity: -1 } },
            { $limit: 5 }
          ],
          averageMetrics: [
            {
              $group: {
                _id: null,
                avgOrderValue: { $avg: '$totalAmount' },
                avgItemsPerOrder: { $avg: { $size: '$items' } },
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: '$totalAmount' }
              }
            }
          ]
        }
      }
    ]);
    
    // Format response
    const stats = periodStats[0];
    
    // Populate top products with details
    if (stats.topProducts.length > 0) {
      const productIds = stats.topProducts.map(p => p._id);
      const products = await Product.find({ _id: { $in: productIds } })
        .select('name images category')
        .lean();
      
      stats.topProducts = stats.topProducts.map(tp => {
        const product = products.find(p => p._id.toString() === tp._id.toString());
        return {
          ...tp,
          product
        };
      });
    }
    
    res.json({
      today: {
        orders: todayOrders,
        revenue: todayRevenue[0]?.total || 0
      },
      period: {
        range: dateRange,
        ...stats,
        averageMetrics: stats.averageMetrics[0] || {}
      }
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// Export orders to CSV
router.get('/export/csv', async (req, res) => {
  try {
    const { startDate, endDate, status, paymentStatus } = req.query;
    
    const query = {};
    if (status) query.orderStatus = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'name category')
      .lean();
    
    // Convert to CSV format
    const csv = convertOrdersToCSV(orders);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    res.send('\uFEFF' + csv); // Add BOM for Excel UTF-8 support
  } catch (error) {
    console.error('Error exporting orders:', error);
    res.status(500).json({ message: error.message });
  }
});

// Cancel order
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if order can be cancelled
    if (!['pending', 'processing'].includes(order.orderStatus)) {
      return res.status(400).json({ 
        message: 'Order cannot be cancelled in current status' 
      });
    }
    
    // Restore stock
    await restoreStock(order);
    
    // Update order
    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = reason || 'Cancelled by admin';
    await order.save();
    
    // Notify user via socket if available
    if (req.io) {
      req.io.to(`user-${order.user}`).emit('orderCancelled', {
        orderId: order._id,
        reason: order.cancelReason
      });
    }
    
    res.json({ 
      message: 'Order cancelled successfully',
      order 
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ message: error.message });
  }
});

// Helper functions
async function updateUserAnalytics(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    
    const deliveredOrders = await Order.find({
      user: userId,
      orderStatus: 'delivered'
    }).populate('items.product', 'category brand');
    
    const totalSpent = deliveredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = deliveredOrders.length;
    
    // Calculate favorite category and brand
    const categoryCount = {};
    const brandCount = {};
    
    deliveredOrders.forEach(order => {
      order.items.forEach(item => {
        if (item.product) {
          if (item.product.category) {
            categoryCount[item.product.category] = (categoryCount[item.product.category] || 0) + item.quantity;
          }
          if (item.product.brand) {
            brandCount[item.product.brand] = (brandCount[item.product.brand] || 0) + item.quantity;
          }
        }
      });
    });
    
    const favoriteCategory = Object.keys(categoryCount).length > 0
      ? Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0][0]
      : null;
      
    const favoriteBrand = Object.keys(brandCount).length > 0
      ? Object.entries(brandCount).sort((a, b) => b[1] - a[1])[0][0]
      : null;
    
    await User.findByIdAndUpdate(userId, {
      $set: {
        'analytics.totalSpent': totalSpent,
        'analytics.totalOrders': totalOrders,
        'analytics.averageOrderValue': totalOrders > 0 ? totalSpent / totalOrders : 0,
        'analytics.lastPurchaseDate': new Date(),
        'analytics.favoriteCategory': favoriteCategory,
        'analytics.favoriteBrand': favoriteBrand
      }
    });
    
    console.log(`✅ Updated analytics for user ${userId}`);
  } catch (error) {
    console.error('Error updating user analytics:', error);
  }
}

async function restoreStock(order) {
  for (const item of order.items) {
    await Product.findOneAndUpdate(
      {
        _id: item.product,
        'stock.size': item.size,
        'stock.color': item.color
      },
      {
        $inc: {
          'stock.$.quantity': item.quantity,
          'totalOrders': -1
        }
      }
    );
  }
}

function isValidStatusTransition(from, to) {
  const transitions = {
    'pending': ['processing', 'cancelled'],
    'processing': ['shipped', 'cancelled'],
    'shipped': ['delivered', 'cancelled'],
    'delivered': [],
    'cancelled': []
  };
  
  return transitions[from]?.includes(to) || false;
}

function getStatusMessage(status) {
  const messages = {
    'pending': 'Đơn hàng đang chờ xử lý',
    'processing': 'Đơn hàng đang được xử lý',
    'shipped': 'Đơn hàng đã được giao cho đơn vị vận chuyển',
    'delivered': 'Đơn hàng đã được giao thành công',
    'cancelled': 'Đơn hàng đã bị hủy'
  };
  return messages[status] || 'Cập nhật trạng thái đơn hàng';
}

function getOrderTimeline(order) {
  const timeline = [
    {
      status: 'created',
      date: order.createdAt,
      label: 'Đơn hàng được tạo'
    }
  ];
  
  if (order.orderStatus !== 'pending') {
    timeline.push({
      status: 'processing',
      date: order.updatedAt,
      label: 'Đang xử lý'
    });
  }
  
  if (order.deliveredAt) {
    timeline.push({
      status: 'delivered',
      date: order.deliveredAt,
      label: 'Đã giao hàng'
    });
  }
  
  if (order.cancelledAt) {
    timeline.push({
      status: 'cancelled',
      date: order.cancelledAt,
      label: 'Đã hủy'
    });
  }
  
  return timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function calculateProfit(order) {
  // Simple profit calculation - you can enhance this
  return order.totalAmount * 0.3; // Assume 30% profit margin
}

function calculateRefundAmount(order) {
  if (order.paymentStatus !== 'paid') return 0;
  
  if (['pending', 'processing'].includes(order.orderStatus)) {
    return order.totalAmount;
  }
  
  if (order.orderStatus === 'shipped') {
    return order.totalAmount - (order.shippingFee || 0);
  }
  
  return 0;
}

function getDateRange(period) {
  const end = new Date();
  const start = new Date();
  
  switch (period) {
    case '24h':
      start.setDate(start.getDate() - 1);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    default:
      start.setDate(start.getDate() - 7);
  }
  
  return { start, end };
}

function convertOrdersToCSV(orders) {
  const headers = [
    'Mã đơn hàng',
    'Ngày đặt',
    'Tên khách hàng',
    'Email',
    'Số điện thoại',
    'Địa chỉ',
    'Tổng tiền',
    'Giảm giá',
    'Trạng thái',
    'Thanh toán',
    'Phương thức',
    'Sản phẩm'
  ];
  
  const rows = orders.map(order => {
    const address = order.shippingAddress 
      ? `${order.shippingAddress.street}, ${order.shippingAddress.city}`
      : '';
      
    return [
      order._id,
      new Date(order.createdAt).toLocaleDateString('vi-VN'),
      order.user?.name || '',
      order.user?.email || '',
      order.user?.phone || '',
      address,
      order.totalAmount,
      order.discountAmount || 0,
      order.orderStatus,
      order.paymentStatus,
      order.paymentMethod,
      order.items.map(i => `${i.product?.name} x${i.quantity}`).join('; ')
    ];
  });
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return csvContent;
}

module.exports = router;
