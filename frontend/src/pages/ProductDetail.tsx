// src/pages/ProductDetail.tsx - COMPLETE VERSION WITH FLASH SALE AND SECONDARY IMAGES
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from '../utils/axios';
import { 
  StarIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  FireIcon,
  ClockIcon,
  InformationCircleIcon,
  ChartBarIcon,
  DocumentTextIcon,
  SparklesIcon,
  XMarkIcon,
  MagnifyingGlassPlusIcon
} from '@heroicons/react/24/solid';
import { 
  HeartIcon, 
  ShoppingCartIcon, 
  ShareIcon, 
  ArrowLeftIcon 
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import RecommendationSection from '../components/RecommendationSection';
import StockBadge from '../components/StockBadge';
import OptimizedImage from '../components/OptimizedImage';
import ReviewSummary from '../components/ReviewSummary';

// Interfaces
interface SecondaryImage {
  _id?: string;
  url: string;
  type: 'detail' | 'size_chart' | 'instruction' | 'material' | 'other';
  caption: string;
  order: number;
}

interface FlashSaleInfo {
  inFlashSale: boolean;
  sale?: {
    _id: string;
    name: string;
    endDate: string;
    originalPrice: number;
    discountPrice: number;
    discountPercentage: number;
    available: number;
  };
}

interface ProductStockItem {
  size: string;
  color: string;
  quantity: number;
}

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  secondaryImages?: SecondaryImage[];
  category: string;
  subcategory?: string;
  brand?: string;
  sizes: string[];
  colors: string[];
  stock: ProductStockItem[];
  tags?: string[];
  rating: number;
  totalReviews: number;
  viewCount: number;
  totalOrders: number;
  createdAt: string;
  updatedAt: string;
}

interface Review {
  _id: string;
  user: {
    _id: string;
    name: string;
    email?: string;
  };
  rating: number;
  comment: string;
  images?: string[];
  createdAt: string;
  helpful?: number;
}

