// backend/scripts/migrateUserData.js
const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');

async function migrateUserData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    
    console.log('Connected to MongoDB');
    
    // Step 1: Initialize missing fields for all users
    console.log('Step 1: Initializing missing user fields...');
    const initResult = await User.updateMany(
      {},
      {
        $setOnInsert: {
          viewHistory: [],
          searchHistory: [],
          interactions: {
            wishlist: [],
            cartAdditions: [],
            productComparisons: [],
            likes: [],
            dislikes: []
          },
          preferences: {
            size: '',
            style: [],
            favoriteColors: [],
            priceRange: { min: 0, max: 10000000 },
            preferredBrands: [],
            preferredCategories: [],
            notifications: {
              email: true,
              sms: false,
              promotions: true
            }
          },
          recommendationSettings: {
            enablePersonalized: true,
            excludeCategories: [],
            excludeBrands: []
          },
          analytics: {
            totalSpent: 0,
            totalOrders: 0,
            averageOrderValue: 0,
            lastPurchaseDate: null,
            favoriteCategory: null,
            favoriteBrand: null,
            registrationDate: new Date(),
            lastLoginDate: null
          }
        }
      },
      { upsert: false }
    );
    
    console.log(`Initialized ${initResult.modifiedCount} users`);
    
    // Step 2: Calculate analytics from existing orders
    console.log('\nStep 2: Calculating user analytics from orders...');
    const users = await User.find({});
    
    for (const user of users) {
      const orders = await Order.find({ user: user._id }).populate('items.product');
      
      if (orders.length > 0) {
        let totalSpent = 0;
        let categoryCount = {};
        let brandCount = {};
        let lastPurchaseDate = null;
        
        orders.forEach(order => {
          totalSpent += order.totalAmount || 0;
          
          if (!lastPurchaseDate || order.createdAt > lastPurchaseDate) {
            lastPurchaseDate = order.createdAt;
          }
          
          order.items.forEach(item => {
            if (item.product) {
              // Count categories
              const category = item.product.category;
              categoryCount[category] = (categoryCount[category] || 0) + 1;
              
              // Count brands
              if (item.product.brand) {
                const brand = item.product.brand;
                brandCount[brand] = (brandCount[brand] || 0) + 1;
              }
            }
          });
        });
        
        // Find favorite category and brand
        const favoriteCategory = Object.entries(categoryCount)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        
        const favoriteBrand = Object.entries(brandCount)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        
        // Update user analytics
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              'analytics.totalSpent': totalSpent,
              'analytics.totalOrders': orders.length,
              'analytics.averageOrderValue': totalSpent / orders.length,
              'analytics.lastPurchaseDate': lastPurchaseDate,
              'analytics.favoriteCategory': favoriteCategory,
              'analytics.favoriteBrand': favoriteBrand
            }
          }
        );
        
        console.log(`Updated analytics for user: ${user.email}`);
      }
    }
    
    // Step 3: Update product statistics
    console.log('\nStep 3: Calculating product statistics...');
    const products = await Product.find({});
    
    for (const product of products) {
      // Count total orders containing this product
      const orderCount = await Order.countDocuments({
        'items.product': product._id
      });
      
      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            totalOrders: orderCount,
            viewCount: product.viewCount || 0
          }
        }
      );
    }
    
    console.log(`Updated statistics for ${products.length} products`);
    
    // Step 4: Clean up invalid data
    console.log('\nStep 4: Cleaning up invalid data...');
    
    // Remove invalid wishlist items
    await User.updateMany(
      {},
      {
        $pull: {
          'interactions.wishlist': { product: null },
          'viewHistory': { product: null }
        }
      }
    );
    
    console.log('Migration completed successfully!');
    
    // Print summary
    const summary = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          usersWithOrders: {
            $sum: { $cond: [{ $gt: ['$analytics.totalOrders', 0] }, 1, 0] }
          },
          usersWithViews: {
            $sum: { $cond: [{ $gt: [{ $size: '$viewHistory' }, 0] }, 1, 0] }
          },
          totalRevenue: { $sum: '$analytics.totalSpent' }
        }
      }
    ]);
    
    console.log('\nMigration Summary:');
    console.log(summary[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateUserData();