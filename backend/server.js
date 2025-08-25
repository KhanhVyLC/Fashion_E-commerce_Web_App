// backend/server.js - Fixed version with proper ENV loading and static files
const dotenv = require('dotenv');
dotenv.config();

// Kiểm tra env đã load chưa
console.log('Environment check at startup:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('- PORT:', process.env.PORT || 5000);
console.log('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Loaded' : 'Missing');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Import middleware
const { enhancedActivityTracking } = require('./middleware/enhancedActivityTracking');
const { protect } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');
const recommendationRoutes = require('./routes/recommendations');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat');
const flashSaleRoutes = require('./routes/flashSales');

// Import admin routes
const adminAuthRoutes = require('./routes/admin/auth');
const adminDashboardRoutes = require('./routes/admin/dashboard');
const adminProductRoutes = require('./routes/admin/products');
const adminOrderRoutes = require('./routes/admin/orders');
const adminUserRoutes = require('./routes/admin/users');
const adminReviewRoutes = require('./routes/admin/reviews');
const adminNotificationRoutes = require('./routes/admin/notifications');
const adminRecommendationRoutes = require('./routes/admin/recommendations');
const adminVoucherRoutes = require('./routes/admin/vouchers');
const adminFlashSaleRoutes = require('./routes/admin/flashSales');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  }
});

// Middleware - CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'], // Add your frontend URLs
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files - IMPORTANT: This must come before routes
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debug middleware to log static file requests
app.use('/uploads', (req, res, next) => {
  console.log('Static file requested:', req.url);
  next();
});

// Attach io to req for use in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || '';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
  console.log('Database:', mongoose.connection.name);
  console.log('Static files served from:', path.join(__dirname, 'uploads'));
})
.catch((err) => console.error('MongoDB connection error:', err));

// Apply activity tracking middleware to specific routes
app.use('/api/cart', protect, enhancedActivityTracking);
app.use('/api/orders', protect, enhancedActivityTracking);
app.use('/api/products', enhancedActivityTracking);
app.use('/api/users', protect, enhancedActivityTracking);
app.use('/api/recommendations', enhancedActivityTracking);

// Client Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/flash-sales', flashSaleRoutes);

// Admin Routes
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/products', adminProductRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/reviews', adminReviewRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/admin/recommendations', adminRecommendationRoutes);
app.use('/api/admin/vouchers', adminVoucherRoutes);
app.use('/api/admin/flash-sales', adminFlashSaleRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Join user-specific room
  socket.on('joinChat', (userId) => {
    socket.join(`user-${userId}`);
    socket.join('chat-room');
    console.log(`User ${userId} joined chat room`);
  });
  
  // Join admin room
  socket.on('joinAdminRoom', () => {
    socket.join('admin-room');
    console.log('Admin joined admin room');
  });
  
  // Join specific conversation
  socket.on('joinConversation', (conversationId) => {
    socket.join(`conversation-${conversationId}`);
    console.log(`Socket joined conversation: ${conversationId}`);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// 404 handler for images
app.use((req, res, next) => {
  if (req.url.startsWith('/uploads')) {
    console.log('404 - Image not found:', req.url);
    res.status(404).sendFile(path.join(__dirname, 'public', 'placeholder-image.png'));
  } else {
    next();
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({ 
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: http://localhost:3000`);
  console.log(`Static files: http://localhost:${PORT}/uploads/`);
});
