// src/pages/Cart.tsx - Updated with selective checkout
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
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
  const { items, totalPrice, updateQuantity, removeFromCart } = useCart();
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
      const { data } = await axios.get('http://localhost:5000/api/cart/check-availability');
      setStockIssues(data.unavailableItems);
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
      .reduce((total, item) => total + (item.product.price * item.quantity), 0);
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
      const { data } = await axios.get('http://localhost:5000/api/cart/check-availability');
      
      // Check if selected items have stock issues
      const selectedStockIssues = data.unavailableItems.filter((issue: StockIssue) => 
        selectedItems.has(issue.itemId)
      );

      if (selectedStockIssues.length > 0) {
        setStockIssues(data.unavailableItems);
        alert('Một số sản phẩm đã chọn không đủ số lượng. Vui lòng kiểm tra lại.');
        return;
      }

      // Store selected items in session storage for checkout
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
        {/* Select all header */}
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

        {/* Cart items */}
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
                
                <img
                  src={item.product.images[0] || '/placeholder.jpg'}
                  alt={item.product.name}
                  className="w-20 h-20 object-cover rounded"
                />
                
                <div className="flex-1 ml-4">
                  <h3 className="font-semibold">{item.product.name}</h3>
                  <p className="text-gray-600">
                    Size: {item.size} | Màu: {item.color}
                  </p>
                  <p className="text-lg font-bold text-red-600">
                    {item.product.price.toLocaleString('vi-VN')}₫
                  </p>
                  
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

        {/* Summary */}
        <div className="bg-gray-50 p-6 rounded-b-lg">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Đã chọn {selectedCount} sản phẩm</span>
            </div>
            <div className="flex justify-between text-lg">
              <span>Tạm tính:</span>
              <span>{getSelectedTotal().toLocaleString('vi-VN')}₫</span>
            </div>
            <div className="flex justify-between text-lg">
              <span>Phí vận chuyển:</span>
              <span>Miễn phí</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-xl font-bold">
              <span>Tổng cộng:</span>
              <span className="text-red-600">{getSelectedTotal().toLocaleString('vi-VN')}₫</span>
            </div>
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