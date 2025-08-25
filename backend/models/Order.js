// backend/models/Order.js (Updated)
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  items: [{
    product: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Product' 
    },
    quantity: Number,
    size: String,
    color: String,
    price: Number,
    originalPrice: Number,
    isFlashSaleItem: { type: Boolean, default: false },
    flashSaleId: { type: mongoose.Schema.Types.ObjectId, ref: 'FlashSale' },
    flashSaleDiscount: { type: Number, default: 0 }
  }],
  subtotal: { 
    type: Number, 
    required: true 
  },
  discountAmount: { 
    type: Number, 
    default: 0 
  },
  flashSaleDiscount: {
    type: Number,
    default: 0
  },
  voucherDiscount: {
    type: Number,
    default: 0
  },
  totalAmount: { 
    type: Number, 
    required: true 
  },
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    recipientName: String,
    recipientPhone: String
  },
  paymentMethod: {
    type: String,
    enum: ['COD', 'BankTransfer', 'CreditCard', 'EWallet'],
    default: 'COD'
  },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending' 
  },
  paymentDetails: {
    transactionId: String,
    paidAt: Date,
    method: String,
    amount: Number
  },
  // QR Code payment tracking
  bankTransferInfo: {
    bankId: String,
    accountNo: String,
    accountName: String,
    amount: Number,
    content: String,
    qrUrl: String,
    expiredAt: Date, // Auto-cancel after this time
    reminderSent: { type: Boolean, default: false }
  },
  orderStatus: { 
    type: String, 
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'expired'],
    default: 'pending' 
  },
  voucherCode: String,
  shippingFee: { 
    type: Number, 
    default: 0 
  },
  notes: String,
  deliveredAt: Date,
  cancelledAt: Date,
  cancelReason: String,
  // Flash sale metadata
  orderMetadata: {
    hasFlashSaleItems: { type: Boolean, default: false },
    flashSaleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FlashSale' }]
  }
}, { 
  timestamps: true 
});

// Indexes
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ 'bankTransferInfo.expiredAt': 1 });
orderSchema.index({ paymentMethod: 1, paymentStatus: 1, 'bankTransferInfo.expiredAt': 1 });

// Virtual for order number
orderSchema.virtual('orderNumber').get(function() {
  return `ORD${this._id.toString().slice(-8).toUpperCase()}`;
});

// Virtual for payment deadline status
orderSchema.virtual('paymentDeadlineStatus').get(function() {
  if (this.paymentMethod !== 'BankTransfer' || this.paymentStatus === 'paid') {
    return null;
  }
  
  const now = new Date();
  const expiredAt = this.bankTransferInfo?.expiredAt;
  
  if (!expiredAt) return null;
  
  const hoursRemaining = Math.max(0, Math.floor((expiredAt - now) / (1000 * 60 * 60)));
  const minutesRemaining = Math.max(0, Math.floor((expiredAt - now) / (1000 * 60)) % 60);
  
  return {
    isExpired: now > expiredAt,
    hoursRemaining,
    minutesRemaining,
    expiredAt
  };
});

// Methods
orderSchema.methods.canBeCancelled = function() {
  return ['pending', 'processing'].includes(this.orderStatus);
};

orderSchema.methods.markAsPaid = async function(transactionDetails) {
  this.paymentStatus = 'paid';
  this.paymentDetails = {
    transactionId: transactionDetails.transactionId,
    paidAt: new Date(),
    method: transactionDetails.method || this.paymentMethod,
    amount: transactionDetails.amount || this.totalAmount
  };
  
  // Auto update to processing if payment successful
  if (this.orderStatus === 'pending') {
    this.orderStatus = 'processing';
  }
  
  // Clear expiration for bank transfer
  if (this.paymentMethod === 'BankTransfer' && this.bankTransferInfo) {
    this.bankTransferInfo.expiredAt = null;
  }
  
  return this.save();
};

