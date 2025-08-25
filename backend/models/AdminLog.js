// backend/models/AdminLog.js
const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  },
  endpoint: {
    type: String,
    required: true
  },
  targetModel: {
    type: String,
    enum: ['Product', 'Order', 'User', 'Voucher', 'Review', 'Other']
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId
  },
  changes: {
    type: mongoose.Schema.Types.Mixed
  },
  ip: String,
  userAgent: String,
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
adminLogSchema.index({ admin: 1, timestamp: -1 });
adminLogSchema.index({ action: 1, timestamp: -1 });
adminLogSchema.index({ targetModel: 1, targetId: 1 });
adminLogSchema.index({ timestamp: -1 });

// Auto-delete old logs after 90 days
adminLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

module.exports = mongoose.model('AdminLog', adminLogSchema);