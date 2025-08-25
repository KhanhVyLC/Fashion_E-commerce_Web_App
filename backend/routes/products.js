// backend/routes/products.js - COMPLETE VERSION with ALL features + Flash Sale
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const FlashSale = require('../models/FlashSale');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// ==================== PUBLIC ROUTES ====================

// Get all products with advanced filtering and flash sale info
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

    // Get flash sale info for all products
    const productsWithFlashSale = await Product.getProductsWithFlashSale(
      { _id: { $in: products.map(p => p._id) } },
      {}
    );

    // Create a map for faster lookup
    const flashSaleMap = new Map(
      productsWithFlashSale.map(p => [p._id.toString(), p])
    );

    // Merge flash sale info with products maintaining original order
    const finalProducts = products.map(product => {
      const withFlashSale = flashSaleMap.get(product._id.toString());
      return withFlashSale || product;
    });

    res.json({
      products: finalProducts,
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

    // Get flash sale info for suggestions
    const productsWithFlashSale = await Product.getProductsWithFlashSale(
      { _id: { $in: products.map(p => p._id) } },
      {}
    );

    res.json(productsWithFlashSale);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ message: error.message });
  }
});

// Search products with flash sale info
router.get('/search/query', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q) {
      return res.json([]);
    }

    // Search products
    const products = await Product.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } },
        { brand: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } }
      ]
    })
    .limit(Number(limit))
    .lean();

    // Get flash sale info
    const productsWithFlashSale = await Product.getProductsWithFlashSale(
      { _id: { $in: products.map(p => p._id) } },
      {}
    );

    res.json(productsWithFlashSale);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ message: 'Error searching products' });
  }
});

// Get popular products with flash sale
router.get('/filter/popular', async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ totalOrders: -1, viewCount: -1 })
      .limit(8)
      .lean();

    // Get flash sale info
    const productsWithFlashSale = await Product.getProductsWithFlashSale(
      { _id: { $in: products.map(p => p._id) } },
      {}
    );
    
    res.json(productsWithFlashSale);
  } catch (error) {
    console.error('Error fetching popular products:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get trending products with flash sale priority
router.get('/filter/trending', async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(16) // Get more to filter
      .lean();

    // Get flash sale info
    const productsWithFlashSale = await Product.getProductsWithFlashSale(
      { _id: { $in: products.map(p => p._id) } },
      {}
    );

    // Sort to prioritize flash sale items
    productsWithFlashSale.sort((a, b) => {
      // Flash sale products first
      if (a.isFlashSale && !b.isFlashSale) return -1;
      if (!a.isFlashSale && b.isFlashSale) return 1;
      
      // Then by trending score
      const scoreA = (a.viewCount || 0) + (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const scoreB = (b.viewCount || 0) + (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return scoreB - scoreA;
    });
    
    res.json(productsWithFlashSale.slice(0, 8));
  } catch (error) {
    console.error('Error fetching trending products:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get trending products (alternative endpoint for compatibility)
router.get('/trending/now', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    // Get products that are trending
    const trendingProducts = await Product.find({})
      .sort({ viewCount: -1, totalOrders: -1 })
      .limit(limit * 2) // Get more to filter
      .lean();

    // Get flash sale info
    const productsWithFlashSale = await Product.getProductsWithFlashSale(
      { _id: { $in: trendingProducts.map(p => p._id) } },
      {}
    );

    // Sort to prioritize flash sale items
    productsWithFlashSale.sort((a, b) => {
      // Flash sale products first
      if (a.isFlashSale && !b.isFlashSale) return -1;
      if (!a.isFlashSale && b.isFlashSale) return 1;
      
      // Then by trending score
      const scoreA = (a.viewCount || 0) + (a.totalOrders || 0) * 10;
      const scoreB = (b.viewCount || 0) + (b.totalOrders || 0) * 10;
      return scoreB - scoreA;
    });

    res.json(productsWithFlashSale.slice(0, limit));
  } catch (error) {
    console.error('Error fetching trending products:', error);
    res.status(500).json({ message: 'Error fetching trending products' });
  }
});

// Get new arrivals with flash sale
router.get('/filter/new-arrivals', async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    // Get flash sale info
    const productsWithFlashSale = await Product.getProductsWithFlashSale(
      { _id: { $in: products.map(p => p._id) } },
      {}
    );
    
    res.json(productsWithFlashSale);
  } catch (error) {
    console.error('Error fetching new arrivals:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get products by category with flash sale
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 20, page = 1 } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const products = await Product.find({ category })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Get flash sale info
    const productsWithFlashSale = await Product.getProductsWithFlashSale(
      { _id: { $in: products.map(p => p._id) } },
      {}
    );

    res.json(productsWithFlashSale);
  } catch (error) {
    console.error('Error fetching category products:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
});

// Get single product with flash sale info
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Track view if user is logged in (get user from auth header if available)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key123456');
        
        if (decoded && decoded.id) {
          // Update product view count
          await Product.findByIdAndUpdate(req.params.id, {
            $inc: { viewCount: 1 }
          });

          // Track in user's view history
          const user = await User.findById(decoded.id);
          
          if (user) {
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
        }
      } catch (error) {
        // Silent fail - view tracking is not critical
        console.log('View tracking failed:', error.message);
      }
    }

    // Get product with flash sale info
    const productWithFlashSale = await product.getWithFlashSale();

    res.json(productWithFlashSale);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get related products with flash sale info
router.get('/:id/related', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Find related products
    const relatedProducts = await Product.find({
      _id: { $ne: product._id },
      $or: [
        { category: product.category },
        { brand: product.brand },
        { tags: { $in: product.tags } }
      ]
    })
    .limit(8)
    .lean();

    // Get flash sale info
    const productsWithFlashSale = await Product.getProductsWithFlashSale(
      { _id: { $in: relatedProducts.map(p => p._id) } },
      {}
    );

    res.json(productsWithFlashSale);
  } catch (error) {
    console.error('Error fetching related products:', error);
    res.status(500).json({ message: 'Error fetching related products' });
  }
});

// Get product price (considering flash sale)
router.get('/:id/price', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const priceInfo = await product.getEffectivePrice();
    
    res.json(priceInfo);
  } catch (error) {
    console.error('Error fetching product price:', error);
    res.status(500).json({ message: 'Error fetching price' });
  }
});

// ==================== PROTECTED ROUTES (ADMIN) ====================

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

    // Check if product is in any active flash sale
    const flashSales = await FlashSale.find({
      'products.product': req.params.id,
      isActive: true
    });
    
    if (flashSales.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete product that is in active flash sale' 
      });
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



// backend/routes/products.js - Thêm endpoint này
router.post('/batch-with-flash-sale', async (req, res) => {
  try {
    const { productIds } = req.body;
    
    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({ message: 'Invalid product IDs' });
    }
    
    // Get products with flash sale info
    const products = await Product.getProductsWithFlashSale(
      { _id: { $in: productIds } },
      {}
    );
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products with flash sale:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
});
module.exports = router;
