// src/pages/Checkout.tsx - Fixed to sync cart after successful order
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios'
import { useCart } from '../context/CartContext';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { clearCart, fetchCart } = useCart(); // Add fetchCart here
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [shippingAddress, setShippingAddress] = useState({
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'Vietnam'
  });
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [processing, setProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');

  useEffect(() => {
    // Get selected items from session storage
    const checkoutItemsStr = sessionStorage.getItem('checkoutItems');
    if (!checkoutItemsStr) {
      navigate('/cart');
      return;
    }
    
    const items = JSON.parse(checkoutItemsStr);
    setSelectedItems(items);
    
    // Final stock check when entering checkout
    checkFinalAvailability();
  }, []);

  const checkFinalAvailability = async () => {
    try {
      const { data } = await axios.get('http://localhost:5000/api/cart/check-availability');
      if (!data.available) {
        alert('Một số sản phẩm không còn đủ hàng. Quay lại giỏ hàng để kiểm tra.');
        navigate('/cart');
      }
    } catch (error) {
      console.error('Error checking availability:', error);
    }
  };

  const calculateTotal = () => {
    return selectedItems.reduce((total, item) => 
      total + (item.product.price * item.quantity), 0
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setProcessing(true);
    try {
      const selectedItemIds = selectedItems.map(item => item._id);
      
      const { data } = await axios.post('http://localhost:5000/api/orders/create', {
        shippingAddress,
        paymentMethod,
        selectedItemIds
      });
      
      setOrderId(data.order._id);
      setOrderSuccess(true);
      
      // Clear selected items from session storage
      sessionStorage.removeItem('checkoutItems');
      
      // IMPORTANT: Sync cart data after successful order
      if (data.remainingCartItems === 0) {
        clearCart(); // Clear local cart state
      } else {
        // Fetch updated cart from server to sync cart count
        await fetchCart();
      }
      
      // Show success message
      setTimeout(() => {
        navigate('/orders');
      }, 3000);
    } catch (error: any) {
      console.error('Error creating order:', error);
      
      if (error.response?.data?.unavailableItems) {
        alert('Một số sản phẩm không còn đủ hàng. Vui lòng quay lại giỏ hàng.');
        navigate('/cart');
      } else {
        alert(error.response?.data?.message || 'Có lỗi xảy ra khi đặt hàng');
      }
    } finally {
      setProcessing(false);
    }
  };

  if (orderSuccess) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <CheckCircleIcon className="h-20 w-20 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Đặt hàng thành công!</h2>
        <p className="text-gray-600 mb-4">
          Mã đơn hàng của bạn: <span className="font-semibold">{orderId}</span>
        </p>
        <p className="text-sm text-gray-500">
          Đang chuyển đến trang quản lý đơn hàng...
        </p>
      </div>
    );
  }

  const totalAmount = calculateTotal();

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Thanh toán</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Thông tin giao hàng</h2>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Họ tên người nhận</label>
                <input
                  type="text"
                  placeholder="Nhập họ tên"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Số điện thoại</label>
                <input
                  type="tel"
                  placeholder="Nhập số điện thoại"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Địa chỉ</label>
                <input
                  type="text"
                  value={shippingAddress.street}
                  onChange={(e) => setShippingAddress({...shippingAddress, street: e.target.value})}
                  placeholder="Số nhà, tên đường"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 mb-2">Thành phố</label>
                  <input
                    type="text"
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
                    placeholder="TP.HCM, Hà Nội..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Quận/Huyện</label>
                  <input
                    type="text"
                    value={shippingAddress.state}
                    onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
                    placeholder="Quận 1, Bình Thạnh..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Phương thức thanh toán</h2>
              <div className="space-y-3">
                <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50 transition">
                  <input
                    type="radio"
                    value="COD"
                    checked={paymentMethod === 'COD'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <p className="font-medium">Thanh toán khi nhận hàng (COD)</p>
                    <p className="text-sm text-gray-600">Thanh toán bằng tiền mặt khi nhận hàng</p>
                  </div>
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </label>
                
                <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50 transition">
                  <input
                    type="radio"
                    value="BankTransfer"
                    checked={paymentMethod === 'BankTransfer'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <p className="font-medium">Chuyển khoản ngân hàng</p>
                    <p className="text-sm text-gray-600">Chuyển khoản trước khi giao hàng</p>
                  </div>
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={processing}
              className={`w-full py-3 rounded-md transition-colors font-semibold ${
                processing
                  ? 'bg-gray-400 text-white cursor-wait'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {processing ? 'Đang xử lý...' : `Đặt hàng (${totalAmount.toLocaleString('vi-VN')}₫)`}
            </button>
          </form>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 h-fit">
          <h2 className="text-xl font-semibold mb-4">Đơn hàng của bạn</h2>
          
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
            {selectedItems.map((item) => (
              <div key={item._id} className="flex space-x-3 pb-3 border-b">
                <img
                  src={item.product.images[0] || '/placeholder.jpg'}
                  alt={item.product.name}
                  className="w-16 h-16 object-cover rounded"
                />
                <div className="flex-1">
                  <p className="font-medium text-sm line-clamp-1">{item.product.name}</p>
                  <p className="text-xs text-gray-600">
                    {item.size} / {item.color}
                  </p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm">SL: {item.quantity}</span>
                    <span className="font-medium">
                      {(item.product.price * item.quantity).toLocaleString('vi-VN')}₫
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Tạm tính:</span>
              <span>{totalAmount.toLocaleString('vi-VN')}₫</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Phí vận chuyển:</span>
              <span className="text-green-600">Miễn phí</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Giảm giá:</span>
              <span>0₫</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-lg font-bold">
              <span>Tổng cộng:</span>
              <span className="text-red-600">{totalAmount.toLocaleString('vi-VN')}₫</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <p className="text-xs text-blue-800">
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Đơn hàng sẽ được giao trong 3-5 ngày làm việc
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;