orderSchema.methods.calculateRefundAmount = function() {
  if (this.paymentStatus !== 'paid') {
    return 0;
  }
  
  // If cancelled before shipping, full refund
  if (['pending', 'processing'].includes(this.orderStatus)) {
    return this.totalAmount;
  }
  
  // If cancelled after shipping, deduct shipping fee
  if (this.orderStatus === 'shipped') {
    return this.totalAmount - this.shippingFee;
  }
  
  // No refund for delivered orders
  return 0;
};

// Method to check and expire overdue bank transfer orders
orderSchema.methods.checkAndExpire = async function() {
  if (this.paymentMethod !== 'BankTransfer' || 
      this.paymentStatus === 'paid' ||
      this.orderStatus === 'cancelled' ||
      this.orderStatus === 'expired') {
    return false;
  }
  
  const now = new Date();
  if (this.bankTransferInfo?.expiredAt && now > this.bankTransferInfo.expiredAt) {
    this.orderStatus = 'expired';
    this.cancelledAt = now;
    this.cancelReason = 'Hết hạn thanh toán chuyển khoản (quá 24 giờ)';
    
    // Restore stock
    const Product = mongoose.model('Product');
    const FlashSale = mongoose.model('FlashSale');
    
    for (const item of this.items) {
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
      
      // Restore flash sale quantity if applicable
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
    
    await this.save();
    return true;
  }
  
  return false;
};

// Static method to check all pending bank transfer orders
orderSchema.statics.expireOverdueOrders = async function() {
  const now = new Date();
  
  const overdueOrders = await this.find({
    paymentMethod: 'BankTransfer',
    paymentStatus: 'pending',
    orderStatus: { $in: ['pending', 'processing'] },
    'bankTransferInfo.expiredAt': { $lt: now }
  });
  
  let expiredCount = 0;
  for (const order of overdueOrders) {
    const expired = await order.checkAndExpire();
    if (expired) expiredCount++;
  }
  
  return expiredCount;
};

// Static method to send payment reminders (6 hours before expiry)
orderSchema.statics.sendPaymentReminders = async function() {
  const now = new Date();
  const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  
  const ordersNeedingReminder = await this.find({
    paymentMethod: 'BankTransfer',
    paymentStatus: 'pending',
    orderStatus: 'pending',
    'bankTransferInfo.reminderSent': false,
    'bankTransferInfo.expiredAt': {
      $gte: now,
      $lte: sixHoursLater
    }
  }).populate('user', 'email name phone');
  
  // Here you would send email/SMS reminders
  // For now, just mark as reminded
  for (const order of ordersNeedingReminder) {
    order.bankTransferInfo.reminderSent = true;
    await order.save();
    
    // TODO: Implement actual notification sending
    console.log(`Payment reminder needed for order ${order._id}`);
  }
  
  return ordersNeedingReminder.length;
};

// Statics
orderSchema.statics.getOrderStats = async function(userId, dateRange) {
  const query = userId ? { user: userId } : {};
  
  if (dateRange) {
    query.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end
    };
  }
  
  const stats = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { 
          $sum: {
            $cond: [
              { $eq: ['$orderStatus', 'delivered'] },
              '$totalAmount',
              0
            ]
          }
        },
        totalDiscount: { $sum: '$discountAmount' },
        avgOrderValue: { $avg: '$totalAmount' },
        statusCounts: {
          $push: '$orderStatus'
        }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      totalDiscount: 0,
      avgOrderValue: 0,
      statusBreakdown: {}
    };
  }
  
  // Count status occurrences
  const statusBreakdown = stats[0].statusCounts.reduce((acc, status) => {
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  
  return {
    totalOrders: stats[0].totalOrders,
    totalRevenue: stats[0].totalRevenue,
    totalDiscount: stats[0].totalDiscount,
    avgOrderValue: Math.round(stats[0].avgOrderValue),
    statusBreakdown
  };
};

module.exports = mongoose.model('Order', orderSchema);
