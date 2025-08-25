// src/components/ChatbotClient.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Send, Image, Check, CheckCheck, MoreVertical, Edit2, Trash2, Paperclip, X, Smile, Clock } from 'lucide-react';
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
  edited?: boolean;
  editedAt?: string;
}

interface ChatbotClientProps {
  currentUser: {
    _id: string;
    email: string;
    name: string;
    role: 'client';
  };
}

const ChatbotClient: React.FC<ChatbotClientProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Initialize Socket.IO
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    
    socketRef.current.on('connect', () => {
      console.log('Client connected to socket server');
      socketRef.current.emit('joinChat', currentUser._id);
      socketRef.current.emit('join', `user-${currentUser._id}`);
    });

    socketRef.current.on('newMessage', (message: Message) => {
      console.log('Received new message:', message);
      
      setMessages(prev => {
        const exists = prev.some(msg => msg._id === message._id);
        if (exists) {
          console.log('Message already exists, skipping...', message._id);
          return prev;
        }
        return [...prev, message];
      });
      
      if (message.senderRole === 'admin' && message.receiver._id === currentUser._id) {
        setTimeout(() => markMessagesAsRead(), 1000);
      }
    });

    socketRef.current.on('adminTyping', ({ isTyping }: { isTyping: boolean }) => {
      setIsTyping(isTyping);
    });

    socketRef.current.on('messageUpdated', (updatedMessage: Message) => {
      console.log('Message updated:', updatedMessage);
      setMessages(prev => prev.map(msg => 
        msg._id === updatedMessage._id ? updatedMessage : msg
      ));
    });

    socketRef.current.on('messageDeleted', ({ messageId }: { messageId: string }) => {
      console.log('Message deleted:', messageId);
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
      
      if (editingMessageId === messageId) {
        setEditingMessageId(null);
        setEditingText('');
      }
      if (dropdownOpen === messageId) {
        setDropdownOpen(null);
      }
      if (deletingMessageId === messageId) {
        setDeletingMessageId(null);
      }
    });

    socketRef.current.on('messagesMarkedAsRead', () => {
      setMessages(prev => prev.map(msg => 
        msg.senderRole === 'admin' && msg.receiver._id === currentUser._id
          ? { ...msg, status: 'read' }
          : msg
      ));
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [currentUser, editingMessageId, dropdownOpen, deletingMessageId]);

  // Fetch messages on mount
  useEffect(() => {
    fetchMessages();
  }, []);

  // Mark messages as read when component mounts
  useEffect(() => {
    if (messages.length > 0) {
      const hasUnread = messages.some(msg => 
        msg.senderRole === 'admin' && 
        msg.receiver._id === currentUser._id && 
        msg.status !== 'read'
      );
      
      if (hasUnread) {
        markMessagesAsRead();
      }
    }
  }, [messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/chat/messages');
      setMessages(response.data.messages);
      setError(null);
      
      setTimeout(() => markMessagesAsRead(), 500);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Không thể tải tin nhắn');
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await axios.post('/chat/messages/mark-read');
      console.log('Messages marked as read');
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTyping = () => {
    if (socketRef.current) {
      socketRef.current.emit('typing', { isTyping: true });
      
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('typing', { isTyping: false });
      }, 1000);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedImage) return;
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

      await axios.post('/chat/messages', {
        text: newMessage,
        image: imageUrl
      });

      setNewMessage('');
      setSelectedImage(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Không thể gửi tin nhắn');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    try {
      await axios.put(`/chat/messages/${messageId}`, { text: newText });
      setEditingMessageId(null);
      setEditingText('');
      setDropdownOpen(null);
    } catch (error) {
      console.error('Error editing message:', error);
      setError('Không thể sửa tin nhắn');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa tin nhắn này?')) return;

    try {
      setDeletingMessageId(messageId);
      await axios.delete(`/chat/messages/${messageId}`);
      setDropdownOpen(null);
    } catch (error) {
      console.error('Error deleting message:', error);
      setError('Không thể xóa tin nhắn');
      setDeletingMessageId(null);
      fetchMessages();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Kích thước ảnh không được vượt quá 5MB');
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

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="w-3.5 h-3.5 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-3.5 h-3.5 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-3.5 h-3.5 text-blue-400" />;
      default:
        return null;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const startEditing = (message: Message) => {
    setEditingMessageId(message._id);
    setEditingText(message.text);
    setDropdownOpen(null);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  // Check if sender is admin based on email
  const isAdminSender = (email: string | undefined) => {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase());
  };

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownOpen && !(event.target as Element).closest('.dropdown-container')) {
        setDropdownOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Đang tải tin nhắn...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 py-3 px-4">
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full shadow-2xl bg-white rounded-2xl overflow-hidden">
        {/* Enhanced Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="relative">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-lg">A</span>
                </div>
                <div className="absolute bottom-0 right-2 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white"></div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Admin Support</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <p className="text-sm text-white/90">
                    {isTyping ? 'Đang nhập...' : 'Đang hoạt động'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Clock className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {error && (
            <div className="mt-3 bg-red-500/20 backdrop-blur-sm text-white p-2 rounded-lg text-sm flex items-center gap-2">
              <X className="w-4 h-4" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto hover:text-white/80">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Enhanced Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50 to-white">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-sm">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Smile className="w-12 h-12 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Chào mừng bạn!</h3>
                <p className="text-gray-600">Hãy bắt đầu cuộc trò chuyện để được hỗ trợ từ đội ngũ admin của chúng tôi.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Group messages by date */}
              {messages.map((message, index) => {
                const isCurrentUser = message.sender._id === currentUser._id;
                const isEditing = editingMessageId === message._id;
                const isDeleting = deletingMessageId === message._id;
                const showDate = index === 0 || new Date(message.timestamp).toDateString() !== new Date(messages[index - 1].timestamp).toDateString();
                
                return (
                  <React.Fragment key={message._id}>
                    {showDate && (
                      <div className="flex items-center justify-center my-4">
                        <div className="bg-gray-200/50 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-gray-600">
                          {new Date(message.timestamp).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                      </div>
                    )}
                    
                    <div
                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} ${
                        isDeleting ? 'opacity-50 pointer-events-none' : ''
                      } transition-all duration-200 hover:scale-[1.02]`}
                    >
                      {!isCurrentUser && (
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                          <span className="text-white text-xs font-semibold">A</span>
                        </div>
                      )}
                      
                      <div
                        className={`max-w-xs lg:max-w-md relative group ${
                          isCurrentUser
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-sm'
                            : 'bg-white text-gray-800 shadow-md rounded-2xl rounded-tl-sm border border-gray-100'
                        } px-4 py-3 transition-all duration-200`}
                      >
                        {!isCurrentUser && (
                          <div className="text-xs font-medium text-blue-600 mb-1">
                            {isAdminSender(message.sender.email) ? 'Admin Support' : message.sender.name}
                          </div>
                        )}

                        {/* Message Options */}
                        {isCurrentUser && !isDeleting && (
                          <div className="dropdown-container absolute -top-8 right-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <button
                              onClick={() => setDropdownOpen(dropdownOpen === message._id ? null : message._id)}
                              className="bg-white text-gray-600 p-1.5 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            
                            {dropdownOpen === message._id && (
                              <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-20 overflow-hidden">
                                <button
                                  onClick={() => startEditing(message)}
                                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full transition-colors"
                                >
                                  <Edit2 className="w-4 h-4 mr-2" />
                                  Chỉnh sửa
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(message._id)}
                                  className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Xóa tin nhắn
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {isDeleting && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-2xl">
                            <div className="text-white text-sm font-medium">Đang xóa...</div>
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
                          <div>
                            {isEditing ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="w-full p-2 text-sm border border-gray-300 rounded-lg text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  rows={3}
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditMessage(message._id, editingText)}
                                    className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors"
                                  >
                                    Lưu thay đổi
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className="px-3 py-1.5 bg-gray-500 text-white text-xs font-medium rounded-lg hover:bg-gray-600 transition-colors"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm leading-relaxed">{message.text}</p>
                                {message.edited && (
                                  <p className="text-xs opacity-70 mt-1 italic">(đã chỉnh sửa)</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {!isEditing && (
                          <div className={`flex items-center justify-between mt-2 ${
                            isCurrentUser ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            <span className="text-xs">
                              {formatTime(message.timestamp)}
                            </span>
                            {isCurrentUser && (
                              <div className="ml-2">
                                {getStatusIcon(message.status)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {isCurrentUser && (
                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center ml-2 flex-shrink-0">
                          <span className="text-white text-xs font-semibold">{currentUser.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white shadow-md rounded-2xl rounded-tl-sm px-4 py-3 border border-gray-100">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Enhanced Image Preview */}
        {imagePreview && (
          <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200">
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
                </div>
              </div>
              <button
                onClick={removeImage}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Enhanced Input Area */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-end gap-2">
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
                className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all duration-200"
                disabled={sendingMessage}
              >
                <Image className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 relative">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Nhập tin nhắn của bạn..."
                className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition-all duration-200"
                disabled={sendingMessage}
              />
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                disabled={sendingMessage}
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>
            
            <button
              onClick={handleSendMessage}
              disabled={(!newMessage.trim() && !selectedImage) || sendingMessage}
              className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
            >
              {sendingMessage ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotClient;
