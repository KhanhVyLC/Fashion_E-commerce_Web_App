// backend/routes/flashSales.js
const express = require('express');
const router = express.Router();
const FlashSale = require('../models/FlashSale');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

// Get all active flash sales with product price info
router.get('/active', async (req, res) => {
  try {
    const flashSales = await FlashSale.getActiveSales();
    
    // Format response with complete price information
    const formattedSales = flashSales.map(sale => ({
      _id: sale._id,
      name: sale.name,
      description: sale.description,
      endDate: sale.endDate,
      timeRemaining: sale.timeRemaining,
      banner: sale.banner,
      products: sale.products.map(p => ({
        _id: p.product._id,
        name: p.product.name,
        images: p.product.images,
        category: p.product.category,
        brand: p.product.brand,
        rating: p.product.rating,
        originalPrice: p.originalPrice,
        discountPrice: p.discountPrice,
        discountPercentage: p.discountPercentage,
        maxQuantity: p.maxQuantity,
        soldQuantity: p.soldQuantity,
        available: p.maxQuantity - p.soldQuantity,
        progressPercentage: (p.soldQuantity / p.maxQuantity) * 100,
        // Add flash sale info to product
        flashSale: {
          saleId: sale._id,
          saleName: sale.name,
          originalPrice: p.originalPrice,
          discountPrice: p.discountPrice,
          discountPercentage: p.discountPercentage,
          endDate: sale.endDate,
          available: p.maxQuantity - p.soldQuantity,
          soldQuantity: p.soldQuantity,
          maxQuantity: p.maxQuantity,
          timeRemaining: sale.timeRemaining
        }
      }))
    }));
    
    res.json(formattedSales);
  } catch (error) {
    console.error('Error fetching active flash sales:', error);
    res.status(500).json({ message: 'Error fetching flash sales' });
  }
});

// Get upcoming flash sales
router.get('/upcoming', async (req, res) => {
  try {
    const upcomingSales = await FlashSale.getUpcomingSales();
    res.json(upcomingSales);
  } catch (error) {
    console.error('Error fetching upcoming sales:', error);
    res.status(500).json({ message: 'Error fetching upcoming sales' });
  }
});

// Get flash sale by ID
router.get('/:id', async (req, res) => {
  try {
    const flashSale = await FlashSale.findById(req.params.id)
      .populate('products.product');
    
    if (!flashSale) {
      return res.status(404).json({ message: 'Flash sale not found' });
    }
    
    // Format with complete price info
    const formattedSale = {
      ...flashSale.toObject(),
      products: flashSale.products.map(p => ({
        ...p.toObject(),
        flashSale: {
          saleId: flashSale._id,
          saleName: flashSale.name,
          originalPrice: p.originalPrice,
          discountPrice: p.discountPrice,
          discountPercentage: p.discountPercentage,
          endDate: flashSale.endDate,
          available: p.maxQuantity - p.soldQuantity
        }
      }))
    };
    
    res.json(formattedSale);
  } catch (error) {
    console.error('Error fetching flash sale:', error);
    res.status(500).json({ message: 'Error fetching flash sale' });
  }
});

// Check if product is in any active flash sale
router.get('/product/:productId', async (req, res) => {
  try {
    const activeSales = await FlashSale.getActiveSales();
    
    for (const sale of activeSales) {
      const product = sale.products.find(p => 
        p.product._id.toString() === req.params.productId
      );
      
      if (product && product.isActive) {
        return res.json({
          inFlashSale: true,
          sale: {
            _id: sale._id,
            name: sale.name,
            endDate: sale.endDate,
            originalPrice: product.originalPrice,
            discountPrice: product.discountPrice,
            discountPercentage: product.discountPercentage,
            available: product.maxQuantity - product.soldQuantity,
            soldQuantity: product.soldQuantity,
            maxQuantity: product.maxQuantity,
            timeRemaining: sale.timeRemaining
          }
        });
      }
    }
    
    res.json({ inFlashSale: false });
  } catch (error) {
    console.error('Error checking product flash sale:', error);
    res.status(500).json({ message: 'Error checking flash sale' });
  }
});

// Get products with flash sale info for recommendations
router.get('/products/recommended', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    // Get all active flash sales
    const activeSales = await FlashSale.getActiveSales();
    
    // Extract all flash sale products
    const flashSaleProducts = [];
    const flashSaleMap = new Map();
    
    activeSales.forEach(sale => {
      sale.products.forEach(p => {
        if (p.isActive && p.soldQuantity < p.maxQuantity) {
          const productId = p.product._id.toString();
          flashSaleMap.set(productId, {
            saleId: sale._id,
            saleName: sale.name,
            originalPrice: p.originalPrice,
            discountPrice: p.discountPrice,
            discountPercentage: p.discountPercentage,
            endDate: sale.endDate,
            available: p.maxQuantity - p.soldQuantity,
            soldQuantity: p.soldQuantity,
            maxQuantity: p.maxQuantity,
            timeRemaining: sale.timeRemaining
          });
          
          flashSaleProducts.push({
            ...p.product.toObject(),
            flashSale: flashSaleMap.get(productId),
            isFlashSale: true,
            effectivePrice: p.discountPrice
          });
        }
      });
    });
    
    // Sort by discount percentage and limit
    flashSaleProducts.sort((a, b) => 
      (b.flashSale.discountPercentage - a.flashSale.discountPercentage)
    );
    
    res.json(flashSaleProducts.slice(0, limit));
  } catch (error) {
    console.error('Error fetching flash sale products:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
});

module.exports = router;