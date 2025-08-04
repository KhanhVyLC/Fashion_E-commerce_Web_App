// src/pages/admin/AdminOrders.tsx - Updated with highlighting system
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Filter,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Bell,
  User
} from 'lucide-react';
import axios from '../../utils/axios';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';

interface Order {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  items: Array<{
    product: {
      _id: string;
      name: string;
      price: number;
      images: string[];
    };
    quantity: number;
    size: string;
    color: string;
    price: number;
  }>;
  totalAmount: number;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  deliveredAt?: string;
}

interface HighlightedOrder {
  orderId: string;
  orderStatus: string;
  timestamp: string;
}

const AdminOrders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [highlightedOrders, setHighlightedOrders] = useState<HighlightedOrder[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Load highlighted orders from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('highlightedOrders');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Clean up old highlights (older than 24 hours)
      const recentHighlights = parsed.filter((h: HighlightedOrder) => {
        const hoursSince = (new Date().getTime() - new Date(h.timestamp).getTime()) / (1000 * 60 * 60);
        return hoursSince < 24;
      });
      setHighlightedOrders(recentHighlights);
      sessionStorage.setItem('highlightedOrders', JSON.stringify(recentHighlights));
    }
  }, []);

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');

    if (user && user.email === 'admin@gmail.com') {
      socketRef.current.emit('joinAdminRoom');
    }

    socketRef.current.on('newOrderNotification', (data: any) => {
      console.log('New order notification received:', data);
      
      // Add to highlighted orders
      const newHighlight: HighlightedOrder = {
        orderId: data.orderId,
        orderStatus: 'pending',
        timestamp: new Date().toISOString()
      };
      
      setHighlightedOrders(prev => {
        const updated = [...prev, newHighlight];
        sessionStorage.setItem('highlightedOrders', JSON.stringify(updated));
        return updated;
      });
      
      // Show alert
      setShowNewOrderAlert(true);
      setTimeout(() => setShowNewOrderAlert(false), 5000);
      
      // Refresh orders
      fetchOrders(true);
      
      // Play sound
      playNotificationSound();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off('newOrderNotification');
        socketRef.current.disconnect();
      }
    };
  }, [user]);

  const playNotificationSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSl+zPDTizUGHGS67OqfWBgKNqHq9cFuIAY1k9z02H');
      audio.volume = 0.3;
      audio.play();
    } catch (e) {
      console.log('Could not play notification sound');
    }
  };

  const fetchOrders = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await axios.get('/admin/orders', {
        params: {
          page: currentPage,
          limit: 10,
          status: statusFilter
        }
      });
      
      setOrders(response.data.orders);
      setTotalPages(response.data.pages);
      setLastUpdateTime(new Date());
      
      if (showRefreshIndicator) {
        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 2000);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const clearOrderHighlight = (orderId: string) => {
    setHighlightedOrders(prev => {
      const updated = prev.filter(h => h.orderId !== orderId);
      sessionStorage.setItem('highlightedOrders', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllHighlights = () => {
    setHighlightedOrders([]);
    sessionStorage.removeItem('highlightedOrders');
  };

  const isOrderHighlighted = (orderId: string) => {
    return highlightedOrders.some(h => h.orderId === orderId);
  };

  const getHighlightInfo = (orderId: string) => {
    return highlightedOrders.find(h => h.orderId === orderId);
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await axios.patch(`/admin/orders/${orderId}/status`, {
        status: newStatus
      });
      
      setOrders(orders.map(order => 
        order._id === orderId ? { ...order, orderStatus: newStatus as any } : order
      ));
      
      if (selectedOrder?._id === orderId) {
        setSelectedOrder({ ...selectedOrder, orderStatus: newStatus as any });
      }

      // Clear highlight when status changes from pending
      if (newStatus !== 'pending') {
        clearOrderHighlight(orderId);
      }

      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 2000);

      setTimeout(() => {
        fetchOrders(true);
      }, 1000);
      
    } catch (error) {
      console.error('Error updating order status:', error);
      fetchOrders(true);
    }
  };

  const handleViewDetails = async (orderId: string) => {
    try {
      const response = await axios.get(`/admin/orders/${orderId}`);
      setSelectedOrder(response.data);
      setShowDetailModal(true);
      
      // Clear highlight when viewing details
      clearOrderHighlight(orderId);
    } catch (error) {
      console.error('Error fetching order details:', error);
    }
  };

  const handleManualRefresh = () => {
    fetchOrders(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Vừa xong';
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      }) + ' hôm nay';
    }
    
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'shipped': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'processing': return <Package className="w-4 h-4" />;
      case 'shipped': return <Truck className="w-4 h-4" />;
      case 'delivered': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Chờ xử lý';
      case 'processing': return 'Đang xử lý';
      case 'shipped': return 'Đang giao';
      case 'delivered': return 'Đã giao';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* New Order Alert */}
      {showNewOrderAlert && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
          <div className="bg-white rounded-lg shadow-lg border-l-4 border-blue-500 p-4 flex items-center space-x-3">
            <Bell className="w-6 h-6 text-blue-500 animate-bounce" />
            <div>
              <p className="font-semibold text-gray-900">Đơn hàng mới!</p>
              <p className="text-sm text-gray-600">Vừa có đơn hàng mới cần xử lý</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Quản lý đơn hàng</h1>
        
        <div className="flex items-center space-x-4">
          {/* Highlighted orders count */}
          {highlightedOrders.length > 0 && (
            <div className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg">
              <Sparkles className="w-5 h-5 animate-pulse" />
              <span className="font-medium">
                {highlightedOrders.length} đơn hàng chưa xem
              </span>
              <button
                onClick={clearAllHighlights}
                className="ml-2 text-yellow-600 hover:text-yellow-700"
                title="Xóa tất cả highlight"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {updateSuccess && (
            <div className="text-green-600 text-sm font-medium animate-fade-in">
              ✓ Cập nhật thành công
            </div>
          )}
          
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className={`flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all ${
              refreshing ? 'cursor-not-allowed' : ''
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Filters and Stats */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ xử lý</option>
              <option value="processing">Đang xử lý</option>
              <option value="shipped">Đang giao</option>
              <option value="delivered">Đã giao</option>
              <option value="cancelled">Đã hủy</option>
            </select>
            
            {/* Quick stats */}
            <div className="flex items-center space-x-6 ml-8 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <span className="text-gray-600">
                  Chờ xử lý: {orders.filter(o => o.orderStatus === 'pending').length}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                <span className="text-gray-600">
                  Đang xử lý: {orders.filter(o => o.orderStatus === 'processing').length}
                </span>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            Cập nhật lúc: {lastUpdateTime.toLocaleTimeString('vi-VN')}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mã đơn
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Khách hàng
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tổng tiền
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trạng thái
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ngày đặt
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  <div className="flex items-center justify-center space-x-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Đang tải...</span>
                  </div>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Không có đơn hàng nào</p>
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const isHighlighted = isOrderHighlighted(order._id);
                const highlightInfo = getHighlightInfo(order._id);
                const isNewOrder = isHighlighted && order.orderStatus === 'pending';
                const isCancelledHighlight = isHighlighted && highlightInfo?.orderStatus === 'cancelled';
                
                return (
                  <tr 
                    key={order._id} 
                    className={`hover:bg-gray-50 transition-all ${
                      isNewOrder ? 'bg-yellow-50 ring-2 ring-yellow-400 ring-opacity-50' : 
                      isCancelledHighlight ? 'bg-red-50 ring-2 ring-red-400 ring-opacity-50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center space-x-2">
                        {isHighlighted && (
                          <Sparkles className={`w-4 h-4 ${
                            isNewOrder ? 'text-yellow-500' : 'text-red-500'
                          } animate-pulse`} />
                        )}
                        <span className="font-mono">#{order._id}</span>
                        {isNewOrder && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-semibold animate-pulse">
                            MỚI
                          </span>
                        )}
                        {isCancelledHighlight && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-semibold">
                            ĐÃ HỦY
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {order.user.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-semibold">{formatCurrency(order.totalAmount)}</div>
                      <div className="text-xs text-gray-500">{order.items.length} sản phẩm</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(order.orderStatus)}
                        <select
                          value={order.orderStatus}
                          onChange={(e) => handleStatusUpdate(order._id, e.target.value)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(order.orderStatus)} cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                        >
                          <option value="pending">Chờ xử lý</option>
                          <option value="processing">Đang xử lý</option>
                          <option value="shipped">Đang giao</option>
                          <option value="delivered">Đã giao</option>
                          <option value="cancelled">Đã hủy</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{formatDate(order.createdAt)}</div>
                      {order.deliveredAt && (
                        <div className="text-xs text-green-600">
                          Giao: {formatDate(order.deliveredAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewDetails(order._id)}
                        className={`text-indigo-600 hover:text-indigo-900 p-2 hover:bg-indigo-50 rounded transition-all ${
                          isHighlighted ? 'animate-pulse' : ''
                        }`}
                        title="Xem chi tiết"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            «
          </button>
          
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ‹
          </button>
          
          {/* Page numbers */}
          {(() => {
            const pages = [];
            const maxVisible = 5;
            let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
            let end = Math.min(totalPages, start + maxVisible - 1);
            
            if (end - start + 1 < maxVisible) {
              start = Math.max(1, end - maxVisible + 1);
            }
            
            for (let i = start; i <= end; i++) {
              pages.push(
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`px-3 py-1 border rounded transition-all ${
                    currentPage === i 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {i}
                </button>
              );
            }
            
            return pages;
          })()}
          
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ›
          </button>
          
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            »
          </button>
        </div>
      )}

      {/* Order Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b bg-gray-50">
              <div>
                <h2 className="text-2xl font-bold">
                  Chi tiết đơn hàng #{selectedOrder._id}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Đặt lúc: {formatDate(selectedOrder.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status Update Bar */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(selectedOrder.orderStatus)}
                    <span className="font-medium text-gray-700">Trạng thái đơn hàng:</span>
                  </div>
                  <select
                    value={selectedOrder.orderStatus}
                    onChange={(e) => {
                      handleStatusUpdate(selectedOrder._id, e.target.value);
                      setSelectedOrder({ ...selectedOrder, orderStatus: e.target.value as any });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="pending">Chờ xử lý</option>
                    <option value="processing">Đang xử lý</option>
                    <option value="shipped">Đang giao</option>
                    <option value="delivered">Đã giao</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                </div>
              </div>

              {/* Customer and Shipping Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3 text-gray-700 flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Thông tin khách hàng
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tên:</span>
                      <span className="font-medium">{selectedOrder.user.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium">{selectedOrder.user.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">SĐT:</span>
                      <span className="font-medium">{selectedOrder.user.phone || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 text-gray-700 flex items-center">
                    <Truck className="w-5 h-5 mr-2" />
                    Địa chỉ giao hàng
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-1">
                    <p className="font-medium">{selectedOrder.shippingAddress.street}</p>
                    <p className="text-gray-600">
                      {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state}
                    </p>
                    <p className="text-gray-600">
                      {selectedOrder.shippingAddress.zipCode}, {selectedOrder.shippingAddress.country}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-700 flex items-center">
                  <Package className="w-5 h-5 mr-2" />
                  Sản phẩm ({selectedOrder.items.length})
                </h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Sản phẩm</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Số lượng</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Size/Màu</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Giá</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Tổng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedOrder.items.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <img
                                src={item.product.images[0].startsWith('http') 
                                  ? item.product.images[0] 
                                  : `http://localhost:5000${item.product.images[0]}`
                                }
                                alt={item.product.name}
                                className="w-16 h-16 object-cover rounded-lg mr-3"
                                onError={(e) => {
                                  e.currentTarget.src = '/placeholder-image.png';
                                }}
                              />
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {item.product.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  SKU: {item.product._id.slice(-8).toUpperCase()}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-medium">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 text-center text-sm">
                            <div className="flex flex-col items-center">
                              <span className="px-2 py-1 bg-gray-100 rounded text-xs">{item.size}</span>
                              <span className="text-xs text-gray-500 mt-1">{item.color}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {formatCurrency(item.price)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium">
                            {formatCurrency(item.price * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={3} className="px-4 py-3">
                          <div className="text-sm text-gray-600">
                            <p>Phương thức thanh toán: <span className="font-medium">{selectedOrder.paymentMethod}</span></p>
                            <p>Trạng thái thanh toán: <span className={`font-medium ${selectedOrder.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                              {selectedOrder.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                            </span></p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-700">
                          Tổng cộng:
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-xl text-gray-900">
                          {formatCurrency(selectedOrder.totalAmount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Order Timeline */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-700 flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Lịch sử đơn hàng
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Đơn hàng được tạo</span>
                      <span className="text-sm font-medium">{formatDate(selectedOrder.createdAt)}</span>
                    </div>
                    {selectedOrder.deliveredAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Đã giao hàng</span>
                        <span className="text-sm font-medium text-green-600">
                          {formatDate(selectedOrder.deliveredAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;