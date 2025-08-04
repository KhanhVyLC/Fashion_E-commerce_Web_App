// src/components/ChatbotClient.tsx - Sửa lỗi duplicate messages
import React, { useState, useEffect, useRef } from 'react';
import { Send, Image, Check, CheckCheck, MoreVertical, Edit2, Trash2 } from 'lucide-react';
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
  const [sendingMessage, setSendingMessage] = useState(false); // Thêm state để track trạng thái gửi
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<any>(null);

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
      
      // Kiểm tra xem tin nhắn đã tồn tại chưa để tránh duplicate
      setMessages(prev => {
        const exists = prev.some(msg => msg._id === message._id);
        if (exists) {
          console.log('Message already exists, skipping...', message._id);
          return prev;
        }
        return [...prev, message];
      });
      
      // If message is from admin, mark as read automatically since chat is open
      if (message.senderRole === 'admin' && message.receiver._id === currentUser._id) {
        setTimeout(() => markMessagesAsRead(), 1000);
      }
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

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedImage) return;
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

      // Gửi tin nhắn và chờ phản hồi từ socket thay vì tự thêm vào UI
      await axios.post('/chat/messages', {
        text: newMessage,
        image: imageUrl
      });

      // Chỉ reset form sau khi gửi thành công
      setNewMessage('');
      setSelectedImage(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Tin nhắn sẽ được thêm vào UI thông qua socket event 'newMessage'
      
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
      
      // Tin nhắn sẽ được xóa khỏi UI thông qua socket event 'messageDeleted'
      
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
        return <Check className="w-4 h-4 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-medium">A</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-800">Admin Support</h3>
              <p className="text-sm text-green-500">Đang hoạt động</p>
            </div>
          </div>
          
          {error && (
            <div className="mt-2 text-red-500 text-sm">{error}</div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              <p>Chào mừng bạn đến với hệ thống hỗ trợ!</p>
              <p className="mt-2">Hãy gửi tin nhắn để được hỗ trợ.</p>
            </div>
          ) : (
            messages.map((message) => {
              const isCurrentUser = message.sender._id === currentUser._id;
              const isEditing = editingMessageId === message._id;
              const isDeleting = deletingMessageId === message._id;
              
              return (
                <div
                  key={message._id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} ${
                    isDeleting ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative group ${
                      isCurrentUser
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-800 shadow-sm'
                    }`}
                  >
                    {!isCurrentUser && (
                      <div className="text-xs text-gray-500 mb-1">Admin</div>
                    )}

                    {/* Message Options (only for current user) */}
                    {isCurrentUser && !isDeleting && (
                      <div className="dropdown-container absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setDropdownOpen(dropdownOpen === message._id ? null : message._id)}
                          className="bg-gray-200 text-gray-600 p-1 rounded-full hover:bg-gray-300"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        {dropdownOpen === message._id && (
                          <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-10">
                            <button
                              onClick={() => startEditing(message)}
                              className="flex items-center px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 w-full"
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Sửa
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(message._id)}
                              className="flex items-center px-3 py-1 text-sm text-red-600 hover:bg-gray-100 w-full"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Xóa
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {isDeleting && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-lg">
                        <div className="text-white text-xs">Đang xóa...</div>
                      </div>
                    )}
                    
                    {message.image && (
                      <img
                        src={`http://localhost:5000${message.image}`}
                        alt="Shared image"
                        className="max-w-full h-auto rounded-lg mb-2"
                      />
                    )}
                    
                    {message.text && (
                      <div>
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full p-2 text-sm border rounded text-gray-800 bg-white"
                              rows={2}
                            />
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEditMessage(message._id, editingText)}
                                className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                              >
                                Lưu
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm">{message.text}</p>
                            {message.edited && (
                              <p className="text-xs opacity-75 mt-1">(đã chỉnh sửa)</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!isEditing && (
                      <div className={`flex items-center justify-between mt-2 ${
                        isCurrentUser ? 'text-blue-200' : 'text-gray-500'
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
                </div>
              );
            })
          )}
          
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
                onClick={removeImage}
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