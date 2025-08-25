// backend/routes/admin/vouchers.js
const express = require('express');
const router = express.Router();
const Voucher = require('../../models/Voucher');
const { protect } = require('../../middleware/auth');
const { adminAuth } = require('../../middleware/adminAuth');

router.use(protect, adminAuth);

// Get all vouchers with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || ''; // active, expired, used

    const query = {};
    
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const now = new Date();
    
    if (status === 'active') {
      query.isActive = true;
      query.startDate = { $lte: now };
      query.endDate = { $gte: now };
      query.$expr = { $gt: ['$quantity', '$usedCount'] };
    } else if (status === 'expired') {
      query.endDate = { $lt: now };
    } else if (status === 'used') {
      query.$expr = { $gte: ['$usedCount', '$quantity'] };
    }

    const total = await Voucher.countDocuments(query);
    
    const vouchers = await Voucher.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    // Add status info to each voucher
    const vouchersWithStatus = vouchers.map(voucher => {
      const voucherObj = voucher.toObject();
      
      if (!voucher.isActive) {
        voucherObj.status = 'inactive';
      } else if (voucher.usedCount >= voucher.quantity) {
        voucherObj.status = 'used_up';
      } else if (now < voucher.startDate) {
        voucherObj.status = 'not_started';
      } else if (now > voucher.endDate) {
        voucherObj.status = 'expired';
      } else {
        voucherObj.status = 'active';
      }
      
      voucherObj.remainingQuantity = voucher.quantity - voucher.usedCount;
      return voucherObj;
    });

    res.json({
      vouchers: vouchersWithStatus,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get voucher details
router.get('/:id', async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('usedBy.user', 'name email')
      .populate('excludedProducts', 'name');

    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }

    const voucherObj = voucher.toObject();
    voucherObj.remainingQuantity = voucher.quantity - voucher.usedCount;
    
    res.json(voucherObj);
  } catch (error) {
    console.error('Error fetching voucher details:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create new voucher
router.post('/', async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      quantity,
      startDate,
      endDate,
      applicableCategories,
      applicableBrands,
      excludedProducts,
      maxUsagePerUser,
      generateCode
    } = req.body;

    // Generate code if requested
    let voucherCode = code;
    if (generateCode) {
      let isUnique = false;
      while (!isUnique) {
        voucherCode = Voucher.generateCode(8);
        const existing = await Voucher.findOne({ code: voucherCode });
        if (!existing) isUnique = true;
      }
    }

    // Validate discount value
    if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
      return res.status(400).json({ 
        message: 'Giá trị giảm giá phần trăm phải từ 1-100' 
      });
    }

    if (discountType === 'fixed' && discountValue <= 0) {
      return res.status(400).json({ 
        message: 'Giá trị giảm giá cố định phải lớn hơn 0' 
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return res.status(400).json({ 
        message: 'Ngày kết thúc phải sau ngày bắt đầu' 
      });
    }

    const voucher = new Voucher({
      code: voucherCode.toUpperCase(),
      description,
      discountType,
      discountValue,
      minOrderAmount: minOrderAmount || 0,
      maxDiscountAmount: discountType === 'percentage' ? maxDiscountAmount : null,
      quantity,
      startDate: start,
      endDate: end,
      applicableCategories: applicableCategories || [],
      applicableBrands: applicableBrands || [],
      excludedProducts: excludedProducts || [],
      maxUsagePerUser: maxUsagePerUser || 1,
      createdBy: req.user._id
    });

    await voucher.save();
    
    res.status(201).json({
      message: 'Voucher created successfully',
      voucher
    });
  } catch (error) {
    console.error('Error creating voucher:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Mã voucher đã tồn tại' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update voucher
router.put('/:id', async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }

    // Don't allow updating code if voucher has been used
    if (req.body.code && voucher.usedCount > 0 && req.body.code !== voucher.code) {
      return res.status(400).json({ 
        message: 'Không thể thay đổi mã voucher đã được sử dụng' 
      });
    }

    // Validate dates if updating
    if (req.body.startDate || req.body.endDate) {
      const start = new Date(req.body.startDate || voucher.startDate);
      const end = new Date(req.body.endDate || voucher.endDate);
      
      if (start >= end) {
        return res.status(400).json({ 
          message: 'Ngày kết thúc phải sau ngày bắt đầu' 
        });
      }
    }

    // Update fields
    const updateFields = [
      'description', 'discountType', 'discountValue', 
      'minOrderAmount', 'maxDiscountAmount', 'quantity',
      'startDate', 'endDate', 'isActive',
      'applicableCategories', 'applicableBrands', 
      'excludedProducts', 'maxUsagePerUser'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        voucher[field] = req.body[field];
      }
    });

    if (req.body.code && voucher.usedCount === 0) {
      voucher.code = req.body.code.toUpperCase();
    }

    await voucher.save();
    
    res.json({
      message: 'Voucher updated successfully',
      voucher
    });
  } catch (error) {
    console.error('Error updating voucher:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Mã voucher đã tồn tại' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Delete voucher (only if not used)
router.delete('/:id', async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }

    if (voucher.usedCount > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa voucher đã được sử dụng. Hãy vô hiệu hóa thay vì xóa.' 
      });
    }

    await Voucher.deleteOne({ _id: req.params.id });
    
    res.json({ message: 'Voucher deleted successfully' });
  } catch (error) {
    console.error('Error deleting voucher:', error);
    res.status(500).json({ message: error.message });
  }
});

