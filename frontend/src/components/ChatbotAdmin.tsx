// src/components/admin/ChatbotAdmin.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Send, Image, User, Search, MessageCircle, Circle, MoreVertical, Paperclip, X, Bell, Filter, Archive, Star, Clock, ChevronDown } from 'lucide-react';
import axios from '../utils/axios';
import io from 'socket.io-client';

// Lấy danh sách admin emails từ environment variable
const ADMIN_EMAILS = (process.env.REACT_APP_ADMIN_EMAILS || 'admin@gmail.com').split(',').map(email => email.trim().toLowerCase());

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
  const [sendingMessage, setSendingMessage] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread' | 'starred'>('all');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingClient, setTypingClient] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Initialize Socket.IO
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    
    socketRef.current.on('connect', () => {
      console.log('Admin connected to socket server');
      socketRef.current.emit('joinChat', currentUser._id);
      socketRef.current.emit('joinAdminRoom');
    });

    socketRef.current.on('newMessage', (message: Message) => {
      if (selectedConversation && message.conversationId === selectedConversation.conversationId) {
        setMessages(prev => {
          const existingMessage = prev.find(msg => msg._id === message._id);
          if (existingMessage) {
            return prev;
          }
          return [...prev, message];
        });
        
        if (message.senderRole === 'client') {
          markMessagesAsRead(message.conversationId);
        }
      }
      
      fetchConversations();
    });

    socketRef.current.on('clientTyping', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      if (selectedConversation?.conversationId === conversationId) {
        setIsTyping(isTyping);
        if (isTyping) {
          setTypingClient(conversationId);
        } else {
          setTypingClient(null);
        }
      }
    });

    socketRef.current.on('newClientMessage', ({ conversationId }: { conversationId: string }) => {
      fetchConversations();
      
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

    socketRef.current.on('messagesMarkedAsRead', ({ conversationId }: { conversationId: string }) => {
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
      
      if (socketRef.current) {
        socketRef.current.emit('joinConversation', selectedConversation.conversationId);
      }

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

  const handleTyping = () => {
    if (socketRef.current && selectedConversation) {
      socketRef.current.emit('adminTyping', { 
        conversationId: selectedConversation.conversationId,
        isTyping: true 
      });
      
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('adminTyping', { 
          conversationId: selectedConversation.conversationId,
          isTyping: false 
        });
      }, 1000);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedImage) return;
    if (!selectedConversation) return;
    if (sendingMessage) return;

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

      const response = await axios.post('/chat/messages', {
        text: newMessage,
        image: imageUrl,
        receiverId: selectedConversation.clientInfo._id
      });

      const sentMessage = response.data.message;
      if (sentMessage) {
        setMessages(prev => {
          const existingMessage = prev.find(msg => msg._id === sentMessage._id);
          if (existingMessage) {
            return prev;
          }
          return [...prev, sentMessage];
        });
      }

      setNewMessage('');
      setSelectedImage(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

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
    setIsTyping(false);
    setTypingClient(null);
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

  // Check if sender is admin based on email
  const isAdminSender = (email: string | undefined) => {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
  };

  // Filter conversations based on filter status
  const getFilteredConversations = () => {
    let filtered = conversations.filter(conv => {
      if (!conv || !conv.clientInfo) return false;
      
      const name = conv.clientInfo.name || '';
      const email = conv.clientInfo.email || '';
      const searchLower = searchTerm.toLowerCase();
      
      return name.toLowerCase().includes(searchLower) || 
             email.toLowerCase().includes(searchLower);
    });

    if (filterStatus === 'unread') {
      filtered = filtered.filter(conv => conv.unreadCount > 0);
    }

    return filtered;
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays === 1) return 'Hôm qua';
      if (diffDays < 7) return `${diffDays} ngày trước`;
      
      return date.toLocaleDateString('vi-VN');
    } catch (error) {
      return 'N/A';
    }
  };

  const getLastMessageText = (lastMessage: Message | null | undefined) => {
    if (!lastMessage) return 'Chưa có tin nhắn';
    
    let prefix = '';
    if (lastMessage.sender?.email && isAdminSender(lastMessage.sender.email)) {
      prefix = 'Bạn: ';
    }
    
    return prefix + (lastMessage.text || '[Hình ảnh]');
  };

  const getTotalUnread = () => {
    return conversations.reduce((total, conv) => total + conv.unreadCount, 0);
  };

  const filteredConversations = getFilteredConversations();

  return (
    <div className="flex h-full bg-gradient-to-br from-slate-50 to-gray-100 py-3 px-4">
      <div className="flex w-full shadow-2xl rounded-2xl overflow-hidden bg-white">
        {/* Enhanced Sidebar */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
          {/* Enhanced Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">Admin Chat</h2>
                <p className="text-indigo-200 text-sm mt-1">Quản lý tin nhắn khách hàng</p>
              </div>
              <div className="relative">
                <Bell className="w-6 h-6 cursor-pointer hover:text-indigo-200 transition-colors" />
                {getTotalUnread() > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {getTotalUnread()}
                  </span>
                )}
              </div>
            </div>
          
          {/* Enhanced Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-indigo-300 w-5 h-5" />
            <input
              type="text"
              placeholder="Tìm kiếm khách hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-indigo-200 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/20 transition-all"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'all' 
                  ? 'bg-white text-indigo-600' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Tất cả ({conversations.length})
            </button>
            <button
              onClick={() => setFilterStatus('unread')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'unread' 
                  ? 'bg-white text-indigo-600' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Chưa đọc ({conversations.filter(c => c.unreadCount > 0).length})
            </button>
            <button
              onClick={() => setFilterStatus('starred')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterStatus === 'starred' 
                  ? 'bg-white text-indigo-600' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Star className="w-4 h-4 inline" />
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <X className="w-4 h-4 cursor-pointer" onClick={() => setError(null)} />
          </div>
        )}

        {/* Enhanced Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {searchTerm ? 'Không tìm thấy kết quả' : 'Chưa có cuộc trò chuyện nào'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.conversationId}
                onClick={() => handleConversationSelect(conv)}
                className={`relative p-4 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                  selectedConversation?.conversationId === conv.conversationId 
                    ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500' 
                    : 'border-b border-gray-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                      conv.unreadCount > 0 ? 'bg-gradient-to-br from-green-500 to-emerald-500' : 'bg-gradient-to-br from-gray-400 to-gray-500'
                    }`}>
                      {conv.clientInfo?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    {typingClient === conv.conversationId && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {conv.clientInfo?.name || 'Khách hàng'}
                      </h3>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {formatTime(conv.lastMessage?.timestamp || '')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {conv.clientInfo?.email || 'N/A'}
                    </p>
                    <p className={`text-sm mt-1 truncate ${
                      conv.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-600'
                    }`}>
                      {typingClient === conv.conversationId ? (
                        <span className="text-green-500 italic">Đang nhập...</span>
                      ) : (
                        getLastMessageText(conv.lastMessage)
                      )}
                    </p>
                  </div>
                  
                  {/* Badges */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {conv.unreadCount > 0 && (
                      <div className="bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 font-bold">
                        {conv.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Stats */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-around text-center">
            <div>
              <p className="text-2xl font-bold text-indigo-600">{conversations.length}</p>
              <p className="text-xs text-gray-500">Tổng hội thoại</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{getTotalUnread()}</p>
              <p className="text-xs text-gray-500">Chưa đọc</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">
                {conversations.filter(c => {
                  const time = new Date(c.lastMessage?.timestamp || '').getTime();
                  return Date.now() - time < 3600000; // Active in last hour
                }).length}
              </p>
              <p className="text-xs text-gray-500">Đang hoạt động</p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Chat Area */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col bg-white">
          {/* Enhanced Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                    <User className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">
                    {selectedConversation.clientInfo?.name || 'Khách hàng'}
                  </h3>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">
                      {selectedConversation.clientInfo?.email || 'N/A'}
                    </span>
                    {isTyping && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-green-500 italic">Đang nhập...</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Star className="w-5 h-5 text-gray-400" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Archive className="w-5 h-5 text-gray-400" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreVertical className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-50 to-white">
            {messages.map((message, index) => {
              const isCurrentUser = message.sender?.email ? isAdminSender(message.sender.email) : false;
              const showDate = index === 0 || new Date(message.timestamp).toDateString() !== new Date(messages[index - 1].timestamp).toDateString();
              
              return (
                <React.Fragment key={message._id}>
                  {showDate && (
                    <div className="flex items-center justify-center my-6">
                      <div className="bg-gray-200/60 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs text-gray-600 font-medium">
                        {new Date(message.timestamp).toLocaleDateString('vi-VN', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`flex mb-4 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isCurrentUser && (
                      <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                        <span className="text-white text-sm font-semibold">
                          {message.sender?.name?.charAt(0).toUpperCase() || 'C'}
                        </span>
                      </div>
                    )}
                    
                    <div
                      className={`max-w-md px-4 py-3 rounded-2xl ${
                        isCurrentUser
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-tr-sm'
                          : 'bg-white text-gray-800 shadow-md border border-gray-100 rounded-tl-sm'
                      }`}
                    >
                      {!isCurrentUser && (
                        <div className="text-xs font-medium text-gray-500 mb-1">
                          {message.sender?.name || 'Khách hàng'}
                        </div>
                      )}
                      
                      {message.image && (
                        <img
                          src={`http://localhost:5000${message.image}`}
                          alt="Shared image"
                          className="max-w-full h-auto rounded-xl mb-2 shadow-md"
                        />
                      )}
                      
                      {message.text && (
                        <p className="text-sm leading-relaxed">{message.text}</p>
                      )}
                      
                      <div className={`flex items-center gap-2 mt-2 ${
                        isCurrentUser ? 'text-indigo-100' : 'text-gray-400'
                      }`}>
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </div>
                    
                    {isCurrentUser && (
                      <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center ml-3 flex-shrink-0">
                        <span className="text-white text-sm font-semibold">A</span>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
            
            {isTyping && (
              <div className="flex justify-start mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                  <span className="text-white text-sm font-semibold">
                    {selectedConversation.clientInfo?.name?.charAt(0).toUpperCase() || 'C'}
                  </span>
                </div>
                <div className="bg-white shadow-md rounded-2xl rounded-tl-sm px-4 py-3 border border-gray-100">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Enhanced Image Preview */}
          {imagePreview && (
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200">
              <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-md">
                <div className="flex items-center gap-3">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-lg shadow-sm"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Ảnh đã chọn</p>
                    <p className="text-xs text-gray-500">{selectedImage?.name}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {selectedImage && `${(selectedImage.size / 1024).toFixed(2)} KB`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Enhanced Input Area */}
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-end gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
              
              <div className="flex gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all duration-200"
                  disabled={sendingMessage}
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all duration-200"
                  disabled={sendingMessage}
                >
                  <Image className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder="Nhập tin nhắn..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 transition-all duration-200"
                  disabled={sendingMessage}
                />
              </div>
              
              <button
                onClick={handleSendMessage}
                disabled={(!newMessage.trim() && !selectedImage) || sendingMessage}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2"
              >
                {sendingMessage ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span className="font-medium">Gửi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
          <div className="text-center max-w-md">
            <div className="w-32 h-32 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-16 h-16 text-indigo-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Chọn một cuộc trò chuyện</h3>
            <p className="text-gray-600">
              Chọn một khách hàng từ danh sách bên trái để bắt đầu trò chuyện và hỗ trợ họ.
            </p>
            
            <div className="mt-8 grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-indigo-600">{conversations.length}</div>
                <div className="text-xs text-gray-500 mt-1">Tổng hội thoại</div>
              </div>
              <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-green-600">{getTotalUnread()}</div>
                <div className="text-xs text-gray-500 mt-1">Tin chưa đọc</div>
              </div>
              <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-purple-600">
                  {conversations.filter(c => c.unreadCount > 0).length}
                </div>
                <div className="text-xs text-gray-500 mt-1">Cần phản hồi</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default ChatbotAdmin;
