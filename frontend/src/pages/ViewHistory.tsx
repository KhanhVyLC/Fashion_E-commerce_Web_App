// src/pages/ViewHistory.tsx - Enhanced with Flash Sale Support
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from '../utils/axios';
import { 
  ClockIcon, 
  TrashIcon, 
  EyeIcon,
  BoltIcon,
  FireIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import OptimizedImage from '../components/OptimizedImage';

interface FlashSaleInfo {
  saleId: string;
  saleName: string;
  originalPrice: number;
  discountPrice: number;
  discountPercentage: number;
  endDate: string;
  available?: number;
  soldQuantity?: number;
  maxQuantity?: number;
  timeRemaining?: number;
}

interface ViewHistoryItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    price: number;
    images: string[];
    category: string;
    brand?: string;
    // Flash Sale fields
    isFlashSale?: boolean;
    effectivePrice?: number;
    flashSale?: FlashSaleInfo;
    discountPrice?: number;
    originalPrice?: number;
    discountPercentage?: number;
  };
  viewedAt: string;
  duration?: number;
  source?: string;
}

const ViewHistory: React.FC = () => {
  const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupedHistory, setGroupedHistory] = useState<{ [key: string]: ViewHistoryItem[] }>({});
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchViewHistory();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchViewHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Vui lòng đăng nhập để xem lịch sử');
        return;
      }

      console.log('🔍 Fetching view history...');
      
      const response = await axios.get('/users/view-history', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('📚 View history response:', response.data);
      
      const historyData = response.data || [];
      
      // Fetch flash sale info for products
      const productsWithFlashSale = await fetchFlashSaleInfo(historyData);
      setViewHistory(productsWithFlashSale);
      groupHistoryByDate(productsWithFlashSale);
      
    } catch (error: any) {
      console.error('❌ Error fetching view history:', error);
      
      if (error.response?.status === 401) {
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      } else {
        setError('Không thể tải lịch sử xem. Vui lòng thử lại.');
      }
      
      setViewHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlashSaleInfo = async (historyData: ViewHistoryItem[]) => {
    try {
      // Get product IDs
      const productIds = historyData
        .filter(item => item.product?._id)
        .map(item => item.product._id);
      
      if (productIds.length === 0) return historyData;

      // Fetch products with flash sale info
      const productsResponse = await axios.post('/products/batch-with-flash-sale', {
        productIds
      });

      const productsWithFlashSale = productsResponse.data || [];
      
      // Map flash sale info back to history items
      const flashSaleMap = new Map(
        productsWithFlashSale.map((p: any) => [p._id, p])
      );

      return historyData.map(item => {
        if (item.product?._id) {
          const productWithFlashSale = flashSaleMap.get(item.product._id);
          if (productWithFlashSale) {
            return {
              ...item,
              product: {
                ...item.product,
                ...productWithFlashSale
              }
            };
          }
        }
        return item;
      });
    } catch (error) {
      console.error('Error fetching flash sale info:', error);
      // Return original data if error
      return historyData;
    }
  };

  const groupHistoryByDate = (history: ViewHistoryItem[]) => {
    const grouped: { [key: string]: ViewHistoryItem[] } = {};
    
    history.forEach(item => {
      if (!item.product) return; // Skip items without product
      
      const date = new Date(item.viewedAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let dateKey: string;
      
      if (date.toDateString() === today.toDateString()) {
        dateKey = 'Hôm nay';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = 'Hôm qua';
      } else {
        const weekDay = date.toLocaleDateString('vi-VN', { weekday: 'long' });
        const dateStr = date.toLocaleDateString('vi-VN', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        });
        dateKey = `${weekDay}, ${dateStr}`;
      }
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(item);
    });
    
    // Sort items within each group by time (newest first)
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime());
    });
    
    setGroupedHistory(grouped);
  };

  const clearHistory = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử xem?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Vui lòng đăng nhập để thực hiện thao tác này');
        return;
      }

      await axios.delete('/users/view-history', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setViewHistory([]);
      setGroupedHistory({});
      
      // Show success message
      showToast('Đã xóa lịch sử xem thành công', 'success');
      
    } catch (error: any) {
      console.error('Error clearing history:', error);
      const errorMessage = error.response?.data?.message || 'Có lỗi xảy ra khi xóa lịch sử';
      showToast(errorMessage, 'error');
    }
  };

  const refreshHistory = () => {
    if (user) {
      fetchViewHistory();
    }
  };

  // Toast notification function
  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all duration-300 ${
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    toast.textContent = message;
    toast.style.transform = 'translateX(100%)';
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };

  // Helper function to get effective price
  const getEffectivePrice = (product: any) => {
    if (product.effectivePrice !== undefined) {
      return product.effectivePrice;
    }
    if (product.isFlashSale) {
      return product.flashSale?.discountPrice || product.discountPrice || product.price;
    }
    return product.price;
  };

  const getOriginalPrice = (product: any) => {
    if (product.isFlashSale) {
      return product.flashSale?.originalPrice || product.originalPrice || product.price;
    }
    return product.price;
  };

  const getDiscountPercentage = (product: any) => {
    if (product.isFlashSale) {
      return product.flashSale?.discountPercentage || product.discountPercentage || 0;
    }
    return 0;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải lịch sử xem...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <EyeIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Vui lòng đăng nhập</h2>
          <p className="text-gray-600 mb-4">Đăng nhập để xem lịch sử sản phẩm đã xem</p>
          <Link 
            to="/login" 
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
            <ClockIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 mb-2">Lỗi tải dữ liệu</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={refreshHistory}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewHistory.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <ClockIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Chưa có lịch sử xem</h2>
          <p className="text-gray-500 mb-6">Sản phẩm bạn đã xem sẽ hiển thị ở đây</p>
          <div className="space-y-2 text-sm text-gray-400 mb-6">
            <p>💡 Lịch sử sẽ được ghi lại khi bạn xem chi tiết sản phẩm</p>
            <p>⏱️ Thời gian xem tối thiểu: 1 giây</p>
          </div>
          <Link 
            to="/" 
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Khám phá sản phẩm
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch sử xem</h1>
          <p className="text-gray-600">{viewHistory.length} sản phẩm đã xem</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={refreshHistory}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <ClockIcon className="h-4 w-4" />
            <span>Làm mới</span>
          </button>
          <button
            onClick={clearHistory}
            className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
            <span>Xóa lịch sử</span>
          </button>
        </div>
      </div>
      
      {/* History Content */}
      {Object.entries(groupedHistory).map(([date, items]) => (
        <div key={date} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
            <span className="bg-gray-100 px-3 py-1 rounded-full text-sm">{date}</span>
            <span className="ml-3 text-sm text-gray-500">({items.length} sản phẩm)</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => {
              const hasFlashSale = item.product?.isFlashSale || !!item.product?.flashSale;
              const effectivePrice = getEffectivePrice(item.product);
              const originalPrice = getOriginalPrice(item.product);
              const discountPercentage = getDiscountPercentage(item.product);
              const hasDiscount = hasFlashSale && effectivePrice < originalPrice;

              return (
                item.product && (
                  <Link
                    key={item._id}
                    to={`/product/${item.product._id}`}
                    className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-4 border border-gray-100 group relative overflow-hidden"
                  >
                    {/* Flash Sale Badge */}
                    {hasFlashSale && (
                      <div className="absolute top-2 right-2 z-10">
                        <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-2 py-1 rounded-full flex items-center space-x-1 text-xs animate-pulse">
                          <BoltIcon className="w-3 h-3" />
                          <span className="font-bold">-{Math.round(discountPercentage)}%</span>
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-3">
                      <div className="flex-shrink-0">
                        <OptimizedImage
                          src={item.product.images?.[0] || '/placeholder.jpg'}
                          alt={item.product.name}
                          className="w-16 h-16 object-cover rounded-lg"
                          width={64}
                          height={64}
                          loading="lazy"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                          {item.product.name}
                        </h3>
                        
                        {/* Price Display */}
                        <div className="mt-1">
                          {hasDiscount ? (
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-red-600 font-semibold">
                                  {effectivePrice.toLocaleString('vi-VN')}₫
                                </span>
                                <span className="text-xs text-gray-400 line-through">
                                  {originalPrice.toLocaleString('vi-VN')}₫
                                </span>
                              </div>
                              <div className="text-xs text-green-600 font-medium">
                                Tiết kiệm {(originalPrice - effectivePrice).toLocaleString('vi-VN')}₫
                              </div>
                            </div>
                          ) : (
                            <p className="text-red-600 font-semibold">
                              {effectivePrice.toLocaleString('vi-VN')}₫
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-500">
                            {new Date(item.viewedAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        {item.product.category && (
                          <p className="text-xs text-gray-400 mt-1">
                            {item.product.category}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ViewHistory;
