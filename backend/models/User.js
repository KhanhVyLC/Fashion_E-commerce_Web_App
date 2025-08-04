// backend/models/User.js - Fixed version with conditional validation
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Tên là bắt buộc'],
    trim: true,
    minlength: [2, 'Tên phải có ít nhất 2 ký tự'],
    maxlength: [50, 'Tên không được vượt quá 50 ký tự']
  },
  email: { 
    type: String, 
    required: [true, 'Email là bắt buộc'], 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email không hợp lệ']
  },
  password: { 
    type: String, 
    required: [true, 'Mật khẩu là bắt buộc'],
    minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự']
  },
  phone: { 
    type: String, 
    required: function() {
      // Only require phone during registration, not for updates
      return this.isNew;
    },
    trim: true,
    match: [/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ (10-11 chữ số)']
  },
  address: { 
    type: String, 
    required: function() {
      // Only require address during registration, not for updates
      return this.isNew;
    },
    trim: true,
    minlength: [6, 'Địa chỉ phải có ít nhất 6 ký tự'],
    maxlength: [200, 'Địa chỉ không được vượt quá 200 ký tự']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Enhanced user preferences
  preferences: {
    size: { type: String },
    style: [String],
    favoriteColors: [String],
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 10000000 }
    },
    preferredBrands: [String],
    preferredCategories: [String],
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      promotions: { type: Boolean, default: true }
    }
  },
  
  // Enhanced tracking
  viewHistory: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    viewedAt: { type: Date, default: Date.now },
    duration: { type: Number }, // Time spent viewing in seconds
    source: { type: String } // 'search', 'recommendation', 'direct', etc.
  }],
  
  searchHistory: [{
    query: String,
    searchedAt: { type: Date, default: Date.now },
    resultsCount: Number,
    clickedResults: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }]
  }],
  
  // Interaction tracking
  interactions: {
    cartAdditions: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      timestamp: { type: Date, default: Date.now },
      removed: { type: Boolean, default: false }
    }],
    
    wishlist: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      addedAt: { type: Date, default: Date.now }
    }],
    
    productComparisons: [{
      products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
      comparedAt: { type: Date, default: Date.now }
    }],
    
    // New: Like/dislike feedback for machine learning
    likes: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      timestamp: { type: Date, default: Date.now },
      weight: { type: Number, default: 1 }
    }],
    
    dislikes: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      timestamp: { type: Date, default: Date.now },
      weight: { type: Number, default: -1 }
    }]
  },
  
  // Recommendation preferences
  recommendationSettings: {
    enablePersonalized: { type: Boolean, default: true },
    excludeCategories: [String],
    excludeBrands: [String]
  },
  
  // Analytics
  analytics: {
    totalSpent: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    lastPurchaseDate: Date,
    favoriteCategory: String,
    favoriteBrand: String,
    registrationDate: { type: Date, default: Date.now },
    lastLoginDate: Date
  }
  
}, { 
  timestamps: true
});

// Index for search performance
userSchema.index({ email: 1, phone: 1 });
userSchema.index({ 'analytics.totalSpent': -1 });
userSchema.index({ 'analytics.totalOrders': -1 });
userSchema.index({ 'viewHistory.viewedAt': -1 });
userSchema.index({ 'interactions.wishlist.addedAt': -1 });

// Virtual for full name display
userSchema.virtual('displayName').get(function() {
  return this.name;
});

// Method to update last login
userSchema.methods.updateLastLogin = async function() {
  this.analytics.lastLoginDate = new Date();
  await this.save({ validateBeforeSave: false });
};

// Method to add to view history with duplicate prevention
userSchema.methods.addToViewHistory = async function(productId, duration = 0, source = 'direct') {
  // Remove existing view of same product today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  this.viewHistory = this.viewHistory.filter(item => 
    !(item.product.toString() === productId.toString() && 
      item.viewedAt >= today)
  );
  
  // Add new view
  this.viewHistory.push({
    product: productId,
    viewedAt: new Date(),
    duration: duration,
    source: source
  });
  
  // Keep only last 100 views
  if (this.viewHistory.length > 100) {
    this.viewHistory = this.viewHistory.slice(-100);
  }
  
  await this.save({ validateBeforeSave: false });
};

