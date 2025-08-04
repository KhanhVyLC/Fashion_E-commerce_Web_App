// backend/scripts/fixAllUserData.js

const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');

async function fixAllUserData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    
    console.log('Connected to MongoDB');
    
    // Step 1: Ensure all users have required fields
    console.log('\nStep 1: Initializing missing fields...');
    
    const users = await User.find({});
    let fixedCount = 0;
    
    for (const user of users) {
      let needsUpdate = false;
      const updateFields = {};
      
      // Check and initialize analytics
      if (!user.analytics) {
        updateFields.analytics = {
          totalSpent: 0,
          totalOrders: 0,
          averageOrderValue: 0,
          registrationDate: user.createdAt || new Date(),
          lastLoginDate: null,
          lastActivityDate: null,
          lastPurchaseDate: null,
          favoriteCategory: null,
          favoriteBrand: null
        };
        needsUpdate = true;
      }
      
      // Check and initialize interactions
      if (!user.interactions) {
        updateFields.interactions = {
          wishlist: [],
          cartAdditions: [],
          productComparisons: [],
          likes: [],
          dislikes: []
        };
        needsUpdate = true;
      }
      
      // Check and initialize arrays
      if (!user.viewHistory) {
        updateFields.viewHistory = [];
        needsUpdate = true;
      }
      
      if (!user.searchHistory) {
        updateFields.searchHistory = [];
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await User.updateOne(
          { _id: user._id },
          { $set: updateFields }
        );
        fixedCount++;
      }
    }
    
    console.log(`Fixed ${fixedCount} users with missing fields`);
    
    // Step 2: Calculate activity dates from various sources
    console.log('\nStep 2: Calculating activity dates...');
    
    for (const user of users) {
      let lastActivityDate = user.createdAt || new Date();
      let hasActivity = false;
      
      // Check view history
      if (user.viewHistory && user.viewHistory.length > 0) {
        const validViews = user.viewHistory.filter(v => v && v.viewedAt);
        if (validViews.length > 0) {
          const lastView = validViews
            .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))[0];
          if (lastView && new Date(lastView.viewedAt) > lastActivityDate) {
            lastActivityDate = new Date(lastView.viewedAt);
            hasActivity = true;
          }
        }
      }
      
      // Check search history
      if (user.searchHistory && user.searchHistory.length > 0) {
        const validSearches = user.searchHistory.filter(s => s && s.searchedAt);
        if (validSearches.length > 0) {
          const lastSearch = validSearches
            .sort((a, b) => new Date(b.searchedAt) - new Date(a.searchedAt))[0];
          if (lastSearch && new Date(lastSearch.searchedAt) > lastActivityDate) {
            lastActivityDate = new Date(lastSearch.searchedAt);
            hasActivity = true;
          }
        }
      }
      
      // Check orders
      const orders = await Order.find({ user: user._id }).sort('-createdAt').limit(1);
      if (orders.length > 0) {
        const lastOrder = orders[0];
        if (lastOrder.createdAt > lastActivityDate) {
          lastActivityDate = lastOrder.createdAt;
          hasActivity = true;
        }
      }
      
      // Update dates
      const updateData = {};
      
      // Only update if we found activity
      if (hasActivity) {
        updateData['analytics.lastActivityDate'] = lastActivityDate;
        
        // If no login date, use activity date
        if (!user.analytics?.lastLoginDate) {
          updateData['analytics.lastLoginDate'] = lastActivityDate;
        }
      }
      
      if (Object.keys(updateData).length > 0) {
        await User.updateOne(
          { _id: user._id },
          { $set: updateData }
        );
        console.log(`Updated activity for ${user.email}: ${lastActivityDate}`);
      }
    }
    
    // Step 3: Calculate order analytics
    console.log('\nStep 3: Calculating order analytics...');
    
    for (const user of users) {
      const orders = await Order.find({ 
        user: user._id,
        orderStatus: { $ne: 'cancelled' }
      }).populate('items.product');
      
      if (orders.length > 0) {
        let totalSpent = 0;
        const categoryCount = {};
        const brandCount = {};
        let lastPurchaseDate = null;
        
        orders.forEach(order => {
          totalSpent += order.totalAmount || 0;
          
          if (!lastPurchaseDate || order.createdAt > lastPurchaseDate) {
            lastPurchaseDate = order.createdAt;
          }
          
          order.items.forEach(item => {
            if (item.product) {
              // Count categories
              if (item.product.category) {
                const category = item.product.category;
                categoryCount[category] = (categoryCount[category] || 0) + 1;
              }
              
              // Count brands
              if (item.product.brand) {
                const brand = item.product.brand;
                brandCount[brand] = (brandCount[brand] || 0) + 1;
              }
            }
          });
        });
        
        // Find favorites
        const favoriteCategory = Object.entries(categoryCount)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        
        const favoriteBrand = Object.entries(brandCount)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        
        // Update analytics
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
        
        console.log(`Updated order analytics for ${user.email}`);
      }
    }
    
    // Step 4: Update product statistics
    console.log('\nStep 4: Updating product statistics...');
    
    const products = await Product.find({});
    
    for (const product of products) {
      // Count orders containing this product
      const orderCount = await Order.countDocuments({
        'items.product': product._id,
        orderStatus: { $ne: 'cancelled' }
      });
      
      // Count views
      const viewCount = await User.countDocuments({
        'viewHistory.product': product._id
      });
      
      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            totalOrders: orderCount,
            viewCount: viewCount
          }
        }
      );
    }
    
    console.log(`Updated statistics for ${products.length} products`);
    
    // Step 5: Generate final summary
    const summary = await User.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          withLoginDate: [
            {
              $match: {
                'analytics.lastLoginDate': { $ne: null }
              }
            },
            { $count: 'count' }
          ],
          activeLastMonth: [
            {
              $match: {
                $or: [
                  {
                    'analytics.lastLoginDate': { 
                      $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                  },
                  {
                    'analytics.lastActivityDate': { 
                      $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                  }
                ]
              }
            },
            { $count: 'count' }
          ],
          withOrders: [
            {
              $match: {
                'analytics.totalOrders': { $gt: 0 }
              }
            },
            { $count: 'count' }
          ],
          withViews: [
            {
              $match: {
                viewHistory: { $exists: true, $ne: [] }
              }
            },
            { $count: 'count' }
          ],
          withSearches: [
            {
              $match: {
                searchHistory: { $exists: true, $ne: [] }
              }
            },
            { $count: 'count' }
          ]
        }
      }
    ]);
    
    console.log('\n=== FINAL SUMMARY ===');
    console.log('Total users:', summary[0].total[0]?.count || 0);
    console.log('Users with login date:', summary[0].withLoginDate[0]?.count || 0);
    console.log('Active last month:', summary[0].activeLastMonth[0]?.count || 0);
    console.log('Users with orders:', summary[0].withOrders[0]?.count || 0);
    console.log('Users with view history:', summary[0].withViews[0]?.count || 0);
    console.log('Users with search history:', summary[0].withSearches[0]?.count || 0);
    
    console.log('\n✅ All user data fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the fix
fixAllUserData();