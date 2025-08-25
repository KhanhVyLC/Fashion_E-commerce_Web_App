// backend/models/Product.js - Enhanced with Flash Sale Integration and Secondary Images
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  price: { 
    type: Number, 
    required: true 
  },
  images: [String],
  secondaryImages: [{
    url: String,
    type: {
      type: String,
      enum: ['detail', 'size_chart', 'instruction', 'material', 'other'],
      default: 'detail'
    },
    caption: String,
    order: {
      type: Number,
      default: 0
    }
  }],
  category: { 
    type: String, 
    required: true 
  },
  subcategory: String,
  brand: String,
  sizes: [String],
  colors: [String],
  stock: [{
    size: String,
    color: String,
    quantity: Number
  }],
  tags: [String],
  rating: { 
    type: Number, 
    default: 0 
  },
  totalReviews: { 
    type: Number, 
    default: 0 
  },
  viewCount: { 
    type: Number, 
    default: 0 
  },
  totalOrders: { 
    type: Number, 
    default: 0 
  },
  flashSaleStats: {
    totalSoldInFlashSales: {
      type: Number,
      default: 0
    },
    lastFlashSaleDate: Date,
    flashSaleRevenue: {
      type: Number,
      default: 0
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });
productSchema.index({ totalOrders: -1 });
productSchema.index({ viewCount: -1 });

// Method to get product with flash sale info
productSchema.methods.getWithFlashSale = async function() {
  const FlashSale = mongoose.model('FlashSale');
  const activeSales = await FlashSale.getActiveSales();
  
  const productObj = this.toObject();
  
  for (const sale of activeSales) {
    const flashProduct = sale.products.find(p => 
      p.product._id.toString() === this._id.toString() && 
      p.isActive &&
      p.soldQuantity < p.maxQuantity
    );
    
    if (flashProduct) {
      productObj.flashSale = {
        saleId: sale._id,
        saleName: sale.name,
        originalPrice: flashProduct.originalPrice,
        discountPrice: flashProduct.discountPrice,
        discountPercentage: flashProduct.discountPercentage,
        endDate: sale.endDate,
        timeRemaining: sale.timeRemaining,
        available: flashProduct.maxQuantity - flashProduct.soldQuantity,
        soldQuantity: flashProduct.soldQuantity,
        maxQuantity: flashProduct.maxQuantity
      };
      productObj.isFlashSale = true;
      productObj.effectivePrice = flashProduct.discountPrice;
      break;
    }
  }
  
  if (!productObj.flashSale) {
    productObj.effectivePrice = this.price;
    productObj.isFlashSale = false;
  }
  
  return productObj;
};

// Method to get effective price (flash sale or regular)
productSchema.methods.getEffectivePrice = async function() {
  const FlashSale = mongoose.model('FlashSale');
  const activeSales = await FlashSale.getActiveSales();
  
  for (const sale of activeSales) {
    const product = sale.products.find(p => 
      p.product._id.toString() === this._id.toString() && 
      p.isActive &&
      p.soldQuantity < p.maxQuantity
    );
    
    if (product) {
      return {
        price: product.discountPrice,
        originalPrice: this.price,
        isFlashSale: true,
        discountPercentage: product.discountPercentage,
        flashSaleId: sale._id
      };
    }
  }
  
  return {
    price: this.price,
    originalPrice: this.price,
    isFlashSale: false,
    discountPercentage: 0,
    flashSaleId: null
  };
};

// Method to check stock considering flash sale limits
productSchema.methods.getAvailableStock = async function(size, color) {
  const stockItem = this.stock.find(s => s.size === size && s.color === color);
  if (!stockItem) return 0;
  
  let availableQuantity = stockItem.quantity;
  
  // Check if in flash sale
  const FlashSale = mongoose.model('FlashSale');
  const activeSales = await FlashSale.getActiveSales();
  
  for (const sale of activeSales) {
    const flashProduct = sale.products.find(p => 
      p.product._id.toString() === this._id.toString() && p.isActive
    );
    
    if (flashProduct) {
      const flashSaleRemaining = flashProduct.maxQuantity - flashProduct.soldQuantity;
      availableQuantity = Math.min(availableQuantity, flashSaleRemaining);
      break;
    }
  }
  
  return availableQuantity;
};

// Static method to get products with flash sale info
productSchema.statics.getProductsWithFlashSale = async function(filter = {}, options = {}) {
  const products = await this.find(filter, null, options);
  const FlashSale = mongoose.model('FlashSale');
  const activeSales = await FlashSale.getActiveSales();
  
  // Create a map for faster lookup
  const flashSaleMap = new Map();
  
  activeSales.forEach(sale => {
    sale.products.forEach(p => {
      if (p.isActive && p.soldQuantity < p.maxQuantity) {
        flashSaleMap.set(p.product._id.toString(), {
          saleId: sale._id,
          saleName: sale.name,
          originalPrice: p.originalPrice,
          discountPrice: p.discountPrice,
          discountPercentage: p.discountPercentage,
          endDate: sale.endDate,
          timeRemaining: sale.timeRemaining,
          available: p.maxQuantity - p.soldQuantity,
          soldQuantity: p.soldQuantity,
          maxQuantity: p.maxQuantity
        });
      }
    });
  });
  
  // Map flash sale info to products
  const productsWithSale = products.map(product => {
    const productObj = product.toObject();
    const flashSale = flashSaleMap.get(product._id.toString());
    
    if (flashSale) {
      productObj.flashSale = flashSale;
      productObj.isFlashSale = true;
      productObj.effectivePrice = flashSale.discountPrice;
    } else {
      productObj.effectivePrice = product.price;
      productObj.isFlashSale = false;
    }
    
    return productObj;
  });
  
  return productsWithSale;
};

// Static method for getting products for recommendations with flash sale
productSchema.statics.getRecommendedWithFlashSale = async function(productIds, limit = 20) {
  const products = await this.find({
    _id: { $in: productIds }
  }).limit(limit);
  
  return this.getProductsWithFlashSale({ _id: { $in: productIds } }, { limit });
};

module.exports = mongoose.model('Product', productSchema);
