// backend/routes/admin/notifications.js
const express = require('express');
const router = express.Router();
const Order = require('../../models/Order');
const Message = require('../../models/Message');
const { protect } = require('../../middleware/auth');
const { adminAuth } = require('../../middleware/adminAuth');

router.use(protect, adminAuth);

// Store notifications in memory (in production, use database)
let notificationsStore = [];

// Get notifications
router.get('/', async (req, res) => {
  try {
    const notifications = [];
    
    // Get orders from last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Get recent pending and cancelled orders
    const recentOrders = await Order.find({
      createdAt: { $gte: yesterday },
      $or: [
        { orderStatus: 'pending' },
        { orderStatus: 'cancelled' }
      ]
    })
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(10);
    
    recentOrders.forEach(order => {
      const isNew = order.orderStatus === 'pending';
      notifications.push({
        _id: `order_${order._id}`,
        type: 'new_order',
        title: isNew ? 'Đơn hàng mới' : 'Đơn hàng bị hủy',
        message: `Đơn hàng #${order._id.toString().slice(-8)} từ ${order.user.name} ${isNew ? '' : '(Đã hủy)'}`,
        read: notificationsStore.includes(`order_${order._id}`),
        createdAt: order.createdAt,
        data: { 
          orderId: order._id,
          orderStatus: order.orderStatus
        }
      });
    });
    
    // Get unread messages
    const adminUser = await require('../../models/User').findOne({ email: 'admin@gmail.com' });
    if (adminUser) {
      const unreadMessages = await Message.find({
        receiver: adminUser._id,
        status: { $ne: 'read' }
      })
      .populate('sender', 'name')
      .sort({ createdAt: -1 })
      .limit(5);
      
      // Group by conversation
      const messagesByConversation = {};
      unreadMessages.forEach(msg => {
        if (!messagesByConversation[msg.conversationId]) {
          messagesByConversation[msg.conversationId] = {
            count: 1,
            lastMessage: msg,
            senderName: msg.sender.name
          };
        } else {
          messagesByConversation[msg.conversationId].count++;
        }
      });
      
      Object.entries(messagesByConversation).forEach(([conversationId, data]) => {
        notifications.push({
          _id: `msg_${conversationId}`,
          type: 'new_message',
          title: 'Tin nhắn mới',
          message: `${data.count} tin nhắn mới từ ${data.senderName}`,
          read: notificationsStore.includes(`msg_${conversationId}`),
          createdAt: data.lastMessage.createdAt,
          data: { conversationId }
        });
      });
    }
    
    // Sort by date
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: error.message });
  }
});

// Mark notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    if (!notificationsStore.includes(id)) {
      notificationsStore.push(id);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark all as read
router.patch('/mark-all-read', async (req, res) => {
  try {
    // In real app, mark all notifications for this admin as read
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;