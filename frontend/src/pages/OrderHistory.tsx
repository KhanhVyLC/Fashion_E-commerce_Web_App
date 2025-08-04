// src/pages/OrderHistory.tsx - Updated với nút Hủy đơn hàng
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from '../utils/axios';
import ReviewForm from '../components/ReviewForm';
import { useAuth } from '../context/AuthContext';
import { ShoppingBagIcon, XMarkIcon } from '@heroicons/react/24/outline';

const OrderHistory: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<{productId: string, orderId: string} | null>(null);
  const [cancelingOrder, setCancelingOrder] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<{orderId: string, orderNumber: string} | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const { data } = await axios.get('/orders/my-orders');
      console.log('Orders fetched:', data); // Debug
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setCancelingOrder(orderId);
    try {
      const { data } = await axios.put(`/orders/${orderId}/cancel`);
      
      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order._id === orderId 
            ? { ...order, orderStatus: 'cancelled' }
            : order
        )
      );
      
      setShowCancelModal(null);
      alert('Đơn hàng đã được hủy thành công!');
    } catch (error: any) {
      console.error('Error canceling order:', error);
      alert(error.response?.data?.message || 'Có lỗi xảy ra khi hủy đơn hàng');
    } finally {
      setCancelingOrder(null);
    }
  };

  const canCancelOrder = (orderStatus: string) => {
    return orderStatus === 'pending' || orderStatus === 'processing';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'processing': return 'text-blue-600 bg-blue-50';
      case 'shipped': return 'text-purple-600 bg-purple-50';
      case 'delivered': return 'text-green-600 bg-green-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Chờ xử lý';
      case 'processing': return 'Đang xử lý';
      case 'shipped': return 'Đang giao hàng';
      case 'delivered': return 'Đã giao hàng';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Vui lòng đăng nhập để xem lịch sử đơn hàng</p>
        <Link to="/login" className="text-blue-600 hover:underline">
          Đăng nhập
        </Link>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingBagIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Chưa có đơn hàng nào</h2>
        <p className="text-gray-500 mb-6">Hãy mua sắm và đặt hàng ngay!</p>
        <Link to="/" className="text-blue-600 hover:underline">
          Mua sắm ngay
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Lịch sử đơn hàng ({orders.length})</h1>

      <div className="space-y-4">
        {orders.map((order: any) => (
          <div key={order._id} className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Order Header */}
            <div className="bg-gray-50 px-6 py-4 border-b">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                  <p className="text-sm text-gray-600">
                    Mã đơn hàng: <span className="font-semibold text-gray-800">#{order._id.slice(-8)}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Ngày đặt: {new Date(order.createdAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.orderStatus)}`}>
                    {getStatusText(order.orderStatus)}
                  </span>
                  {canCancelOrder(order.orderStatus) && (
                    <button
                      onClick={() => setShowCancelModal({
                        orderId: order._id,
                        orderNumber: order._id.slice(-8)
                      })}
                      disabled={cancelingOrder === order._id}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        cancelingOrder === order._id
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                    >
                      {cancelingOrder === order._id ? 'Đang hủy...' : 'Hủy đơn'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="p-6">
              <div className="space-y-4">
                {order.items.map((item: any) => (
                  <div key={item._id} className="flex items-center space-x-4">
                    <img
                      src={item.product?.images?.[0] || '/placeholder.jpg'}
                      alt={item.product?.name || 'Product'}
                      className="w-20 h-20 object-cover rounded"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium">{item.product?.name || 'Sản phẩm đã xóa'}</h3>
                      <p className="text-sm text-gray-600">
                        Size: {item.size} | Màu: {item.color} | SL: {item.quantity}
                      </p>
                      <p className="text-sm font-semibold text-gray-800 mt-1">
                        {(item.price * item.quantity).toLocaleString('vi-VN')}₫
                      </p>
                    </div>
                    {order.orderStatus === 'delivered' && item.product && (
                      <button
                        onClick={() => setSelectedReview({productId: item.product._id, orderId: order._id})}
                        className="text-blue-600 text-sm hover:underline whitespace-nowrap"
                      >
                        Đánh giá
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="mt-6 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600">Phương thức thanh toán:</p>
                    <p className="font-medium">
                      {order.paymentMethod === 'COD' ? 'Thanh toán khi nhận hàng' : 'Chuyển khoản'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Tổng cộng:</p>
                    <p className="text-xl font-bold text-red-600">
                      {order.totalAmount.toLocaleString('vi-VN')}₫
                    </p>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              {order.shippingAddress && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-600 mb-1">Địa chỉ giao hàng:</p>
                  <p className="text-sm">
                    {order.shippingAddress.street}, {order.shippingAddress.state}, {order.shippingAddress.city}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Xác nhận hủy đơn hàng</h3>
              <button
                onClick={() => setShowCancelModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-2">
                Bạn có chắc chắn muốn hủy đơn hàng <span className="font-semibold">#{showCancelModal.orderNumber}</span> không?
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Lưu ý:</strong> Sau khi hủy, đơn hàng sẽ không thể khôi phục. Số lượng sản phẩm sẽ được hoàn trả về kho.
                </p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCancelModal(null)}
                className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Không, giữ lại
              </button>
              <button
                onClick={() => handleCancelOrder(showCancelModal.orderId)}
                disabled={cancelingOrder === showCancelModal.orderId}
                className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                  cancelingOrder === showCancelModal.orderId
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {cancelingOrder === showCancelModal.orderId ? 'Đang hủy...' : 'Có, hủy đơn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <ReviewForm
              productId={selectedReview.productId}
              orderId={selectedReview.orderId}
              onSuccess={() => {
                setSelectedReview(null);
                fetchOrders();
              }}
            />
            <button
              onClick={() => setSelectedReview(null)}
              className="mt-4 w-full text-gray-600 hover:text-gray-800"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistory;