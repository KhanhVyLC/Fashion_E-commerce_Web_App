// backend/routes/orders.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Create order with selected items only
router.post('/create', protect, async (req, res) => {
  try {
    const { shippingAddress, paymentMethod, selectedItemIds } = req.body;
    
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Giỏ hàng trống' });
    }

    // Filter only selected items if provided
    let itemsToOrder = cart.items;
    if (selectedItemIds && selectedItemIds.length > 0) {
      itemsToOrder = cart.items.filter(item => 
        selectedItemIds.includes(item._id.toString())
      );
      
      if (itemsToOrder.length === 0) {
        return res.status(400).json({ message: 'Không có sản phẩm nào được chọn' });
      }
    }

    // Check stock availability for selected items
    const unavailableItems = [];
    const orderItems = [];
    
    for (const item of itemsToOrder) {
      const product = await Product.findById(item.product._id);
      const stockItem = product.stock.find(
        s => s.size === item.size && s.color === item.color
      );
      
      if (!stockItem || stockItem.quantity < item.quantity) {
        unavailableItems.push({
          productName: product.name,
          size: item.size,
          color: item.color,
          requested: item.quantity,
          available: stockItem ? stockItem.quantity : 0
        });
      } else {
        orderItems.push({
          product: item.product._id,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
          price: item.product.price
        });
      }
    }
    
    if (unavailableItems.length > 0) {
      return res.status(400).json({
        message: 'Một số sản phẩm không đủ hàng',
        unavailableItems
      });
    }

    const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Create order
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      totalAmount,
      shippingAddress,
      paymentMethod
    });

    // Update stock and totalOrders
    for (const item of orderItems) {
      await Product.findOneAndUpdate(
        {
          _id: item.product,
          'stock.size': item.size,
          'stock.color': item.color
        },
        {
          $inc: {
            'stock.$.quantity': -item.quantity,
            'totalOrders': 1
          }
        }
      );
    }

    // Remove ordered items from cart
    if (selectedItemIds && selectedItemIds.length > 0) {
      // Remove only selected items
      cart.items = cart.items.filter(item => 
        !selectedItemIds.includes(item._id.toString())
      );
    } else {
      // Clear entire cart if no specific items selected
      cart.items = [];
    }
    
    // Recalculate cart total
    cart.totalPrice = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
    
    await cart.save();

    // NOTE: We do NOT update user analytics here anymore
    // Analytics will only be updated when order status changes to 'delivered'
    // This ensures totalSpent only includes delivered orders

    res.status(201).json({
      order,
      message: 'Đặt hàng thành công!',
      remainingCartItems: cart.items.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user orders
router.get('/my-orders', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product')
      .sort('-createdAt');
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single order
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if order belongs to user
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update order status (admin only - add admin middleware in production)
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { orderStatus } = req.body;
    
    const order = await Order.findById(req.params.id).populate('items.product', 'category brand');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const previousStatus = order.orderStatus;
    
    // Update order status
    order.orderStatus = orderStatus;
    if (orderStatus === 'delivered') {
      order.deliveredAt = new Date();
    }
    
    await order.save();
    
    // If order is newly delivered, update user analytics
    if (previousStatus !== 'delivered' && orderStatus === 'delivered') {
      const user = await User.findById(order.user);
      
      if (user) {
        // Calculate all delivered orders for this user
        const allDeliveredOrders = await Order.find({
          user: user._id,
          orderStatus: 'delivered'
        }).populate('items.product', 'category brand');
        
        // Calculate totals
        const totalSpent = allDeliveredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const totalOrders = allDeliveredOrders.length;
        const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
        
        // Calculate favorite category and brand
        const categoryCount = {};
        const brandCount = {};
        
        for (const deliveredOrder of allDeliveredOrders) {
          for (const item of deliveredOrder.items) {
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
        
        // Update user analytics
        await User.findByIdAndUpdate(
          user._id,
          {
            $set: {
              'analytics.totalSpent': totalSpent,
              'analytics.totalOrders': totalOrders,
              'analytics.averageOrderValue': averageOrderValue,
              'analytics.lastPurchaseDate': order.deliveredAt,
              'analytics.favoriteCategory': favoriteCategory,
              'analytics.favoriteBrand': favoriteBrand
            }
          }
        );
        
        console.log(`✅ Updated analytics for user ${user._id}: totalSpent=${totalSpent}, totalOrders=${totalOrders}`);
      }
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Cancel order
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if order belongs to user
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Check if order can be cancelled
    if (order.orderStatus !== 'pending' && order.orderStatus !== 'processing') {
      return res.status(400).json({ 
        message: 'Không thể hủy đơn hàng đã được giao hoặc đang vận chuyển' 
      });
    }
    
    // Restore stock
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
    
    // Update order status
    order.orderStatus = 'cancelled';
    await order.save();
    
    // If order was previously delivered, recalculate user analytics
    if (order.deliveredAt) {
      const user = await User.findById(order.user);
      
      if (user) {
        // Recalculate analytics excluding this cancelled order
        const deliveredOrders = await Order.find({
          user: user._id,
          orderStatus: 'delivered'
        }).populate('items.product', 'category brand');
        
        const totalSpent = deliveredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const totalOrders = deliveredOrders.length;
        const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
        
        // Update user analytics
        await User.findByIdAndUpdate(
          user._id,
          {
            $set: {
              'analytics.totalSpent': totalSpent,
              'analytics.totalOrders': totalOrders,
              'analytics.averageOrderValue': averageOrderValue
            }
          }
        );
      }
    }
    
    res.json({ message: 'Đơn hàng đã được hủy', order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get order statistics for admin
router.get('/admin/stats', protect, async (req, res) => {
  try {
    // Add admin check here in production
    
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });
    const processingOrders = await Order.countDocuments({ orderStatus: 'processing' });
    const shippedOrders = await Order.countDocuments({ orderStatus: 'shipped' });
    const deliveredOrders = await Order.countDocuments({ orderStatus: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ orderStatus: 'cancelled' });
    
    // Calculate revenue from delivered orders only
    const deliveredOrdersData = await Order.find({ orderStatus: 'delivered' });
    const totalRevenue = deliveredOrdersData.reduce((sum, order) => sum + order.totalAmount, 0);
    
    res.json({
      totalOrders,
      ordersByStatus: {
        pending: pendingOrders,
        processing: processingOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders
      },
      totalRevenue,
      averageOrderValue: deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all orders for admin
router.get('/admin/all', protect, async (req, res) => {
  try {
    // Add admin check here in production
    
    const { page = 1, limit = 10, status, userId } = req.query;
    const query = {};
    
    if (status) {
      query.orderStatus = status;
    }
    
    if (userId) {
      query.user = userId;
    }
    
    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'name price images')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Order.countDocuments(query);
    
    res.json({
      orders,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalOrders: count
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;