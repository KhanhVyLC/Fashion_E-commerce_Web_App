// backend/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  images: [String],
  category: { type: String, required: true },
  subcategory: String,
  brand: String,
  sizes: [String],
  colors: [String],
  stock: [{
    size: String,
    color: String,
    quantity: Number
  }],
  tags: [String],
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 }
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ price: 1 });
productSchema.index({ rating: -1 });

module.exports = mongoose.model('Product', productSchema);