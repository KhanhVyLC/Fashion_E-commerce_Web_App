// src/components/admin/AdminHeader.tsx - Updated version
import React, { useState, useEffect, useRef } from 'react';
import { Menu, Bell, User, ShoppingCart, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
import io, { Socket } from 'socket.io-client';

interface Notification {
  _id: string;
  type: 'new_order' | 'new_message' | 'low_stock';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: {
    orderId?: string;
    conversationId?: string;
    productId?: string;
    orderStatus?: string;
  };
}

interface AdminHeaderProps {
  toggleSidebar: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({ toggleSidebar }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');
    
    if (user && user.email === 'admin@gmail.com') {
      socketRef.current.emit('joinAdminRoom');
    }

    // Listen for new order notifications
    socketRef.current.on('newOrderNotification', (data: any) => {
      const newNotification: Notification = {
        _id: `order_${Date.now()}`,
        type: 'new_order',
        title: 'Đơn hàng mới',
        message: `Đơn hàng #${data.orderId.slice(-8)} từ ${data.customerName}`,
        read: false,
        createdAt: new Date().toISOString(),
        data: { 
          orderId: data.orderId,
          orderStatus: 'pending'
        }
      };
      
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);
      playNotificationSound();
    });

    // Listen for new message notifications
    socketRef.current.on('newMessageNotification', (data: any) => {
      const newNotification: Notification = {
        _id: `msg_${Date.now()}`,
        type: 'new_message',
        title: 'Tin nhắn mới',
        message: `Tin nhắn mới từ ${data.senderName}`,
        read: false,
        createdAt: new Date().toISOString(),
        data: { conversationId: data.conversationId }
      };
      
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);
      playNotificationSound();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off('newOrderNotification');
        socketRef.current.off('newMessageNotification');
        socketRef.current.disconnect();
      }
    };
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const playNotificationSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl+zPDTizUGHGS67OqfWBgKNqHq9cFuIAY1k9z02H');
      audio.volume = 0.3;
      audio.play();
    } catch (e) {
      console.log('Could not play notification sound');
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/admin/notifications');
      setNotifications(response.data);
      setUnreadCount(response.data.filter((n: Notification) => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    await markAsRead(notification._id);
    
    // Close dropdown
    setShowNotifications(false);
    
    // Navigate based on type
    switch (notification.type) {
      case 'new_order':
        // Store order info for highlighting
        const orderInfo = {
          orderId: notification.data?.orderId,
          orderStatus: notification.data?.orderStatus || 'pending',
          timestamp: new Date().toISOString()
        };
        
        // Get existing highlighted orders
        const existingHighlights = JSON.parse(sessionStorage.getItem('highlightedOrders') || '[]');
        
        // Add new order if not already there
        if (!existingHighlights.find((o: any) => o.orderId === orderInfo.orderId)) {
          existingHighlights.push(orderInfo);
          sessionStorage.setItem('highlightedOrders', JSON.stringify(existingHighlights));
        }
        
        navigate('/admin/orders');
        break;
        
      case 'new_message':
        if (notification.data?.conversationId) {
          navigate('/admin/chat', { state: { conversationId: notification.data.conversationId } });
        } else {
          navigate('/admin/chat');
        }
        break;
        
      default:
        break;
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await axios.patch(`/admin/notifications/${notificationId}/read`);
      setNotifications(notifications.map(n => 
        n._id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.patch('/admin/notifications/mark-all-read');
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_order':
        return <ShoppingCart className="w-4 h-4 text-blue-500" />;
      case 'new_message':
        return <MessageSquare className="w-4 h-4 text-green-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <header className="bg-white shadow-sm relative">
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={toggleSidebar}
          className="text-gray-600 hover:text-gray-900 focus:outline-none"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex items-center space-x-4">
          {/* Notification Bell */}
          <div ref={notificationRef} className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative text-gray-600 hover:text-gray-900 focus:outline-none p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 -mt-1 -mr-1 px-2 py-1 text-xs text-white bg-red-500 rounded-full animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Thông báo</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Đánh dấu tất cả đã đọc
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Không có thông báo mới</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification._id}
                        className={`p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                          !notification.read ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-sm text-gray-900">
                              {notification.title}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                              {new Date(notification.createdAt).toLocaleString('vi-VN')}
                            </p>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2"></div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-gray-600" />
            </div>
            <span className="text-gray-700">{user?.name || 'Admin'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;