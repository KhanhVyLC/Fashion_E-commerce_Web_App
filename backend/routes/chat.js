//backend/routes/chat.js
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Tạo thư mục uploads/chat nếu chưa tồn tại
const uploadDir = path.join(__dirname, '..', 'uploads', 'chat');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter
});

// Middleware xác thực
router.use(protect);

// Upload image
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const imageUrl = `/uploads/chat/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Lấy danh sách conversations (chỉ dành cho admin)
router.get('/conversations', async (req, res) => {
  try {
    if (req.user.email !== 'admin@gmail.com') {
      return res.status(403).json({ error: 'Chỉ admin mới có quyền xem danh sách conversations' });
    }

    const conversations = await Message.getAdminConversations();
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Lấy tin nhắn - Route chung
router.get('/messages', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    
    if (req.user.email === 'admin@gmail.com') {
      // Admin có thể xem mọi tin nhắn
      // Không cần thêm filter
    } else {
      // Client chỉ xem được tin nhắn của mình với admin
      const adminUser = await User.findOne({ email: 'admin@gmail.com' });
      if (!adminUser) {
        return res.status(404).json({ error: 'Admin user not found' });
      }
      
      const userConversationId = Message.createConversationId(req.user._id.toString(), adminUser._id.toString());
      query.conversationId = userConversationId;
    }

    const messages = await Message.find(query)
      .populate('sender', 'name email')
      .populate('receiver', 'name email')
      .populate('replyTo', 'text sender')
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalMessages = await Message.countDocuments(query);
    
    res.json({
      messages,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalMessages / limit),
        totalMessages,
        hasMore: skip + messages.length < totalMessages
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Lấy tin nhắn theo conversationId - Route riêng cho admin
router.get('/messages/conversation/:conversationId', async (req, res) => {
  try {
    // Chỉ admin mới được xem conversation cụ thể
    if (req.user.email !== 'admin@gmail.com') {
      return res.status(403).json({ error: 'Không có quyền xem conversation này' });
    }

    const { conversationId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ conversationId })
      .populate('sender', 'name email')
      .populate('receiver', 'name email')
      .populate('replyTo', 'text sender')
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalMessages = await Message.countDocuments({ conversationId });
    
    res.json({
      messages,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalMessages / limit),
        totalMessages,
        hasMore: skip + messages.length < totalMessages
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Đánh dấu tin nhắn trong conversation đã đọc
router.post('/messages/mark-conversation-read/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Chỉ admin mới có thể đánh dấu đã đọc
    if (req.user.email !== 'admin@gmail.com') {
      return res.status(403).json({ error: 'Chỉ admin mới có quyền đánh dấu tin nhắn đã đọc' });
    }

    // Đánh dấu tất cả tin nhắn trong conversation này là đã đọc
    // (chỉ những tin nhắn mà admin là receiver)
    const result = await Message.updateMany(
      {
        conversationId: conversationId,
        receiver: req.user._id, // Admin là receiver
        status: { $ne: 'read' }
      },
      { 
        status: 'read',
        readAt: new Date()
      }
    );

    // Emit socket event để cập nhật UI real-time
    if (req.io) {
      req.io.to('admin-room').emit('messagesMarkedAsRead', { 
        conversationId,
        count: result.modifiedCount 
      });
      
      // Emit to conversation room
      req.io.to(`conversation-${conversationId}`).emit('messagesMarkedAsRead', { 
        conversationId,
        count: result.modifiedCount 
      });
    }

    res.json({ 
      message: `Đã đánh dấu ${result.modifiedCount} tin nhắn là đã đọc`,
      count: result.modifiedCount,
      conversationId
    });
  } catch (error) {
    console.error('Error marking conversation messages as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gửi tin nhắn mới - CẢI TIẾN
router.post('/messages', async (req, res) => {
  try {
    const { text, image, replyTo, receiverId } = req.body;
    
    if (!text && !image) {
      return res.status(400).json({ error: 'Tin nhắn hoặc ảnh không thể trống' });
    }

    // Xác định receiver
    let receiver;
    if (req.user.email === 'admin@gmail.com') {
      // Admin gửi cho client cụ thể
      if (!receiverId) {
        return res.status(400).json({ error: 'receiverId is required for admin' });
      }
      receiver = await User.findById(receiverId);
    } else {
      // Client luôn gửi cho admin
      receiver = await User.findOne({ email: 'admin@gmail.com' });
    }

    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    const conversationId = Message.createConversationId(
      req.user._id.toString(),
      receiver._id.toString()
    );

    const senderRole = req.user.email === 'admin@gmail.com' ? 'admin' : 'client';

    const message = new Message({
      text: text?.trim() || '',
      image: image || null,
      sender: req.user._id,
      receiver: receiver._id,
      conversationId: conversationId,
      senderRole: senderRole,
      timestamp: new Date(),
      status: 'sent',
      replyTo: replyTo || null
    });

    const savedMessage = await message.save();
    
    // Populate thông tin ngay sau khi save
    await savedMessage.populate('sender', 'name email');
    await savedMessage.populate('receiver', 'name email');
    if (savedMessage.replyTo) {
      await savedMessage.populate('replyTo', 'text sender');
    }

    // Emit via Socket.IO với nhiều rooms để đảm bảo tất cả clients nhận được
    if (req.io) {
      console.log('Emitting message to rooms:', {
        conversationId,
        senderRole,
        senderId: req.user._id.toString(),
        receiverId: receiver._id.toString()
      });

      // Emit to specific conversation room
      req.io.to(`conversation-${conversationId}`).emit('newMessage', savedMessage);
      
      // Emit to user-specific rooms
      req.io.to(`user-${req.user._id}`).emit('newMessage', savedMessage);
      req.io.to(`user-${receiver._id}`).emit('newMessage', savedMessage);
      
      // Notify admin if message from client
      if (senderRole === 'client') {
        req.io.to('admin-room').emit('newClientMessage', {
          message: savedMessage,
          sender: req.user,
          conversationId: conversationId
        });
      }
      
      // Emit to general chat room as backup
      req.io.emit('newMessage', savedMessage);
    }

    res.status(201).json(savedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sửa tin nhắn
router.put('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    
    if (!text?.trim()) {
      return res.status(400).json({ error: 'Nội dung tin nhắn không thể trống' });
    }

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Tin nhắn không tìm thấy' });
    }

    // Chỉ cho phép sửa tin nhắn của chính mình
    const isOwner = message.sender.toString() === req.user._id.toString();
    
    if (!isOwner) {
      return res.status(403).json({ error: 'Không có quyền sửa tin nhắn này' });
    }

    message.text = text.trim();
    message.edited = true;
    message.editedAt = new Date();
    
    await message.save();
    await message.populate('sender', 'name email');
    await message.populate('receiver', 'name email');

    // Emit update via Socket.IO
    if (req.io) {
      req.io.to(`conversation-${message.conversationId}`).emit('messageUpdated', message);
      req.io.to(`user-${message.sender}`).emit('messageUpdated', message);
      req.io.to(`user-${message.receiver}`).emit('messageUpdated', message);
    }

    res.json(message);
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Xóa tin nhắn
router.delete('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Tin nhắn không tìm thấy' });
    }

    // Chỉ cho phép xóa tin nhắn của chính mình
    const isOwner = message.sender.toString() === req.user._id.toString();
    
    if (!isOwner) {
      return res.status(403).json({ error: 'Không có quyền xóa tin nhắn này' });
    }

    const conversationId = message.conversationId;
    const senderId = message.sender;
    const receiverId = message.receiver;
    
    await Message.findByIdAndDelete(messageId);

    // Emit delete event via Socket.IO
    if (req.io) {
      req.io.to(`conversation-${conversationId}`).emit('messageDeleted', { messageId });
      req.io.to(`user-${senderId}`).emit('messageDeleted', { messageId });
      req.io.to(`user-${receiverId}`).emit('messageDeleted', { messageId });
    }

    res.json({ message: 'Tin nhắn đã được xóa' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Lấy thống kê tin nhắn (chỉ admin)
router.get('/stats', async (req, res) => {
  try {
    // Kiểm tra quyền admin
    if (req.user.email !== 'admin@gmail.com') {
      return res.status(403).json({ error: 'Chỉ admin mới có quyền xem thống kê' });
    }

    const stats = await Message.aggregate([
      {
        $group: {
          _id: '$senderRole',
          count: { $sum: 1 },
          lastMessage: { $max: '$timestamp' }
        }
      }
    ]);

    const totalMessages = await Message.countDocuments();
    const totalUsers = await Message.distinct('sender').then(users => users.length);

    res.json({
      totalMessages,
      totalUsers,
      messagesByRole: stats,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Đánh dấu tất cả tin nhắn là đã đọc
router.post('/messages/mark-all-read', async (req, res) => {
  try {
    const result = await Message.updateMany(
      { 
        receiver: req.user._id, // Tin nhắn gửi cho mình
        status: { $ne: 'read' } // Chưa đọc
      },
      { 
        status: 'read',
        readAt: new Date()
      }
    );

    // Emit update via Socket.IO
    if (req.io) {
      req.io.to(`user-${req.user._id}`).emit('allMessagesRead', {
        userId: req.user._id,
        count: result.modifiedCount
      });
    }

    res.json({ 
      message: `Đã đánh dấu ${result.modifiedCount} tin nhắn là đã đọc`,
      count: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// Đánh dấu tin nhắn đã đọc cho client
router.post('/messages/mark-read', async (req, res) => {
  try {
    // Client đánh dấu tin nhắn từ admin là đã đọc
    if (req.user.email !== 'admin@gmail.com') {
      const adminUser = await User.findOne({ email: 'admin@gmail.com' });
      if (!adminUser) {
        return res.status(404).json({ error: 'Admin user not found' });
      }

      const result = await Message.updateMany(
        {
          sender: adminUser._id,     // Tin nhắn từ admin
          receiver: req.user._id,    // Gửi cho client hiện tại
          status: { $ne: 'read' }    // Chưa đọc
        },
        { 
          status: 'read',
          readAt: new Date()
        }
      );

      // Emit socket event để cập nhật UI
      if (req.io) {
        // Notify admin that client has read messages
        req.io.to('admin-room').emit('clientReadMessages', {
          clientId: req.user._id,
          count: result.modifiedCount
        });
        
        // Notify the client's own connections
        req.io.to(`user-${req.user._id}`).emit('messagesMarkedAsRead', {
          count: result.modifiedCount
        });
      }

      res.json({ 
        message: `Đã đánh dấu ${result.modifiedCount} tin nhắn là đã đọc`,
        count: result.modifiedCount
      });
    } else {
      // Admin không dùng route này
      res.status(400).json({ error: 'Admin should use mark-conversation-read route' });
    }
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: error.message });
  }
});



// Chỉ phần xóa tin nhắn trong chat.js
router.delete('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Tin nhắn không tìm thấy' });
    }

    // Chỉ cho phép xóa tin nhắn của chính mình
    const isOwner = message.sender.toString() === req.user._id.toString();
    
    if (!isOwner) {
      return res.status(403).json({ error: 'Không có quyền xóa tin nhắn này' });
    }

    const conversationId = message.conversationId;
    const senderId = message.sender;
    const receiverId = message.receiver;
    
    // Xóa tin nhắn khỏi database
    await Message.findByIdAndDelete(messageId);

    // Emit delete event via Socket.IO - nhiều cách để đảm bảo tất cả clients nhận được
    if (req.io) {
      console.log('Emitting messageDeleted event for messageId:', messageId);
      
      // Emit to conversation room
      req.io.to(`conversation-${conversationId}`).emit('messageDeleted', { messageId });
      
      // Emit to sender and receiver
      req.io.to(`user-${senderId}`).emit('messageDeleted', { messageId });
      req.io.to(`user-${receiverId}`).emit('messageDeleted', { messageId });
      
      // Emit to admin room if applicable
      if (req.user.email === 'admin@gmail.com') {
        req.io.to('admin-room').emit('messageDeleted', { messageId });
      }
      
      // Emit globally as backup
      req.io.emit('messageDeleted', { messageId });
      
      console.log('Successfully emitted messageDeleted event');
    }

    res.json({ 
      message: 'Tin nhắn đã được xóa',
      messageId: messageId 
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
