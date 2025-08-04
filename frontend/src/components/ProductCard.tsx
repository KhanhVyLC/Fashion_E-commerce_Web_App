// src/components/ProductCard.tsx - Fixed Interactive Version
import React, { useState, memo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StarIcon, HeartIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import OptimizedImage from './OptimizedImage';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import axios from '../utils/axios';

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  rating: number;
  totalReviews: number;
  category?: string;
  brand?: string;
  sizes?: string[];
  colors?: string[];
  stock?: Array<{
    size: string;
    color: string;
    quantity: number;
  }>;
}

interface ProductCardProps {
  product: Product;
  showRecommendationReason?: boolean;
  recommendationData?: {
    type?: string;
    reason?: string;
    confidence?: number;
    complementaryScore?: number;
  };
  isWishlisted?: boolean;
  onToggleWishlist?: (productId: string, isWishlisted: boolean) => void;
  onAddToCart?: (productId: string) => void;
  onProductView?: (productId: string, duration: number) => void;
}

const ProductCard: React.FC<ProductCardProps> = memo(({
  product,
  showRecommendationReason = false,
  recommendationData,
  isWishlisted: propIsWishlisted = false,
  onToggleWishlist,
  onAddToCart,
  onProductView
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(propIsWishlisted);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const viewStartTime = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { user } = useAuth();
  const { addToCart } = useCart();

  // Update local wishlist state when prop changes
  useEffect(() => {
    setIsWishlisted(propIsWishlisted);
  }, [propIsWishlisted]);

  // Track view when component mounts
  useEffect(() => {
    viewStartTime.current = Date.now();
    
    return () => {
      // Track view duration when component unmounts
      if (onProductView) {
        const duration = Math.floor((Date.now() - viewStartTime.current) / 1000);
        if (duration > 1) { // Only track if viewed for more than 1 second
          onProductView(product._id, duration);
        }
      }
    };
  }, [product._id, onProductView]);

  // Handle image hover cycling
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (product.images.length > 1) {
      let imageIndex = 0;
      intervalRef.current = setInterval(() => {
        imageIndex = (imageIndex + 1) % product.images.length;
        setCurrentImageIndex(imageIndex);
      }, 1000);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCurrentImageIndex(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Handle wishlist toggle
  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      alert('Vui lòng đăng nhập để sử dụng tính năng này');
      return;
    }

    if (wishlistLoading) return;

    setWishlistLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Vui lòng đăng nhập để sử dụng tính năng này');
        return;
      }

      const response = await axios.post('/users/wishlist', {
        productId: product._id,
        action: isWishlisted ? 'remove' : 'add'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setIsWishlisted(!isWishlisted);
      
      // Call parent callback if provided
      if (onToggleWishlist) {
        onToggleWishlist(product._id, !isWishlisted);
      }

      // Show feedback
      const message = !isWishlisted 
        ? 'Đã thêm vào danh sách yêu thích!' 
        : 'Đã xóa khỏi danh sách yêu thích!';
      
      // Create a temporary toast notification
      showToast(message, 'success');

    } catch (error: any) {
      console.error('Error updating wishlist:', error);
      const errorMessage = error.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại!';
      showToast(errorMessage, 'error');
    } finally {
      setWishlistLoading(false);
    }
  };

  // Handle add to cart
  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      alert('Vui lòng đăng nhập để sử dụng tính năng này');
      return;
    }

    if (cartLoading) return;

    // Get available stock options
    const availableStock = product.stock?.filter(s => s.quantity > 0) || [];
    
    if (availableStock.length === 0) {
      showToast('Sản phẩm này hiện đã hết hàng', 'error');
      return;
    }

    // Use first available stock option (in real app, you might want to show a selection modal)
    const firstAvailable = availableStock[0];
    const size = firstAvailable.size || product.sizes?.[0] || 'M';
    const color = firstAvailable.color || product.colors?.[0] || 'Đen';

    setCartLoading(true);
    try {
      await addToCart(product._id, 1, size, color);
      
      // Call parent callback if provided
      if (onAddToCart) {
        onAddToCart(product._id);
      }

      showToast('Đã thêm vào giỏ hàng!', 'success');

    } catch (error: any) {
      console.error('Error adding to cart:', error);
      const errorMessage = error.response?.data?.message || 'Có lỗi xảy ra khi thêm vào giỏ hàng';
      showToast(errorMessage, 'error');
    } finally {
      setCartLoading(false);
    }
  };

  // Simple toast notification function
  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all duration-300 ${
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    toast.textContent = message;
    toast.style.transform = 'translateX(100%)';
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };

  const currentImage = product.images[currentImageIndex] || product.images[0] || '/placeholder.jpg';

  return (
    <div 
      className="group bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden">
        <Link to={`/product/${product._id}`}>
          <OptimizedImage
            src={currentImage}
            alt={product.name}
            className="w-full h-full"
            width={300}
            height={300}
            loading="lazy"
            placeholder="/placeholder.jpg"
          />
        </Link>

        {/* Overlay Actions */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300">
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 space-y-2">
            {/* Wishlist Button */}
            <button
              onClick={handleWishlistToggle}
              disabled={wishlistLoading}
              className={`w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors ${
                wishlistLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
              title={isWishlisted ? "Xóa khỏi yêu thích" : "Thêm vào yêu thích"}
            >
              {wishlistLoading ? (
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
              ) : isWishlisted ? (
                <HeartSolidIcon className="w-5 h-5 text-red-500" />
              ) : (
                <HeartIcon className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {/* Quick Add to Cart */}
            <button
              onClick={handleAddToCart}
              disabled={cartLoading}
              className={`w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors ${
                cartLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
              title="Thêm vào giỏ hàng"
            >
              {cartLoading ? (
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
              ) : (
                <ShoppingCartIcon className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>

          {/* Quick View Button */}
          <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Link 
              to={`/product/${product._id}`}
              className="w-full bg-white text-gray-800 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors text-center block"
            >
              Xem chi tiết
            </Link>
          </div>
        </div>

        {/* Image Indicators */}
        {product.images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {product.images.map((_, index) => (
              <div
                key={index}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        )}

        {/* Recommendation Badge */}
        {showRecommendationReason && recommendationData?.reason && (
          <div className="absolute top-3 left-3">
            <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
              {recommendationData.reason}
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <Link to={`/product/${product._id}`}>
          <h3 className="font-medium text-gray-900 mb-2 line-clamp-2 hover:text-blue-600 transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        <div className="flex items-center mb-2">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <StarIcon
                key={i}
                className={`h-4 w-4 ${
                  i < Math.floor(product.rating) 
                    ? 'text-yellow-400 fill-current' 
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="ml-1 text-sm text-gray-600">
            ({product.totalReviews})
          </span>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-red-600">
            {product.price.toLocaleString('vi-VN')}₫
          </span>
          
          {/* Confidence Score for Recommendations */}
          {recommendationData?.confidence && (
            <span className="text-xs text-gray-500">
              {Math.round(recommendationData.confidence * 100)}% phù hợp
            </span>
          )}
        </div>

        {/* Category/Brand */}
        {(product.category || product.brand) && (
          <div className="mt-2 text-xs text-gray-500">
            {product.brand && <span>{product.brand}</span>}
            {product.brand && product.category && <span> • </span>}
            {product.category && <span>{product.category}</span>}
          </div>
        )}
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;