// backend/routes/admin/flashSales.js - Enhanced with Stock Validation
const express = require('express');
const router = express.Router();
const FlashSale = require('../../models/FlashSale');
const Product = require('../../models/Product');

// Auth middleware (keep existing implementation)
const adminAuth = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (req.user.role !== 'admin' && req.user.email !== 'admin@gmail.com') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

const protect = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }
    
    const jwt = require('jsonwebtoken');
    const User = require('../../models/User');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.id || decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ message: 'Not authorized' });
  }
};

// Helper function to calculate total stock for a product
const calculateTotalStock = (product) => {
  if (!product.stock || product.stock.length === 0) {
    return 0;
  }
  return product.stock.reduce((total, item) => total + (item.quantity || 0), 0);
};

// Helper function to get available stock considering existing flash sales
const getAvailableStockForFlashSale = async (productId, excludeSaleId = null) => {
  const product = await Product.findById(productId);
  if (!product) return 0;
  
  const totalStock = calculateTotalStock(product);
  
  // Find all active/upcoming flash sales that include this product
  const now = new Date();
  const query = {
    'products.product': productId,
    endDate: { $gte: now },
    isActive: true
  };
  
  if (excludeSaleId) {
    query._id = { $ne: excludeSaleId };
  }
  
  const existingFlashSales = await FlashSale.find(query);
  
  // Calculate total quantity already allocated to other flash sales
  let allocatedQuantity = 0;
  existingFlashSales.forEach(sale => {
    const productInSale = sale.products.find(p => 
      p.product.toString() === productId.toString()
    );
    if (productInSale) {
      // Subtract sold quantity since it's already deducted from stock
      allocatedQuantity += (productInSale.maxQuantity - productInSale.soldQuantity);
    }
  });
  
  return Math.max(0, totalStock - allocatedQuantity);
};

