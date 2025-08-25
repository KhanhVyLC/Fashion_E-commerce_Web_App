// src/pages/Wishlist.tsx - Enhanced with Flash Sale Support
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from '../utils/axios';
import ProductCard from '../components/ProductCard';
import RecommendationSection from '../components/RecommendationSection';
import { 
  HeartIcon, 
  TrashIcon, 
  ShoppingCartIcon,
  ShareIcon,
  BoltIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

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

interface WishlistItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    price: number;
    images: string[];
    rating: number;
    totalReviews: number;
    category: string;
    brand?: string;
    stock: Array<{
      size: string;
      color: string;
      quantity: number;
    }>;
    // Flash Sale fields
    isFlashSale?: boolean;
    effectivePrice?: number;
    flashSale?: FlashSaleInfo;
    discountPrice?: number;
    originalPrice?: number;
    discountPercentage?: number;
  };
  addedAt: string;
}

const Wishlist: React.FC = () => {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price_low' | 'price_high' | 'name'>('newest');
  const { user } = useAuth();
  const { addToCart } = useCart();

  useEffect(() => {
    if (user) {
      fetchWishlist();
    }
  }, [user]);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/users/wishlist');
      const wishlistData = data || [];
      
      // Fetch flash sale info for products
      const productsWithFlashSale = await fetchFlashSaleInfo(wishlistData);
      setWishlistItems(productsWithFlashSale);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      setWishlistItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlashSaleInfo = async (wishlistData: WishlistItem[]) => {
    try {
      // Get product IDs
      const productIds = wishlistData
        .filter(item => item.product?._id)
        .map(item => item.product._id);
      
      if (productIds.length === 0) return wishlistData;

      // Fetch products with flash sale info
      const productsResponse = await axios.post('/products/batch-with-flash-sale', {
        productIds
      });

      const productsWithFlashSale = productsResponse.data || [];
      
      // Map flash sale info back to wishlist items
      const flashSaleMap = new Map(
        productsWithFlashSale.map((p: any) => [p._id, p])
      );

      return wishlistData.map(item => {
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
      return wishlistData;
    }
  };

  const removeFromWishlist = async (productId: string) => {
    try {
      const { data } = await axios.post('/users/wishlist', {
        productId,
        action: 'remove'
      });
      const wishlistData = data || [];
      
      // Fetch flash sale info for updated list
      const productsWithFlashSale = await fetchFlashSaleInfo(wishlistData);
      setWishlistItems(productsWithFlashSale);
      
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      alert('Có lỗi xảy ra khi xóa sản phẩm');
    }
  };

  const removeSelectedItems = async () => {
    if (selectedItems.size === 0) return;
    
    try {
      const promises = Array.from(selectedItems).map(productId =>
        axios.post('/users/wishlist', {
          productId,
          action: 'remove'
        })
      );
      
      await Promise.all(promises);
      await fetchWishlist(); // Refresh the list
      setSelectedItems(new Set());
    } catch (error) {
      console.error('Error removing selected items:', error);
      alert('Có lỗi xảy ra khi xóa sản phẩm');
    }
  };

  const addToCartFromWishlist = async (item: WishlistItem) => {
    try {
      // Get available stock options
      const availableStock = item.product.stock?.filter(s => s.quantity > 0) || [];
      
      if (availableStock.length === 0) {
        alert('Sản phẩm này hiện đã hết hàng');
        return;
      }
      
      // Check flash sale availability
      if (item.product.isFlashSale && item.product.flashSale?.available !== undefined && item.product.flashSale.available <= 0) {
        alert('Sản phẩm Flash Sale đã hết');
        return;
      }
      
      // Use first available stock option (or implement a selection modal)
      const firstAvailable = availableStock[0];
      
      await addToCart(item.product._id, 1, firstAvailable.size, firstAvailable.color);
      
      const hasFlashSale = item.product.isFlashSale || !!item.product.flashSale;
      const effectivePrice = getEffectivePrice(item.product);
      const originalPrice = getOriginalPrice(item.product);
      const savings = hasFlashSale ? (originalPrice - effectivePrice) : 0;
      
      const message = hasFlashSale && savings > 0
        ? `Đã thêm vào giỏ với giá Flash Sale! Tiết kiệm ${savings.toLocaleString('vi-VN')}₫`
        : 'Đã thêm vào giỏ hàng!';
      
      alert(message);
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      alert(error.response?.data?.message || 'Có lỗi xảy ra khi thêm vào giỏ hàng');
    }
  };

  const toggleSelectItem = (productId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const selectAllItems = () => {
    if (selectedItems.size === wishlistItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(wishlistItems.map(item => item.product._id)));
    }
  };

  const shareWishlist = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Danh sách yêu thích của tôi',
          text: `Xem ${wishlistItems.length} sản phẩm tôi yêu thích`,
          url: window.location.href
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        alert('Đã sao chép link danh sách yêu thích!');
      }
    } catch (error) {
      console.error('Error sharing wishlist:', error);
    }
  };

  // Helper functions to get prices
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

  // Sort wishlist items (using effective price for price sorting)
  const sortedItems = [...wishlistItems].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      case 'oldest':
        return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
      case 'price_low':
        return getEffectivePrice(a.product) - getEffectivePrice(b.product);
      case 'price_high':
        return getEffectivePrice(b.product) - getEffectivePrice(a.product);
      case 'name':
        return a.product.name.localeCompare(b.product.name, 'vi');
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải danh sách yêu thích...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <HeartIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Đăng nhập để xem danh sách yêu thích</h2>
          <p className="text-gray-600 mb-4">Đăng nhập để lưu và quản lý sản phẩm yêu thích của bạn</p>
          <Link 
            to="/login" 
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    );
  }

  if (wishlistItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <HeartSolidIcon className="h-16 w-16 text-pink-300 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Danh sách yêu thích trống</h2>
          <p className="text-gray-500 mb-6">Hãy thêm sản phẩm yêu thích để xem lại sau</p>
          <div className="space-x-4">
            <Link 
              to="/" 
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Khám phá sản phẩm
            </Link>
            <Link 
              to="/categories" 
              className="inline-block border border-blue-600 text-blue-600 px-6 py-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Xem danh mục
            </Link>
          </div>
        </div>

        {/* Show recommendations for empty wishlist */}
        <div className="mt-12">
          <RecommendationSection
            title="Có thể bạn sẽ thích"
            type="mixed"
            userId={user._id}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Sản phẩm yêu thích
          </h1>
          <p className="text-gray-600">
            {wishlistItems.length} sản phẩm • Cập nhật lần cuối: {new Date().toLocaleDateString('vi-VN')}
          </p>
        </div>
        
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          {/* Share button */}
          <button
            onClick={shareWishlist}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ShareIcon className="h-4 w-4" />
            <span>Chia sẻ</span>
          </button>

          {/* View mode toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 text-sm ${
                viewMode === 'grid' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Lưới
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm ${
                viewMode === 'list' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Danh sách
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
        <div className="flex items-center space-x-4">
          {/* Select all checkbox */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedItems.size === wishlistItems.length && wishlistItems.length > 0}
              onChange={selectAllItems}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Chọn tất cả ({selectedItems.size}/{wishlistItems.length})
            </span>
          </label>

          {/* Bulk actions */}
          {selectedItems.size > 0 && (
            <button
              onClick={removeSelectedItems}
              className="flex items-center space-x-1 px-3 py-1 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
            >
              <TrashIcon className="h-4 w-4" />
              <span>Xóa ({selectedItems.size})</span>
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="price_low">Giá thấp đến cao</option>
          <option value="price_high">Giá cao đến thấp</option>
          <option value="name">Tên A-Z</option>
        </select>
      </div>

      {/* Wishlist Items */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
          {sortedItems.map((item) => (
            <div key={item._id} className="relative group">
              {/* Selection checkbox */}
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.product._id)}
                  onChange={() => toggleSelectItem(item.product._id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-white shadow-sm"
                />
              </div>

              {/* Product Card - Pass complete product with flash sale info */}
              <ProductCard 
                product={item.product}
                showRecommendationReason={false}
                isWishlisted={true}
                onToggleWishlist={() => removeFromWishlist(item.product._id)}
              />

              {/* Added date */}
              <div className="mt-2 text-xs text-gray-500 text-center">
                Đã thêm: {new Date(item.addedAt).toLocaleDateString('vi-VN')}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="space-y-4 mb-12">
          {sortedItems.map((item) => {
            const hasFlashSale = item.product.isFlashSale || !!item.product.flashSale;
            const effectivePrice = getEffectivePrice(item.product);
            const originalPrice = getOriginalPrice(item.product);
            const discountPercentage = getDiscountPercentage(item.product);
            const hasDiscount = hasFlashSale && effectivePrice < originalPrice;

            return (
              <div 
                key={item._id} 
                className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors relative"
              >
                {/* Flash Sale Badge for list view */}
                {hasFlashSale && (
                  <div className="absolute top-2 right-2">
                    <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-2 py-1 rounded-full flex items-center space-x-1 text-xs animate-pulse">
                      <BoltIcon className="w-3 h-3" />
                      <span className="font-bold">-{Math.round(discountPercentage)}%</span>
                    </div>
                  </div>
                )}

                {/* Selection checkbox */}
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.product._id)}
                  onChange={() => toggleSelectItem(item.product._id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />

                {/* Product image */}
                <Link to={`/product/${item.product._id}`}>
                  <img
                    src={item.product.images[0] || '/placeholder.jpg'}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                </Link>

                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <Link 
                    to={`/product/${item.product._id}`}
                    className="text-lg font-medium text-gray-900 hover:text-blue-600 line-clamp-1"
                  >
                    {item.product.name}
                  </Link>
                  <p className="text-gray-600">{item.product.category}</p>
                  
                  {/* Price Display */}
                  <div className="mt-1">
                    {hasDiscount ? (
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-semibold text-red-600">
                            {effectivePrice.toLocaleString('vi-VN')}₫
                          </span>
                          <span className="text-sm text-gray-400 line-through">
                            {originalPrice.toLocaleString('vi-VN')}₫
                          </span>
                        </div>
                        <div className="text-xs text-green-600 font-medium">
                          Tiết kiệm {(originalPrice - effectivePrice).toLocaleString('vi-VN')}₫
                        </div>
                      </div>
                    ) : (
                      <p className="text-lg font-semibold text-gray-900">
                        {effectivePrice.toLocaleString('vi-VN')}₫
                      </p>
                    )}
                  </div>

                  <p className="text-sm text-gray-500">
                    Đã thêm: {new Date(item.addedAt).toLocaleDateString('vi-VN')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => addToCartFromWishlist(item)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center space-x-1"
                  >
                    <ShoppingCartIcon className="h-4 w-4" />
                    <span>Thêm vào giỏ</span>
                  </button>
                  <button
                    onClick={() => removeFromWishlist(item.product._id)}
                    className="bg-red-600 text-white p-2 rounded hover:bg-red-700 transition-colors"
                    title="Xóa khỏi yêu thích"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recommendations based on wishlist */}
      <div className="border-t pt-12">
        <RecommendationSection
          title="Sản phẩm tương tự"
          type="content"
          userId={user._id}
        />
      </div>
    </div>
  );
};

export default Wishlist;
