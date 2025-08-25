// backend/routes/admin/products.js - Complete Version with Import/Export CSV
const express = require('express');
const router = express.Router();
const Product = require('../../models/Product');
const Order = require('../../models/Order');
const { protectAdmin } = require('../../middleware/adminAuth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const csv = require('csv-parser');

// Use combined middleware for better performance
router.use(protectAdmin);

// Configure multer for image upload with optimization
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/products');
    const thumbnailPath = path.join(__dirname, '../../uploads/products/thumbnails');
    const secondaryPath = path.join(__dirname, '../../uploads/products/secondary');
    
    // Create directories if they don't exist
    [uploadPath, thumbnailPath, secondaryPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    // Determine destination based on field name
    if (file.fieldname === 'secondaryImages') {
      cb(null, path.join(__dirname, '../../uploads/products/secondary'));
    } else {
      cb(null, uploadPath);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const prefix = file.fieldname === 'secondaryImages' ? 'secondary-' : 'product-';
    cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Combined upload middleware for both primary and secondary images
const uploadImages = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'secondaryImages', maxCount: 20 }
]);

// Get all products with advanced filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      subcategory,
      brand,
      minPrice,
      maxPrice,
      minStock,
      inStock,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (brand) query.brand = brand;
    
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    
    // Stock filter
    if (inStock === 'true') {
      query['stock.quantity'] = { $gt: 0 };
    } else if (inStock === 'false') {
      query['stock.quantity'] = { $lte: 0 };
    }
    
    if (minStock) {
      query['stock.quantity'] = { $gte: Number(minStock) };
    }

    // Build sort
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const total = await Product.countDocuments(query);
    
    const products = await Product.find(query)
      .sort(sortObj)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    // Add stock status for each product
    const productsWithStock = products.map(product => {
      const totalStock = product.stock.reduce((sum, item) => sum + item.quantity, 0);
      const lowStock = totalStock > 0 && totalStock < 10;
      const outOfStock = totalStock === 0;
      
      return {
        ...product,
        totalStock,
        stockStatus: outOfStock ? 'out' : lowStock ? 'low' : 'normal',
        hasVariants: product.stock.length > 1
      };
    });

    res.json({
      products: productsWithStock,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      hasMore: Number(page) < Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new product with image optimization
router.post('/', uploadImages, async (req, res) => {
  try {
    const images = [];
    const secondaryImages = [];
    
    // Process primary images
    if (req.files && req.files['images']) {
      for (const file of req.files['images']) {
        const imagePath = `/uploads/products/${file.filename}`;
        const thumbnailPath = `/uploads/products/thumbnails/thumb-${file.filename}`;
        
        // Create thumbnail
        try {
          await sharp(file.path)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toFile(path.join(__dirname, '../../uploads/products/thumbnails', `thumb-${file.filename}`));
        } catch (err) {
          console.error('Error creating thumbnail:', err);
        }
        
        images.push(imagePath);
      }
    }
    
    // Process secondary images
    if (req.files && req.files['secondaryImages']) {
      const secondaryImageData = JSON.parse(req.body.secondaryImageData || '[]');
      
      for (let i = 0; i < req.files['secondaryImages'].length; i++) {
        const file = req.files['secondaryImages'][i];
        const imagePath = `/uploads/products/secondary/${file.filename}`;
        
        // Create optimized version for secondary images
        try {
          await sharp(file.path)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toFile(path.join(__dirname, '../../uploads/products/secondary', `opt-${file.filename}`));
        } catch (err) {
          console.error('Error optimizing secondary image:', err);
        }
        
        const imageData = secondaryImageData[i] || {};
        secondaryImages.push({
          url: imagePath,
          type: imageData.type || 'detail',
          caption: imageData.caption || '',
          order: imageData.order || i
        });
      }
    }
    
    // Parse JSON fields
    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: Number(req.body.price),
      category: req.body.category,
      subcategory: req.body.subcategory,
      brand: req.body.brand,
      images: images,
      secondaryImages: secondaryImages,
      sizes: JSON.parse(req.body.sizes || '[]'),
      colors: JSON.parse(req.body.colors || '[]'),
      stock: JSON.parse(req.body.stock || '[]'),
      tags: JSON.parse(req.body.tags || '[]')
    };

    // Validate stock entries
    if (productData.stock.length === 0 && productData.sizes.length > 0 && productData.colors.length > 0) {
      // Auto-generate stock entries
      productData.stock = [];
      for (const size of productData.sizes) {
        for (const color of productData.colors) {
          productData.stock.push({
            size,
            color,
            quantity: 0
          });
        }
      }
    }

    const product = new Product(productData);
    await product.save();
    
    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      ['images', 'secondaryImages'].forEach(fieldName => {
        if (req.files[fieldName]) {
          req.files[fieldName].forEach(file => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });
        }
      });
    }
    
    res.status(500).json({ message: error.message });
  }
});

