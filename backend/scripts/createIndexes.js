// backend/scripts/createIndexes.js
// Run this script to ensure all indexes are created properly

const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

async function createIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || '', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Create User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ phone: 1 }, { sparse: true });
    await User.collection.createIndex({ 'analytics.lastLoginDate': -1 });
    await User.collection.createIndex({ 'analytics.totalSpent': -1 });
    await User.collection.createIndex({ 'analytics.totalOrders': -1 });
    await User.collection.createIndex({ 'viewHistory.viewedAt': -1 });
    await User.collection.createIndex({ 'searchHistory.searchedAt': -1 });
    await User.collection.createIndex({ 'interactions.wishlist.addedAt': -1 });
    await User.collection.createIndex({ createdAt: -1 });
    console.log('User indexes created');

    // Create Product indexes
    await Product.collection.createIndex({ name: 'text', description: 'text', tags: 'text' });
    await Product.collection.createIndex({ category: 1, subcategory: 1 });
    await Product.collection.createIndex({ price: 1 });
    await Product.collection.createIndex({ rating: -1 });
    await Product.collection.createIndex({ viewCount: -1 });
    await Product.collection.createIndex({ totalOrders: -1 });
    await Product.collection.createIndex({ createdAt: -1 });
    console.log('Product indexes created');

    // Create Order indexes
    await Order.collection.createIndex({ user: 1, createdAt: -1 });
    await Order.collection.createIndex({ orderStatus: 1 });
    await Order.collection.createIndex({ createdAt: -1 });
    await Order.collection.createIndex({ 'items.product': 1 });
    console.log('Order indexes created');

    // Update existing users to ensure analytics field exists
    await User.updateMany(
      { analytics: { $exists: false } },
      {
        $set: {
          analytics: {
            totalSpent: 0,
            totalOrders: 0,
            averageOrderValue: 0,
            registrationDate: new Date(),
            lastLoginDate: null,
            lastPurchaseDate: null
          }
        }
      }
    );
    console.log('Updated users with missing analytics');

    // Update existing users to ensure interactions field exists
    await User.updateMany(
      { interactions: { $exists: false } },
      {
        $set: {
          interactions: {
            cartAdditions: [],
            wishlist: [],
            productComparisons: [],
            likes: [],
            dislikes: []
          }
        }
      }
    );
    console.log('Updated users with missing interactions');

    // Initialize viewHistory and searchHistory for users missing them
    await User.updateMany(
      { viewHistory: { $exists: false } },
      { $set: { viewHistory: [] } }
    );
    
    await User.updateMany(
      { searchHistory: { $exists: false } },
      { $set: { searchHistory: [] } }
    );
    console.log('Initialized missing history arrays');

    // Update products with missing analytics fields
    await Product.updateMany(
      { viewCount: { $exists: false } },
      { $set: { viewCount: 0 } }
    );
    
    await Product.updateMany(
      { totalOrders: { $exists: false } },
      { $set: { totalOrders: 0 } }
    );
    console.log('Updated products with missing analytics fields');

    console.log('All indexes and updates completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  }
}

// Run the script
createIndexes();