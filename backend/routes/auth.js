// backend/routes/auth.js - Updated with proper activity tracking
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || '', {
    expiresIn: '30d',
  });
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    // Validate required fields
    if (!name || !email || !password || !phone || !address) {
      return res.status(400).json({ 
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc' 
      });
    }

    // Validate phone format
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ 
        message: 'Số điện thoại không hợp lệ (10-11 chữ số)' 
      });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Email này đã được sử dụng' });
    }

    // Check if phone already exists
    const phoneExists = await User.findOne({ phone });
    if (phoneExists) {
      return res.status(400).json({ message: 'Số điện thoại này đã được sử dụng' });
    }

    // Create new user with all fields including analytics
    const user = await User.create({
      name,
      email,
      password,
      phone,
      address,
      analytics: {
        totalSpent: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        registrationDate: new Date(),
        lastLoginDate: new Date(),
        lastActivityDate: new Date(),
        lastPurchaseDate: null,
        favoriteCategory: null,
        favoriteBrand: null
      },
      interactions: {
        wishlist: [],
        cartAdditions: [],
        productComparisons: [],
        likes: [],
        dislikes: []
      },
      viewHistory: [],
      searchHistory: [],
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
      }
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
        token: generateToken(user._id),
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi khi tạo tài khoản' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Vui lòng nhập email và mật khẩu' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác' });
    }

    // Update last login date and activity date
    await User.findByIdAndUpdate(
      user._id,
      { 
        $set: { 
          'analytics.lastLoginDate': new Date(),
          'analytics.lastActivityDate': new Date()
        }
      },
      { new: false }
    );

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi khi đăng nhập' });
  }
});

// Get user profile (protected route)
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Token không được cung cấp' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key123456');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Update last activity date
    await User.findByIdAndUpdate(
      user._id,
      { 
        $set: { 
          'analytics.lastActivityDate': new Date()
        }
      },
      { new: false }
    );

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(401).json({ message: 'Token không hợp lệ' });
  }
});

module.exports = router;