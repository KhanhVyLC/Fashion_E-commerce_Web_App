// backend/routes/orders.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const Voucher = require('../models/Voucher');
const FlashSale = require('../models/FlashSale');
const cron = require('node-cron');

// Generate VietQR data
function generateBankQRData(orderId, amount) {
  // MB Bank account info from environment variables or defaults
  const bankInfo = {
    bankId: process.env.MB_BANK_ID || 'MB',
    accountNo: process.env.MB_BANK_ACCOUNT_NO || '0393737373',
    accountName: process.env.MB_BANK_ACCOUNT_NAME || 'NGUYEN VAN A',
    template: 'compact2'
  };
  
  // Generate payment content with order ID
  const paymentContent = `DH${orderId.toString().slice(-8).toUpperCase()}`;
  
  // Create VietQR URL
  const qrData = {
    bankId: bankInfo.bankId,
    accountNo: bankInfo.accountNo,
    accountName: bankInfo.accountName,
    amount: amount,
    content: paymentContent,
    template: bankInfo.template,
    // Generate QR URL using VietQR API format
    qrUrl: `https://img.vietqr.io/image/${bankInfo.bankId}-${bankInfo.accountNo}-${bankInfo.template}.png?amount=${amount}&addInfo=${encodeURIComponent(paymentContent)}&accountName=${encodeURIComponent(bankInfo.accountName)}`
  };
  
  return qrData;
}

