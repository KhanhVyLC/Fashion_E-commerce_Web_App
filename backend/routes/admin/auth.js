// backend/routes/admin/auth.js
const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Kiểm tra email admin
    if (email !== 'admin@gmail.com') {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'your-secret-key123456',
      { expiresIn: '30d' }
    );

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token,
      isAdmin: true
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
