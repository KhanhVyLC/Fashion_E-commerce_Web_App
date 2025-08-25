// backend/routes/admin/users.js
const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Order = require('../../models/Order');
const { protect } = require('../../middleware/auth');
const { adminAuth } = require('../../middleware/adminAuth');

router.use(protect, adminAuth);

// Helper function to calculate user analytics - ONLY FOR DELIVERED ORDERS
const calculateUserAnalytics = async (userId) => {
  const orders = await Order.find({ 
    user: userId, 
    orderStatus: 'delivered' // Only count delivered orders
  });

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
  
  // Get last purchase date from delivered orders only
  const lastPurchaseDate = orders.length > 0 
    ? orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt
    : null;

  return {
    totalSpent,
    totalOrders,
    averageOrderValue,
    lastPurchaseDate
  };
};

// Get all users with pagination and analytics
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    const query = { email: { $ne: 'admin@gmail.com' } };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    // Calculate analytics for each user (only delivered orders)
    const usersWithAnalytics = await Promise.all(
      users.map(async (user) => {
        const analytics = await calculateUserAnalytics(user._id);
        return {
          ...user.toObject(),
          analytics
        };
      })
    );

    res.json({
      users: usersWithAnalytics,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user details with orders and analytics
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get ALL orders for order history display
    const orders = await Order.find({ user: user._id })
      .populate('items.product', 'name price images')
      .sort({ createdAt: -1 });

    // Calculate analytics based on DELIVERED orders only
    const analytics = await calculateUserAnalytics(user._id);

    const userWithAnalytics = {
      ...user.toObject(),
      analytics
    };

    res.json({ 
      user: userWithAnalytics, 
      orders 
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: user._id } 
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.phone = phone || user.phone;
    user.address = address || user.address;

    await user.save();

    // Return user with analytics (only delivered orders)
    const analytics = await calculateUserAnalytics(user._id);
    const userWithAnalytics = {
      ...user.toObject(),
      analytics
    };

    res.json(userWithAnalytics);
  } catch (error) {
    console.error('Error updating user:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has orders
    const orderCount = await Order.countDocuments({ user: user._id });
    if (orderCount > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa khách hàng có đơn hàng' 
      });
    }

    // Use deleteOne instead of remove (deprecated)
    await User.deleteOne({ _id: user._id });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user analytics summary (optional endpoint for dashboard) - ONLY DELIVERED ORDERS
router.get('/analytics/summary', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ email: { $ne: 'admin@gmail.com' } });
    const totalOrders = await Order.countDocuments({ orderStatus: 'delivered' }); // Only delivered orders
    const totalRevenue = await Order.aggregate([
      { $match: { orderStatus: 'delivered' } }, // Only delivered orders
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const avgOrderValue = totalOrders > 0 ? 
      (totalRevenue[0]?.total || 0) / totalOrders : 0;

    res.json({
      totalUsers,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      avgOrderValue
    });
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ message: error.message });
  }
});





// Ping endpoint to update user activity
router.post('/ping', protect, async (req, res) => {
  try {
    // Simple update of last login date
    await User.updateOne(
      { _id: req.user._id },
      { 
        $set: { 
          'analytics.lastLoginDate': new Date(),
          'analytics.lastActivityDate': new Date()
        }
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    // Don't fail the request, just log
    console.error('Ping error:', error);
    res.json({ success: false });
  }
});
module.exports = router;