// GET /admin/flash-sales/products-with-stock
// Get all products with available stock info for flash sale
router.get('/products-with-stock', protect, adminAuth, async (req, res) => {
  try {
    const { excludeSaleId } = req.query;
    
    const products = await Product.find({});
    
    const productsWithStock = await Promise.all(products.map(async (product) => {
      const totalStock = calculateTotalStock(product);
      const availableForFlashSale = await getAvailableStockForFlashSale(
        product._id.toString(), 
        excludeSaleId
      );
      
      return {
        _id: product._id,
        name: product.name,
        price: product.price,
        images: product.images,
        category: product.category,
        brand: product.brand,
        totalStock,
        availableForFlashSale,
        stock: product.stock // Include detailed stock info
      };
    }));
    
    // Filter out products with no available stock
    const availableProducts = productsWithStock.filter(p => p.availableForFlashSale > 0);
    
    res.json({
      products: availableProducts,
      total: availableProducts.length
    });
  } catch (error) {
    console.error('Error fetching products with stock:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
});

// Validate flash sale products before creation/update
const validateFlashSaleProducts = async (products, excludeSaleId = null) => {
  const errors = [];
  const validatedProducts = [];
  
  for (const productData of products) {
    const product = await Product.findById(productData.productId);
    
    if (!product) {
      errors.push(`Product ${productData.productId} not found`);
      continue;
    }
    
    const availableStock = await getAvailableStockForFlashSale(
      productData.productId,
      excludeSaleId
    );
    
    if (productData.maxQuantity > availableStock) {
      errors.push(
        `Product "${product.name}" requested quantity (${productData.maxQuantity}) ` +
        `exceeds available stock (${availableStock})`
      );
      continue;
    }
    
    validatedProducts.push({
      product: productData.productId,
      originalPrice: product.price,
      discountPercentage: productData.discountPercentage,
      discountPrice: Math.round(product.price * (1 - productData.discountPercentage / 100)),
      maxQuantity: productData.maxQuantity,
      soldQuantity: productData.soldQuantity || 0,
      isActive: productData.isActive !== false
    });
  }
  
  return { validatedProducts, errors };
};

// GET all flash sales (existing endpoint with enhancement)
router.get('/', protect, adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    const now = new Date();
    
    if (status === 'active') {
      query = {
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
      };
    } else if (status === 'upcoming') {
      query = {
        isActive: true,
        startDate: { $gt: now }
      };
    } else if (status === 'ended') {
      query = {
        endDate: { $lt: now }
      };
    }
    
    const flashSales = await FlashSale.find(query)
      .populate('products.product', 'name images category price stock')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await FlashSale.countDocuments(query);
    
    // Add statistics and stock info
    const salesWithStats = flashSales.map(sale => {
      const saleObj = sale.toObject();
      
      const statistics = {
        totalProducts: saleObj.products?.length || 0,
        totalSold: saleObj.products?.reduce((sum, p) => sum + (p.soldQuantity || 0), 0) || 0,
        totalRevenue: saleObj.products?.reduce((sum, p) => sum + ((p.discountPrice || 0) * (p.soldQuantity || 0)), 0) || 0,
        averageDiscount: saleObj.products?.reduce((sum, p) => sum + (p.discountPercentage || 0), 0) / (saleObj.products?.length || 1) || 0,
        productsOutOfStock: saleObj.products?.filter(p => p.soldQuantity >= p.maxQuantity).length || 0
      };
      
      // Add stock availability info for each product
      saleObj.products = saleObj.products.map(p => ({
        ...p,
        currentStock: p.product ? calculateTotalStock(p.product) : 0,
        remainingInSale: p.maxQuantity - p.soldQuantity
      }));
      
      const now = new Date();
      const endDate = new Date(saleObj.endDate);
      const timeRemaining = Math.max(0, Math.floor((endDate - now) / 1000));
      
      return {
        ...saleObj,
        statistics,
        isCurrentlyActive: saleObj.isActive && new Date(saleObj.startDate) <= now && endDate >= now,
        timeRemaining
      };
    });
    
    res.json({
      flashSales: salesWithStats,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching flash sales:', error);
    res.status(500).json({ message: 'Error fetching flash sales' });
  }
});

// CREATE new flash sale with stock validation
router.post('/', protect, adminAuth, async (req, res) => {
  try {
    const {
      name,
      description,
      startDate,
      endDate,
      products,
      banner,
      priority,
      isActive
    } = req.body;
    
    // Validate dates
    if (new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({ 
        message: 'End date must be after start date' 
      });
    }
    
    // Validate products and stock
    const { validatedProducts, errors } = await validateFlashSaleProducts(products);
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        message: 'Stock validation failed',
        errors 
      });
    }
    
    if (validatedProducts.length === 0) {
      return res.status(400).json({ 
        message: 'No valid products for flash sale' 
      });
    }
    
    const flashSale = new FlashSale({
      name,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      products: validatedProducts,
      banner,
      priority: priority || 0,
      isActive: isActive !== false,
      createdBy: req.user._id
    });
    
    await flashSale.save();
    await flashSale.populate('products.product', 'name images category brand price');
    
    res.status(201).json({
      message: 'Flash sale created successfully',
      flashSale
    });
  } catch (error) {
    console.error('Error creating flash sale:', error);
    res.status(500).json({ message: error.message || 'Error creating flash sale' });
  }
});

// UPDATE flash sale with stock validation
router.put('/:id', protect, adminAuth, async (req, res) => {
  try {
    const flashSale = await FlashSale.findById(req.params.id);
    
    if (!flashSale) {
      return res.status(404).json({ message: 'Flash sale not found' });
    }
    
    // Update basic fields
    const allowedUpdates = [
      'name', 'description', 'startDate', 'endDate',
      'isActive', 'banner', 'priority'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        flashSale[field] = req.body[field];
      }
    });
    
    // Validate and update products if provided
    if (req.body.products) {
      // Keep track of already sold quantities
      const soldQuantities = {};
      flashSale.products.forEach(p => {
        soldQuantities[p.product.toString()] = p.soldQuantity;
      });
      
      const productsToValidate = req.body.products.map(p => ({
        ...p,
        soldQuantity: soldQuantities[p.productId] || 0
      }));
      
      const { validatedProducts, errors } = await validateFlashSaleProducts(
        productsToValidate, 
        req.params.id
      );
      
      if (errors.length > 0) {
        return res.status(400).json({ 
          message: 'Stock validation failed',
          errors 
        });
      }
      
      // Preserve sold quantities
      validatedProducts.forEach(p => {
        if (soldQuantities[p.product]) {
          p.soldQuantity = soldQuantities[p.product];
        }
      });
      
      flashSale.products = validatedProducts;
    }
    
    await flashSale.save();
    await flashSale.populate('products.product', 'name images category brand price stock');
    
    res.json({
      message: 'Flash sale updated successfully',
      flashSale
    });
  } catch (error) {
    console.error('Error updating flash sale:', error);
    res.status(500).json({ message: error.message || 'Error updating flash sale' });
  }
});