// Toggle voucher active status
router.patch('/:id/toggle-status', async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id);
    
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }

    voucher.isActive = !voucher.isActive;
    await voucher.save();
    
    res.json({
      message: `Voucher ${voucher.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: voucher.isActive
    });
  } catch (error) {
    console.error('Error toggling voucher status:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get voucher statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id)
      .populate('usedBy.user', 'name email')
      .populate('usedBy.orderId', 'totalAmount createdAt');

    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }

    // Calculate statistics
    const totalDiscountGiven = voucher.usedBy.reduce((sum, usage) => {
      if (usage.orderId) {
        // Calculate discount for this order
        const discount = voucher.calculateDiscount(usage.orderId.totalAmount);
        return sum + discount;
      }
      return sum;
    }, 0);

    const usageByDate = {};
    voucher.usedBy.forEach(usage => {
      const date = new Date(usage.usedAt).toLocaleDateString('vi-VN');
      usageByDate[date] = (usageByDate[date] || 0) + 1;
    });

    const stats = {
      totalUsed: voucher.usedCount,
      totalQuantity: voucher.quantity,
      remainingQuantity: voucher.quantity - voucher.usedCount,
      usageRate: ((voucher.usedCount / voucher.quantity) * 100).toFixed(2) + '%',
      totalDiscountGiven,
      averageDiscountPerUse: voucher.usedCount > 0 
        ? Math.floor(totalDiscountGiven / voucher.usedCount)
        : 0,
      usageByDate,
      recentUsage: voucher.usedBy.slice(-10).reverse() // Last 10 uses
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching voucher stats:', error);
    res.status(500).json({ message: error.message });
  }
});

// Generate multiple voucher codes
router.post('/generate-bulk', async (req, res) => {
  try {
    const {
      prefix,
      quantity,
      voucherData
    } = req.body;

    const vouchers = [];
    const errors = [];

    for (let i = 0; i < quantity; i++) {
      let code = (prefix || '') + Voucher.generateCode(8 - (prefix?.length || 0));
      
      // Ensure uniqueness
      let attempts = 0;
      while (attempts < 10) {
        const existing = await Voucher.findOne({ code });
        if (!existing) break;
        code = (prefix || '') + Voucher.generateCode(8 - (prefix?.length || 0));
        attempts++;
      }

      if (attempts === 10) {
        errors.push(`Failed to generate unique code for voucher ${i + 1}`);
        continue;
      }

      try {
        const voucher = new Voucher({
          ...voucherData,
          code: code.toUpperCase(),
          createdBy: req.user._id
        });
        
        await voucher.save();
        vouchers.push(voucher);
      } catch (error) {
        errors.push(`Error creating voucher ${code}: ${error.message}`);
      }
    }

    res.json({
      message: `Created ${vouchers.length} vouchers successfully`,
      vouchers,
      errors
    });
  } catch (error) {
    console.error('Error generating bulk vouchers:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;