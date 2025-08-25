// backend/models/FlashSale.js
const mongoose = require('mongoose');

const flashSaleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
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
    default: false
  },
  products: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    discountPrice: {
      type: Number,
      required: true
    },
    originalPrice: {
      type: Number,
      required: true
    },
    maxQuantity: {
      type: Number,
      required: true,
      default: 100
    },
    soldQuantity: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  banner: {
    image: String,
    title: String,
    subtitle: String,
    gradient: {
      type: String,
      default: 'from-red-600 to-orange-600'
    }
  },
  priority: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
flashSaleSchema.index({ startDate: 1, endDate: 1 });
flashSaleSchema.index({ isActive: 1, priority: -1 });
flashSaleSchema.index({ 'products.product': 1 });

// Virtual for checking if sale is currently active
flashSaleSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.isActive && 
         this.startDate <= now && 
         this.endDate >= now;
});

// Virtual for time remaining
flashSaleSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  if (this.endDate <= now) return 0;
  return Math.floor((this.endDate - now) / 1000); // in seconds
});

// Method to check if product is in stock for flash sale
flashSaleSchema.methods.isProductAvailable = function(productId) {
  const product = this.products.find(p => 
    p.product.toString() === productId.toString()
  );
  
  if (!product) return false;
  return product.isActive && 
         product.soldQuantity < product.maxQuantity;
};

// Method to update sold quantity
flashSaleSchema.methods.updateSoldQuantity = async function(productId, quantity) {
  const product = this.products.find(p => 
    p.product.toString() === productId.toString()
  );
  
  if (!product) {
    throw new Error('Product not found in flash sale');
  }
  
  if (product.soldQuantity + quantity > product.maxQuantity) {
    throw new Error('Exceeds maximum quantity for flash sale');
  }
  
  product.soldQuantity += quantity;
  await this.save();
  return product;
};

// Static method to get active flash sales
flashSaleSchema.statics.getActiveSales = async function() {
  const now = new Date();
  return this.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  })
  .populate('products.product', 'name images category brand rating')
  .sort({ priority: -1, createdAt: -1 });
};

// Static method to get upcoming sales
flashSaleSchema.statics.getUpcomingSales = async function() {
  const now = new Date();
  return this.find({
    isActive: true,
    startDate: { $gt: now }
  })
  .populate('products.product', 'name images category brand')
  .sort({ startDate: 1 });
};

// Method to calculate statistics
flashSaleSchema.methods.getStatistics = function() {
  const stats = {
    totalProducts: this.products.length,
    totalSold: 0,
    totalRevenue: 0,
    averageDiscount: 0,
    productsOutOfStock: 0
  };
  
  this.products.forEach(product => {
    stats.totalSold += product.soldQuantity;
    stats.totalRevenue += product.discountPrice * product.soldQuantity;
    stats.averageDiscount += product.discountPercentage;
    
    if (product.soldQuantity >= product.maxQuantity) {
      stats.productsOutOfStock++;
    }
  });
  
  if (this.products.length > 0) {
    stats.averageDiscount = stats.averageDiscount / this.products.length;
  }
  
  return stats;
};

// Pre-save middleware to validate dates
flashSaleSchema.pre('save', function(next) {
  if (this.endDate <= this.startDate) {
    next(new Error('End date must be after start date'));
  }
  
  // Calculate discount prices
  this.products.forEach(product => {
    if (product.originalPrice && product.discountPercentage) {
      product.discountPrice = Math.round(
        product.originalPrice * (1 - product.discountPercentage / 100)
      );
    }
  });
  
  next();
});

module.exports = mongoose.model('FlashSale', flashSaleSchema);