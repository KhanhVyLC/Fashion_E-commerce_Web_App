// src/components/ChatboxAdmin.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Send, Image, User, Search, MessageCircle, Circle } from 'lucide-react';
import axios from '../utils/axios';
import io from 'socket.io-client';

interface Message {
  _id: string;
  text: string;
  image?: string;
  sender: {
    _id: string;
    name: string;
    email: string;
  };
  receiver: {
    _id: string;
    name: string;
    email: string;
  };
  senderRole: 'admin' | 'client';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  conversationId: string;
}

interface Conversation {
  conversationId: string;
  lastMessage: Message;
  unreadCount: number;
  clientInfo: {
    _id: string;
    name: string;
    email: string;
  };
}

interface ChatbotAdminProps {
  currentUser: {
    _id: string;
    email: string;
    name: string;
    role: 'admin';
  };
}

const ChatbotAdmin: React.FC<ChatbotAdminProps> = ({ currentUser }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false); // Thêm state để track việc gửi tin nhắn
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<any>(null);

  // Initialize Socket.IO
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    
    socketRef.current.on('connect', () => {
      console.log('Admin connected to socket server');
      socketRef.current.emit('joinChat', currentUser._id);
      socketRef.current.emit('joinAdminRoom');
    });

    socketRef.current.on('newMessage', (message: Message) => {
      // Chỉ thêm tin nhắn nếu không phải từ chính admin đang gửi
      // hoặc nếu tin nhắn đó không tồn tại trong state
      if (selectedConversation && message.conversationId === selectedConversation.conversationId) {
        setMessages(prev => {
          // Kiểm tra xem tin nhắn đã tồn tại chưa
          const existingMessage = prev.find(msg => msg._id === message._id);
          if (existingMessage) {
            return prev; // Không thêm nếu đã tồn tại
          }
          return [...prev, message];
        });
        
        // Auto mark as read if message is from client and admin is viewing this conversation
        if (message.senderRole === 'client') {
          markMessagesAsRead(message.conversationId);
        }
      }
      
      // Update conversation list
      fetchConversations();
    });

    socketRef.current.on('newClientMessage', ({ conversationId }: { conversationId: string }) => {
      // Refresh conversation list when new client message
      fetchConversations();
      
      // Join the new conversation room if needed
      if (conversationId) {
        socketRef.current.emit('joinConversation', conversationId);
      }
    });

    socketRef.current.on('messageUpdated', (updatedMessage: Message) => {
      setMessages(prev => prev.map(msg => 
        msg._id === updatedMessage._id ? updatedMessage : msg
      ));
    });

    socketRef.current.on('messageDeleted', ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
    });

    // Listen for messages marked as read
    socketRef.current.on('messagesMarkedAsRead', ({ conversationId }: { conversationId: string }) => {
      // Update conversation list to remove unread count
      setConversations(prev => prev.map(conv => 
        conv.conversationId === conversationId 
          ? { ...conv, unreadCount: 0 }
          : conv
      ));
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [currentUser, selectedConversation]);

  // Fetch conversations
  useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch messages when conversation selected
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.conversationId);
      
      // Join conversation room
      if (socketRef.current) {
        socketRef.current.emit('joinConversation', selectedConversation.conversationId);
      }

      // Mark messages as read when selecting conversation
      markMessagesAsRead(selectedConversation.conversationId);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/chat/conversations');
      
      // Validate và filter dữ liệu
      const validConversations = response.data.filter((conv: any) => {
        return conv && 
               conv.conversationId && 
               conv.lastMessage && 
               conv.clientInfo && 
               conv.clientInfo.name && 
               conv.clientInfo.email;
      });
      
      setConversations(validConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Không thể tải danh sách cuộc trò chuyện');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const response = await axios.get(`/chat/messages/conversation/${conversationId}`);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Không thể tải tin nhắn');
    }
  };

  const markMessagesAsRead = async (conversationId: string) => {
    try {
      await axios.post(`/chat/messages/mark-conversation-read/${conversationId}`);
      
      // Update local state to remove unread count
      setConversations(prev => prev.map(conv => 
        conv.conversationId === conversationId 
          ? { ...conv, unreadCount: 0 }
          : conv
      ));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedImage) return;
    if (!selectedConversation) return;
    if (sendingMessage) return; // Prevent multiple sends

    try {
      setSendingMessage(true);
      let imageUrl = null;
      
      if (selectedImage) {
        const formData = new FormData();
        formData.append('image', selectedImage);
        
        const uploadResponse = await axios.post('/chat/upload-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        imageUrl = uploadResponse.data.imageUrl;
      }

      // Gửi tin nhắn
      const response = await axios.post('/chat/messages', {
        text: newMessage,
        image: imageUrl,
        receiverId: selectedConversation.clientInfo._id
      });

      // Chỉ thêm tin nhắn vào state nếu socket chưa thêm
      const sentMessage = response.data.message;
      if (sentMessage) {
        setMessages(prev => {
          // Kiểm tra xem tin nhắn đã tồn tại chưa
          const existingMessage = prev.find(msg => msg._id === sentMessage._id);
          if (existingMessage) {
            return prev; // Không thêm nếu đã tồn tại
          }
          return [...prev, sentMessage];
        });
      }

      // Reset form
      setNewMessage('');
      setSelectedImage(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh conversations để cập nhật lastMessage
      fetchConversations();
      
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Không thể gửi tin nhắn');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    // Unread count will be handled by useEffect when selectedConversation changes
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Kích thước ảnh không được vượt quá 5MB');
        return;
      }
      
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Safe filter với null check
  const filteredConversations = conversations.filter(conv => {
    if (!conv || !conv.clientInfo) return false;
    
    const name = conv.clientInfo.name || '';
    const email = conv.clientInfo.email || '';
    const searchLower = searchTerm.toLowerCase();
    
    return name.toLowerCase().includes(searchLower) || 
           email.toLowerCase().includes(searchLower);
  });

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return 'Hôm qua';
      } else if (diffDays < 7) {
        return `${diffDays} ngày trước`;
      } else {
        return date.toLocaleDateString('vi-VN');
      }
    } catch (error) {
      return 'N/A';
    }
  };

  const getLastMessageText = (lastMessage: Message) => {
    if (!lastMessage) return '';
    
    let prefix = '';
    if (lastMessage.sender?.email === 'admin@gmail.com') {
      prefix = 'Bạn: ';
    }
    
    return prefix + (lastMessage.text || '[Hình ảnh]');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Conversation List */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Admin Chat</h2>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Tìm kiếm khách hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
            {error}
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Đang tải...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchTerm ? 'Không tìm thấy cuộc trò chuyện nào' : 'Chưa có cuộc trò chuyện nào'}
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.conversationId}
                onClick={() => handleConversationSelect(conv)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selectedConversation?.conversationId === conv.conversationId ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-gray-900">
                        {conv.clientInfo?.name || 'Khách hàng'}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatTime(conv.lastMessage?.timestamp || '')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {conv.clientInfo?.email || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {getLastMessageText(conv.lastMessage)}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className="ml-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {conv.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800">
                  {selectedConversation.clientInfo?.name || 'Khách hàng'}
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedConversation.clientInfo?.email || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => {
              const isCurrentUser = message.sender?._id === currentUser._id;
              
              return (
                <div
                  key={message._id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      isCurrentUser
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-800 shadow-sm'
                    }`}
                  >
                    {message.image && (
                      <img
                        src={`http://localhost:5000${message.image}`}
                        alt="Shared image"
                        className="max-w-full h-auto rounded-lg mb-2"
                      />
                    )}
                    
                    {message.text && (
                      <p className="text-sm">{message.text}</p>
                    )}
                    
                    <div className={`flex items-center justify-between mt-2 ${
                      isCurrentUser ? 'text-blue-200' : 'text-gray-500'
                    }`}>
                      <span className="text-xs">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Image Preview */}
          {imagePreview && (
            <div className="p-4 bg-gray-50 border-t">
              <div className="flex items-center space-x-2">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Xóa ảnh
                </button>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="bg-white border-t border-gray-200 p-4">
            <div className="flex items-center space-x-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                disabled={sendingMessage}
              >
                <Image className="w-5 h-5" />
              </button>
              
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Nhập tin nhắn..."
                className="flex-1 p-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sendingMessage}
              />
              
              <button
                onClick={handleSendMessage}
                disabled={(!newMessage.trim() && !selectedImage) || sendingMessage}
                className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p>Chọn một cuộc trò chuyện để bắt đầu</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatbotAdmin;