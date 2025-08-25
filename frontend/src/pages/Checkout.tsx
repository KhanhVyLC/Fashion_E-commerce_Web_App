// src/pages/Checkout.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { 
  CheckCircleIcon, 
  TicketIcon,
  XMarkIcon,
  QrCodeIcon,
  InformationCircleIcon,
  PhoneIcon,
  UserIcon,
  FireIcon,
  MapPinIcon,
  CreditCardIcon,
  TruckIcon,
  ChevronRightIcon,
  TagIcon,
  HomeIcon,
  BuildingOfficeIcon,
  ArrowLeftIcon,
  ShoppingBagIcon,
  GiftIcon
} from '@heroicons/react/24/solid';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { clearCart, fetchCart } = useCart();
  const { user } = useAuth();
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  const [shippingAddress, setShippingAddress] = useState({
    street: '',
    city: '',
    state: '',
    zipCode: '700000',
    country: 'Vietnam'
  });
  
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [processing, setProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [qrCodeData, setQrCodeData] = useState<any>(null);
  
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherError, setVoucherError] = useState('');
  const [voucherDetails, setVoucherDetails] = useState<any>(null);
  const [applyingVoucher, setApplyingVoucher] = useState(false);

  useEffect(() => {
    const checkoutItemsStr = sessionStorage.getItem('checkoutItems');
    if (!checkoutItemsStr) {
      navigate('/cart');
      return;
    }
    
    const items = JSON.parse(checkoutItemsStr);
    setSelectedItems(items);
    
    if (user) {
      setCustomerName(user.name || '');
      setCustomerPhone(user.phone || '');
      if (user.address) {
        const addressParts = user.address.split(',');
        if (addressParts.length > 0) {
          setShippingAddress(prev => ({
            ...prev,
            street: addressParts[0]?.trim() || '',
            state: addressParts[1]?.trim() || '',
            city: addressParts[2]?.trim() || ''
          }));
        }
      }
    }
    
    checkFinalAvailability();
  }, [user, navigate]);

  const checkFinalAvailability = async () => {
    try {
      const { data } = await axios.get('/cart/check-availability');
      if (!data.available) {
        alert('Một số sản phẩm không còn đủ hàng. Quay lại giỏ hàng để kiểm tra.');
        navigate('/cart');
      }
    } catch (error) {
      console.error('Error checking availability:', error);
    }
  };

  const calculateSubtotal = () => {
    return selectedItems.reduce((total, item) => 
      total + (item.price * item.quantity), 0
    );
  };

  const calculateOriginalSubtotal = () => {
    return selectedItems.reduce((total, item) => {
      const price = item.originalPrice || item.price;
      return total + (price * item.quantity);
    }, 0);
  };

  const calculateFlashSaleDiscount = () => {
    return selectedItems.reduce((total, item) => {
      if (item.isFlashSaleItem && item.originalPrice) {
        return total + ((item.originalPrice - item.price) * item.quantity);
      }
      return total;
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal - voucherDiscount;
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^[0-9]{10,11}$/;
    return phoneRegex.test(phone);
  };

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      setVoucherError('Vui lòng nhập mã voucher');
      return;
    }

    setApplyingVoucher(true);
    setVoucherError('');
    
    try {
      const orderAmount = calculateSubtotal();
      const orderItems = selectedItems.map(item => ({
        productId: item.product._id,
        product: item.product,
        quantity: item.quantity,
        price: item.price
      }));

      const { data } = await axios.post('/orders/validate-voucher', {
        code: voucherCode,
        orderAmount,
        orderItems
      });

      if (data.valid) {
        setVoucherDiscount(data.discountAmount);
        setVoucherDetails(data);
      }
    } catch (error: any) {
      setVoucherError(error.response?.data?.message || 'Mã voucher không hợp lệ');
      setVoucherDiscount(0);
      setVoucherDetails(null);
    } finally {
      setApplyingVoucher(false);
    }
  };

  const handleRemoveVoucher = () => {
    setVoucherCode('');
    setVoucherDiscount(0);
    setVoucherDetails(null);
    setVoucherError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePhone(customerPhone)) {
      alert('Số điện thoại không hợp lệ (10-11 chữ số)');
      return;
    }
    
    setProcessing(true);
    try {
      const selectedItemIds = selectedItems.map(item => item._id);
      const subtotal = calculateSubtotal();
      const flashSaleDiscount = calculateFlashSaleDiscount();
      const total = calculateTotal();
      
      const fullShippingAddress = {
        ...shippingAddress,
        recipientName: customerName,
        recipientPhone: customerPhone
      };
      
      const orderData = {
        shippingAddress: fullShippingAddress,
        paymentMethod,
        selectedItemIds,
        voucherCode: voucherDetails?.code || null,
        subtotal: subtotal,
        discountAmount: flashSaleDiscount + voucherDiscount,
        totalAmount: total,
        customerName,
        customerPhone
      };

      const { data } = await axios.post('/orders/create', orderData);
      
      setOrderId(data.order._id);
      
      if (data.qrCodeData) {
        setQrCodeData(data.qrCodeData);
      }
      
      setOrderSuccess(true);
      sessionStorage.removeItem('checkoutItems');
      
      if (data.remainingCartItems === 0) {
        clearCart();
      } else {
        await fetchCart();
      }
      
      if (paymentMethod !== 'BankTransfer') {
        setTimeout(() => {
          navigate('/orders');
        }, 3000);
      }
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

  if (orderSuccess && paymentMethod === 'BankTransfer' && qrCodeData) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Success Header */}
            <div className="bg-green-500 p-6 text-white text-center">
              <CheckCircleIcon className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Đặt hàng thành công!</h2>
              <p className="text-green-100">
                Mã đơn hàng: <span className="font-mono font-bold">#{orderId.slice(-8).toUpperCase()}</span>
              </p>
            </div>

            {/* QR Payment */}
            <div className="p-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Thanh toán qua QR Code
                </h3>
                <p className="text-gray-600">
                  Quét mã QR hoặc chuyển khoản theo thông tin bên dưới
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* QR Code */}
                <div className="text-center">
                  <div className="bg-white p-4 rounded-lg border inline-block">
                    <img 
                      src={qrCodeData.qrUrl}
                      alt="QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                </div>
                
                {/* Bank Info */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Ngân hàng</p>
                    <p className="font-semibold text-lg">MB Bank</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Số tài khoản</p>
                    <p className="font-mono font-semibold text-lg">{qrCodeData.accountNo}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Chủ tài khoản</p>
                    <p className="font-semibold text-lg">{qrCodeData.accountName}</p>
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-600 mb-1">Số tiền</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {qrCodeData.amount.toLocaleString('vi-VN')}₫
                    </p>
                  </div>
                  
                  <div className="bg-amber-50 rounded-lg p-4">
                    <p className="text-sm text-amber-600 mb-2 font-medium">Nội dung chuyển khoản</p>
                    <p className="font-mono font-bold text-amber-800 bg-amber-100 px-3 py-2 rounded border text-center">
                      {qrCodeData.content}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 bg-blue-50 rounded-lg p-4">
                <div className="flex items-start">
                  <InformationCircleIcon className="w-5 h-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Lưu ý quan trọng:</p>
                    <ul className="space-y-1">
                      <li>• Vui lòng nhập chính xác nội dung chuyển khoản</li>
                      <li>• Đơn hàng sẽ được xử lý sau khi nhận được thanh toán</li>
                      <li>• Thời gian xử lý: 5-10 phút trong giờ hành chính</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={() => navigate('/orders')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Xem đơn hàng của tôi
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
          <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Đặt hàng thành công!
          </h2>
          <p className="text-gray-600 mb-2">
            Mã đơn hàng của bạn:
          </p>
          <p className="text-xl font-bold font-mono text-blue-600 mb-6">
            #{orderId}
          </p>
          <div className="flex items-center justify-center text-sm text-gray-500">
            <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
            Đang chuyển đến trang quản lý đơn hàng...
          </div>
        </div>
      </div>
    );
  }

  const subtotal = calculateSubtotal();
  const originalSubtotal = calculateOriginalSubtotal();
  const flashSaleDiscount = calculateFlashSaleDiscount();
  const totalAmount = calculateTotal();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/cart')}
              className="mr-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-xl font-bold text-gray-800">Thanh Toán</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Shipping Address */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <MapPinIcon className="w-5 h-5 mr-2 text-blue-500" />
                  Địa chỉ nhận hàng
                </h2>
                
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Họ và tên *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nhập họ tên người nhận"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Số điện thoại *
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="Nhập số điện thoại"
                      className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                        customerPhone && !validatePhone(customerPhone) 
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                          : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                      pattern="[0-9]{10,11}"
                      maxLength={11}
                      required
                    />
                    {customerPhone && !validatePhone(customerPhone) && (
                      <p className="text-red-500 text-xs mt-1">
                        Số điện thoại phải có 10-11 chữ số
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Địa chỉ cụ thể *
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.street}
                      onChange={(e) => setShippingAddress({...shippingAddress, street: e.target.value})}
                      placeholder="Số nhà, tên đường..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quận/Huyện *
                      </label>
                      <input
                        type="text"
                        value={shippingAddress.state}
                        onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
                        placeholder="Ví dụ: Quận 1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tỉnh/Thành phố *
                      </label>
                      <input
                        type="text"
                        value={shippingAddress.city}
                        onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
                        placeholder="Ví dụ: TP.HCM"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <CreditCardIcon className="w-5 h-5 mr-2 text-blue-500" />
                  Phương thức thanh toán
                </h2>
                
                <div className="space-y-3">
                  <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === 'COD' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      value="COD"
                      checked={paymentMethod === 'COD'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="text-blue-600"
                    />
                    <div className="ml-3">
                      <p className="font-medium text-gray-800">Thanh toán khi nhận hàng</p>
                      <p className="text-sm text-gray-500">Thanh toán bằng tiền mặt khi shipper giao hàng</p>
                    </div>
                  </label>
                  
                  <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    paymentMethod === 'BankTransfer' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      value="BankTransfer"
                      checked={paymentMethod === 'BankTransfer'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="text-blue-600"
                    />
                    <div className="ml-3">
                      <p className="font-medium text-gray-800">Chuyển khoản ngân hàng</p>
                      <p className="text-sm text-gray-500">Chuyển khoản qua QR Code hoặc số tài khoản</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Voucher */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <TicketIcon className="w-5 h-5 mr-2 text-amber-500" />
                  Mã giảm giá
                </h2>
                
                {!voucherDetails ? (
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                      placeholder="Nhập mã voucher"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors uppercase font-medium"
                      disabled={applyingVoucher}
                    />
                    <button
                      type="button"
                      onClick={handleApplyVoucher}
                      disabled={applyingVoucher || !voucherCode.trim()}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        applyingVoucher || !voucherCode.trim()
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-amber-500 text-white hover:bg-amber-600'
                      }`}
                    >
                      {applyingVoucher ? (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      ) : (
                        'Áp dụng'
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-green-800">{voucherDetails.code}</p>
                      <p className="text-sm text-green-600">{voucherDetails.description}</p>
                      <p className="text-sm font-medium text-green-700 mt-1">
                        Giảm: ₫{voucherDiscount.toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveVoucher}
                      className="text-green-600 hover:text-green-800"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                )}
                
                {voucherError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                    <InformationCircleIcon className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-red-600 text-sm">{voucherError}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 space-y-6">
                {/* Products */}
                <div className="bg-white rounded-lg shadow-sm">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800 flex items-center">
                      <ShoppingBagIcon className="w-5 h-5 mr-2 text-blue-500" />
                      Sản phẩm ({selectedItems.length})
                    </h3>
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto">
                    {selectedItems.map((item) => (
                      <div key={item._id} className="p-4 border-b border-gray-50 last:border-b-0">
                        <div className="flex gap-3">
                          <div className="relative">
                            <img
                              src={item.product.images[0] || '/placeholder.jpg'}
                              alt={item.product.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                            {item.isFlashSaleItem && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                <FireIcon className="h-2 w-2 text-white" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-800 line-clamp-1">
                              {item.product.name}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {item.size}, {item.color} • x{item.quantity}
                            </p>
                            <div className="mt-1">
                              {item.originalPrice && item.originalPrice !== item.price ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400 line-through">
                                    ₫{item.originalPrice.toLocaleString('vi-VN')}
                                  </span>
                                  <span className="text-sm font-medium text-blue-600">
                                    ₫{item.price.toLocaleString('vi-VN')}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm font-medium text-gray-800">
                                  ₫{item.price.toLocaleString('vi-VN')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Chi tiết thanh toán</h3>
                  
                  <div className="space-y-3 text-sm">
                    {flashSaleDiscount > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tổng tiền hàng</span>
                          <span className="line-through text-gray-400">₫{originalSubtotal.toLocaleString('vi-VN')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 flex items-center">
                            <FireIcon className="w-3 h-3 mr-1 text-orange-500" />
                            Flash Sale
                          </span>
                          <span className="text-green-600">-₫{flashSaleDiscount.toLocaleString('vi-VN')}</span>
                        </div>
                      </>
                    )}
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tạm tính</span>
                      <span>₫{subtotal.toLocaleString('vi-VN')}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600 flex items-center">
                        <TruckIcon className="w-3 h-3 mr-1 text-blue-500" />
                        Phí vận chuyển
                      </span>
                      <span className="text-green-600">Miễn phí</span>
                    </div>
                    
                    {voucherDiscount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 flex items-center">
                          <TicketIcon className="w-3 h-3 mr-1 text-amber-500" />
                          Voucher
                        </span>
                        <span className="text-green-600">-₫{voucherDiscount.toLocaleString('vi-VN')}</span>
                      </div>
                    )}
                    
                    <div className="pt-3 mt-3 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-800">Tổng cộng</span>
                        <div className="text-right">
                          <p className="text-xl font-bold text-blue-600">
                            ₫{totalAmount.toLocaleString('vi-VN')}
                          </p>
                          {(flashSaleDiscount + voucherDiscount) > 0 && (
                            <p className="text-xs text-green-600">
                              Tiết kiệm ₫{(flashSaleDiscount + voucherDiscount).toLocaleString('vi-VN')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={processing || !validatePhone(customerPhone)}
                    className={`w-full mt-6 py-3 rounded-lg font-semibold transition-colors ${
                      processing || !validatePhone(customerPhone)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {processing ? (
                      <span className="flex items-center justify-center">
                        <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                        Đang xử lý...
                      </span>
                    ) : (
                      'Đặt hàng'
                    )}
                  </button>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mb-1">
                        <CheckCircleIcon className="w-3 h-3 text-green-600" />
                      </div>
                      <span>An toàn</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mb-1">
                        <TruckIcon className="w-3 h-3 text-blue-600" />
                      </div>
                      <span>Giao nhanh</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mb-1">
                        <TagIcon className="w-3 h-3 text-purple-600" />
                      </div>
                      <span>Chính hãng</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;
