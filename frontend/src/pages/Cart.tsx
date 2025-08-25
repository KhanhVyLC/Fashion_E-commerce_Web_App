// src/pages/Cart.tsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { 
  TrashIcon, 
  ExclamationTriangleIcon,
  FireIcon,
  ClockIcon 
} from '@heroicons/react/24/outline';
import axios from '../utils/axios';

interface StockIssue {
  itemId: string;
  productName: string;
  requestedQuantity: number;
  availableQuantity: number;
  size: string;
  color: string;
}

const Cart: React.FC = () => {
  const { items, totalPrice, totalDiscount, updateQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
  const [checkingStock, setCheckingStock] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (items.length > 0) {
      checkStockAvailability();
      // Select all items by default
      setSelectedItems(new Set(items.map(item => item._id)));
      setSelectAll(true);
    }
  }, [items]);

  const checkStockAvailability = async () => {
    try {
      const { data } = await axios.get('/cart/check-availability');
      setStockIssues(data.unavailableItems || []);
    } catch (error) {
      console.error('Error checking stock:', error);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    setUpdatingItems(prev => new Set(prev).add(itemId));
    try {
      await updateQuantity(itemId, newQuantity);
      await checkStockAvailability();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Không thể cập nhật số lượng');
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
    setSelectAll(newSelected.size === items.length);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item._id)));
    }
    setSelectAll(!selectAll);
  };

  const getSelectedTotal = () => {
    return items
      .filter(item => selectedItems.has(item._id))
      .reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getSelectedDiscount = () => {
    return items
      .filter(item => selectedItems.has(item._id))
      .reduce((total, item) => {
        if (item.isFlashSaleItem && item.originalPrice) {
          return total + ((item.originalPrice - item.price) * item.quantity);
        }
        return total;
      }, 0);
  };

  const handleCheckout = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (selectedItems.size === 0) {
      alert('Vui lòng chọn ít nhất một sản phẩm để đặt hàng');
      return;
    }

    setCheckingStock(true);
    try {
      const { data } = await axios.get('/cart/check-availability');
      
      const selectedStockIssues = (data.unavailableItems || []).filter((issue: StockIssue) => 
        selectedItems.has(issue.itemId)
      );

      if (selectedStockIssues.length > 0) {
        setStockIssues(data.unavailableItems);
        alert('Một số sản phẩm đã chọn không đủ số lượng. Vui lòng kiểm tra lại.');
        return;
      }

      const selectedItemsData = items.filter(item => selectedItems.has(item._id));
      sessionStorage.setItem('checkoutItems', JSON.stringify(selectedItemsData));
      
      navigate('/checkout');
    } catch (error) {
      console.error('Error checking stock:', error);
      alert('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setCheckingStock(false);
    }
  };

  const getStockIssue = (itemId: string) => {
    return stockIssues.find(issue => issue.itemId === itemId);
  };

  const formatTimeRemaining = (endDate: string | Date) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Đã kết thúc';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `Còn ${days} ngày`;
    }
    
    return `Còn ${hours}h ${minutes}m`;
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">Giỏ hàng của bạn đang trống</p>
        <Link to="/" className="text-blue-600 hover:underline">
          Tiếp tục mua sắm
        </Link>
      </div>
    );
  }

  const selectedCount = selectedItems.size;
  const selectedTotal = getSelectedTotal();
  const selectedDiscount = getSelectedDiscount();

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Giỏ hàng</h1>

      {stockIssues.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" />
            <div>
              <p className="font-medium text-yellow-800">
                Một số sản phẩm không đủ số lượng
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Vui lòng điều chỉnh số lượng hoặc xóa sản phẩm không còn hàng
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b p-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={toggleSelectAll}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Chọn tất cả ({items.length} sản phẩm)
            </span>
          </label>
        </div>

        <div className="p-6">
          {items.map((item) => {
            const stockIssue = getStockIssue(item._id);
            const isUpdating = updatingItems.has(item._id);
            const isSelected = selectedItems.has(item._id);
            
            return (
              <div key={item._id} className={`flex items-center border-b py-4 ${
                stockIssue ? 'bg-red-50 -mx-6 px-6' : ''
              }`}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleItemSelection(item._id)}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500 mr-4"
                />
                
                <div className="relative">
                  <img
                    src={item.product.images[0] || '/placeholder.jpg'}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded"
                  />
                  {item.isFlashSaleItem && (
                    <div className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1">
                      <FireIcon className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 ml-4">
                  <h3 className="font-semibold">{item.product.name}</h3>
                  <p className="text-gray-600">
                    Size: {item.size} | Màu: {item.color}
                  </p>
                  
                  {/* Flash Sale Badge */}
                  {item.isFlashSaleItem && item.flashSaleInfo && (
                    <div className="mt-1 inline-flex items-center space-x-2">
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full font-medium">
                        Flash Sale -{item.discountPercentage}%
                      </span>
                      <span className="text-xs text-gray-500 flex items-center">
                        <ClockIcon className="h-3 w-3 mr-1" />
                        {formatTimeRemaining(item.flashSaleInfo.endDate)}
                      </span>
                    </div>
                  )}
                  
                  {/* Price Display */}
                  <div className="mt-1 flex items-center space-x-2">
                    <p className="text-lg font-bold text-red-600">
                      {item.price.toLocaleString('vi-VN')}₫
                    </p>
                    {item.originalPrice && item.originalPrice !== item.price && (
                      <p className="text-sm text-gray-500 line-through">
                        {item.originalPrice.toLocaleString('vi-VN')}₫
                      </p>
                    )}
                  </div>
                  
                  {/* Savings Display */}
                  {item.isFlashSaleItem && item.originalPrice && (
                    <p className="text-xs text-green-600 font-medium">
                      Tiết kiệm: {((item.originalPrice - item.price) * item.quantity).toLocaleString('vi-VN')}₫
                    </p>
                  )}
                  
                  {stockIssue && (
                    <p className="text-sm text-red-600 mt-1">
                      Chỉ còn {stockIssue.availableQuantity} sản phẩm
                    </p>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="flex items-center border border-gray-300 rounded">
                    <button
                      onClick={() => handleUpdateQuantity(item._id, item.quantity - 1)}
                      disabled={isUpdating || item.quantity <= 1}
                      className="px-2 py-1 hover:bg-gray-100 disabled:opacity-50"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={stockIssue ? stockIssue.availableQuantity : undefined}
                      value={item.quantity}
                      onChange={(e) => handleUpdateQuantity(item._id, Number(e.target.value))}
                      disabled={isUpdating}
                      className={`w-16 text-center border-x border-gray-300 ${
                        stockIssue ? 'bg-red-50' : ''
                      }`}
                    />
                    <button
                      onClick={() => handleUpdateQuantity(item._id, item.quantity + 1)}
                      disabled={isUpdating || (stockIssue && item.quantity >= stockIssue.availableQuantity)}
                      className="px-2 py-1 hover:bg-gray-100 disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                  
                  <button
                    onClick={() => removeFromCart(item._id)}
                    className="text-red-600 hover:text-red-800 p-2"
                    aria-label="Xóa khỏi giỏ hàng"
                    title="Xóa khỏi giỏ hàng"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-gray-50 p-6 rounded-b-lg">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Đã chọn {selectedCount} sản phẩm</span>
            </div>
            
            {selectedDiscount > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span>Tạm tính (giá gốc):</span>
                  <span>{(selectedTotal + selectedDiscount).toLocaleString('vi-VN')}₫</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span className="flex items-center">
                    <FireIcon className="h-4 w-4 mr-1" />
                    Giảm giá Flash Sale:
                  </span>
                  <span>-{selectedDiscount.toLocaleString('vi-VN')}₫</span>
                </div>
              </>
            )}
            
            <div className="flex justify-between text-lg">
              <span>Tạm tính:</span>
              <span>{selectedTotal.toLocaleString('vi-VN')}₫</span>
            </div>
            
            <div className="flex justify-between text-lg">
              <span>Phí vận chuyển:</span>
              <span>Miễn phí</span>
            </div>
            
            <div className="border-t pt-2 flex justify-between text-xl font-bold">
              <span>Tổng cộng:</span>
              <span className="text-red-600">{selectedTotal.toLocaleString('vi-VN')}₫</span>
            </div>
            
            {selectedDiscount > 0 && (
              <div className="bg-green-50 p-2 rounded text-sm text-green-800">
                <span className="font-medium">
                  Bạn đã tiết kiệm {selectedDiscount.toLocaleString('vi-VN')}₫ từ Flash Sale!
                </span>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={handleCheckout}
              disabled={checkingStock || selectedCount === 0 || stockIssues.some(issue => selectedItems.has(issue.itemId))}
              className={`w-full py-3 rounded-md transition-colors ${
                selectedCount === 0 || stockIssues.some(issue => selectedItems.has(issue.itemId))
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : checkingStock
                  ? 'bg-gray-400 text-white cursor-wait'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {checkingStock 
                ? 'Đang kiểm tra...' 
                : selectedCount === 0
                ? 'Vui lòng chọn sản phẩm'
                : `Đặt hàng (${selectedCount} sản phẩm)`}
            </button>
            
            <Link 
              to="/" 
              className="block text-center text-blue-600 hover:underline"
            >
              Tiếp tục mua sắm
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
