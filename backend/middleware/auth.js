// backend/middleware/auth.js - Enhanced Version
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    // Check for token in multiple places
    let token = null;
    
    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check cookies (if using cookies)
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized, no token provided' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key123456');
    
    // Check if token has required fields
    if (!decoded.id && !decoded.userId) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token structure' 
      });
    }
    
    // Get user from database - note: using decoded.id OR decoded.userId for compatibility
    const userId = decoded.id || decoded.userId;
    const user = await User.findById(userId)
      .select('-password')
      .lean(); // Use lean() for better performance when not modifying
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found or has been deleted' 
      });
    }
    
    // Check if user is active
    if (user.isActive === false) {
      return res.status(401).json({ 
        success: false,
        message: 'Account has been deactivated' 
      });
    }
    
    // Attach user to request object
    req.user = user;
    req.userId = user._id;
    
    // Update last activity (non-blocking)
    User.findByIdAndUpdate(
      userId,
      { 'analytics.lastLoginDate': new Date() },
      { validateBeforeSave: false }
    ).exec().catch(err => {
      console.error('Error updating last activity:', err);
    });
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token has expired',
        expired: true // Frontend can use this to trigger refresh
      });
    }
    
    res.status(401).json({ 
      success: false,
      message: 'Authentication failed' 
    });
  }
};

// Optional middleware - allows access with or without authentication
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || '');
      const userId = decoded.id || decoded.userId;
      const user = await User.findById(userId).select('-password').lean();
      
      if (user && user.isActive !== false) {
        req.user = user;
        req.userId = user._id;
      }
    }
    
    next();
  } catch (error) {
    // If token is invalid, continue without user
    console.log('Optional auth - invalid token, continuing without user');
    next();
  }
};

module.exports = { protect, optionalAuth };
