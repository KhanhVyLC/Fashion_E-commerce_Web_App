//backend/models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: function() {
      return !this.image;
    },
    trim: true
  },
  image: {
    type: String,
    required: function() {
      return !this.text;
    }
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  conversationId: {
    type: String,
    required: true,
    index: true
  },
  senderRole: {
    type: String,
    enum: ['admin', 'client'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  }
}, {
  timestamps: true
});

// Indexes
messageSchema.index({ timestamp: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ receiver: 1 });
messageSchema.index({ conversationId: 1, timestamp: -1 });

// Virtual để format thời gian
messageSchema.virtual('formattedTime').get(function() {
  return this.timestamp.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Static method để tạo conversationId
messageSchema.statics.createConversationId = function(userId1, userId2) {
  // Luôn đặt admin ID trước để đảm bảo consistency
  const ids = [userId1, userId2].sort();
  return `${ids[0]}_${ids[1]}`;
};

// Static method để lấy conversations của admin
messageSchema.statics.getAdminConversations = async function() {
  const User = mongoose.model('User');
  const adminUser = await User.findOne({ email: 'admin@gmail.com' });
  if (!adminUser) return [];

  const conversations = await this.aggregate([
    {
      $match: {
        $or: [
          { sender: adminUser._id },
          { receiver: adminUser._id }
        ]
      }
    },
    {
      $sort: { timestamp: -1 }
    },
    {
      $group: {
        _id: '$conversationId',
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$receiver', adminUser._id] },
                  { $ne: ['$status', 'read'] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'lastMessage.sender',
        foreignField: '_id',
        as: 'senderInfo'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'lastMessage.receiver',
        foreignField: '_id',
        as: 'receiverInfo'
      }
    },
    {
      $project: {
        conversationId: '$_id',
        lastMessage: 1,
        unreadCount: 1,
        clientInfo: {
          $cond: [
            { $eq: [{ $arrayElemAt: ['$senderInfo.email', 0] }, 'admin@gmail.com'] },
            { $arrayElemAt: ['$receiverInfo', 0] },
            { $arrayElemAt: ['$senderInfo', 0] }
          ]
        }
      }
    },
    {
      $sort: { 'lastMessage.timestamp': -1 }
    }
  ]);

  return conversations;
};

// Method để cập nhật trạng thái tin nhắn
messageSchema.methods.updateStatus = function(newStatus) {
  if (['sent', 'delivered', 'read'].includes(newStatus)) {
    this.status = newStatus;
    return this.save();
  }
  throw new Error('Invalid status');
};

module.exports = mongoose.model('Message', messageSchema);
    