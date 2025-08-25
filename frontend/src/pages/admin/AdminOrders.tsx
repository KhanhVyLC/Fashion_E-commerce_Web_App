// src/pages/admin/AdminOrders.tsx - Complete Version with Payment Confirmation
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
  User,
  DollarSign,
  CreditCard,
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Check,
  MapPin,
  Phone,
  Mail,
  ShoppingBag,
  Hash
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
    address?: string;
  };
  items: Array<{
    product: {
      _id: string;
      name: string;
      price: number;
      images: string[];
      category?: string;
      brand?: string;
    };
    quantity: number;
    size: string;
    color: string;
    price: number;
  }>;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    recipientName?: string;
    recipientPhone?: string;
  };
  paymentMethod: string;
  paymentStatus: string;
  paymentDetails?: {
    transactionId?: string;
    paidAt?: string;
    method?: string;
    amount?: number;
  };
  orderStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  voucherCode?: string;
  voucherDiscount?: number;
  shippingFee?: number;
  notes?: string;
  createdAt: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

interface HighlightedOrder {
  orderId: string;
  orderStatus: string;
  timestamp: string;
}

interface PaymentConfirmationModal {
  show: boolean;
  order: Order | null;
  transactionId: string;
  paymentDate: string;
  paymentMethod: string;
  amount: string;
  notes: string;
}

