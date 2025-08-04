// backend/routes/products.js
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// Get all products with advanced filtering
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      category, 
      brand,
      minPrice, 
      maxPrice,
      price, // For range filter {min, max}
      size,
      color,
      rating,
      sort = '-createdAt',
      page = 1,
      limit = 12 
    } = req.query;

    // Build query
    const query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Brand filter
    if (brand) {
      query.brand = brand;
    }

    // Price range filter
    if (price && typeof price === 'object') {
      query.price = {};
      if (price.min !== undefined) query.price.$gte = price.min;
      if (price.max !== undefined) query.price.$lte = price.max;
    } else if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Size filter (can be array or single value)
    if (size) {
      const sizes = Array.isArray(size) ? size : [size];
      query.sizes = { $in: sizes };
    }

    // Color filter (can be array or single value)
    if (color) {
      const colors = Array.isArray(color) ? color : [color];
      query.colors = { $in: colors };
    }

    // Rating filter
    if (rating) {
      // Handle "4+" format
      const minRating = parseFloat(rating.replace('+', ''));
      query.rating = { $gte: minRating };
    }

    // Calculate total documents for pagination
    const total = await Product.countDocuments(query);

    // Execute query with pagination and sorting
    const products = await Product.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    res.json({
      products,
      pagination: {
        page: Number(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all unique categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories.filter(cat => cat)); // Filter out null/undefined
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all unique brands
router.get('/brands', async (req, res) => {
  try {
    const brands = await Product.distinct('brand');
    res.json(brands.filter(brand => brand)); // Filter out null/undefined
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get price range
router.get('/price-range', async (req, res) => {
  try {
    const result = await Product.aggregate([
      {
        $group: {
          _id: null,
          min: { $min: '$price' },
          max: { $max: '$price' }
        }
      }
    ]);
    
    res.json(result[0] || { min: 0, max: 10000000 });
  } catch (error) {
    console.error('Error fetching price range:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all unique sizes
router.get('/sizes', async (req, res) => {
  try {
    const products = await Product.find({}, 'sizes');
    const allSizes = new Set();
    
    products.forEach(product => {
      if (product.sizes && Array.isArray(product.sizes)) {
        product.sizes.forEach(size => allSizes.add(size));
      }
    });
    
    res.json(Array.from(allSizes).filter(size => size));
  } catch (error) {
    console.error('Error fetching sizes:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all unique colors
router.get('/colors', async (req, res) => {
  try {
    const products = await Product.find({}, 'colors');
    const allColors = new Set();
    
    products.forEach(product => {
      if (product.colors && Array.isArray(product.colors)) {
        product.colors.forEach(color => allColors.add(color));
      }
    });
    
    res.json(Array.from(allColors).filter(color => color));
  } catch (error) {
    console.error('Error fetching colors:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Track view if user is logged in
    if (req.user) {
      // Update product view count
      await Product.findByIdAndUpdate(req.params.id, {
        $inc: { viewCount: 1 }
      });

      // Track in user's view history
      const user = await User.findById(req.user._id);
      
      // Remove existing view of this product
      user.viewHistory = user.viewHistory.filter(
        item => item.product.toString() !== req.params.id
      );
      
      // Add new view at the beginning
      user.viewHistory.unshift({
        product: req.params.id,
        viewedAt: new Date(),
        source: req.query.source || 'direct'
      });
      
      // Keep only last 50 views
      if (user.viewHistory.length > 50) {
        user.viewHistory = user.viewHistory.slice(0, 50);
      }
      
      await user.save();
    }

    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new product (admin only)
router.post('/', protect, async (req, res) => {
  try {
    // Check if admin
    if (req.user.email !== 'admin@gmail.com') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const product = new Product(req.body);
    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update product (admin only)
router.put('/:id', protect, async (req, res) => {
  try {
    // Check if admin
    if (req.user.email !== 'admin@gmail.com') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete product (admin only)
router.delete('/:id', protect, async (req, res) => {
  try {
    // Check if admin
    if (req.user.email !== 'admin@gmail.com') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: error.message });
  }
});

// Search suggestions endpoint
router.get('/search/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const products = await Product.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } }
      ]
    })
    .select('name price images category brand')
    .limit(5)
    .lean();

    res.json(products);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get popular products
router.get('/filter/popular', async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ totalOrders: -1, viewCount: -1 })
      .limit(8)
      .lean();
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching popular products:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get trending products (high view count recently)
router.get('/filter/trending', async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(8)
      .lean();
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching trending products:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get new arrivals
router.get('/filter/new-arrivals', async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching new arrivals:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;