// Method to add to search history
userSchema.methods.addToSearchHistory = async function(query, resultsCount = 0, clickedResults = []) {
  this.searchHistory.push({
    query: query,
    searchedAt: new Date(),
    resultsCount: resultsCount,
    clickedResults: clickedResults
  });
  
  // Keep only last 50 searches
  if (this.searchHistory.length > 50) {
    this.searchHistory = this.searchHistory.slice(-50);
  }
  
  await this.save({ validateBeforeSave: false });
};

// Update analytics on new order
userSchema.methods.updateAnalytics = async function(order) {
  this.analytics.totalSpent += order.totalAmount;
  this.analytics.totalOrders += 1;
  this.analytics.averageOrderValue = this.analytics.totalSpent / this.analytics.totalOrders;
  this.analytics.lastPurchaseDate = new Date();
  
  // Calculate favorite category and brand
  try {
    const orders = await mongoose.model('Order').find({ user: this._id }).populate('items.product');
    const categoryCount = {};
    const brandCount = {};
    
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.product) {
          categoryCount[item.product.category] = (categoryCount[item.product.category] || 0) + 1;
          brandCount[item.product.brand] = (brandCount[item.product.brand] || 0) + 1;
        }
      });
    });
    
    this.analytics.favoriteCategory = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    this.analytics.favoriteBrand = Object.entries(brandCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
  } catch (error) {
    console.error('Error calculating analytics:', error);
  }
  
  await this.save({ validateBeforeSave: false });
};

// Method to safely add to wishlist
userSchema.methods.addToWishlist = async function(productId) {
  if (!this.interactions) this.interactions = {};
  if (!this.interactions.wishlist) this.interactions.wishlist = [];
  
  const exists = this.interactions.wishlist.some(
    item => item.product?.toString() === productId.toString()
  );
  
  if (!exists) {
    this.interactions.wishlist.push({
      product: productId,
      addedAt: new Date()
    });
    await this.save({ validateBeforeSave: false });
  }
  
  return this.interactions.wishlist;
};

// Method to safely remove from wishlist
userSchema.methods.removeFromWishlist = async function(productId) {
  if (!this.interactions?.wishlist) return [];
  
  this.interactions.wishlist = this.interactions.wishlist.filter(
    item => item.product?.toString() !== productId.toString()
  );
  
  await this.save({ validateBeforeSave: false });
  return this.interactions.wishlist;
};

// Method to get user preferences for recommendations
userSchema.methods.getRecommendationPreferences = function() {
  return {
    preferences: this.preferences,
    analytics: this.analytics,
    viewHistory: this.viewHistory.slice(-20), // Last 20 views
    searchHistory: this.searchHistory.slice(-10), // Last 10 searches
    settings: this.recommendationSettings
  };
};

// Password comparison method
userSchema.methods.matchPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Pre-save middleware for password hashing
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware for email normalization
userSchema.pre('save', function(next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase().trim();
  }
  next();
});

// Static method to find by email or phone
userSchema.statics.findByEmailOrPhone = function(email, phone) {
  return this.findOne({
    $or: [
      { email: email },
      { phone: phone }
    ]
  });
};

// Method to safely return user data (without password)
userSchema.methods.toSafeObject = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Static method for safe wishlist operations
userSchema.statics.updateWishlist = async function(userId, productId, action) {
  const updateOperation = action === 'add' 
    ? { $addToSet: { 'interactions.wishlist': { product: productId, addedAt: new Date() } } }
    : { $pull: { 'interactions.wishlist': { product: productId } } };
  
  await this.updateOne({ _id: userId }, updateOperation);
  
  const user = await this.findById(userId)
    .select('interactions.wishlist')
    .populate('interactions.wishlist.product', 'name price images category rating');
  
  return user.interactions?.wishlist?.filter(item => item.product) || [];
};

module.exports = mongoose.model('User', userSchema);