// Create order with voucher and flash sale support
router.post('/create', protect, async (req, res) => {
  try {
    const { 
      shippingAddress, 
      paymentMethod, 
      selectedItemIds,
      voucherCode,
      subtotal: clientSubtotal,
      discountAmount: clientDiscountAmount,
      totalAmount: clientTotalAmount,
      customerName,
      customerPhone
    } = req.body;
    
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Giỏ hàng trống' });
    }

    // Validate flash sale items before checkout
    await cart.validateFlashSaleItems();

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

    // Track flash sale items for updating sold quantities
    const flashSaleUpdates = [];

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
        // Additional check for flash sale items
        if (item.isFlashSaleItem && item.flashSaleId) {
          const flashSale = await FlashSale.findById(item.flashSaleId);
          if (flashSale && flashSale.isCurrentlyActive) {
            const flashProduct = flashSale.products.find(p => 
              p.product.toString() === item.product._id.toString()
            );
            
            if (flashProduct) {
              const availableInSale = flashProduct.maxQuantity - flashProduct.soldQuantity;
              if (item.quantity > availableInSale) {
                unavailableItems.push({
                  productName: product.name,
                  size: item.size,
                  color: item.color,
                  requested: item.quantity,
                  available: availableInSale,
                  reason: 'Flash Sale limit exceeded'
                });
                continue;
              }
              
              // Track for updating later
              flashSaleUpdates.push({
                saleId: flashSale._id,
                productId: item.product._id,
                quantity: item.quantity
              });
            }
          }
        }
        
        orderItems.push({
          product: item.product._id,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
          price: item.price, // This will be flash sale price if applicable
          originalPrice: item.originalPrice || item.product.price,
          isFlashSaleItem: item.isFlashSaleItem || false,
          flashSaleId: item.flashSaleId,
          flashSaleDiscount: item.isFlashSaleItem 
            ? (item.originalPrice - item.price) * item.quantity 
            : 0
        });
      }
    }
    
    if (unavailableItems.length > 0) {
      return res.status(400).json({
        message: 'Một số sản phẩm không đủ hàng',
        unavailableItems
      });
    }

    // Calculate amounts including flash sale discounts
    let subtotal = orderItems.reduce((sum, item) => 
      sum + ((item.originalPrice || item.price) * item.quantity), 0
    );
    let flashSaleDiscount = orderItems.reduce((sum, item) => 
      sum + (item.flashSaleDiscount || 0), 0
    );
    let voucherDiscount = 0;
    let totalAmount = subtotal - flashSaleDiscount;
    let appliedVoucher = null;

    // Apply voucher if provided (after flash sale discount)
    if (voucherCode) {
      try {
        const voucherResult = await Voucher.validateAndApply(
          voucherCode,
          req.user._id,
          totalAmount, // Apply voucher on price after flash sale
          orderItems.map(item => ({
            ...item,
            product: itemsToOrder.find(i => 
              i.product._id.toString() === item.product.toString()
            ).product
          }))
        );
        
        voucherDiscount = voucherResult.discountAmount;
        totalAmount = voucherResult.finalAmount;
        appliedVoucher = voucherResult.voucher;
      } catch (error) {
        console.log('Voucher error:', error.message);
        // Continue without voucher if validation fails
        voucherDiscount = 0;
      }
    }

    // Add customer info to shipping address if provided
    const finalShippingAddress = {
      ...shippingAddress,
      recipientName: customerName || req.user.name,
      recipientPhone: customerPhone || req.user.phone
    };
    
    // Generate bank transfer info if needed
    let bankTransferInfo = null;
    if (paymentMethod === 'BankTransfer') {
      const qrData = generateBankQRData('temp', totalAmount); // Will update with actual order ID
      const expiredAt = new Date();
      expiredAt.setHours(expiredAt.getHours() + 24); // 24 hours payment deadline
      
      bankTransferInfo = {
        ...qrData,
        expiredAt,
        reminderSent: false
      };
    }
    
    // Create order with flash sale info
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      subtotal: subtotal,
      discountAmount: flashSaleDiscount + voucherDiscount,
      flashSaleDiscount: flashSaleDiscount,
      voucherDiscount: voucherDiscount,
      totalAmount: totalAmount,
      shippingAddress: finalShippingAddress,
      paymentMethod: paymentMethod || 'COD',
      voucherCode: appliedVoucher ? appliedVoucher.code : null,
      shippingFee: 0,
      notes: '',
      bankTransferInfo: bankTransferInfo,
      orderMetadata: {
        hasFlashSaleItems: flashSaleDiscount > 0,
        flashSaleIds: [...new Set(orderItems.filter(i => i.flashSaleId).map(i => i.flashSaleId))]
      }
    });
    
    // Update QR code with actual order ID
    if (bankTransferInfo) {
      const updatedQRData = generateBankQRData(order._id, totalAmount);
      order.bankTransferInfo = {
        ...order.bankTransferInfo.toObject(),
        ...updatedQRData
      };
      await order.save();
    }

    // Update flash sale sold quantities
    for (const update of flashSaleUpdates) {
      try {
        const flashSale = await FlashSale.findById(update.saleId);
        await flashSale.updateSoldQuantity(update.productId, update.quantity);
        
        // Update product flash sale stats
        await Product.findByIdAndUpdate(update.productId, {
          $inc: {
            'flashSaleStats.totalSoldInFlashSales': update.quantity,
            'flashSaleStats.flashSaleRevenue': orderItems.find(i => 
              i.product.toString() === update.productId.toString()
            ).price * update.quantity
          },
          $set: {
            'flashSaleStats.lastFlashSaleDate': new Date()
          }
        });
      } catch (error) {
        console.error('Error updating flash sale quantity:', error);
        // Continue with order even if flash sale update fails
      }
    }

    // Update voucher usage if applied
    if (appliedVoucher) {
      appliedVoucher.usedCount += 1;
      appliedVoucher.usedBy.push({
        user: req.user._id,
        orderId: order._id,
        usedAt: new Date()
      });
      await appliedVoucher.save();
    }

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
      cart.items = cart.items.filter(item => 
        !selectedItemIds.includes(item._id.toString())
      );
    } else {
      cart.items = [];
    }
    
    cart.totalPrice = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
    
    await cart.save();

    // Emit socket notification for new order
    if (req.io) {
      req.io.to('admin-room').emit('newOrderNotification', {
        orderId: order._id,
        customerName: customerName || req.user.name,
        totalAmount: totalAmount,
        orderStatus: 'pending',
        hasFlashSale: flashSaleDiscount > 0,
        paymentMethod: paymentMethod,
        requiresPayment: paymentMethod === 'BankTransfer',
        paymentDeadline: bankTransferInfo?.expiredAt,
        createdAt: new Date()
      });
    }

    res.status(201).json({
      order,
      message: flashSaleDiscount > 0 
        ? `Đặt hàng thành công! Bạn đã tiết kiệm ${flashSaleDiscount.toLocaleString('vi-VN')}₫ từ Flash Sale!`
        : 'Đặt hàng thành công!',
      remainingCartItems: cart.items.length,
      qrCodeData: bankTransferInfo,
      discountApplied: flashSaleDiscount + voucherDiscount,
      flashSaleDiscount,
      voucherDiscount,
      paymentDeadline: bankTransferInfo?.expiredAt
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get QR code for existing order
router.get('/:id/qr-code', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check if order belongs to user
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }
    
    if (order.paymentMethod !== 'BankTransfer') {
      return res.status(400).json({ message: 'QR code only available for bank transfer payments' });
    }
    
    // Check if payment is expired
    const paymentStatus = order.paymentDeadlineStatus;
    if (paymentStatus?.isExpired) {
      return res.status(400).json({ 
        message: 'Đơn hàng đã hết hạn thanh toán',
        expired: true 
      });
    }
    
    // Return existing QR data or regenerate if needed
    let qrCodeData = order.bankTransferInfo;
    if (!qrCodeData || !qrCodeData.qrUrl) {
      qrCodeData = generateBankQRData(order._id, order.totalAmount);
      
      // Update order with new QR data
      order.bankTransferInfo = {
        ...order.bankTransferInfo?.toObject(),
        ...qrCodeData
      };
      await order.save();
    }
    
    res.json({
      ...qrCodeData.toObject ? qrCodeData.toObject() : qrCodeData,
      paymentDeadline: order.bankTransferInfo?.expiredAt,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      hoursRemaining: paymentStatus?.hoursRemaining,
      minutesRemaining: paymentStatus?.minutesRemaining
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ message: error.message });
  }
});

