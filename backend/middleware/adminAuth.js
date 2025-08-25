// backend/middleware/adminAuth.js - Fixed Version
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const adminAuth = async (req, res, next) => {
  try {
    // Check for token
    let token = null;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Access denied. No token provided.' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '');
    const userId = decoded.id || decoded.userId;
    
    // Get user with role check
    const user = await User.findById(userId)
      .select('-password')
      .lean();
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // Check if user is active
    if (user.isActive === false) {
      return res.status(401).json({ 
        success: false,
        message: 'Account has been deactivated' 
      });
    }
    
    // Check if user is admin
    const isAdmin = user.role === 'admin' || 
                    user.email === 'admin@gmail.com' ||
                    (user.permissions && user.permissions.includes('admin'));
    
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Admin privileges required.',
        requiredRole: 'admin',
        currentRole: user.role
      });
    }
    
    // Attach user to request
    req.user = user;
    req.userId = user._id;
    req.isAdmin = true;
    
    // Log admin action (non-blocking) - FIXED: pass req as parameter
    logAdminActivity(req, user._id, req.method, req.originalUrl);
    
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    
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
        expired: true
      });
    }
    
    res.status(401).json({ 
      success: false,
      message: 'Authentication failed' 
    });
  }
};

// Middleware for specific admin permissions
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      // First ensure user is authenticated and is admin
      if (!req.user || !req.isAdmin) {
        return res.status(403).json({ 
          success: false,
          message: 'Access denied. Admin privileges required.' 
        });
      }
      
      // Check specific permission if user has permissions array
      if (req.user.permissions && !req.user.permissions.includes(permission)) {
        return res.status(403).json({ 
          success: false,
          message: `Access denied. Missing permission: ${permission}` 
        });
      }
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error checking permissions' 
      });
    }
  };
};

// Combined middleware - checks auth first, then admin
const protectAdmin = async (req, res, next) => {
  try {
    // Check for token
    let token = null;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Access denied. No token provided.' 
      });
    }

    // Verify token and get user in one step
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key123456');
    const userId = decoded.id || decoded.userId;
    
    const user = await User.findById(userId)
      .select('-password')
      .lean();
    
    if (!user || user.isActive === false) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication failed' 
      });
    }
    
    // Check admin role
    const isAdmin = user.role === 'admin' || 
                    user.email === 'admin@gmail.com';
    
    if (!isAdmin) {
      return res.status(403).json({ 
        success: false,
        message: 'Admin access required' 
      });
    }
    
    req.user = user;
    req.userId = user._id;
    req.isAdmin = true;
    
    // Log admin activity - FIXED: pass req as parameter
    logAdminActivity(req, user._id, req.method, req.originalUrl);
    
    next();
  } catch (error) {
    console.error('Protected admin auth error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired',
        expired: true
      });
    }
    
    res.status(401).json({ 
      success: false,
      message: 'Authentication failed' 
    });
  }
};

// Helper function to log admin activities - FIXED: add req parameter
async function logAdminActivity(req, userId, method, url) {
  try {
    // Check if AdminLog model exists
    let AdminLog;
    try {
      AdminLog = require('../models/AdminLog');
    } catch (e) {
      // AdminLog model doesn't exist, skip logging
      return;
    }
    
    if (AdminLog) {
      await AdminLog.create({
        admin: userId,
        action: method,
        endpoint: url,
        timestamp: new Date(),
        ip: req.ip || req.connection.remoteAddress
      }).catch(err => {
        console.error('Error logging admin activity:', err.message);
      });
    }
  } catch (error) {
    // Don't block the request if logging fails
    console.error('Admin activity logging error:', error.message);
  }
}

module.exports = { 
  adminAuth, 
  requirePermission, 
  protectAdmin 
};
