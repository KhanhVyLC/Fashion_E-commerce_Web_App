// backend/scripts/fixUserActivityData.js
// Run this script to fix all user activity data

const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');

async function fixUserActivityData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    
    console.log('Connected to MongoDB');
    
    // Step 1: Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to process`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        console.log(`\nProcessing user: ${user.email}`);
        
        // Initialize analytics if missing
        if (!user.analytics) {
          user.analytics = {
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
        }
        
        // Initialize other fields if missing
        if (!user.interactions) {
          user.interactions = {
            wishlist: [],
            cartAdditions: [],
            productComparisons: [],
            likes: [],
            dislikes: []
          };
        }
        
        if (!user.viewHistory) user.viewHistory = [];
        if (!user.searchHistory) user.searchHistory = [];
        
        // Calculate last activity from various sources
        let lastActivityDate = user.analytics.registrationDate || user.createdAt || new Date();
        let hasActivity = false;
        
        // Check view history
        if (user.viewHistory.length > 0) {
          const validViews = user.viewHistory.filter(v => v && v.viewedAt);
          if (validViews.length > 0) {
            const sortedViews = validViews.sort((a, b) => 
              new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime()
            );
            const lastView = sortedViews[0];
            if (lastView && new Date(lastView.viewedAt) > lastActivityDate) {
              lastActivityDate = new Date(lastView.viewedAt);
              hasActivity = true;
              console.log(`  - Last view: ${lastActivityDate.toISOString()}`);
            }
          }
        }
        
        // Check search history
        if (user.searchHistory.length > 0) {
          const validSearches = user.searchHistory.filter(s => s && s.searchedAt);
          if (validSearches.length > 0) {
            const sortedSearches = validSearches.sort((a, b) => 
              new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime()
            );
            const lastSearch = sortedSearches[0];
            if (lastSearch && new Date(lastSearch.searchedAt) > lastActivityDate) {
              lastActivityDate = new Date(lastSearch.searchedAt);
              hasActivity = true;
              console.log(`  - Last search: ${lastActivityDate.toISOString()}`);
            }
          }
        }
        
        // Check cart additions
        if (user.interactions.cartAdditions && user.interactions.cartAdditions.length > 0) {
          const validCarts = user.interactions.cartAdditions.filter(c => c && c.timestamp);
          if (validCarts.length > 0) {
            const sortedCarts = validCarts.sort((a, b) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            const lastCart = sortedCarts[0];
            if (lastCart && new Date(lastCart.timestamp) > lastActivityDate) {
              lastActivityDate = new Date(lastCart.timestamp);
              hasActivity = true;
              console.log(`  - Last cart addition: ${lastActivityDate.toISOString()}`);
            }
          }
        }
        
        // Check wishlist
        if (user.interactions.wishlist && user.interactions.wishlist.length > 0) {
          const validWishlist = user.interactions.wishlist.filter(w => w && w.addedAt);
          if (validWishlist.length > 0) {
            const sortedWishlist = validWishlist.sort((a, b) => 
              new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
            );
            const lastWishlist = sortedWishlist[0];
            if (lastWishlist && new Date(lastWishlist.addedAt) > lastActivityDate) {
              lastActivityDate = new Date(lastWishlist.addedAt);
              hasActivity = true;
              console.log(`  - Last wishlist: ${lastActivityDate.toISOString()}`);
            }
          }
        }
        
        // Check orders
        const orders = await Order.find({ 
          user: user._id,
          orderStatus: { $ne: 'cancelled' }
        }).sort('-createdAt');
        
        if (orders.length > 0) {
          const lastOrder = orders[0];
          if (lastOrder.createdAt > lastActivityDate) {
            lastActivityDate = lastOrder.createdAt;
            hasActivity = true;
            console.log(`  - Last order: ${lastActivityDate.toISOString()}`);
          }
          
          // Calculate order analytics
          let totalSpent = 0;
          const categoryCount = {};
          const brandCount = {};
          
          for (const order of orders) {
            totalSpent += order.totalAmount || 0;
            
            // If order has populated items with products, count them
            if (order.items && order.items.length > 0) {
              for (const item of order.items) {
                if (item.product) {
                  // Count by product ID for now (would need to populate for actual category/brand)
                  const productId = item.product.toString();
                  categoryCount[productId] = (categoryCount[productId] || 0) + 1;
                }
              }
            }
          }
          
          user.analytics.totalSpent = totalSpent;
          user.analytics.totalOrders = orders.length;
          user.analytics.averageOrderValue = orders.length > 0 ? totalSpent / orders.length : 0;
          user.analytics.lastPurchaseDate = orders[0].createdAt;
          
          console.log(`  - Total orders: ${orders.length}, Total spent: ${totalSpent}`);
        }
        
        // Update activity dates
        if (hasActivity) {
          user.analytics.lastActivityDate = lastActivityDate;
          
          // If no login date or activity is more recent, update login date
          if (!user.analytics.lastLoginDate || lastActivityDate > user.analytics.lastLoginDate) {
            user.analytics.lastLoginDate = lastActivityDate;
          }
          
          console.log(`  - Updated last activity: ${lastActivityDate.toISOString()}`);
        } else {
          // No activity found, use registration date
          const regDate = user.analytics.registrationDate || user.createdAt || new Date();
          user.analytics.lastActivityDate = regDate;
          user.analytics.lastLoginDate = regDate;
          console.log(`  - No activity found, using registration date: ${regDate}`);
        }
        
        // Save user
        await user.save({ validateBeforeSave: false });
        fixedCount++;
        console.log(`  ✓ User ${user.email} fixed successfully`);
        
      } catch (error) {
        errorCount++;
        console.error(`  ✗ Error fixing user ${user.email}:`, error.message);
      }
    }
    
    // Generate summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total users processed: ${users.length}`);
    console.log(`Successfully fixed: ${fixedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Get final statistics
    const stats = await User.aggregate([
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
          withViewHistory: [
            {
              $match: {
                viewHistory: { $exists: true, $ne: [] }
              }
            },
            { $count: 'count' }
          ]
        }
      }
    ]);
    
    console.log('\n=== FINAL STATISTICS ===');
    console.log('Total users:', stats[0].total[0]?.count || 0);
    console.log('Users with login date:', stats[0].withLoginDate[0]?.count || 0);
    console.log('Active last month:', stats[0].activeLastMonth[0]?.count || 0);
    console.log('Users with orders:', stats[0].withOrders[0]?.count || 0);
    console.log('Users with view history:', stats[0].withViewHistory[0]?.count || 0);
    
    console.log('\n✅ User activity data fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the fix
fixUserActivityData();