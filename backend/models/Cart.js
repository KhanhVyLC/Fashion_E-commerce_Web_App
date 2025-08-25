// backend/models/Cart.js
const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  items: [{
    product: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Product',
      required: true
    },
    quantity: { 
      type: Number, 
      required: true,
      min: 1
    },
    size: String,
    color: String,
    price: {
      type: Number,
      required: true
    },
    // Flash sale tracking
    isFlashSaleItem: {
      type: Boolean,
      default: false
    },
    flashSaleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FlashSale'
    },
    originalPrice: Number,
    discountPercentage: Number,
    flashSaleSnapshot: {
      saleName: String,
      discountPrice: Number,
      endDate: Date,
      addedAt: Date
    }
  }],
  totalPrice: { 
    type: Number, 
    default: 0 
  },
  totalDiscount: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true 
});

// Index for better performance
cartSchema.index({ user: 1 });
cartSchema.index({ 'items.product': 1 });

// Method to validate and update flash sale items
cartSchema.methods.validateFlashSaleItems = async function() {
  const FlashSale = mongoose.model('FlashSale');
  const Product = mongoose.model('Product');
  const now = new Date();
  let hasChanges = false;
  
  for (let item of this.items) {
    // Populate product if not populated
    if (!item.product.price) {
      await this.populate('items.product');
    }
    
    if (item.isFlashSaleItem && item.flashSaleId) {
      const flashSale = await FlashSale.findById(item.flashSaleId)
        .populate('products.product');
      
      // Check if flash sale is still active
      if (!flashSale || !flashSale.isActive || 
          flashSale.startDate > now || flashSale.endDate < now) {
        // Flash sale expired or inactive - revert to original price
        const product = await Product.findById(item.product._id || item.product);
        item.isFlashSaleItem = false;
        item.price = product.price;
        item.originalPrice = null;
        item.flashSaleId = null;
        item.flashSaleSnapshot = null;
        item.discountPercentage = null;
        hasChanges = true;
      } else {
        // Check if product is still in flash sale
        const flashProduct = flashSale.products.find(p => 
          p.product._id.toString() === (item.product._id || item.product).toString()
        );
        
        if (!flashProduct || !flashProduct.isActive || 
            flashProduct.soldQuantity >= flashProduct.maxQuantity) {
          // Product no longer in flash sale or sold out
          const product = await Product.findById(item.product._id || item.product);
          item.isFlashSaleItem = false;
          item.price = product.price;
          item.originalPrice = null;
          item.flashSaleId = null;
          item.flashSaleSnapshot = null;
          item.discountPercentage = null;
          hasChanges = true;
        } else {
          // Update price if changed
          if (item.price !== flashProduct.discountPrice) {
            item.price = flashProduct.discountPrice;
            item.originalPrice = flashProduct.originalPrice;
            item.discountPercentage = flashProduct.discountPercentage;
            hasChanges = true;
          }
          
          // Update snapshot
          item.flashSaleSnapshot = {
            saleName: flashSale.name,
            discountPrice: flashProduct.discountPrice,
            endDate: flashSale.endDate,
            addedAt: item.flashSaleSnapshot?.addedAt || new Date()
          };
        }
      }
    }
  }
  
  if (hasChanges) {
    this.calculateTotals();
    await this.save();
  }
  
  return hasChanges;
};

// Method to add/update item with flash sale check
cartSchema.methods.addItemWithFlashSale = async function(productId, quantity, size, color) {
  const Product = mongoose.model('Product');
  const FlashSale = mongoose.model('FlashSale');
  
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }
  
  // Check if product is in active flash sale
  const activeSales = await FlashSale.getActiveSales();
  let flashSaleInfo = null;
  
  for (const sale of activeSales) {
    const flashProduct = sale.products.find(p => 
      p.product._id.toString() === productId.toString() &&
      p.isActive &&
      p.soldQuantity < p.maxQuantity
    );
    
    if (flashProduct) {
      flashSaleInfo = {
        saleId: sale._id,
        saleName: sale.name,
        originalPrice: flashProduct.originalPrice,
        discountPrice: flashProduct.discountPrice,
        discountPercentage: flashProduct.discountPercentage,
        endDate: sale.endDate
      };
      break;
    }
  }
  
  // Check if item already exists
  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString() &&
    item.size === size &&
    item.color === color
  );
  
  if (existingItemIndex > -1) {
    // Update existing item
    this.items[existingItemIndex].quantity += quantity;
    
    // Update flash sale info if applicable
    if (flashSaleInfo) {
      this.items[existingItemIndex].isFlashSaleItem = true;
      this.items[existingItemIndex].flashSaleId = flashSaleInfo.saleId;
      this.items[existingItemIndex].price = flashSaleInfo.discountPrice;
      this.items[existingItemIndex].originalPrice = flashSaleInfo.originalPrice;
      this.items[existingItemIndex].discountPercentage = flashSaleInfo.discountPercentage;
      this.items[existingItemIndex].flashSaleSnapshot = {
        saleName: flashSaleInfo.saleName,
        discountPrice: flashSaleInfo.discountPrice,
        endDate: flashSaleInfo.endDate,
        addedAt: new Date()
      };
    } else {
      this.items[existingItemIndex].price = product.price;
    }
  } else {
    // Add new item
    const newItem = {
      product: productId,
      quantity,
      size,
      color,
      price: flashSaleInfo ? flashSaleInfo.discountPrice : product.price,
      isFlashSaleItem: !!flashSaleInfo,
      flashSaleId: flashSaleInfo?.saleId || null,
      originalPrice: flashSaleInfo?.originalPrice || null,
      discountPercentage: flashSaleInfo?.discountPercentage || null,
      flashSaleSnapshot: flashSaleInfo ? {
        saleName: flashSaleInfo.saleName,
        discountPrice: flashSaleInfo.discountPrice,
        endDate: flashSaleInfo.endDate,
        addedAt: new Date()
      } : null
    };
    
    this.items.push(newItem);
  }
  
  this.calculateTotals();
  await this.save();
  
  return this;
};

// Method to calculate totals including discounts
cartSchema.methods.calculateTotals = function() {
  let total = 0;
  let discount = 0;
  
  this.items.forEach(item => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    
    if (item.isFlashSaleItem && item.originalPrice) {
      discount += (item.originalPrice - item.price) * item.quantity;
    }
  });
  
  this.totalPrice = total;
  this.totalDiscount = discount;
};

// Method to get formatted cart with details
cartSchema.methods.getFormattedCart = async function() {
  await this.populate('items.product');
  await this.validateFlashSaleItems();
  
  const formattedItems = this.items.map(item => ({
    _id: item._id,
    product: item.product,
    quantity: item.quantity,
    size: item.size,
    color: item.color,
    price: item.price,
    originalPrice: item.originalPrice,
    isFlashSaleItem: item.isFlashSaleItem,
    discountPercentage: item.discountPercentage,
    flashSaleInfo: item.flashSaleSnapshot,
    subtotal: item.price * item.quantity,
    savings: item.isFlashSaleItem && item.originalPrice 
      ? (item.originalPrice - item.price) * item.quantity 
      : 0
  }));
  
  return {
    items: formattedItems,
    totalPrice: this.totalPrice,
    totalDiscount: this.totalDiscount,
    finalPrice: this.totalPrice,
    itemCount: this.items.reduce((sum, item) => sum + item.quantity, 0)
  };
};

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  this.calculateTotals();
  next();
});

module.exports = mongoose.model('Cart', cartSchema);
