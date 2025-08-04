// backend/scripts/fixUserLoginDates.js
// Run this script to fix existing users' login dates

const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');

async function fixUserLoginDates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    
    console.log('Connected to MongoDB');
    
    // Step 1: Set default login date for users who have never logged in
    const usersWithoutLogin = await User.find({
      $or: [
        { 'analytics.lastLoginDate': null },
        { 'analytics.lastLoginDate': { $exists: false } }
      ]
    });
    
    console.log(`Found ${usersWithoutLogin.length} users without login date`);
    
    for (const user of usersWithoutLogin) {
      // Check if user has any activity
      const hasViewHistory = user.viewHistory && user.viewHistory.length > 0;
      const hasOrders = await Order.findOne({ user: user._id });
      const hasSearchHistory = user.searchHistory && user.searchHistory.length > 0;
      
      let lastActivityDate = user.createdAt;
      
      // Find most recent activity
      if (hasViewHistory) {
        const lastView = user.viewHistory
          .filter(v => v.viewedAt)
          .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))[0];
        if (lastView && new Date(lastView.viewedAt) > lastActivityDate) {
          lastActivityDate = new Date(lastView.viewedAt);
        }
      }
      
      if (hasSearchHistory) {
        const lastSearch = user.searchHistory
          .filter(s => s.searchedAt)
          .sort((a, b) => new Date(b.searchedAt) - new Date(a.searchedAt))[0];
        if (lastSearch && new Date(lastSearch.searchedAt) > lastActivityDate) {
          lastActivityDate = new Date(lastSearch.searchedAt);
        }
      }
      
      if (hasOrders) {
        const lastOrder = await Order.findOne({ user: user._id }).sort('-createdAt');
        if (lastOrder && lastOrder.createdAt > lastActivityDate) {
          lastActivityDate = lastOrder.createdAt;
        }
      }
      
      // Update user's login date based on their last activity
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            'analytics.lastLoginDate': lastActivityDate,
            'analytics.lastActivityDate': lastActivityDate
          }
        }
      );
      
      console.log(`Updated login date for ${user.email} to ${lastActivityDate}`);
    }
    
    // Step 2: Set login dates for recently active users
    const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    // Users with recent view history
    await User.updateMany(
      {
        'viewHistory.viewedAt': { $gte: recentDate },
        'analytics.lastLoginDate': { $lt: recentDate }
      },
      {
        $set: {
          'analytics.lastLoginDate': new Date()
        }
      }
    );
    
    // Users with recent orders
    const recentOrderUsers = await Order.distinct('user', {
      createdAt: { $gte: recentDate }
    });
    
    await User.updateMany(
      {
        _id: { $in: recentOrderUsers },
        'analytics.lastLoginDate': { $lt: recentDate }
      },
      {
        $set: {
          'analytics.lastLoginDate': new Date()
        }
      }
    );
    
    // Step 3: Generate summary
    const summary = await User.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          activeLastMonth: [
            {
              $match: {
                'analytics.lastLoginDate': { $gte: recentDate }
              }
            },
            { $count: 'count' }
          ],
          activeLastWeek: [
            {
              $match: {
                'analytics.lastLoginDate': { 
                  $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                }
              }
            },
            { $count: 'count' }
          ],
          neverActive: [
            {
              $match: {
                $or: [
                  { 'analytics.lastLoginDate': null },
                  { 'analytics.lastLoginDate': { $exists: false } }
                ]
              }
            },
            { $count: 'count' }
          ]
        }
      }
    ]);
    
    console.log('\n=== Summary ===');
    console.log('Total users:', summary[0].total[0]?.count || 0);
    console.log('Active last month:', summary[0].activeLastMonth[0]?.count || 0);
    console.log('Active last week:', summary[0].activeLastWeek[0]?.count || 0);
    console.log('Never active:', summary[0].neverActive[0]?.count || 0);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the fix
fixUserLoginDates();