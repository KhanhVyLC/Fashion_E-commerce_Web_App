// backend/routes/reviews.js
const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');
const reviewSummaryService = require('../services/reviewSummaryService');

// Create review
router.post('/create', protect, async (req, res) => {
  try {
    const { productId, orderId, rating, comment } = req.body;

    // Check if user bought the product
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id,
      'items.product': productId,
      orderStatus: 'delivered'
    });

    if (!order) {
      return res.status(400).json({ message: 'You can only review products you have purchased' });
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({
      user: req.user._id,
      product: productId,
      order: orderId
    });

    if (existingReview) {
      return res.status(400).json({ message: 'Product already reviewed' });
    }

    const review = await Review.create({
      user: req.user._id,
      product: productId,
      order: orderId,
      rating,
      comment
    });

    // Update product rating
    const reviews = await Review.find({ product: productId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    
    await Product.findByIdAndUpdate(productId, {
      rating: avgRating,
      totalReviews: reviews.length
    });

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get product reviews
router.get('/product/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate('user', 'name')
      .sort('-createdAt');
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get review summary for a product
router.get('/product/:productId/summary', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Lấy tất cả reviews của sản phẩm
    const reviews = await Review.find({ product: productId })
      .populate('user', 'name')
      .sort('-createdAt')
      .lean();

    // Nếu không có review nào
    if (reviews.length === 0) {
      return res.json({
        summary: 'Chưa có đánh giá nào cho sản phẩm này.',
        highlights: { pros: [], cons: [] },
        sentiment: { type: 'neutral', label: 'Chưa có dữ liệu' },
        keywords: [],
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: {
          5: 0, 4: 0, 3: 0, 2: 0, 1: 0
        }
      });
    }

    // Tính phân bố rating
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(review => {
      ratingDistribution[review.rating]++;
    });

    // Gọi service để tóm tắt
    const summary = await reviewSummaryService.summarizeReviews(reviews);

    // Thêm phân bố rating
    summary.ratingDistribution = ratingDistribution;

    // Thêm phân tích theo thời gian
    summary.timeTrends = reviewSummaryService.analyzeTimeTrends(reviews);

    // Thêm phân tích theo khía cạnh
    summary.aspectAnalysis = reviewSummaryService.analyzeAspects(reviews);

    // Cache kết quả trong Redis nếu có (optional)
    // await redis.setex(`review_summary_${productId}`, 3600, JSON.stringify(summary));

    res.json(summary);
  } catch (error) {
    console.error('Error getting review summary:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get detailed analytics for a product's reviews
router.get('/product/:productId/analytics', async (req, res) => {
  try {
    const { productId } = req.params;
    
    const reviews = await Review.find({ product: productId })
      .populate('user', 'name')
      .sort('-createdAt')
      .lean();

    if (reviews.length === 0) {
      return res.json({
        message: 'No reviews found for this product',
        analytics: null
      });
    }

    // Phân tích chi tiết
    const analytics = {
      // Tổng quan
      overview: {
        totalReviews: reviews.length,
        averageRating: parseFloat((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)),
        totalWithComments: reviews.filter(r => r.comment).length,
        totalWithImages: reviews.filter(r => r.images && r.images.length > 0).length
      },

      // Phân bố rating theo thời gian
      monthlyDistribution: {},

      // Top reviewers
      topReviewers: {},

      // Độ dài comment trung bình
      averageCommentLength: 0,

      // Từ được sử dụng nhiều nhất
      mostUsedWords: [],

      // Thời gian đánh giá phổ biến
      popularReviewTimes: {
        morning: 0,    // 6-12h
        afternoon: 0,  // 12-18h
        evening: 0,    // 18-24h
        night: 0       // 0-6h
      }
    };

    // Xử lý dữ liệu
    let totalCommentLength = 0;
    const wordFrequency = {};

    reviews.forEach(review => {
      // Monthly distribution
      const month = new Date(review.createdAt).toISOString().substring(0, 7);
      if (!analytics.monthlyDistribution[month]) {
        analytics.monthlyDistribution[month] = {
          count: 0,
          ratings: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          averageRating: 0
        };
      }
      analytics.monthlyDistribution[month].count++;
      analytics.monthlyDistribution[month].ratings[review.rating]++;

      // Top reviewers
      const userName = review.user?.name || 'Anonymous';
      analytics.topReviewers[userName] = (analytics.topReviewers[userName] || 0) + 1;

      // Comment analysis
      if (review.comment) {
        totalCommentLength += review.comment.length;
        
        // Word frequency
        const words = review.comment
          .toLowerCase()
          .replace(/[.,!?;:]/g, '')
          .split(/\s+/)
          .filter(word => word.length > 3);
        
        words.forEach(word => {
          wordFrequency[word] = (wordFrequency[word] || 0) + 1;
        });
      }

      // Time analysis
      const hour = new Date(review.createdAt).getHours();
      if (hour >= 6 && hour < 12) analytics.popularReviewTimes.morning++;
      else if (hour >= 12 && hour < 18) analytics.popularReviewTimes.afternoon++;
      else if (hour >= 18 && hour < 24) analytics.popularReviewTimes.evening++;
      else analytics.popularReviewTimes.night++;
    });

    // Calculate averages
    analytics.averageCommentLength = Math.round(totalCommentLength / reviews.filter(r => r.comment).length);

    // Calculate monthly averages
    Object.keys(analytics.monthlyDistribution).forEach(month => {
      const monthData = analytics.monthlyDistribution[month];
      const totalRating = Object.entries(monthData.ratings)
        .reduce((sum, [rating, count]) => sum + (parseInt(rating) * count), 0);
      monthData.averageRating = parseFloat((totalRating / monthData.count).toFixed(1));
    });

    // Top words (exclude common words)
    const stopWords = ['và', 'là', 'của', 'có', 'được', 'cho', 'với', 'này', 'khi', 'để'];
    analytics.mostUsedWords = Object.entries(wordFrequency)
      .filter(([word]) => !stopWords.includes(word))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    // Top 5 reviewers
    analytics.topReviewers = Object.entries(analytics.topReviewers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, reviewCount: count }));

    res.json(analytics);
  } catch (error) {
    console.error('Error getting review analytics:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user's reviews
router.get('/user', protect, async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user._id })
      .populate('product', 'name images price')
      .populate('order', 'createdAt')
      .sort('-createdAt');
    
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update review
router.put('/:reviewId', protect, async (req, res) => {
  try {
    const review = await Review.findOne({
      _id: req.params.reviewId,
      user: req.user._id
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const { rating, comment } = req.body;
    
    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    
    await review.save();

    // Update product rating
    const reviews = await Review.find({ product: review.product });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    
    await Product.findByIdAndUpdate(review.product, {
      rating: avgRating
    });

    res.json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete review
router.delete('/:reviewId', protect, async (req, res) => {
  try {
    const review = await Review.findOne({
      _id: req.params.reviewId,
      user: req.user._id
    });

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const productId = review.product;
    await review.remove();

    // Update product rating
    const remainingReviews = await Review.find({ product: productId });
    const avgRating = remainingReviews.length > 0
      ? remainingReviews.reduce((sum, r) => sum + r.rating, 0) / remainingReviews.length
      : 0;
    
    await Product.findByIdAndUpdate(productId, {
      rating: avgRating,
      totalReviews: remainingReviews.length
    });

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;