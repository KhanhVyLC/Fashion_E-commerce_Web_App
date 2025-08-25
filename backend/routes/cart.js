// backend/routes/cart.js
const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const FlashSale = require('../models/FlashSale');
const { protect } = require('../middleware/auth');

// All cart routes require authentication
router.use(protect);

// Get cart
router.get('/', async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product')
      .populate('items.flashSaleId');

    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
      await cart.save();
    }

    // Validate flash sale items and update prices
    await cart.validateFlashSaleItems();
    
    // Get formatted cart with all details
    const formattedCart = await cart.getFormattedCart();
    
    res.json(formattedCart);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ message: 'Error fetching cart' });
  }
});

// Add to cart with flash sale check
router.post('/add', async (req, res) => {
  try {
    const { productId, quantity, size, color } = req.body;
    
    // Validate product exists and has stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check stock
    const stockItem = product.stock.find(s => s.size === size && s.color === color);
    if (!stockItem || stockItem.quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }
    
    // Find or create cart
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }
    
    // Add item with flash sale check
    await cart.addItemWithFlashSale(productId, quantity, size, color);
    
    // Get formatted response
    const formattedCart = await cart.getFormattedCart();
    
    res.json({
      message: 'Product added to cart',
      cart: formattedCart
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ message: error.message || 'Error adding to cart' });
  }
});

// Update cart item quantity
router.put('/update/:itemId', async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }
    
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    const item = cart.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }
    
    // Check stock for new quantity
    const product = await Product.findById(item.product);
    const stockItem = product.stock.find(s => 
      s.size === item.size && s.color === item.color
    );
    
    if (!stockItem || stockItem.quantity < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }
    
    // Check flash sale quantity limit if applicable
    if (item.isFlashSaleItem && item.flashSaleId) {
      const flashSale = await FlashSale.findById(item.flashSaleId);
      if (flashSale) {
        const flashProduct = flashSale.products.find(p => 
          p.product.toString() === item.product.toString()
        );
        
        if (flashProduct) {
          const availableFlashQuantity = flashProduct.maxQuantity - flashProduct.soldQuantity;
          if (quantity > availableFlashQuantity) {
            return res.status(400).json({ 
              message: `Flash sale limit: only ${availableFlashQuantity} items available` 
            });
          }
        }
      }
    }
    
    item.quantity = quantity;
    cart.calculateTotals();
    await cart.save();
    
    // Validate flash sales and get formatted cart
    await cart.validateFlashSaleItems();
    const formattedCart = await cart.getFormattedCart();
    
    res.json({
      message: 'Cart updated',
      cart: formattedCart
    });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ message: 'Error updating cart' });
  }
});

// Remove item from cart
router.delete('/remove/:itemId', async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    cart.items = cart.items.filter(item => 
      item._id.toString() !== req.params.itemId
    );
    
    cart.calculateTotals();
    await cart.save();
    
    const formattedCart = await cart.getFormattedCart();
    
    res.json({
      message: 'Item removed from cart',
      cart: formattedCart
    });
  } catch (error) {
    console.error('Error removing item:', error);
    res.status(500).json({ message: 'Error removing item' });
  }
});

// Clear cart
router.delete('/clear', async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    cart.items = [];
    cart.totalPrice = 0;
    cart.totalDiscount = 0;
    await cart.save();
    
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ message: 'Error clearing cart' });
  }
});

// Check availability before checkout
router.get('/check-availability', async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      return res.json({ available: true, items: [] });
    }
    
    // Validate flash sales first
    await cart.validateFlashSaleItems();
    
    const unavailableItems = [];
    const updatedItems = [];
    
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      const stockItem = product.stock.find(s => 
        s.size === item.size && s.color === item.color
      );
      
      if (!stockItem || stockItem.quantity === 0) {
        unavailableItems.push({
          product: product.name,
          reason: 'Out of stock'
        });
      } else if (stockItem.quantity < item.quantity) {
        updatedItems.push({
          product: product.name,
          available: stockItem.quantity,
          requested: item.quantity
        });
        
        // Update quantity to available stock
        item.quantity = stockItem.quantity;
      }
      
      // Check flash sale availability
      if (item.isFlashSaleItem && item.flashSaleId) {
        const flashSale = await FlashSale.findById(item.flashSaleId);
        if (flashSale) {
          const flashProduct = flashSale.products.find(p => 
            p.product.toString() === item.product._id.toString()
          );
          
          if (flashProduct) {
            const availableFlashQuantity = flashProduct.maxQuantity - flashProduct.soldQuantity;
            if (availableFlashQuantity === 0) {
              unavailableItems.push({
                product: product.name,
                reason: 'Flash sale sold out'
              });
            } else if (item.quantity > availableFlashQuantity) {
              item.quantity = availableFlashQuantity;
              updatedItems.push({
                product: product.name,
                available: availableFlashQuantity,
                requested: item.quantity,
                reason: 'Flash sale limit'
              });
            }
          }
        }
      }
    }
    
    // Remove unavailable items
    if (unavailableItems.length > 0) {
      cart.items = cart.items.filter(item => 
        !unavailableItems.some(u => u.product === item.product.name)
      );
    }
    
    if (unavailableItems.length > 0 || updatedItems.length > 0) {
      cart.calculateTotals();
      await cart.save();
    }
    
    res.json({
      available: unavailableItems.length === 0,
      unavailableItems,
      updatedItems,
      cart: await cart.getFormattedCart()
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ message: 'Error checking availability' });
  }
});

// Get cart summary for checkout
router.get('/summary', async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }
    
    // Validate flash sales
    await cart.validateFlashSaleItems();
    
    const summary = {
      items: cart.items.map(item => ({
        product: {
          _id: item.product._id,
          name: item.product.name,
          image: item.product.images[0]
        },
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        price: item.price,
        originalPrice: item.originalPrice,
        isFlashSale: item.isFlashSaleItem,
        flashSaleInfo: item.flashSaleSnapshot,
        subtotal: item.price * item.quantity
      })),
      subtotal: cart.totalPrice,
      flashSaleDiscount: cart.totalDiscount,
      shipping: 0, // Free shipping
      total: cart.totalPrice
    };
    
    res.json(summary);
  } catch (error) {
    console.error('Error getting cart summary:', error);
    res.status(500).json({ message: 'Error getting cart summary' });
  }
});

module.exports = router;