// Update product with stock management - FIXED IMAGE HANDLING
router.put('/:id', uploadImages, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Handle primary image updates
    let updatedImages = [...product.images];
    
    // Parse existing images from request body
    if (req.body.existingImages) {
      try {
        const keepImages = JSON.parse(req.body.existingImages);
        
        // Delete images that are no longer needed
        const imagesToDelete = updatedImages.filter(img => !keepImages.includes(img));
        
        imagesToDelete.forEach(imagePath => {
          const fullPath = path.join(__dirname, '../..', imagePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log('Deleted image:', fullPath);
          }
          
          // Delete thumbnail too
          const filename = path.basename(imagePath);
          const thumbPath = path.join(__dirname, '../../uploads/products/thumbnails', `thumb-${filename}`);
          if (fs.existsSync(thumbPath)) {
            fs.unlinkSync(thumbPath);
            console.log('Deleted thumbnail:', thumbPath);
          }
        });
        
        // Update the images array to only keep the ones not deleted
        updatedImages = keepImages;
      } catch (err) {
        console.error('Error parsing existingImages:', err);
      }
    } else {
      // If no existing images specified, clear all
      updatedImages.forEach(imagePath => {
        const fullPath = path.join(__dirname, '../..', imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        
        // Delete thumbnail
        const filename = path.basename(imagePath);
        const thumbPath = path.join(__dirname, '../../uploads/products/thumbnails', `thumb-${filename}`);
        if (fs.existsSync(thumbPath)) {
          fs.unlinkSync(thumbPath);
        }
      });
      updatedImages = [];
    }
    
    // Add new primary images
    if (req.files && req.files['images']) {
      for (const file of req.files['images']) {
        const imagePath = `/uploads/products/${file.filename}`;
        
        // Create thumbnail
        try {
          await sharp(file.path)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toFile(path.join(__dirname, '../../uploads/products/thumbnails', `thumb-${file.filename}`));
          console.log('Created thumbnail for:', file.filename);
        } catch (err) {
          console.error('Error creating thumbnail:', err);
        }
        
        updatedImages.push(imagePath);
        console.log('Added new image:', imagePath);
      }
    }
    
    // Handle secondary images
    let updatedSecondaryImages = product.secondaryImages || [];
    
    // Remove deleted secondary images
    if (req.body.deletedSecondaryImages) {
      try {
        const deletedSecondaryImages = JSON.parse(req.body.deletedSecondaryImages);
        deletedSecondaryImages.forEach(imageId => {
          const image = updatedSecondaryImages.find(img => img._id.toString() === imageId);
          if (image) {
            const fullPath = path.join(__dirname, '../..', image.url);
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
            }
          }
        });
        updatedSecondaryImages = updatedSecondaryImages.filter(img => 
          !deletedSecondaryImages.includes(img._id.toString())
        );
      } catch (err) {
        console.error('Error parsing deletedSecondaryImages:', err);
      }
    }
    
    // Update existing secondary images data
    if (req.body.updatedSecondaryImages) {
      try {
        const updates = JSON.parse(req.body.updatedSecondaryImages);
        updatedSecondaryImages = updatedSecondaryImages.map(img => {
          const update = updates.find(u => u._id === img._id.toString());
          if (update) {
            return {
              ...img.toObject(),
              type: update.type || img.type,
              caption: update.caption !== undefined ? update.caption : img.caption,
              order: update.order !== undefined ? update.order : img.order
            };
          }
          return img;
        });
      } catch (err) {
        console.error('Error parsing updatedSecondaryImages:', err);
      }
    }
    
    // Add new secondary images
    if (req.files && req.files['secondaryImages']) {
      const newSecondaryImageData = JSON.parse(req.body.newSecondaryImageData || '[]');
      
      for (let i = 0; i < req.files['secondaryImages'].length; i++) {
        const file = req.files['secondaryImages'][i];
        const imagePath = `/uploads/products/secondary/${file.filename}`;
        
        const imageData = newSecondaryImageData[i] || {};
        updatedSecondaryImages.push({
          url: imagePath,
          type: imageData.type || 'detail',
          caption: imageData.caption || '',
          order: imageData.order || updatedSecondaryImages.length
        });
      }
    }

    // Parse and update fields
    const updateData = {
      name: req.body.name || product.name,
      description: req.body.description || product.description,
      price: req.body.price ? Number(req.body.price) : product.price,
      category: req.body.category || product.category,
      subcategory: req.body.subcategory || product.subcategory,
      brand: req.body.brand || product.brand,
      images: updatedImages,
      secondaryImages: updatedSecondaryImages,
      sizes: req.body.sizes ? JSON.parse(req.body.sizes) : product.sizes,
      colors: req.body.colors ? JSON.parse(req.body.colors) : product.colors,
      stock: req.body.stock ? JSON.parse(req.body.stock) : product.stock,
      tags: req.body.tags ? JSON.parse(req.body.tags) : product.tags
    };

    // Log the update for debugging
    console.log('Updating product with images:', updateData.images);

    Object.assign(product, updateData);
    await product.save();
    
    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    
    // Clean up any newly uploaded files on error
    if (req.files) {
      ['images', 'secondaryImages'].forEach(fieldName => {
        if (req.files[fieldName]) {
          req.files[fieldName].forEach(file => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });
        }
      });
    }
    
    res.status(500).json({ message: error.message });
  }
});

