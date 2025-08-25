// backend/routes/admin/auth.js
const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is admin (either by role or specific email)
    const isAdmin = user.role === 'admin' || user.email === 'admin@gmail.com';
    
    if (!isAdmin) {
      return res.status(401).json({ message: 'Unauthorized - Admin access only' });
    }

    // Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { 
        id: user._id,
        role: user.role,
        isAdmin: true
      },
      process.env.JWT_SECRET || 'your-secret-key123456',
      { expiresIn: '30d' }
    );

    // Update last login
    user.analytics.lastLoginDate = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
      isAdmin: true
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get current admin info
router.get('/me', async (req, res) => {
  try {
    // Extract token from header
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '');
    
    // Find admin user
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify admin status
    const isAdmin = user.role === 'admin' || user.email === 'admin@gmail.com';
    
    if (!isAdmin) {
      return res.status(401).json({ message: 'Unauthorized - Admin access only' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isAdmin: true
    });
  } catch (error) {
    console.error('Get admin info error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// Change admin password
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Extract token
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '');
    
    // Find admin user
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify admin status
    const isAdmin = user.role === 'admin' || user.email === 'admin@gmail.com';
    
    if (!isAdmin) {
      return res.status(401).json({ message: 'Unauthorized - Admin access only' });
    }

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new admin (only super admin can do this)
router.post('/create', async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    
    // Extract token
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '');
    
    // Find requesting admin
    const requestingAdmin = await User.findById(decoded.id);
    
    if (!requestingAdmin) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only super admin (admin@gmail.com) can create new admins
    if (requestingAdmin.email !== 'admin@gmail.com') {
      return res.status(403).json({ message: 'Only super admin can create new admin accounts' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Create new admin user
    const newAdmin = new User({
      name,
      email,
      password,
      phone: phone || '0000000000', // Default phone if not provided
      address: address || 'Admin Office', // Default address if not provided
      role: 'admin'
    });

    await newAdmin.save();

    res.status(201).json({
      message: 'Admin account created successfully',
      admin: {
        _id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: error.message });
  }
});

// List all admins (only super admin can see this)
router.get('/list', async (req, res) => {
  try {
    // Extract token
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key123456');
    
    // Find requesting admin
    const requestingAdmin = await User.findById(decoded.id);
    
    if (!requestingAdmin) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only super admin can list all admins
    if (requestingAdmin.email !== 'admin@gmail.com') {
      return res.status(403).json({ message: 'Only super admin can view admin list' });
    }

    // Find all admin users
    const admins = await User.find({ role: 'admin' })
      .select('name email createdAt analytics.lastLoginDate')
      .sort({ createdAt: -1 });

    res.json({
      admins,
      total: admins.length
    });
  } catch (error) {
    console.error('List admins error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Remove admin privileges (only super admin can do this)
router.delete('/:id', async (req, res) => {
  try {
    // Extract token
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key123456');
    
    // Find requesting admin
    const requestingAdmin = await User.findById(decoded.id);
    
    if (!requestingAdmin) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only super admin can remove admin privileges
    if (requestingAdmin.email !== 'admin@gmail.com') {
      return res.status(403).json({ message: 'Only super admin can remove admin privileges' });
    }

    // Find target admin
    const targetAdmin = await User.findById(req.params.id);
    
    if (!targetAdmin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Prevent removing super admin
    if (targetAdmin.email === 'admin@gmail.com') {
      return res.status(403).json({ message: 'Cannot remove super admin privileges' });
    }

    // Change role to regular user
    targetAdmin.role = 'user';
    await targetAdmin.save();

    res.json({ 
      message: 'Admin privileges removed successfully',
      user: {
        _id: targetAdmin._id,
        name: targetAdmin.name,
        email: targetAdmin.email,
        role: targetAdmin.role
      }
    });
  } catch (error) {
    console.error('Remove admin error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
