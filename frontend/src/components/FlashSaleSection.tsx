import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from '../utils/axios';
import { 
  ClockIcon, 
  FireIcon,
  BoltIcon,
  ShoppingCartIcon 
} from '@heroicons/react/24/solid';

interface FlashSaleProduct {
  _id: string;
  name: string;
  images: string[];
  category: string;
  brand: string;
  rating: number;
  originalPrice: number;
  discountPrice: number;
  discountPercentage: number;
  maxQuantity: number;
  soldQuantity: number;
  available: number;
  progressPercentage: number;
}

interface FlashSale {
  _id: string;
  name: string;
  description: string;
  endDate: string;
  timeRemaining: number;
  banner?: {
    image?: string;
    title?: string;
    subtitle?: string;
    gradient?: string;
  };
  products: FlashSaleProduct[];
}

const FlashSaleSection: React.FC = () => {
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<{ [key: string]: string }>({});
  const [selectedSale, setSelectedSale] = useState<FlashSale | null>(null);

  useEffect(() => {
    fetchFlashSales();
    const interval = setInterval(fetchFlashSales, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      updateCountdowns();
    }, 1000);
    return () => clearInterval(timer);
  }, [flashSales]);

  const fetchFlashSales = async () => {
    try {
      const { data } = await axios.get('/flash-sales/active');
      setFlashSales(data);
      if (data.length > 0 && !selectedSale) {
        setSelectedSale(data[0]);
      }
    } catch (error) {
      console.error('Error fetching flash sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCountdowns = () => {
    const newTimeLeft: { [key: string]: string } = {};
    
    flashSales.forEach(sale => {
      const endTime = new Date(sale.endDate).getTime();
      const now = new Date().getTime();
      const difference = endTime - now;
      
      if (difference > 0) {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        newTimeLeft[sale._id] = `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        newTimeLeft[sale._id] = 'Đã kết thúc';
      }
    });
    
    setTimeLeft(newTimeLeft);
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-lg p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-white/20 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white/20 rounded-lg h-64"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (flashSales.length === 0) {
    return null;
  }

  return (
    <div className="mb-12">
      {/* Flash Sale Header */}
      <div className={`bg-gradient-to-r ${selectedSale?.banner?.gradient || 'from-red-600 to-orange-600'} rounded-t-lg p-6 text-white`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <BoltIcon className="h-8 w-8 animate-pulse" />
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {selectedSale?.name || 'Flash Sale'}
                <FireIcon className="h-6 w-6 text-yellow-300" />
              </h2>
              <p className="text-white/90">{selectedSale?.description}</p>
            </div>
          </div>
          
          {/* Countdown Timer */}
          <div className="flex items-center space-x-2">
            <ClockIcon className="h-6 w-6" />
            <div className="text-xl font-bold">
              Kết thúc sau: {timeLeft[selectedSale?._id || ''] || '00:00:00'}
            </div>
          </div>
        </div>

        {/* Sale Tabs if multiple sales */}
        {flashSales.length > 1 && (
          <div className="flex space-x-2 mt-4 overflow-x-auto">
            {flashSales.map(sale => (
              <button
                key={sale._id}
                onClick={() => setSelectedSale(sale)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                  selectedSale?._id === sale._id
                    ? 'bg-white text-red-600 font-semibold'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {sale.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Products Grid */}
      <div className="bg-gray-50 rounded-b-lg p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {selectedSale?.products.map(product => (
            <Link
              key={product._id}
              to={`/product/${product._id}`}
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 group"
            >
              {/* Product Image */}
              <div className="relative aspect-square overflow-hidden rounded-t-lg">
                <img
                  src={product.images[0] || '/placeholder.jpg'}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Discount Badge */}
                <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-full text-sm font-bold">
                  -{product.discountPercentage}%
                </div>
                
                {/* Sold Out Overlay */}
                {product.available === 0 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">HẾT HÀNG</span>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-3">
                <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2 group-hover:text-blue-600">
                  {product.name}
                </h3>
                
                {/* Price */}
                <div className="mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-red-600">
                      {product.discountPrice.toLocaleString('vi-VN')}₫
                    </span>
                  </div>
                  <span className="text-sm text-gray-400 line-through">
                    {product.originalPrice.toLocaleString('vi-VN')}₫
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mb-2">
                  <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        product.progressPercentage > 80
                          ? 'bg-red-600'
                          : product.progressPercentage > 50
                          ? 'bg-orange-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(product.progressPercentage, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {product.available > 0 ? (
                      <span className={product.available <= 5 ? 'text-red-600 font-semibold' : ''}>
                        {product.available <= 5 
                          ? `Chỉ còn ${product.available} sản phẩm!`
                          : `Đã bán ${product.soldQuantity}/${product.maxQuantity}`
                        }
                      </span>
                    ) : (
                      <span className="text-red-600 font-semibold">Đã bán hết</span>
                    )}
                  </p>
                </div>

                {/* Quick Add Button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    // Handle quick add to cart
                    console.log('Quick add:', product._id);
                  }}
                  disabled={product.available === 0}
                  className={`w-full py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-1 ${
                    product.available === 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  <ShoppingCartIcon className="h-4 w-4" />
                  {product.available === 0 ? 'Hết hàng' : 'Mua ngay'}
                </button>
              </div>
            </Link>
          ))}
        </div>

        {/* View All Button */}
        {selectedSale && selectedSale.products.length > 10 && (
          <div className="text-center mt-6">
            <Link
              to={`/flash-sale/${selectedSale._id}`}
              className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Xem tất cả sản phẩm Flash Sale
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlashSaleSection;