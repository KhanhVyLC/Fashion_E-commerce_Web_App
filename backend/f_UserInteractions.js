// backend/fixUserInteractions.js
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const fixUserInteractions = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB');
    
    // Find all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);
    
    let fixed = 0;
    
    for (const user of users) {
      let needsUpdate = false;
      
      // Check if interactions field exists
      if (!user.interactions) {
        user.interactions = {
          wishlist: [],
          cartAdditions: [],
          productComparisons: []
        };
        needsUpdate = true;
      } else {
        // Check individual fields
        if (!user.interactions.wishlist) {
          user.interactions.wishlist = [];
          needsUpdate = true;
        }
        if (!user.interactions.cartAdditions) {
          user.interactions.cartAdditions = [];
          needsUpdate = true;
        }
        if (!user.interactions.productComparisons) {
          user.interactions.productComparisons = [];
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await user.save();
        console.log(`Fixed user: ${user.email}`);
        fixed++;
      }
    }
    
    console.log(`\nFixed ${fixed} users`);
    console.log('All users now have interactions field!');
    
    // Test: Show one user
    const testUser = await User.findOne();
    console.log('\nSample user structure:');
    console.log('Email:', testUser.email);
    console.log('Has interactions:', !!testUser.interactions);
    console.log('Has wishlist:', !!testUser.interactions?.wishlist);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

// Run the fix
fixUserInteractions();