// Validate voucher
router.post('/validate-voucher', protect, async (req, res) => {
  try {
    const { code, orderAmount, orderItems } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Vui lòng nhập mã voucher' });
    }

    // Populate product details for items if needed
    const populatedItems = [];
    for (const item of orderItems) {
      const product = await Product.findById(item.productId || item.product);
      if (product) {
        populatedItems.push({
          ...item,
          product: {
            _id: product._id,
            category: product.category,
            brand: product.brand
          }
        });
      }
    }

    const result = await Voucher.validateAndApply(
      code,
      req.user._id,
      orderAmount,
      populatedItems
    );

    res.json({
      valid: true,
      code: result.voucher.code,
      description: result.voucher.description,
      discountType: result.voucher.discountType,
      discountValue: result.voucher.discountValue,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount
    });
  } catch (error) {
    console.error('Voucher validation error:', error);
    res.status(400).json({ 
      valid: false,
      message: error.message 
    });
  }
});

// Get user orders
router.get('/my-orders', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product')
      .sort('-createdAt');
    
    // Add payment deadline status to each order
    const ordersWithStatus = orders.map(order => {
      const orderObj = order.toObject();
      if (order.paymentMethod === 'BankTransfer' && order.paymentStatus === 'pending') {
        orderObj.paymentDeadlineStatus = order.paymentDeadlineStatus;
      }
      return orderObj;
    });
    
    res.json(ordersWithStatus);
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
    
    const orderObj = order.toObject();
    if (order.paymentMethod === 'BankTransfer' && order.paymentStatus === 'pending') {
      orderObj.paymentDeadlineStatus = order.paymentDeadlineStatus;
    }

    res.json(orderObj);
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

// Confirm payment for bank transfer
router.put('/:id/confirm-payment', protect, async (req, res) => {
  try {
    const { transactionId } = req.body;
    
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Admin check should be added here in production
    
    if (order.paymentMethod !== 'BankTransfer') {
      return res.status(400).json({ message: 'This order does not use bank transfer' });
    }
    
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Payment already confirmed' });
    }
    
    await order.markAsPaid({
      transactionId: transactionId || `BANK-${Date.now()}`,
      method: 'BankTransfer',
      amount: order.totalAmount
    });
    
    // Emit socket notification
    if (req.io) {
      req.io.to('admin-room').emit('paymentConfirmed', {
        orderId: order._id,
        paymentStatus: 'paid',
        orderStatus: order.orderStatus
      });
    }
    
    res.json({
      message: 'Payment confirmed successfully',
      order
    });
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
      
      // If it was a flash sale item, restore flash sale quantity
      if (item.isFlashSaleItem && item.flashSaleId) {
        try {
          const flashSale = await FlashSale.findById(item.flashSaleId);
          if (flashSale) {
            const flashProduct = flashSale.products.find(p => 
              p.product.toString() === item.product.toString()
            );
            if (flashProduct) {
              flashProduct.soldQuantity = Math.max(0, flashProduct.soldQuantity - item.quantity);
              await flashSale.save();
            }
          }
        } catch (error) {
          console.error('Error restoring flash sale quantity:', error);
        }
      }
    }
    
    // Update order status
    order.orderStatus = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = req.body.reason || 'Customer requested';
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

// Check expired orders endpoint
router.post('/check-expired', protect, async (req, res) => {
  try {
    const expiredCount = await Order.expireOverdueOrders();
    res.json({ 
      message: `Checked and expired ${expiredCount} overdue orders`,
      expiredCount 
    });
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
    const expiredOrders = await Order.countDocuments({ orderStatus: 'expired' });
    
    // Pending payments
    const pendingPayments = await Order.countDocuments({ 
      paymentMethod: 'BankTransfer',
      paymentStatus: 'pending',
      orderStatus: { $nin: ['cancelled', 'expired'] }
    });
    
    // Calculate revenue from delivered orders only
    const deliveredOrdersData = await Order.find({ orderStatus: 'delivered' });
    const totalRevenue = deliveredOrdersData.reduce((sum, order) => sum + order.totalAmount, 0);
    
    // Calculate flash sale statistics
    const flashSaleOrders = await Order.find({ 
      'orderMetadata.hasFlashSaleItems': true 
    });
    const totalFlashSaleRevenue = flashSaleOrders.reduce((sum, order) => 
      sum + (order.flashSaleDiscount || 0), 0
    );
    
    res.json({
      totalOrders,
      ordersByStatus: {
        pending: pendingOrders,
        processing: processingOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
        expired: expiredOrders
      },
      pendingPayments,
      totalRevenue,
      averageOrderValue: deliveredOrders > 0 ? totalRevenue / deliveredOrders : 0,
      flashSaleStats: {
        totalOrders: flashSaleOrders.length,
        totalDiscount: totalFlashSaleRevenue
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all orders for admin
router.get('/admin/all', protect, async (req, res) => {
  try {
    // Add admin check here in production
    
    const { page = 1, limit = 10, status, userId, hasFlashSale, paymentStatus } = req.query;
    const query = {};
    
    if (status) {
      query.orderStatus = status;
    }
    
    if (userId) {
      query.user = userId;
    }
    
    if (hasFlashSale === 'true') {
      query['orderMetadata.hasFlashSaleItems'] = true;
    }
    
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    
    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'name price images')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Order.countDocuments(query);
    
    // Add payment deadline status to bank transfer orders
    const ordersWithStatus = orders.map(order => {
      const orderObj = order.toObject();
      if (order.paymentMethod === 'BankTransfer' && order.paymentStatus === 'pending') {
        orderObj.paymentDeadlineStatus = order.paymentDeadlineStatus;
      }
      return orderObj;
    });
    
    res.json({
      orders: ordersWithStatus,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalOrders: count
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Schedule cron jobs for auto-expiry and reminders
// Run every hour to check expired orders
cron.schedule('0 * * * *', async () => {
  try {
    const expiredCount = await Order.expireOverdueOrders();
    if (expiredCount > 0) {
      console.log(`[CRON] Expired ${expiredCount} overdue bank transfer orders`);
    }
  } catch (error) {
    console.error('[CRON] Error expiring orders:', error);
  }
});

// Run every 30 minutes to send payment reminders
cron.schedule('*/30 * * * *', async () => {
  try {
    const reminderCount = await Order.sendPaymentReminders();
    if (reminderCount > 0) {
      console.log(`[CRON] Sent ${reminderCount} payment reminders`);
    }
  } catch (error) {
    console.error('[CRON] Error sending reminders:', error);
  }
});

module.exports = router;
