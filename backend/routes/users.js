// backend/routes/users.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');

// Get current user profile with calculated analytics
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate({
        path: 'interactions.wishlist.product',
        select: 'name price images category brand rating totalReviews stock'
      });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Filter out null products from wishlist
    if (user.interactions && user.interactions.wishlist) {
      user.interactions.wishlist = user.interactions.wishlist.filter(item => item.product);
    }
    
    // Calculate analytics from delivered orders
    const orders = await Order.find({ 
      user: req.user._id,
      orderStatus: 'delivered' // Only count delivered orders
    }).populate('items.product', 'category brand');
    
    // Calculate total spent from delivered orders
    const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    
    // Find last purchase date from delivered orders
    const lastPurchaseDate = orders.length > 0 
      ? orders.sort((a, b) => new Date(b.deliveredAt || b.createdAt) - new Date(a.deliveredAt || a.createdAt))[0].deliveredAt
      : null;
    
    // Calculate favorite category and brand from delivered orders
    const categoryCount = {};
    const brandCount = {};
    
    for (const order of orders) {
      for (const item of order.items) {
        if (item.product) {
          // Count categories
          if (item.product.category) {
            categoryCount[item.product.category] = (categoryCount[item.product.category] || 0) + item.quantity;
          }
          // Count brands
          if (item.product.brand) {
            brandCount[item.product.brand] = (brandCount[item.product.brand] || 0) + item.quantity;
          }
        }
      }
    }
    
    // Find favorite category and brand
    const favoriteCategory = Object.keys(categoryCount).length > 0
      ? Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0][0]
      : null;
      
    const favoriteBrand = Object.keys(brandCount).length > 0
      ? Object.entries(brandCount).sort((a, b) => b[1] - a[1])[0][0]
      : null;
    
    // Update user analytics with calculated values
    user.analytics = {
      ...user.analytics.toObject ? user.analytics.toObject() : user.analytics,
      totalSpent,
      totalOrders,
      averageOrderValue,
      lastPurchaseDate,
      favoriteCategory,
      favoriteBrand
    };
    
    // Convert to object and return
    const userObj = user.toObject();
    userObj.analytics = user.analytics;
    
    res.json(userObj);
  } catch (error) {
    console.error('Error in /me route:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update user profile - ALLOW PARTIAL UPDATES
router.put('/me', protect, async (req, res) => {
  try {
    const allowedUpdates = ['name', 'phone', 'address', 'preferences'];
    const updates = {};
    
    // Only include fields that are provided and allowed
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key) && req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { 
        new: true,
        runValidators: false // Skip validation for partial updates
      }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Recalculate analytics for the response
    const orders = await Order.find({ 
      user: req.user._id,
      orderStatus: 'delivered'
    }).populate('items.product', 'category brand');
    
    const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    
    const lastPurchaseDate = orders.length > 0 
      ? orders.sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt))[0].deliveredAt
      : null;
    
    // Calculate favorite category and brand
    const categoryCount = {};
    const brandCount = {};
    
    for (const order of orders) {
      for (const item of order.items) {
        if (item.product) {
          if (item.product.category) {
            categoryCount[item.product.category] = (categoryCount[item.product.category] || 0) + item.quantity;
          }
          if (item.product.brand) {
            brandCount[item.product.brand] = (brandCount[item.product.brand] || 0) + item.quantity;
          }
        }
      }
    }
    
    const favoriteCategory = Object.keys(categoryCount).length > 0
      ? Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0][0]
      : null;
      
    const favoriteBrand = Object.keys(brandCount).length > 0
      ? Object.entries(brandCount).sort((a, b) => b[1] - a[1])[0][0]
      : null;
    
    const userObj = user.toObject();
    userObj.analytics = {
      ...userObj.analytics,
      totalSpent,
      totalOrders,
      averageOrderValue,
      lastPurchaseDate,
      favoriteCategory,
      favoriteBrand
    };
    
    res.json(userObj);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update user preferences only
router.put('/preferences', protect, async (req, res) => {
  try {
    const { preferences } = req.body;
    
    if (!preferences) {
      return res.status(400).json({ message: 'Preferences data is required' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { preferences } },
      { new: true, runValidators: false }
    ).select('preferences');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user.preferences);
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user's wishlist
router.get('/wishlist', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('interactions.wishlist')
      .populate({
        path: 'interactions.wishlist.product',
        select: 'name price images category brand rating totalReviews stock',
        match: { _id: { $ne: null } } // Only get non-deleted products
      });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Filter out null products (deleted products) and return with proper structure
    const wishlist = user.interactions?.wishlist?.filter(item => item.product) || [];
    
    // Transform to include addedAt date for each item
    const wishlistWithDates = wishlist.map(item => ({
      _id: item._id,
      product: item.product,
      addedAt: item.addedAt || new Date()
    }));
    
    res.json(wishlistWithDates);
  } catch (error) {
    console.error('Error in /wishlist GET route:', error);
    res.status(500).json({ message: error.message });
  }
});

// Manage wishlist (add/remove)
router.post('/wishlist', protect, async (req, res) => {
  try {
    const { productId, action } = req.body;
    const userId = req.user._id;
    
    console.log('Wishlist action:', action, 'Product:', productId, 'User:', userId);
    
    if (!productId || !action) {
      return res.status(400).json({ message: 'Product ID and action are required' });
    }
    
    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({ message: 'Action must be "add" or "remove"' });
    }
    
    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const user = await User.findById(userId).select('interactions');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Initialize interactions if not exists
    if (!user.interactions) {
      user.interactions = { wishlist: [] };
    }
    if (!user.interactions.wishlist) {
      user.interactions.wishlist = [];
    }
    
    if (action === 'add') {
      // Check if already in wishlist
      const exists = user.interactions.wishlist.some(
        item => item.product && item.product.toString() === productId.toString()
      );
      
      if (!exists) {
        // Use atomic operation to prevent race conditions
        await User.findByIdAndUpdate(
          userId,
          { 
            $addToSet: { 
              'interactions.wishlist': {
                product: productId,
                addedAt: new Date()
              }
            },
            $set: {
              'analytics.lastActivityDate': new Date()
            }
          },
          { new: false }
        );
        
        console.log('✅ Added to wishlist:', productId);
      } else {
        console.log('ℹ️ Product already in wishlist:', productId);
      }
    } else if (action === 'remove') {
      // Use atomic operation to remove
      await User.findByIdAndUpdate(
        userId,
        { 
          $pull: { 
            'interactions.wishlist': { product: productId }
          },
          $set: {
            'analytics.lastActivityDate': new Date()
          }
        },
        { new: false }
      );
      
      console.log('✅ Removed from wishlist:', productId);
    }
    
    // Fetch updated user with populated wishlist
    const updatedUser = await User.findById(userId)
      .select('interactions.wishlist')
      .populate({
        path: 'interactions.wishlist.product',
        select: 'name price images category brand rating totalReviews stock'
      });
    
    const wishlist = updatedUser.interactions?.wishlist?.filter(item => item.product) || [];
    
    // Return wishlist with proper structure
    const wishlistWithDates = wishlist.map(item => ({
      _id: item._id,
      product: item.product,
      addedAt: item.addedAt || new Date()
    }));
    
    res.json(wishlistWithDates);
  } catch (error) {
    console.error('Error in /wishlist POST route:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user's view history
router.get('/view-history', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'viewHistory.product',
        select: 'name price images category brand',
        match: { _id: { $ne: null } } // Only get non-deleted products
      })
      .select('viewHistory');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Filter out items where product is null (deleted products)
    let viewHistory = user.viewHistory?.filter(item => item.product) || [];
    
    // Remove duplicates - keep only the most recent view of each product
    const uniqueProducts = new Map();
    viewHistory.forEach(item => {
      if (item.product) {
        const productId = item.product._id.toString();
        if (!uniqueProducts.has(productId) || 
            new Date(item.viewedAt) > new Date(uniqueProducts.get(productId).viewedAt)) {
          uniqueProducts.set(productId, {
            _id: item._id,
            product: item.product,
            viewedAt: item.viewedAt,
            duration: item.duration || 0,
            source: item.source || 'direct'
          });
        }
      }
    });
    
    // Convert back to array and sort by most recent
    const uniqueHistory = Array.from(uniqueProducts.values())
      .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))
      .slice(0, 50); // Limit to 50 most recent views
    
    console.log(`📚 Returning ${uniqueHistory.length} view history items for user ${req.user._id}`);
    res.json(uniqueHistory);
  } catch (error) {
    console.error('Error fetching view history:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add to view history
router.post('/view-history', protect, async (req, res) => {
  try {
    const { productId, duration = 0, source = 'direct' } = req.body;
    
    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize viewHistory if not exists
    if (!user.viewHistory) {
      user.viewHistory = [];
    }

    // Remove existing view of same product today to avoid duplicates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    user.viewHistory = user.viewHistory.filter(item => 
      !(item.product?.toString() === productId.toString() && 
        new Date(item.viewedAt) >= today)
    );
    
    // Add new view
    user.viewHistory.push({
      product: productId,
      viewedAt: new Date(),
      duration: Number(duration) || 0,
      source: source
    });
    
    // Keep only last 100 views to prevent unlimited growth
    if (user.viewHistory.length > 100) {
      user.viewHistory = user.viewHistory.slice(-100);
    }
    
    // Save without validation to avoid schema issues
    await User.updateOne(
      { _id: req.user._id },
      { $set: { viewHistory: user.viewHistory } }
    );
    
    console.log(`👀 Added view history: Product ${productId}, Duration: ${duration}s, Source: ${source}`);
    res.json({ 
      message: 'View history updated successfully',
      productId,
      duration,
      source
    });
  } catch (error) {
    console.error('Error adding to view history:', error);
    res.status(500).json({ message: error.message });
  }
});

// Clear view history
router.delete('/view-history', protect, async (req, res) => {
  try {
    const result = await User.updateOne(
      { _id: req.user._id },
      { $set: { viewHistory: [] } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log(`🗑️ Cleared view history for user ${req.user._id}`);
    res.json({ message: 'View history cleared successfully' });
  } catch (error) {
    console.error('Error clearing view history:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user analytics/stats - Updated to calculate from delivered orders
router.get('/stats', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('analytics viewHistory interactions createdAt');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Calculate stats from delivered orders
    const deliveredOrders = await Order.find({ 
      user: req.user._id,
      orderStatus: 'delivered'
    }).select('totalAmount');
    
    const totalSpent = deliveredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalPurchases = deliveredOrders.length;
    const averageOrderValue = totalPurchases > 0 ? totalSpent / totalPurchases : 0;
    
    const stats = {
      totalViews: user.viewHistory?.length || 0,
      totalPurchases,
      totalSpent,
      averageOrderValue,
      wishlistItems: user.interactions?.wishlist?.length || 0,
      lastLoginDate: user.analytics?.lastLoginDate,
      registrationDate: user.analytics?.registrationDate || user.createdAt,
      favoriteCategory: user.analytics?.favoriteCategory,
      favoriteBrand: user.analytics?.favoriteBrand
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update last login time
router.post('/update-login', protect, async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { 
        $set: { 
          'analytics.lastLoginDate': new Date() 
        }
      }
    );
    
    res.json({ message: 'Login time updated' });
  } catch (error) {
    console.error('Error updating login time:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user's search history
router.get('/search-history', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('searchHistory');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const searchHistory = user.searchHistory || [];
    
    // Sort by most recent and limit to 20
    const recentSearches = searchHistory
      .sort((a, b) => new Date(b.searchedAt) - new Date(a.searchedAt))
      .slice(0, 20);
    
    res.json(recentSearches);
  } catch (error) {
    console.error('Error fetching search history:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add to search history
router.post('/search-history', protect, async (req, res) => {
  try {
    const { query, resultsCount = 0, clickedResults = [] } = req.body;
    
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }
    
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $push: {
          searchHistory: {
            $each: [{
              query: query.toLowerCase().trim(),
              searchedAt: new Date(),
              resultsCount: resultsCount || 0,
              clickedResults: clickedResults || []
            }],
            $position: 0,
            $slice: 50 // Keep only last 50 searches
          }
        },
        $set: {
          'analytics.lastActivityDate': new Date()
        }
      },
      { new: false }
    );
    
    res.json({ success: true, message: 'Search tracked successfully' });
  } catch (error) {
    console.error('Error tracking search:', error);
    res.status(500).json({ message: error.message });
  }
});

// Clear search history
router.delete('/search-history', protect, async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $set: { searchHistory: [] } }
    );
    
    res.json({ message: 'Search history cleared successfully' });
  } catch (error) {
    console.error('Error clearing search history:', error);
    res.status(500).json({ message: error.message });
  }
});

// Change password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check current password
    const isValidPassword = await user.matchPassword(currentPassword);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete user account
router.delete('/account', protect, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: 'Password confirmation is required' });
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify password
    const isValidPassword = await user.matchPassword(password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Password is incorrect' });
    }
    
    // Soft delete - just deactivate account
    await User.updateOne(
      { _id: req.user._id },
      { 
        $set: { 
          isActive: false,
          'analytics.deletedAt': new Date()
        }
      }
    );
    
    res.json({ message: 'Account deactivated successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: error.message });
  }
});

// Ping endpoint to update user activity
router.post('/ping', protect, async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { 
        $set: { 
          'analytics.lastActivityDate': new Date(),
          'analytics.lastLoginDate': new Date()
        }
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user activity:', error);
    res.json({ success: false });
  }
});

// Track product view
router.post('/track-view', protect, async (req, res) => {
  try {
    const { productId, duration, source } = req.body;
    
    if (!productId) {
      return res.status(400).json({ message: 'Product ID required' });
    }
    
    // Update user's view history
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $push: {
          viewHistory: {
            $each: [{
              product: productId,
              viewedAt: new Date(),
              duration: duration || 0,
              source: source || 'direct'
            }],
            $position: 0,
            $slice: 100
          }
        },
        $set: {
          'analytics.lastActivityDate': new Date()
        }
      }
    );
    
    // Increment product view count
    await Product.findByIdAndUpdate(
      productId,
      { $inc: { viewCount: 1 } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Track view error:', error);
    res.status(500).json({ message: 'Failed to track view' });
  }
});

// Get user profile with wishlist populated
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('interactions.wishlist.product', 'name price images category rating');
    
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone, address, preferences } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (preferences) updateData.preferences = preferences;
    
    // Update activity date
    updateData['analytics.lastActivityDate'] = new Date();
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;