// Bulk update products
router.patch('/bulk-update', async (req, res) => {
  try {
    const { productIds, updates } = req.body;
    
    if (!productIds || !Array.isArray(productIds)) {
      return res.status(400).json({ message: 'Invalid product IDs' });
    }
    
    const results = [];
    const errors = [];
    
    for (const productId of productIds) {
      try {
        const product = await Product.findByIdAndUpdate(
          productId,
          updates,
          { new: true, runValidators: true }
        );
        
        if (product) {
          results.push({ productId, success: true });
        } else {
          errors.push({ productId, error: 'Product not found' });
        }
      } catch (error) {
        errors.push({ productId, error: error.message });
      }
    }
    
    res.json({
      message: `Updated ${results.length} products, ${errors.length} errors`,
      results,
      errors
    });
  } catch (error) {
    console.error('Error bulk updating products:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update stock levels
router.patch('/:id/stock', async (req, res) => {
  try {
    const { stockUpdates } = req.body;
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Update stock levels
    for (const update of stockUpdates) {
      const stockIndex = product.stock.findIndex(
        s => s.size === update.size && s.color === update.color
      );
      
      if (stockIndex !== -1) {
        product.stock[stockIndex].quantity = update.quantity;
      } else {
        // Add new stock variant
        product.stock.push({
          size: update.size,
          color: update.color,
          quantity: update.quantity
        });
      }
    }
    
    await product.save();
    
    res.json({
      message: 'Stock updated successfully',
      stock: product.stock
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete product with cleanup
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if product has pending orders
    const pendingOrders = await Order.countDocuments({
      'items.product': req.params.id,
      orderStatus: { $in: ['pending', 'processing', 'shipped'] }
    });
    
    if (pendingOrders > 0) {
      return res.status(400).json({ 
        message: `Cannot delete product with ${pendingOrders} pending orders` 
      });
    }

    // Delete primary images from filesystem
    product.images.forEach(imagePath => {
      const fullPath = path.join(__dirname, '../..', imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      // Delete thumbnail
      const filename = path.basename(imagePath);
      const thumbPath = path.join(__dirname, '../../uploads/products/thumbnails', `thumb-${filename}`);
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    });
    
    // Delete secondary images from filesystem
    if (product.secondaryImages && product.secondaryImages.length > 0) {
      product.secondaryImages.forEach(image => {
        const fullPath = path.join(__dirname, '../..', image.url);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      });
    }

    await product.deleteOne();
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get product statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await Product.aggregate([
      {
        $facet: {
          totalProducts: [{ $count: 'count' }],
          byCategory: [
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          byBrand: [
            { $group: { _id: '$brand', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ],
          priceRange: [
            {
              $group: {
                _id: null,
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' },
                avgPrice: { $avg: '$price' }
              }
            }
          ],
          stockStatus: [
            {
              $project: {
                totalStock: { $sum: '$stock.quantity' }
              }
            },
            {
              $group: {
                _id: null,
                outOfStock: {
                  $sum: { $cond: [{ $eq: ['$totalStock', 0] }, 1, 0] }
                },
                lowStock: {
                  $sum: { 
                    $cond: [
                      { $and: [
                        { $gt: ['$totalStock', 0] },
                        { $lt: ['$totalStock', 10] }
                      ]}, 
                      1, 
                      0
                    ] 
                  }
                },
                inStock: {
                  $sum: { $cond: [{ $gte: ['$totalStock', 10] }, 1, 0] }
                }
              }
            }
          ],
          topSelling: [
            { $sort: { totalOrders: -1 } },
            { $limit: 5 },
            {
              $project: {
                name: 1,
                images: 1,
                totalOrders: 1,
                revenue: { $multiply: ['$price', '$totalOrders'] }
              }
            }
          ],
          topViewed: [
            { $sort: { viewCount: -1 } },
            { $limit: 5 },
            {
              $project: {
                name: 1,
                images: 1,
                viewCount: 1
              }
            }
          ]
        }
      }
    ]);
    
    // Format response
    const result = stats[0];
    res.json({
      totalProducts: result.totalProducts[0]?.count || 0,
      byCategory: result.byCategory,
      byBrand: result.byBrand,
      priceRange: result.priceRange[0] || {},
      stockStatus: result.stockStatus[0] || {},
      topSelling: result.topSelling,
      topViewed: result.topViewed
    });
  } catch (error) {
    console.error('Error fetching product stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get low stock alerts
router.get('/alerts/low-stock', async (req, res) => {
  try {
    const { threshold = 10 } = req.query;
    
    const products = await Product.aggregate([
      {
        $project: {
          name: 1,
          images: 1,
          category: 1,
          brand: 1,
          totalStock: { $sum: '$stock.quantity' },
          variants: {
            $filter: {
              input: '$stock',
              as: 'item',
              cond: { $lt: ['$item.quantity', Number(threshold)] }
            }
          }
        }
      },
      {
        $match: {
          $or: [
            { totalStock: { $lt: Number(threshold) } },
            { 'variants.0': { $exists: true } }
          ]
        }
      },
      { $sort: { totalStock: 1 } }
    ]);
    
    res.json({
      threshold,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Error fetching low stock alerts:', error);
    res.status(500).json({ message: error.message });
  }
});

// Import products from CSV
router.post('/import/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const results = [];
    const imported = [];
    const errors = [];
    
    // Parse CSV file
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        for (const row of results) {
          try {
            const product = new Product({
              name: row.name,
              description: row.description,
              price: Number(row.price),
              category: row.category,
              subcategory: row.subcategory,
              brand: row.brand,
              sizes: row.sizes ? row.sizes.split(',').map(s => s.trim()) : [],
              colors: row.colors ? row.colors.split(',').map(c => c.trim()) : [],
              stock: row.stock ? JSON.parse(row.stock) : [],
              tags: row.tags ? row.tags.split(',').map(t => t.trim()) : []
            });
            
            await product.save();
            imported.push(product._id);
          } catch (error) {
            errors.push({ row: row.name, error: error.message });
          }
        }
        
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        res.json({
          message: `Imported ${imported.length} products`,
          imported: imported.length,
          errors: errors.length,
          errorDetails: errors
        });
      });
  } catch (error) {
    console.error('Error importing products:', error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: error.message });
  }
});

// Export products to CSV
router.get('/export/csv', async (req, res) => {
  try {
    const products = await Product.find().lean();
    
    if (products.length === 0) {
      return res.status(404).json({ message: 'No products to export' });
    }
    
    const csvData = products.map(p => ({
      id: p._id,
      name: p.name,
      description: p.description,
      price: p.price,
      category: p.category || '',
      subcategory: p.subcategory || '',
      brand: p.brand || '',
      sizes: (p.sizes || []).join(','),
      colors: (p.colors || []).join(','),
      totalStock: (p.stock || []).reduce((sum, s) => sum + (s.quantity || 0), 0),
      rating: p.rating || 0,
      totalOrders: p.totalOrders || 0,
      createdAt: p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : ''
    }));
    
    // Convert to CSV format with proper escaping
    const headers = Object.keys(csvData[0]);
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    csvData.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma or quotes
        const escaped = String(value).replace(/"/g, '""');
        return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
      });
      csvRows.push(values.join(','));
    });
    
    const csv = csvRows.join('\n');
    
    // Add BOM for UTF-8 Excel compatibility
    const BOM = '\uFEFF';
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=products.csv');
    res.send(BOM + csv);
  } catch (error) {
    console.error('Error exporting products:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all unique categories and subcategories
router.get('/categories', async (req, res) => {
  try {
    // Get all unique categories and subcategories
    const categories = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          subcategories: { $addToSet: '$subcategory' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          category: '$_id',
          subcategories: {
            $filter: {
              input: '$subcategories',
              as: 'subcat',
              cond: { $ne: ['$subcat', null] }
            }
          },
          count: 1,
          _id: 0
        }
      },
      { $sort: { category: 1 } }
    ]);

    // Get all brands
    const brands = await Product.distinct('brand').sort();

    res.json({
      categories,
      brands: brands.filter(b => b) // Remove null/undefined
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
