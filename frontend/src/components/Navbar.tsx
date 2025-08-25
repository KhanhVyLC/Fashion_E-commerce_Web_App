// src/components/Navbar.tsx - Optimized and styled
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
  ChatBubbleLeftRightIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  // Socket connection and unread count logic (unchanged)
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    let socket: any = null;
    fetchUnreadCount();

    socket = io('http://localhost:5000');
    
    socket.on('connect', () => {
      console.log('Navbar connected to socket');
      socket.emit('joinChat', user._id);
      socket.emit('join', `user-${user._id}`);
      
      if (user.email === 'admin@gmail.com') {
        socket.emit('joinAdminRoom');
      }
    });

    socket.on('newMessage', (message: any) => {
      console.log('New message received:', message);
      
      if (user.email !== 'admin@gmail.com') {
        if (message.receiver._id === user._id && message.senderRole === 'admin' && message.status !== 'read') {
          setUnreadCount(prev => prev + 1);
        }
      }
    });

    socket.on('newClientMessage', ({ message, conversationId }: any) => {
      console.log('New client message for admin:', message);
      
      if (user.email === 'admin@gmail.com' && message.status !== 'read') {
        fetchUnreadCount();
      }
    });

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
        const response = await axios.get('/chat/conversations');
        const totalUnread = response.data.reduce((sum: number, conv: any) => {
          return sum + (conv.unreadCount || 0);
        }, 0);
        console.log('Admin total unread:', totalUnread);
        setUnreadCount(totalUnread);
      } else {
        const response = await axios.get('/chat/messages');
        const messages = response.data.messages || [];
        
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
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  // Badge component for notifications
  const NotificationBadge = ({ count, className = "", animate = false }: { count: number; className?: string; animate?: boolean }) => (
    count > 0 ? (
      <span className={`absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium ${animate ? 'animate-pulse' : ''} ${className}`}>
        {count > 9 ? '9+' : count}
      </span>
    ) : null
  );

  // Navigation link component
  const NavLink = ({ to, children, onClick, className = "" }: { to?: string, children: React.ReactNode, onClick?: () => void, className?: string }) => (
    to ? (
      <Link 
        to={to} 
        className={`text-gray-600 hover:text-blue-600 transition-colors duration-200 font-medium ${className}`}
        onClick={onClick}
      >
        {children}
      </Link>
    ) : (
      <button 
        onClick={onClick}
        className={`text-gray-600 hover:text-blue-600 transition-colors duration-200 font-medium ${className}`}
      >
        {children}
      </button>
    )
  );

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50 border-b border-gray-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link 
            to="/" 
            className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
          >
            Fashion Shop
          </Link>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center space-x-8">
            <NavLink to="/">Trang chủ</NavLink>
            
            {user && (
              <>
                <NavLink to="/wishlist" className="flex items-center space-x-1">
                  <HeartIcon className="h-5 w-5" />
                  <span>Yêu thích</span>
                </NavLink>
                
                <NavLink to="/view-history" className="flex items-center space-x-1">
                  <ClockIcon className="h-5 w-5" />
                  <span>Đã xem</span>
                </NavLink>
                
                <NavLink onClick={handleChatClick} className="flex items-center space-x-1 relative">
                  <ChatBubbleLeftRightIcon className="h-5 w-5" />
                  <span>Chat</span>
                  <NotificationBadge count={unreadCount} animate />
                </NavLink>
                
                <NavLink to="/orders">Đơn hàng</NavLink>
              </>
            )}

            {/* Cart */}
            <Link to="/cart" className="relative p-2 text-gray-600 hover:text-blue-600 transition-colors duration-200">
              <ShoppingCartIcon className="h-6 w-6" />
              <NotificationBadge count={totalItems} className="bg-red-500" />
            </Link>

            {/* User Menu */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 border border-transparent hover:border-blue-200"
                >
                  <UserIcon className="h-5 w-5" />
                  <span className="font-medium">{user.name}</span>
                  <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${userDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Dropdown Menu - with higher z-index */}
                {userDropdownOpen && (
                  <>
                    {/* Overlay to close dropdown */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setUserDropdownOpen(false)}
                    />
                    
                    {/* Dropdown content */}
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 transform opacity-100 scale-100 transition-all duration-200">

                      
                      <div className="py-2">
                        <Link
                          to="/profile"
                          className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors duration-200"
                          onClick={() => setUserDropdownOpen(false)}
                        >
                          <UserIcon className="h-4 w-4 mr-3" />
                          Quản lý tài khoản
                        </Link>
                        
                        <button
                          onClick={handleLogout}
                          className="flex items-center w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
                        >
                          <svg className="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Đăng xuất
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <NavLink to="/login">Đăng nhập</NavLink>
                <Link
                  to="/register"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
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
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-6 space-y-4">
              <NavLink to="/" onClick={() => setMobileMenuOpen(false)} className="block py-2">
                Trang chủ
              </NavLink>
              
              {user && (
                <>
                  <NavLink to="/wishlist" onClick={() => setMobileMenuOpen(false)} className="block py-2">
                    <div className="flex items-center space-x-3">
                      <HeartIcon className="h-5 w-5" />
                      <span>Yêu thích</span>
                    </div>
                  </NavLink>
                  
                  <NavLink to="/view-history" onClick={() => setMobileMenuOpen(false)} className="block py-2">
                    <div className="flex items-center space-x-3">
                      <ClockIcon className="h-5 w-5" />
                      <span>Đã xem</span>
                    </div>
                  </NavLink>
                  
                  <NavLink onClick={handleChatClick} className="block py-2">
                    <div className="flex items-center space-x-3 relative">
                      <ChatBubbleLeftRightIcon className="h-5 w-5" />
                      <span>Chat</span>
                      {unreadCount > 0 && (
                        <span className="bg-red-500 text-white rounded-full px-2 py-0.5 text-xs font-medium">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </NavLink>
                  
                  <NavLink to="/orders" onClick={() => setMobileMenuOpen(false)} className="block py-2">
                    Đơn hàng
                  </NavLink>
                </>
              )}

              <NavLink to="/cart" onClick={() => setMobileMenuOpen(false)} className="block py-2">
                <div className="flex items-center space-x-3">
                  <ShoppingCartIcon className="h-5 w-5" />
                  <span>Giỏ hàng ({totalItems})</span>
                </div>
              </NavLink>

              {user ? (
                <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  
                  <NavLink to="/profile" onClick={() => setMobileMenuOpen(false)} className="block py-2">
                    <div className="flex items-center space-x-3">
                      <UserIcon className="h-5 w-5" />
                      <span>Quản lý tài khoản</span>
                    </div>
                  </NavLink>
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3 w-full text-left py-2 text-red-600 hover:text-red-700 transition-colors duration-200"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              ) : (
                <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
                  <NavLink to="/login" onClick={() => setMobileMenuOpen(false)} className="block py-2">
                    Đăng nhập
                  </NavLink>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium text-center"
                  >
                    Đăng ký
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