const AdminOrders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [highlightedOrders, setHighlightedOrders] = useState<HighlightedOrder[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Payment confirmation modal state
  const [paymentModal, setPaymentModal] = useState<PaymentConfirmationModal>({
    show: false,
    order: null,
    transactionId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    amount: '',
    notes: ''
  });

  // Batch actions
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showBatchActions, setShowBatchActions] = useState(false);

  // Load highlighted orders from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('highlightedOrders');
    if (stored) {
      const parsed = JSON.parse(stored);
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

    if (user && (user.email === 'admin@gmail.com' || user.role === 'admin')) {
      socketRef.current.emit('joinAdminRoom');
    }

    socketRef.current.on('newOrderNotification', (data: any) => {
      console.log('New order notification received:', data);
      
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
      
      setShowNewOrderAlert(true);
      setTimeout(() => setShowNewOrderAlert(false), 5000);
      
      fetchOrders(true);
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
          status: statusFilter,
          paymentStatus: paymentFilter
        }
      });
      
      setOrders(response.data.orders || []);
      setTotalPages(response.data.pages || 1);
      setLastUpdateTime(new Date());
      
      if (showRefreshIndicator) {
        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 2000);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, statusFilter, paymentFilter]);

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

  // New function: Confirm Payment
  const openPaymentModal = (order: Order) => {
    // Tự động tạo mã giao dịch
    const autoTransactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    setPaymentModal({
      show: true,
      order: order,
      transactionId: autoTransactionId, // Mã tự động
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: order.paymentMethod || 'BankTransfer',
      amount: order.totalAmount.toString(),
      notes: ''
    });
  };

  const confirmPayment = async () => {
    if (!paymentModal.order) return;

    try {
      await axios.patch(`/admin/orders/${paymentModal.order._id}/payment`, {
        transactionId: paymentModal.transactionId,
        paidAt: paymentModal.paymentDate,
        method: paymentModal.paymentMethod,
        amount: parseFloat(paymentModal.amount),
        notes: paymentModal.notes
      });

      // Update local state
      setOrders(orders.map(order => 
        order._id === paymentModal.order!._id 
          ? { 
              ...order, 
              paymentStatus: 'paid',
              paymentDetails: {
                transactionId: paymentModal.transactionId,
                paidAt: paymentModal.paymentDate,
                method: paymentModal.paymentMethod,
                amount: parseFloat(paymentModal.amount)
              }
            } 
          : order
      ));

      // Close modal and refresh
      setPaymentModal({
        show: false,
        order: null,
        transactionId: '',
        paymentDate: '',
        paymentMethod: '',
        amount: '',
        notes: ''
      });

      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 2000);
      fetchOrders(true);

      alert('Xác nhận thanh toán thành công!');
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('Lỗi khi xác nhận thanh toán');
    }
  };

  // Batch update functions
  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev => {
      if (prev.includes(orderId)) {
        return prev.filter(id => id !== orderId);
      }
      return [...prev, orderId];
    });
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o._id));
    }
  };

  const handleBatchStatusUpdate = async (newStatus: string) => {
    if (selectedOrders.length === 0) return;

    try {
      await axios.patch('/admin/orders/batch-update', {
        orderIds: selectedOrders,
        status: newStatus,
        notifyCustomers: true
      });

      setSelectedOrders([]);
      setShowBatchActions(false);
      fetchOrders(true);
      alert(`Đã cập nhật ${selectedOrders.length} đơn hàng`);
    } catch (error) {
      console.error('Error batch updating orders:', error);
      alert('Lỗi khi cập nhật hàng loạt');
    }
  };

  const handleViewDetails = async (orderId: string) => {
    try {
      const response = await axios.get(`/admin/orders/${orderId}`);
      setSelectedOrder(response.data);
      setShowDetailModal(true);
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

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Đã thanh toán';
      case 'pending': return 'Chờ thanh toán';
      case 'failed': return 'Thanh toán thất bại';
      case 'refunded': return 'Đã hoàn tiền';
      default: return status;
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'COD': return 'Thanh toán khi nhận hàng';
      case 'BankTransfer': return 'Chuyển khoản ngân hàng';
      case 'CreditCard': return 'Thẻ tín dụng';
      case 'EWallet': return 'Ví điện tử';
      default: return method;
    }
  };

  const exportOrders = async () => {
    try {
      const response = await axios.get('/admin/orders/export/csv', {
        params: {
          status: statusFilter,
          paymentStatus: paymentFilter
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orders-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting orders:', error);
      alert('Lỗi khi xuất file');
    }
  };

  // Helper function to get image URL
  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return '/placeholder-image.png';
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    return `http://localhost:5000${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
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
            onClick={exportOrders}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          
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

            <select
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả thanh toán</option>
              <option value="pending">Chờ thanh toán</option>
              <option value="paid">Đã thanh toán</option>
              <option value="failed">Thất bại</option>
              <option value="refunded">Đã hoàn tiền</option>
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
                <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                <span className="text-gray-600">
                  Chờ thanh toán: {orders.filter(o => o.paymentStatus === 'pending').length}
                </span>
              </div>
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            Cập nhật lúc: {lastUpdateTime.toLocaleTimeString('vi-VN')}
          </div>
        </div>

        {/* Batch Actions */}
        {selectedOrders.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-800">
                Đã chọn {selectedOrders.length} đơn hàng
              </span>
              <button
                onClick={() => handleBatchStatusUpdate('processing')}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Xử lý
              </button>
              <button
                onClick={() => handleBatchStatusUpdate('shipped')}
                className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
              >
                Giao hàng
              </button>
              <button
                onClick={() => handleBatchStatusUpdate('delivered')}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Hoàn thành
              </button>
            </div>
            <button
              onClick={() => setSelectedOrders([])}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Bỏ chọn tất cả
            </button>
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={orders.length > 0 && selectedOrders.length === orders.length}
                  onChange={handleSelectAll}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
              </th>
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
                Thanh toán
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
                <td colSpan={8} className="text-center py-8 text-gray-500">
                  <div className="flex items-center justify-center space-x-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Đang tải...</span>
                  </div>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-500">
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
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order._id)}
                        onChange={() => handleSelectOrder(order._id)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center space-x-2">
                        {isHighlighted && (
                          <Sparkles className={`w-4 h-4 ${
                            isNewOrder ? 'text-yellow-500' : 'text-red-500'
                          } animate-pulse`} />
                        )}
                        <span className="font-mono">#{order._id.slice(-8).toUpperCase()}</span>
                        {isNewOrder && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-semibold animate-pulse">
                            MỚI
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
                      <div>
                        <div className="font-semibold">{formatCurrency(order.totalAmount)}</div>
                        {order.discountAmount > 0 && (
                          <div className="text-xs text-green-600">
                            -<DollarSign className="w-3 h-3 inline" />{formatCurrency(order.discountAmount)}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">{order.items.length} sản phẩm</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(order.paymentStatus)}`}>
                          {getPaymentStatusText(order.paymentStatus)}
                        </span>
                        <div className="text-xs text-gray-500">
                          {getPaymentMethodText(order.paymentMethod)}
                        </div>
                        {order.paymentStatus === 'pending' && (
                          <button
                            onClick={() => openPaymentModal(order)}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                          >
                            <CreditCard className="w-3 h-3 mr-1" />
                            Xác nhận
                          </button>
                        )}
                      </div>
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

      {/* Payment Confirmation Modal */}
      {paymentModal.show && paymentModal.order && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold flex items-center">
                <CreditCard className="w-6 h-6 mr-2 text-green-600" />
                Xác nhận thanh toán
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Đơn hàng #{paymentModal.order._id.slice(-8).toUpperCase()}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mã giao dịch <span className="text-green-600">(Tự động)</span>
                  </label>
                  <input
                    type="text"
                    value={paymentModal.transactionId}
                    onChange={(e) => setPaymentModal({...paymentModal, transactionId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    placeholder="Mã tự động tạo"
                    readOnly
                  />
                  <p className="text-xs text-gray-500 mt-1">Mã giao dịch được tạo tự động</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ngày thanh toán
                  </label>
                  <input
                    type="date"
                    value={paymentModal.paymentDate}
                    onChange={(e) => setPaymentModal({...paymentModal, paymentDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phương thức thanh toán
                  </label>
                  <select
                    value={paymentModal.paymentMethod}
                    onChange={(e) => setPaymentModal({...paymentModal, paymentMethod: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="BankTransfer">Chuyển khoản ngân hàng</option>
                    <option value="COD">Thanh toán khi nhận hàng</option>
                    <option value="CreditCard">Thẻ tín dụng</option>
                    <option value="EWallet">Ví điện tử</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Số tiền
                  </label>
                  <input
                    type="number"
                    value={paymentModal.amount}
                    onChange={(e) => setPaymentModal({...paymentModal, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ghi chú
                </label>
                <textarea
                  value={paymentModal.notes}
                  onChange={(e) => setPaymentModal({...paymentModal, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Ghi chú về thanh toán..."
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Thông tin đơn hàng</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Khách hàng:</span>
                    <span className="font-medium">{paymentModal.order.user.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tổng tiền:</span>
                    <span className="font-medium">{formatCurrency(paymentModal.order.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phương thức đặt hàng:</span>
                    <span className="font-medium">{getPaymentMethodText(paymentModal.order.paymentMethod)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end space-x-3">
              <button
                onClick={() => setPaymentModal({
                  show: false,
                  order: null,
                  transactionId: '',
                  paymentDate: '',
                  paymentMethod: '',
                  amount: '',
                  notes: ''
                })}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={confirmPayment}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <Check className="w-4 h-4 mr-2" />
                Xác nhận thanh toán
              </button>
            </div>
          </div>
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
                  Chi tiết đơn hàng #{selectedOrder._id.slice(-8).toUpperCase()}
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
              {/* Status and Payment Update Bar */}
              <div className="grid grid-cols-2 gap-4">
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

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-gray-700">Thanh toán:</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getPaymentStatusColor(selectedOrder.paymentStatus)}`}>
                        {getPaymentStatusText(selectedOrder.paymentStatus)}
                      </span>
                      {selectedOrder.paymentStatus === 'pending' && (
                        <button
                          onClick={() => {
                            setShowDetailModal(false);
                            openPaymentModal(selectedOrder);
                          }}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                        >
                          Xác nhận
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedOrder.paymentDetails && (
                    <div className="mt-2 text-sm text-gray-600">
                      <p>Mã GD: {selectedOrder.paymentDetails.transactionId}</p>
                      <p>Ngày: {selectedOrder.paymentDetails.paidAt ? formatDate(selectedOrder.paymentDetails.paidAt) : ''}</p>
                    </div>
                  )}
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
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Tên:</span>
                      <span className="font-medium">{selectedOrder.user.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">Email:</span>
                      <span className="font-medium">{selectedOrder.user.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">SĐT:</span>
                      <span className="font-medium">{selectedOrder.user.phone || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 text-gray-700 flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Địa chỉ giao hàng
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-1">
                    {selectedOrder.shippingAddress.recipientName && (
                      <p className="font-medium">{selectedOrder.shippingAddress.recipientName}</p>
                    )}
                    {selectedOrder.shippingAddress.recipientPhone && (
                      <p className="text-sm text-gray-600">{selectedOrder.shippingAddress.recipientPhone}</p>
                    )}
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
                  <ShoppingBag className="w-5 h-5 mr-2" />
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
                                src={getImageUrl(item.product.images?.[0])}
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
                            <p>Phương thức thanh toán: <span className="font-medium">{getPaymentMethodText(selectedOrder.paymentMethod)}</span></p>
                            <p>Trạng thái thanh toán: <span className={`font-medium ${selectedOrder.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                              {getPaymentStatusText(selectedOrder.paymentStatus)}
                            </span></p>
                            {selectedOrder.voucherCode && (
                              <p>Mã giảm giá: <span className="font-medium">{selectedOrder.voucherCode}</span></p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="space-y-1">
                            <div className="text-sm">
                              <span className="text-gray-600">Tạm tính:</span>
                            </div>
                            {selectedOrder.discountAmount > 0 && (
                              <div className="text-sm">
                                <span className="text-gray-600">Giảm giá:</span>
                              </div>
                            )}
                            {selectedOrder.shippingFee && selectedOrder.shippingFee > 0 && (
                              <div className="text-sm">
                                <span className="text-gray-600">Phí ship:</span>
                              </div>
                            )}
                            <div className="font-semibold text-gray-700">
                              Tổng cộng:
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="space-y-1">
                            <div className="text-sm">
                              {formatCurrency(selectedOrder.subtotal || selectedOrder.totalAmount)}
                            </div>
                            {selectedOrder.discountAmount > 0 && (
                              <div className="text-sm text-green-600">
                                -{formatCurrency(selectedOrder.discountAmount)}
                              </div>
                            )}
                            {selectedOrder.shippingFee && selectedOrder.shippingFee > 0 && (
                              <div className="text-sm">
                                {formatCurrency(selectedOrder.shippingFee)}
                              </div>
                            )}
                            <div className="font-bold text-xl text-gray-900">
                              {formatCurrency(selectedOrder.totalAmount)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Order Timeline & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      {selectedOrder.cancelledAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Đã hủy</span>
                          <span className="text-sm font-medium text-red-600">
                            {formatDate(selectedOrder.cancelledAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div>
                    <h3 className="font-semibold mb-3 text-gray-700 flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      Ghi chú
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">{selectedOrder.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