interface ToastOptions {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  
  // Product state
  const [product, setProduct] = useState<Product | null>(null);
  const [flashSaleInfo, setFlashSaleInfo] = useState<FlashSaleInfo | null>(null);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  
  // Selection state
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [currentStock, setCurrentStock] = useState(0);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showSecondaryImageModal, setShowSecondaryImageModal] = useState(false);
  const [selectedSecondaryImage, setSelectedSecondaryImage] = useState<SecondaryImage | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'reviews' | 'care'>('details');
  const [showSecondaryImages, setShowSecondaryImages] = useState(false);
  
  // Recommendation state
  const [showRecommendations, setShowRecommendations] = useState(false);
  
  // Timer ref for cleanup
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // View tracking refs
  const viewStartTime = useRef<number>(Date.now());
  const hasTrackedView = useRef<boolean>(false);
  const trackingTimeout = useRef<NodeJS.Timeout | null>(null);
  const pageLoadTime = useRef<number>(Date.now());

  // Fetch Flash Sale info
  const fetchFlashSaleInfo = async () => {
    if (!id) return;
    
    try {
      const { data } = await axios.get(`/flash-sales/product/${id}`);
      setFlashSaleInfo(data);
      
      if (data.inFlashSale && data.sale) {
        // Start countdown
        const endTime = new Date(data.sale.endDate).getTime();
        startCountdown(endTime);
      }
    } catch (error) {
      console.error('Error fetching flash sale info:', error);
    }
  };

  // Countdown timer
  const startCountdown = (endTime: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = endTime - now;
      
      if (distance < 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        setFlashSaleInfo(null); // Flash sale ended
        return;
      }
      
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      
      setTimeLeft({ hours, minutes, seconds });
    };
    
    updateTimer(); // Initial call
    timerRef.current = setInterval(updateTimer, 1000);
  };

  // Initialize and fetch data
  useEffect(() => {
    if (id) {
      // Reset states
      viewStartTime.current = Date.now();
      hasTrackedView.current = false;
      pageLoadTime.current = Date.now();
      setShowRecommendations(false);
      
      // Fetch data
      fetchProductData();
      fetchFlashSaleInfo();
      
      // Scroll to top
      window.scrollTo(0, 0);
    }
    
    return () => {
      // Cleanup timers
      if (trackingTimeout.current) {
        clearTimeout(trackingTimeout.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [id]);

  // Check wishlist status when user changes
  useEffect(() => {
    if (user && product) {
      checkWishlist();
    } else {
      setIsWishlisted(false);
    }
  }, [user, product]);

  // Show recommendations after product loads
  useEffect(() => {
    if (product && !loading) {
      const timer = setTimeout(() => {
        setShowRecommendations(true);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [product, loading]);

  // Update stock when selection changes
  useEffect(() => {
    if (product && selectedSize && selectedColor) {
      const stockItem = product.stock?.find(
        (item) => item.size === selectedSize && item.color === selectedColor
      );
      let availableStock = stockItem ? stockItem.quantity : 0;
      
      // Check flash sale limit
      if (flashSaleInfo?.inFlashSale && flashSaleInfo.sale) {
        availableStock = Math.min(availableStock, flashSaleInfo.sale.available);
      }
      
      setCurrentStock(availableStock);
    }
  }, [product, selectedSize, selectedColor, flashSaleInfo]);

  // Get effective price (flash sale or regular)
  const getEffectivePrice = () => {
    if (flashSaleInfo?.inFlashSale && flashSaleInfo.sale) {
      return flashSaleInfo.sale.discountPrice;
    }
    return product?.price || 0;
  };

  // Get original price for display
  const getOriginalPrice = () => {
    if (flashSaleInfo?.inFlashSale && flashSaleInfo.sale) {
      return flashSaleInfo.sale.originalPrice;
    }
    // Show fake discount for non-flash sale items under 1M
    if (product && product.price < 1000000) {
      return product.price * 1.25;
    }
    return null;
  };

  // Get discount percentage
  const getDiscountPercentage = () => {
    if (flashSaleInfo?.inFlashSale && flashSaleInfo.sale) {
      return flashSaleInfo.sale.discountPercentage;
    }
    if (product && product.price < 1000000) {
      return 20; // Default discount
    }
    return 0;
  };

  // Group secondary images by type
  const getGroupedSecondaryImages = () => {
    if (!product?.secondaryImages) return {};
    
    const grouped: Record<string, SecondaryImage[]> = {};
    product.secondaryImages.forEach(img => {
      if (!grouped[img.type]) {
        grouped[img.type] = [];
      }
      grouped[img.type].push(img);
    });
    
    // Sort each group by order
    Object.keys(grouped).forEach(type => {
      grouped[type].sort((a, b) => a.order - b.order);
    });
    
    return grouped;
  };

  // Get secondary image type label
  const getImageTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      detail: 'Chi tiết sản phẩm',
      size_chart: 'Bảng size',
      instruction: 'Hướng dẫn sử dụng',
      material: 'Chất liệu',
      other: 'Khác'
    };
    return labels[type] || type;
  };

  // Get secondary image type icon
  const getImageTypeIcon = (type: string) => {
    switch (type) {
      case 'detail':
        return <InformationCircleIcon className="w-5 h-5" />;
      case 'size_chart':
        return <ChartBarIcon className="w-5 h-5" />;
      case 'instruction':
        return <DocumentTextIcon className="w-5 h-5" />;
      case 'material':
        return <SparklesIcon className="w-5 h-5" />;
      default:
        return <InformationCircleIcon className="w-5 h-5" />;
    }
  };

  // Data fetching functions
  const fetchProductData = async () => {
    try {
      setLoading(true);
      
      const { data } = await axios.get(`/products/${id}`);
      setProduct(data);
      
      if (data.sizes?.length > 0) {
        setSelectedSize(data.sizes[0]);
      }
      if (data.colors?.length > 0) {
        setSelectedColor(data.colors[0]);
      }
      
      await Promise.all([
        fetchReviews(),
        fetchRelatedProducts(data.category, data._id)
      ]);
      
    } catch (error) {
      console.error('Error fetching product:', error);
      showToast({
        message: 'Không thể tải thông tin sản phẩm',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const { data } = await axios.get(`/reviews/product/${id}`);
      setReviews(data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const fetchRelatedProducts = async (category: string, excludeId: string) => {
    try {
      const { data } = await axios.get('/products', {
        params: { category, limit: 6 }
      });
      const filtered = (data.products || data).filter((p: Product) => p._id !== excludeId);
      setRelatedProducts(filtered.slice(0, 5));
    } catch (error) {
      console.error('Error fetching related products:', error);
    }
  };

  const checkWishlist = async () => {
    if (!user || !product) {
      setIsWishlisted(false);
      return;
    }
    
    try {
      const { data } = await axios.get('/users/me');
      const wishlist = data.interactions?.wishlist || [];
      
      const isInWishlist = wishlist.some((item: any) => {
        const productId = item.product?._id || item.product;
        return productId === product._id;
      });
      
      setIsWishlisted(isInWishlist);
    } catch (error) {
      console.error('Error checking wishlist:', error);
      setIsWishlisted(false);
    }
  };

  // Action handlers
  const handleAddToCart = async () => {
    if (!user) {
      showToast({
        message: 'Vui lòng đăng nhập để thêm vào giỏ hàng',
        type: 'info'
      });
      navigate('/login');
      return;
    }

    if (!product) return;

    if (currentStock === 0) {
      showToast({
        message: flashSaleInfo?.inFlashSale 
          ? 'Flash Sale đã hết hàng!' 
          : 'Sản phẩm này đã hết hàng!',
        type: 'error'
      });
      return;
    }

    if (quantity > currentStock) {
      showToast({
        message: flashSaleInfo?.inFlashSale 
          ? `Flash Sale chỉ còn ${currentStock} sản phẩm!` 
          : `Chỉ còn ${currentStock} sản phẩm trong kho!`,
        type: 'warning'
      });
      return;
    }

    setAddingToCart(true);
    try {
      // The backend will automatically detect and apply flash sale price
      await addToCart(product._id, quantity, selectedSize, selectedColor);
      
      // Track add to cart action
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await axios.post('/recommendations/track', {
            action: 'addToCart',
            productId: product._id,
            metadata: { 
              source: 'product_detail',
              size: selectedSize,
              color: selectedColor,
              quantity: quantity,
              price: getEffectivePrice(),
              isFlashSale: flashSaleInfo?.inFlashSale || false,
              totalValue: getEffectivePrice() * quantity
            }
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (trackError) {
          console.warn('Failed to track add to cart:', trackError);
        }
      }
      
      // Update local stock display
      setCurrentStock(prev => Math.max(0, prev - quantity));
      
      // Update flash sale available quantity if applicable
      if (flashSaleInfo?.inFlashSale && flashSaleInfo.sale) {
        setFlashSaleInfo({
          ...flashSaleInfo,
          sale: {
            ...flashSaleInfo.sale,
            available: Math.max(0, flashSaleInfo.sale.available - quantity)
          }
        });
      }
      
      // Reset quantity
      setQuantity(1);
      
      // Show success message
      showToast({
        message: flashSaleInfo?.inFlashSale 
          ? `🔥 Đã thêm ${quantity} sản phẩm Flash Sale vào giỏ!`
          : `Đã thêm ${quantity} sản phẩm vào giỏ hàng!`,
        type: 'success'
      });
      
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      const errorMessage = error.response?.data?.message || 'Có lỗi xảy ra khi thêm vào giỏ hàng';
      showToast({
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setAddingToCart(false);
    }
  };

  const toggleWishlist = async () => {
    if (!user) {
      showToast({
        message: 'Vui lòng đăng nhập để thêm vào yêu thích',
        type: 'info'
      });
      navigate('/login');
      return;
    }

    if (wishlistLoading || !product) return;

    setWishlistLoading(true);
    try {
      await axios.post('/users/wishlist', {
        productId: product._id,
        action: isWishlisted ? 'remove' : 'add'
      });
      
      setIsWishlisted(!isWishlisted);
      
      showToast({
        message: !isWishlisted 
          ? '❤️ Đã thêm vào danh sách yêu thích!' 
          : 'Đã xóa khỏi danh sách yêu thích',
        type: 'success'
      });
      
    } catch (error: any) {
      console.error('Error updating wishlist:', error);
      showToast({
        message: error.response?.data?.message || 'Có lỗi xảy ra',
        type: 'error'
      });
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleShare = async () => {
    if (!product) return;
    
    setShareLoading(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `Xem sản phẩm ${product.name} với giá ${getEffectivePrice().toLocaleString('vi-VN')}₫`,
          url: window.location.href
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast({
          message: '📋 Đã sao chép link sản phẩm!',
          type: 'success'
        });
      }
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
    } finally {
      setShareLoading(false);
    }
  };

  const openSecondaryImageModal = (image: SecondaryImage) => {
    setSelectedSecondaryImage(image);
    setShowSecondaryImageModal(true);
  };

  // UI helper functions
  const showToast = useCallback((options: ToastOptions) => {
    const { message, type, duration = 3000 } = options;
    
    const toast = document.createElement('div');
    const bgColor = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      info: 'bg-blue-500',
      warning: 'bg-yellow-500'
    }[type];
    
    const icon = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠'
    }[type];
    
    toast.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-white font-medium shadow-lg transition-all duration-300 ${bgColor} flex items-center space-x-2 max-w-sm`;
    toast.innerHTML = `
      <span class="text-lg">${icon}</span>
      <span>${message}</span>
    `;
    toast.style.transform = 'translateX(400px)';
    
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
    });
    
    setTimeout(() => {
      toast.style.transform = 'translateX(400px)';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, duration);
  }, []);

  const nextImage = () => {
    if (product && product.images.length > 1) {
      setSelectedImage((prev) => (prev + 1) % product.images.length);
      setImageLoading(true);
    }
  };

  const prevImage = () => {
    if (product && product.images.length > 1) {
      setSelectedImage((prev) => (prev - 1 + product.images.length) % product.images.length);
      setImageLoading(true);
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

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="bg-gray-200 rounded-lg aspect-square"></div>
              <div className="flex space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-gray-200 rounded w-20 h-20"></div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              <div className="h-10 bg-gray-200 rounded w-1/4"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Không tìm thấy sản phẩm</h2>
          <Link to="/" className="text-blue-600 hover:underline">
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  const effectivePrice = getEffectivePrice();
  const originalPrice = getOriginalPrice();
  const discountPercentage = getDiscountPercentage();
  const groupedSecondaryImages = getGroupedSecondaryImages();

  // Main render
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm">
        <ol className="flex items-center space-x-2 flex-wrap">
          <li>
            <Link to="/" className="text-gray-500 hover:text-gray-700">Trang chủ</Link>
          </li>
          <li className="text-gray-400">/</li>
          <li>
            <Link to={`/category/${product.category}`} className="text-gray-500 hover:text-gray-700">
              {product.category}
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-900 font-medium">{product.name}</li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Image Gallery */}
        <div>
          <div className="relative mb-4 group">
              <div 
                className="aspect-square overflow-hidden rounded-lg bg-gray-100 cursor-zoom-in"
                onClick={() => setShowImageModal(true)}
              >
                <OptimizedImage
                  src={product.images[selectedImage] || '/placeholder.jpg'}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  width={600}
                  height={600}
                  loading="eager"
                  onLoad={() => setImageLoading(false)}
                />
                            {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
              
              {/* Zoom indicator */}
              <div className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <MagnifyingGlassPlusIcon className="w-5 h-5" />
              </div>
            </div>
            
            {/* Navigation arrows */}
            {product.images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
          
          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedImage(index);
                    setImageLoading(true);
                  }}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                    selectedImage === index ? 'border-blue-500' : 'border-gray-200'
                  }`}
                >
                  <OptimizedImage
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                    width={80}
                    height={80}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
          
          {/* Secondary Images Section */}
          {product.secondaryImages && product.secondaryImages.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowSecondaryImages(!showSecondaryImages)}
                className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="font-medium text-gray-900">Xem thêm hình ảnh chi tiết</span>
                <ChevronRightIcon className={`w-5 h-5 transition-transform ${showSecondaryImages ? 'rotate-90' : ''}`} />
              </button>
              
              {showSecondaryImages && (
                <div className="mt-4 space-y-6">
                  {Object.entries(groupedSecondaryImages).map(([type, images]) => (
                    <div key={type}>
                      <div className="flex items-center space-x-2 mb-3">
                        {getImageTypeIcon(type)}
                        <h3 className="font-medium text-gray-900">{getImageTypeLabel(type)}</h3>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {images.map((image, index) => (
                          <button
                            key={image._id || index}
                            onClick={() => openSecondaryImageModal(image)}
                            className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 hover:opacity-80 transition-opacity"
                          >
                            <img
                              src={getImageUrl(image.url)}
                              alt={image.caption || `${getImageTypeLabel(type)} ${index + 1}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            {image.caption && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center">
                                {image.caption}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="lg:pl-8">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
              {product.brand && (
                <p className="text-gray-600 mb-2">
                  Thương hiệu: <Link to={`/brand/${product.brand}`} className="font-medium text-blue-600 hover:underline">
                    {product.brand}
                  </Link>
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <button onClick={handleShare} className="p-2 rounded-full hover:bg-gray-100">
                <ShareIcon className="h-6 w-6 text-gray-600" />
              </button>
              <button onClick={toggleWishlist} disabled={wishlistLoading} className="p-2 rounded-full hover:bg-gray-100">
                {wishlistLoading ? (
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin"></div>
                ) : isWishlisted ? (
                  <HeartSolidIcon className="h-6 w-6 text-red-500" />
                ) : (
                  <HeartIcon className="h-6 w-6 text-gray-600" />
                )}
              </button>
            </div>
          </div>
          
          {/* Flash Sale Timer */}
          {flashSaleInfo?.inFlashSale && (
            <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-4 mb-6 border border-red-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FireIcon className="w-6 h-6 text-red-500 mr-2 animate-pulse" />
                  <span className="font-bold text-red-600 text-lg">Flash Sale</span>
                </div>
                <div className="flex items-center space-x-2">
                  <ClockIcon className="w-5 h-5 text-gray-600" />
                  <div className="flex space-x-1">
                    <span className="bg-gray-900 text-white px-2 py-1 rounded font-mono text-sm">
                      {String(timeLeft.hours).padStart(2, '0')}
                    </span>
                    <span className="font-bold">:</span>
                    <span className="bg-gray-900 text-white px-2 py-1 rounded font-mono text-sm">
                      {String(timeLeft.minutes).padStart(2, '0')}
                    </span>
                    <span className="font-bold">:</span>
                    <span className="bg-gray-900 text-white px-2 py-1 rounded font-mono text-sm">
                      {String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </div>
              
              {flashSaleInfo.sale && (
                <div className="mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Đã bán trong Flash Sale</span>
                    <span className="font-semibold">Còn {flashSaleInfo.sale.available} sản phẩm</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
                      style={{ width: '30%' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Rating */}
          <div className="flex items-center mb-6">
            <div className="flex items-center mr-2">
              {[...Array(5)].map((_, i) => (
                <StarIcon
                  key={i}
                  className={`h-5 w-5 ${i < Math.floor(product.rating || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                />
              ))}
            </div>
            <span className="text-gray-700">
              {(product.rating || 0).toFixed(1)} ({product.totalReviews || 0} đánh giá) | {product.totalOrders || 0} đã bán
            </span>
          </div>

          {/* Price */}
          <div className="mb-6">
            <div className="flex items-baseline space-x-3">
              <p className="text-3xl font-bold text-red-600">
                {effectivePrice.toLocaleString('vi-VN')}₫
              </p>
              {originalPrice && (
                <p className="text-lg text-gray-400 line-through">
                  {originalPrice.toLocaleString('vi-VN')}₫
                </p>
              )}
              {flashSaleInfo?.inFlashSale && (
                <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-sm font-medium">
                  Tiết kiệm {((originalPrice || 0) - effectivePrice).toLocaleString('vi-VN')}₫
                </span>
              )}
            </div>
            {effectivePrice >= 500000 && (
              <p className="text-sm text-green-600 mt-1">✓ Miễn phí vận chuyển</p>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Mô tả sản phẩm</h3>
            <p className="text-gray-700 leading-relaxed">{product.description}</p>
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {product.tags.map((tag, index) => (
                  <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Size Selection */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Kích thước</label>
                {product.secondaryImages?.some(img => img.type === 'size_chart') && (
                  <button 
                    onClick={() => {
                      const sizeChartImg = product.secondaryImages?.find(img => img.type === 'size_chart');
                      if (sizeChartImg) openSecondaryImageModal(sizeChartImg);
                    }}
                    className="text-sm text-blue-600 hover:underline flex items-center space-x-1"
                  >
                    <ChartBarIcon className="w-4 h-4" />
                    <span>Bảng size</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {product.sizes.map((size) => {
                  const hasStock = product.stock?.some(
                    item => item.size === size && item.color === selectedColor && item.quantity > 0
                  );
                  
                  return (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      disabled={!hasStock}
                      className={`px-3 py-2 border rounded-lg transition-all text-sm font-medium ${
                        selectedSize === size
                          ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-200'
                          : hasStock
                          ? 'border-gray-300 hover:border-gray-400'
                          : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Color Selection */}
          {product.colors && product.colors.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Màu sắc: <span className="font-normal text-gray-600">{selectedColor}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => {
                  const hasStock = product.stock?.some(
                    item => item.size === selectedSize && item.color === color && item.quantity > 0
                  );
                  
                  return (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      disabled={!hasStock}
                      className={`px-4 py-2 border rounded-lg transition-all text-sm font-medium ${
                        selectedColor === color
                          ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-200'
                          : hasStock
                          ? 'border-gray-300 hover:border-gray-400'
                          : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock Display */}
          <div className="mb-6">
            <StockBadge quantity={currentStock} />
            {flashSaleInfo?.inFlashSale && currentStock > 0 && currentStock <= 10 && (
              <div className="flex items-center mt-2 text-sm text-orange-600 font-medium">
                <FireIcon className="w-4 h-4 mr-1 animate-pulse" />
                Nhanh tay! Chỉ còn {currentStock} sản phẩm trong Flash Sale
              </div>
            )}
            {!flashSaleInfo?.inFlashSale && currentStock > 0 && currentStock <= 10 && (
              <div className="flex items-center mt-2 text-sm text-orange-600">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Chỉ còn {currentStock} sản phẩm!
              </div>
            )}
          </div>

          {/* Quantity and Add to Cart */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Số lượng</label>
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-3 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentStock === 0 || quantity <= 1}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <input
                  type="number"
                  min="1"
                  max={currentStock}
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    if (val > 0 && val <= currentStock) {
                      setQuantity(val);
                    }
                  }}
                  className="w-20 text-center border-x border-gray-300 focus:outline-none py-3"
                  disabled={currentStock === 0}
                />
                <button
                  onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                  className="px-4 py-3 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={currentStock === 0 || quantity >= currentStock}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAddToCart}
                disabled={currentStock === 0 || addingToCart}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-medium transition-all ${
                  currentStock === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : flashSaleInfo?.inFlashSale
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:shadow-lg transform hover:-translate-y-0.5'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'
                }`}
              >
                {currentStock === 0 ? (
                  'Hết hàng'
                ) : addingToCart ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Đang thêm...
                  </>
                ) : (
                  <>
                    <ShoppingCartIcon className="h-5 w-5" />
                    {flashSaleInfo?.inFlashSale ? 'Thêm vào giỏ hàng' : 'Thêm vào giỏ hàng'}
                  </>
                )}
              </button>
              
              <button
                className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                onClick={() => {
                  handleAddToCart();
                  setTimeout(() => navigate('/cart'), 500);
                }}
                disabled={currentStock === 0 || addingToCart}
              >
                Mua ngay
              </button>
            </div>
          </div>

          {/* Shipping & Policies */}
          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 mb-3">Chính sách bán hàng</h3>
            
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-medium text-gray-900">Miễn phí vận chuyển</p>
                <p className="text-sm text-gray-600">Cho đơn hàng từ 500.000₫</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-medium text-gray-900">Đổi trả dễ dàng</p>
                <p className="text-sm text-gray-600">Trong vòng 30 ngày kể từ ngày nhận hàng</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-medium text-gray-900">Cam kết chính hãng</p>
                <p className="text-sm text-gray-600">100% hàng chính hãng, bồi thường 200% nếu phát hiện hàng giả</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Details Tabs */}
      <div className="mb-12">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button 
              onClick={() => setActiveTab('details')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Chi tiết sản phẩm
            </button>
            <button 
              onClick={() => setActiveTab('reviews')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'reviews'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Đánh giá ({reviews.length})
            </button>
            <button 
              onClick={() => setActiveTab('care')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'care'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Hướng dẫn bảo quản
            </button>
          </nav>
        </div>
        
        <div className="py-6">
          {activeTab === 'details' && (
            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold mb-4">Thông tin chi tiết</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Danh mục</p>
                  <p className="font-medium">{product.category}</p>
                </div>
                {product.brand && (
                  <div>
                    <p className="text-sm text-gray-600">Thương hiệu</p>
                    <p className="font-medium">{product.brand}</p>
                  </div>
                )}
                {product.sizes && (
                  <div>
                    <p className="text-sm text-gray-600">Kích thước có sẵn</p>
                    <p className="font-medium">{product.sizes.join(', ')}</p>
                  </div>
                )}
                {product.colors && (
                  <div>
                    <p className="text-sm text-gray-600">Màu sắc có sẵn</p>
                    <p className="font-medium">{product.colors.join(', ')}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Mã sản phẩm</p>
                  <p className="font-medium">{product._id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Ngày cập nhật</p>
                  <p className="font-medium">
                    {new Date(product.updatedAt).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              {reviews.length > 0 && (
                <div className="mb-8">
                  <ReviewSummary productId={id!} />
                </div>
              )}
              
              {reviews.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <div className="mb-4">
                    <StarIcon className="h-12 w-12 text-gray-300 mx-auto" />
                  </div>
                  <p className="text-gray-600 mb-2">Chưa có đánh giá nào cho sản phẩm này</p>
                  <p className="text-sm text-gray-500">Hãy là người đầu tiên đánh giá sản phẩm!</p>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-gray-900">{product.rating.toFixed(1)}</p>
                        <div className="flex items-center justify-center mt-2">
                          {[...Array(5)].map((_, i) => (
                            <StarIcon
                              key={i}
                              className={`h-5 w-5 ${
                                i < Math.floor(product.rating) 
                                  ? 'text-yellow-400' 
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{product.totalReviews} đánh giá</p>
                      </div>
                      
                      <div className="col-span-2 space-y-2">
                        {[5, 4, 3, 2, 1].map((star) => {
                          const count = reviews.filter(r => r.rating === star).length;
                          const percentage = (count / reviews.length) * 100;
                          
                          return (
                            <div key={star} className="flex items-center space-x-2">
                              <span className="text-sm text-gray-600 w-12">{star} sao</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-yellow-400 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600 w-12 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review._id} className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center space-x-3 mb-2">
                              <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                                <span className="text-gray-600 font-medium">
                                  {review.user?.name?.charAt(0).toUpperCase() || 'U'}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{review.user?.name || 'Người dùng'}</p>
                                <div className="flex items-center space-x-2">
                                  <div className="flex items-center">
                                    {[...Array(5)].map((_, i) => (
                                      <StarIcon
                                        key={i}
                                        className={`h-4 w-4 ${
                                          i < review.rating 
                                            ? 'text-yellow-400' 
                                            : 'text-gray-300'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-sm text-gray-500">
                                    {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-gray-700 mb-4">{review.comment}</p>
                        
                        {review.images && review.images.length > 0 && (
                          <div className="flex gap-2 mb-4">
                            {review.images.map((image, index) => (
                              <img
                                key={index}
                                src={image}
                                alt={`Review ${index + 1}`}
                                className="w-24 h-24 object-cover rounded-lg cursor-pointer hover:opacity-80"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          
          {activeTab === 'care' && (
            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold mb-4">Hướng dẫn bảo quản</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Giặt tay hoặc giặt máy với nước lạnh</li>
                <li>• Không sử dụng chất tẩy mạnh</li>
                <li>• Phơi trong bóng râm, tránh ánh nắng trực tiếp</li>
                <li>• Ủi ở nhiệt độ thấp nếu cần thiết</li>
                <li>• Bảo quản nơi khô ráo, thoáng mát</li>
                <li>• Tránh để gần nguồn nhiệt cao</li>
              </ul>
              
              {product.secondaryImages?.some(img => img.type === 'instruction') && (
                <div className="mt-6">
                  <button 
                    onClick={() => {
                      const instructionImg = product.secondaryImages?.find(img => img.type === 'instruction');
                      if (instructionImg) openSecondaryImageModal(instructionImg);
                    }}
                    className="text-blue-600 hover:underline flex items-center space-x-2"
                  >
                    <DocumentTextIcon className="w-5 h-5" />
                    <span>Xem hướng dẫn chi tiết bằng hình ảnh</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Sản phẩm liên quan</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {relatedProducts.map((relatedProduct) => (
              <Link 
                key={relatedProduct._id}
                to={`/product/${relatedProduct._id}`}
                className="group"
              >
                <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 mb-3">
                  <OptimizedImage
                    src={relatedProduct.images[0] || '/placeholder.jpg'}
                    alt={relatedProduct.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    width={200}
                    height={200}
                    loading="lazy"
                  />
                </div>
                <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {relatedProduct.name}
                </h3>
                <p className="text-sm font-semibold text-red-600 mt-1">
                  {relatedProduct.price.toLocaleString('vi-VN')}₫
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {showRecommendations && product && (
        <div className="space-y-12">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-2xl font-bold mb-6">Sản phẩm gợi ý cho bạn</h2>
            <RecommendationSection 
              title="Sản phẩm tương tự" 
              type="content"
              productId={product._id}
              userId={user?._id}
            />
          </div>
          
          {user && (
            <RecommendationSection 
              title="Dựa trên lịch sử xem" 
              type="content"
              userId={user._id}
            />
          )}
          
          <RecommendationSection 
            title="Xu hướng hiện tại" 
            type="trending"
            userId={user?._id}
          />
        </div>
      )}

      {/* Primary Image Modal */}
      {showImageModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh]">
            <img
              src={getImageUrl(product.images[selectedImage])}
              alt={product.name}
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowImageModal(false);
              }}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            
            {/* Navigation in modal */}
            {product.images.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 transition-colors"
                >
                  <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 transition-colors"
                >
                  <ChevronRightIcon className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Secondary Image Modal */}
      {showSecondaryImageModal && selectedSecondaryImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowSecondaryImageModal(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col">
            <img
              src={getImageUrl(selectedSecondaryImage.url)}
              alt={selectedSecondaryImage.caption || getImageTypeLabel(selectedSecondaryImage.type)}
              className="max-w-full max-h-full object-contain"
            />
            
            {selectedSecondaryImage.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-4">
                <p className="text-center">{selectedSecondaryImage.caption}</p>
              </div>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSecondaryImageModal(false);
              }}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