// CHECK stock availability for a product
router.get('/check-stock/:productId', protect, adminAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const { excludeSaleId, requestedQuantity = 0 } = req.query;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const totalStock = calculateTotalStock(product);
    const availableForFlashSale = await getAvailableStockForFlashSale(
      productId,
      excludeSaleId
    );
    
    res.json({
      product: {
        _id: product._id,
        name: product.name,
        price: product.price
      },
      totalStock,
      availableForFlashSale,
      canAddToFlashSale: availableForFlashSale >= requestedQuantity,
      stock: product.stock
    });
  } catch (error) {
    console.error('Error checking stock:', error);
    res.status(500).json({ message: 'Error checking stock' });
  }
});

// Other existing endpoints remain the same...
router.delete('/:id', protect, adminAuth, async (req, res) => {
  try {
    const flashSale = await FlashSale.findById(req.params.id);
    
    if (!flashSale) {
      return res.status(404).json({ message: 'Flash sale not found' });
    }
    
    const now = new Date();
    const isCurrentlyActive = flashSale.isActive && 
                             new Date(flashSale.startDate) <= now && 
                             new Date(flashSale.endDate) >= now;
    
    if (isCurrentlyActive) {
      const totalSold = flashSale.products.reduce((sum, p) => sum + (p.soldQuantity || 0), 0);
      if (totalSold > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete active flash sale with sold items' 
        });
      }
    }
    
    await flashSale.deleteOne();
    
    res.json({ message: 'Flash sale deleted successfully' });
  } catch (error) {
    console.error('Error deleting flash sale:', error);
    res.status(500).json({ message: 'Error deleting flash sale' });
  }
});

router.patch('/:id/toggle', protect, adminAuth, async (req, res) => {
  try {
    const flashSale = await FlashSale.findById(req.params.id);
    
    if (!flashSale) {
      return res.status(404).json({ message: 'Flash sale not found' });
    }
    
    flashSale.isActive = !flashSale.isActive;
    await flashSale.save();
    
    res.json({
      message: `Flash sale ${flashSale.isActive ? 'activated' : 'deactivated'}`,
      isActive: flashSale.isActive
    });
  } catch (error) {
    console.error('Error toggling flash sale:', error);
    res.status(500).json({ message: 'Error toggling flash sale' });
  }
});

router.get('/:id/statistics', protect, adminAuth, async (req, res) => {
  try {
    const flashSale = await FlashSale.findById(req.params.id)
      .populate('products.product', 'name images category stock');
    
    if (!flashSale) {
      return res.status(404).json({ message: 'Flash sale not found' });
    }
    
    const stats = {
      totalProducts: flashSale.products.length,
      totalSold: flashSale.products.reduce((sum, p) => sum + (p.soldQuantity || 0), 0),
      totalRevenue: flashSale.products.reduce((sum, p) => sum + ((p.discountPrice || 0) * (p.soldQuantity || 0)), 0),
      averageDiscount: flashSale.products.reduce((sum, p) => sum + (p.discountPercentage || 0), 0) / flashSale.products.length,
      productsOutOfStock: flashSale.products.filter(p => p.soldQuantity >= p.maxQuantity).length
    };
    
    const productStats = flashSale.products.map(p => ({
      product: p.product,
      soldQuantity: p.soldQuantity,
      maxQuantity: p.maxQuantity,
      currentStock: p.product ? calculateTotalStock(p.product) : 0,
      revenue: (p.discountPrice || 0) * (p.soldQuantity || 0),
      sellThroughRate: ((p.soldQuantity || 0) / (p.maxQuantity || 1)) * 100
    }));
    
    const now = new Date();
    const endDate = new Date(flashSale.endDate);
    const timeRemaining = Math.max(0, Math.floor((endDate - now) / 1000));
    
    res.json({
      overall: stats,
      products: productStats,
      isCurrentlyActive: flashSale.isActive && 
                        new Date(flashSale.startDate) <= now && 
                        endDate >= now,
      timeRemaining
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Error fetching statistics' });
  }
});

module.exports = router;