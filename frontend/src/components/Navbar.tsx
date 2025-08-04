// src/components/Navbar.tsx - Fixed unread messages count
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from '../utils/axios';

import {
  ShoppingCartIcon,
  UserIcon,
  HeartIcon,
  ClockIcon,
  Bars3Icon,
  XMarkIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    let socket: any = null;

    // Initial fetch of unread count
    fetchUnreadCount();

    // Setup socket connection
    socket = io('http://localhost:5000');
    
    socket.on('connect', () => {
      console.log('Navbar connected to socket');
      socket.emit('joinChat', user._id);
      
      // Join user-specific room
      socket.emit('join', `user-${user._id}`);
      
      // If admin, join admin room
      if (user.email === 'admin@gmail.com') {
        socket.emit('joinAdminRoom');
      }
    });

    // Listen for new messages
    socket.on('newMessage', (message: any) => {
      console.log('New message received:', message);
      
      // For regular users: count if message is from admin and user is the receiver
      if (user.email !== 'admin@gmail.com') {
        if (message.receiver._id === user._id && message.senderRole === 'admin' && message.status !== 'read') {
          setUnreadCount(prev => prev + 1);
        }
      }
    });

    // For admin: listen to new client messages
    socket.on('newClientMessage', ({ message, conversationId }: any) => {
      console.log('New client message for admin:', message);
      
      if (user.email === 'admin@gmail.com' && message.status !== 'read') {
        fetchUnreadCount(); // Refetch total unread for admin
      }
    });

    // Listen for messages marked as read
    socket.on('messagesMarkedAsRead', ({ conversationId, count }: any) => {
      console.log('Messages marked as read:', count);
      fetchUnreadCount();
    });

    socket.on('allMessagesRead', ({ userId }: any) => {
      console.log('All messages read for user:', userId);
      if (userId === user._id) {
        setUnreadCount(0);
      }
    });

    // Cleanup
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user) return;

    try {
      if (user.email === 'admin@gmail.com') {
        // For admin: get total unread from all conversations
        const response = await axios.get('/chat/conversations');
        const totalUnread = response.data.reduce((sum: number, conv: any) => {
          return sum + (conv.unreadCount || 0);
        }, 0);
        console.log('Admin total unread:', totalUnread);
        setUnreadCount(totalUnread);
      } else {
        // For client: count unread messages from admin
        const response = await axios.get('/chat/messages');
        const messages = response.data.messages || [];
        
        // Count messages where:
        // 1. User is the receiver
        // 2. Message is from admin
        // 3. Status is not 'read'
        const unreadMessages = messages.filter((msg: any) => 
          msg.receiver._id === user._id && 
          msg.senderRole === 'admin' && 
          msg.status !== 'read'
        );
        
        console.log('Client unread messages:', unreadMessages.length);
        setUnreadCount(unreadMessages.length);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setUnreadCount(0);
    }
  };

  const handleChatClick = () => {
    navigate('/chat');
    // Don't reset count here, let the chat component handle marking as read
  };

  // Reset count when user logs out
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
    }
  }, [user]);

  return (
    <nav className="bg-white shadow-md sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-2xl font-bold text-gray-800">
            Fashion Shop
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-gray-600 hover:text-gray-800">
              Trang chủ
            </Link>
            
            {user && (
              <>
                <Link to="/wishlist" className="text-gray-600 hover:text-gray-800 flex items-center">
                  <HeartIcon className="h-5 w-5 mr-1" />
                  Yêu thích
                </Link>
                <Link to="/view-history" className="text-gray-600 hover:text-gray-800 flex items-center">
                  <ClockIcon className="h-5 w-5 mr-1" />
                  Đã xem
                </Link>
                <button
                  onClick={handleChatClick}
                  className="text-gray-600 hover:text-gray-800 flex items-center relative"
                >
                  <ChatBubbleLeftRightIcon className="h-5 w-5 mr-1" />
                  Chat
                  {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </>
            )}

            <Link to="/cart" className="relative">
              <ShoppingCartIcon className="h-6 w-6 text-gray-600" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  {totalItems}
                </span>
              )}
            </Link>

            {user ? (
              <div className="flex items-center space-x-4">
                <Link to="/orders" className="text-gray-600 hover:text-gray-800">
                  Đơn hàng
                </Link>
                <div className="relative group">
                  <button className="flex items-center space-x-1 text-gray-600 hover:text-gray-800">
                    <UserIcon className="h-5 w-5" />
                    <span>{user.name}</span>
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      Tài khoản
                    </Link>
                    <button
                      onClick={logout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link to="/login" className="text-gray-600 hover:text-gray-800">
                  Đăng nhập
                </Link>
                <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                  Đăng ký
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden"
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="space-y-2">
              <Link to="/" className="block py-2 text-gray-600 hover:text-gray-800">
                Trang chủ
              </Link>
              
              {user && (
                <>
                  <Link to="/wishlist" className="block py-2 text-gray-600 hover:text-gray-800">
                    Yêu thích
                  </Link>
                  <Link to="/view-history" className="block py-2 text-gray-600 hover:text-gray-800">
                    Đã xem
                  </Link>
                  <button
                    onClick={handleChatClick}
                    className="block w-full text-left py-2 text-gray-600 hover:text-gray-800 relative"
                  >
                    Chat
                    {unreadCount > 0 && (
                      <span className="inline-block ml-2 bg-red-500 text-white rounded-full px-2 py-0.5 text-xs">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <Link to="/orders" className="block py-2 text-gray-600 hover:text-gray-800">
                    Đơn hàng
                  </Link>
                </>
              )}

              <Link to="/cart" className="block py-2 text-gray-600 hover:text-gray-800">
                Giỏ hàng ({totalItems})
              </Link>

              {user ? (
                <>
                  <Link to="/profile" className="block py-2 text-gray-600 hover:text-gray-800">
                    Tài khoản ({user.name})
                  </Link>
                  <button
                    onClick={logout}
                    className="block w-full text-left py-2 text-gray-600 hover:text-gray-800"
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="block py-2 text-gray-600 hover:text-gray-800">
                    Đăng nhập
                  </Link>
                  <Link to="/register" className="block py-2 text-gray-600 hover:text-gray-800">
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;