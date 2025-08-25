// backend/models/Voucher.js
const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9]{6,12}$/, 'Mã voucher phải từ 6-12 ký tự, chỉ chứa chữ in hoa và số']
  },
  description: {
    type: String,
    required: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  minOrderAmount: {
    type: Number,
    default: 0
  },
  maxDiscountAmount: {
    type: Number, // For percentage discounts, max amount that can be discounted
    default: null
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  usedCount: {
    type: Number,
    default: 0
  },
  usedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    usedAt: { type: Date, default: Date.now },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' }
  }],
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicableCategories: [String], // Empty means all categories
  applicableBrands: [String], // Empty means all brands
  excludedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  maxUsagePerUser: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
voucherSchema.index({ code: 1 });
voucherSchema.index({ startDate: 1, endDate: 1 });
voucherSchema.index({ isActive: 1 });

// Methods
voucherSchema.methods.isValid = function() {
  const now = new Date();
  return (
    this.isActive &&
    this.quantity > this.usedCount &&
    now >= this.startDate &&
    now <= this.endDate
  );
};

voucherSchema.methods.canBeUsedByUser = function(userId) {
  const userUsageCount = this.usedBy.filter(
    usage => usage.user.toString() === userId.toString()
  ).length;
  
  return userUsageCount < this.maxUsagePerUser;
};

voucherSchema.methods.calculateDiscount = function(orderAmount, applicableAmount = null) {
  // Use applicableAmount if provided (for category/brand specific discounts)
  const baseAmount = applicableAmount || orderAmount;
  
  if (orderAmount < this.minOrderAmount) {
    return 0;
  }

  let discount = 0;
  
  if (this.discountType === 'percentage') {
    discount = baseAmount * (this.discountValue / 100);
    
    // Apply max discount cap if set
    if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
      discount = this.maxDiscountAmount;
    }
  } else if (this.discountType === 'fixed') {
    discount = Math.min(this.discountValue, baseAmount);
  }
  
  return Math.floor(discount); // Round down to nearest integer
};

// Static methods
voucherSchema.statics.generateCode = function(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

voucherSchema.statics.validateAndApply = async function(code, userId, orderAmount, orderItems = []) {
  const voucher = await this.findOne({ 
    code: code.toUpperCase().trim() 
  }).populate('excludedProducts');
  
  if (!voucher) {
    throw new Error('Mã voucher không tồn tại');
  }
  
  if (!voucher.isValid()) {
    if (!voucher.isActive) {
      throw new Error('Voucher đã bị vô hiệu hóa');
    }
    if (voucher.quantity <= voucher.usedCount) {
      throw new Error('Voucher đã hết lượt sử dụng');
    }
    const now = new Date();
    if (now < voucher.startDate) {
      throw new Error('Voucher chưa đến thời gian sử dụng');
    }
    if (now > voucher.endDate) {
      throw new Error('Voucher đã hết hạn');
    }
  }
  
  if (!voucher.canBeUsedByUser(userId)) {
    throw new Error(`Bạn đã sử dụng voucher này ${voucher.maxUsagePerUser} lần`);
  }
  
  if (orderAmount < voucher.minOrderAmount) {
    throw new Error(`Đơn hàng tối thiểu ${voucher.minOrderAmount.toLocaleString('vi-VN')}₫ để sử dụng voucher này`);
  }
  
  // Calculate applicable amount based on categories/brands if specified
  let applicableAmount = orderAmount;
  
  if (voucher.applicableCategories.length > 0 || voucher.applicableBrands.length > 0) {
    applicableAmount = 0;
    for (const item of orderItems) {
      const isExcluded = voucher.excludedProducts.some(
        excludedId => excludedId.toString() === item.product._id.toString()
      );
      
      if (isExcluded) continue;
      
      const categoryMatch = voucher.applicableCategories.length === 0 || 
        voucher.applicableCategories.includes(item.product.category);
      
      const brandMatch = voucher.applicableBrands.length === 0 || 
        voucher.applicableBrands.includes(item.product.brand);
      
      if (categoryMatch && brandMatch) {
        applicableAmount += item.price * item.quantity;
      }
    }
    
    if (applicableAmount === 0) {
      throw new Error('Không có sản phẩm nào trong giỏ hàng áp dụng được voucher này');
    }
  }
  
  const discountAmount = voucher.calculateDiscount(orderAmount, applicableAmount);
  
  return {
    voucher,
    discountAmount,
    finalAmount: orderAmount - discountAmount
  };
};

module.exports = mongoose.model('Voucher', voucherSchema);