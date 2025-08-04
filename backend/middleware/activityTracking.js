// backend/middleware/activityTracking.js
const User = require('../models/User');

const trackUserActivity = async (req, res, next) => {
  // Only track for authenticated users on specific routes
  if (req.user && req.user._id) {
    try {
      // Only update on meaningful actions, not every request
      const meaningfulRoutes = [
        '/api/cart',
        '/api/orders',
        '/api/products/',
        '/api/users/wishlist',
        '/api/users/view-history',
        '/api/recommendations'
      ];
      
      const shouldTrack = meaningfulRoutes.some(route => req.path.includes(route));
      
      if (shouldTrack && req.method !== 'GET') {
        // Update activity asynchronously without blocking
        User.findByIdAndUpdate(
          req.user._id,
          {
            $set: {
              'analytics.lastActivityDate': new Date()
            }
          },
          { new: false }
        ).exec().catch(err => {
          console.error('Failed to update user activity:', err);
        });
      }
    } catch (error) {
      // Don't block the request if tracking fails
      console.error('Activity tracking error:', error);
    }
  }
  
  next();
};

module.exports = { trackUserActivity };