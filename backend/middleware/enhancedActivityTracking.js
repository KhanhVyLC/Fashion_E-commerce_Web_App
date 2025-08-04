// backend/middleware/enhancedActivityTracking.js
const User = require('../models/User');

const enhancedActivityTracking = async (req, res, next) => {
  // Only track for authenticated users
  if (req.user && req.user._id) {
    try {
      // Only update on meaningful actions
      const meaningfulRoutes = [
        '/cart',
        '/orders',
        '/products',
        '/users/wishlist',
        '/users/view-history',
        '/recommendations',
        '/admin/recommendations'
      ];
      
      const shouldTrack = meaningfulRoutes.some(route => req.path.includes(route));
      
      // Track based on method and route
      if (shouldTrack && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        // Update activity asynchronously without blocking
        User.findByIdAndUpdate(
          req.user._id,
          {
            $set: {
              'analytics.lastActivityDate': new Date(),
              'analytics.lastLoginDate': new Date()
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

module.exports = { enhancedActivityTracking };