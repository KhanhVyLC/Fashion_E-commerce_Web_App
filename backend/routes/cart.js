// backend/routes/cart.js
const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

// Get user cart
router.get('/', protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add to cart with stock validation
router.post('/add', protect, async (req, res) => {
  try {
    const { productId, quantity, size, color } = req.body;
    
    // Get product and check stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
    }
    
    // Find stock for specific size and color
    const stockItem = product.stock.find(
      item => item.size === size && item.color === color
    );
    
    if (!stockItem || stockItem.quantity === 0) {
      return res.status(400).json({ 
        message: 'Sản phẩm này hiện đã hết hàng',
        available: false 
      });
    }
    
    // Get or create cart
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    // Check if item already exists in cart
    const existingItem = cart.items.find(
      item => item.product.toString() === productId && 
      item.size === size && 
      item.color === color
    );

    if (existingItem) {
      // Check if total quantity doesn't exceed stock
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > stockItem.quantity) {
        return res.status(400).json({ 
          message: `Chỉ còn ${stockItem.quantity} sản phẩm trong kho. Bạn đã có ${existingItem.quantity} trong giỏ hàng.`,
          available: stockItem.quantity,
          inCart: existingItem.quantity
        });
      }
      existingItem.quantity = newQuantity;
      existingItem.price = product.price; // Update price in case it changed
    } else {
      // Check if requested quantity is available
      if (quantity > stockItem.quantity) {
        return res.status(400).json({ 
          message: `Chỉ còn ${stockItem.quantity} sản phẩm trong kho`,
          available: stockItem.quantity 
        });
      }
      
      cart.items.push({
        product: productId,
        quantity,
        size,
        color,
        price: product.price
      });
    }

    // Calculate total price
    cart.totalPrice = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);

    await cart.save();
    await cart.populate('items.product');
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update cart item with stock validation
router.put('/update/:itemId', protect, async (req, res) => {
  try {
    const { quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    
    const item = cart.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Sản phẩm không có trong giỏ hàng' });
    }
    
    // Check stock availability
    const product = await Product.findById(item.product._id);
    const stockItem = product.stock.find(
      s => s.size === item.size && s.color === item.color
    );
    
    if (!stockItem || quantity > stockItem.quantity) {
      return res.status(400).json({ 
        message: `Chỉ còn ${stockItem ? stockItem.quantity : 0} sản phẩm trong kho`,
        available: stockItem ? stockItem.quantity : 0
      });
    }
    
    item.quantity = quantity;
    
    // Recalculate total price
    cart.totalPrice = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
    
    await cart.save();
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove from cart
router.delete('/remove/:itemId', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    cart.items = cart.items.filter(item => item._id.toString() !== req.params.itemId);
    
    // Recalculate total price
    cart.totalPrice = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
    
    await cart.save();
    await cart.populate('items.product');
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Check cart items availability
router.get('/check-availability', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.json({ available: true, unavailableItems: [] });
    }
    
    const unavailableItems = [];
    
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id);
      const stockItem = product.stock.find(
        s => s.size === item.size && s.color === item.color
      );
      
      if (!stockItem || stockItem.quantity < item.quantity) {
        unavailableItems.push({
          itemId: item._id,
          productName: product.name,
          requestedQuantity: item.quantity,
          availableQuantity: stockItem ? stockItem.quantity : 0,
          size: item.size,
          color: item.color
        });
      }
    }
    
    res.json({
      available: unavailableItems.length === 0,
      unavailableItems
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
