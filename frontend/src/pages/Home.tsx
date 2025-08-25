// src/pages/Home.tsx - Complete Version without service features, newsletter, with dynamic categories and footer
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from '../utils/axios';
import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import ProductFilter from '../components/ProductFilter';
import RecommendationManager from '../components/RecommendationManager';
import ImageWithFallback from '../components/ImageWithFallback';
import { useAuth } from '../context/AuthContext';
import { useImagePreloader } from '../hooks/useImagePreloader';
import { ImageOptimizer } from '../utils/imageOptimization';
import { 
  ChevronRightIcon, 
  SparklesIcon, 
  FireIcon,
  ArrowRightIcon,
  ClockIcon,
  StarIcon,
  HeartIcon,
  ShoppingBagIcon,
  FunnelIcon,
  ArrowTrendingUpIcon,
  AdjustmentsHorizontalIcon,
  Squares2X2Icon,
  ListBulletIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

// Enhanced Hero Banner with Parallax Effect
const HeroBanner: React.FC = React.memo(() => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const { preloadImages } = useImagePreloader();

  const slides = useMemo(() => [
    {
      id: 1,
      image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1920&q=80',
      title: 'Summer Collection 2025',
      subtitle: 'Phong cách mùa hè sôi động',
      description: 'Khám phá BST mới với hơn 500+ mẫu thiết kế độc đáo',
      cta: 'Khám phá ngay',
      badge: 'NEW ARRIVAL',
      discount: '-50%',
      gradient: 'from-purple-600 to-pink-600'
    },
    {
      id: 2,
      image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1920&q=80',
      title: 'Flash Sale Cuối Tuần',
      subtitle: 'Giảm giá cực sốc',
      description: 'Ưu đãi lên đến 70% cho thành viên VIP',
      cta: 'Mua ngay',
      badge: 'LIMITED TIME',
      discount: '-70%',
      gradient: 'from-orange-600 to-red-600'
    },
    {
      id: 3,
      image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1920&q=80',
      title: 'Exclusive Designer',
      subtitle: 'Bộ sưu tập cao cấp',
      description: 'Thiết kế độc quyền từ các NTK hàng đầu',
      cta: 'Xem chi tiết',
      badge: 'EXCLUSIVE',
      discount: 'VIP',
      gradient: 'from-blue-600 to-cyan-600'
    }
  ], []);

  useEffect(() => {
    const urls = slides.map(slide => 
      ImageOptimizer.getOptimizedUrl(slide.image, { width: 1920, height: 800, quality: 90 })
    );
    preloadImages(urls, { priority: 'high' });
  }, [slides, preloadImages]);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length, isAutoPlaying]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  return (
    <div className="relative h-[500px] lg:h-[600px] rounded-3xl overflow-hidden mb-16 group">
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-all duration-1000 ${
            index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
          }`}
        >
          <div className="relative h-full w-full">
            <ImageWithFallback
              src={ImageOptimizer.getOptimizedUrl(slide.image, { width: 1920, height: 800 })}
              alt={slide.title}
              className="w-full h-full transform transition-transform duration-[10s] ease-out"
              style={{
                transform: index === currentSlide ? 'scale(1.1)' : 'scale(1)'
              }}
              priority="high"
              loading="eager"
            />
            
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </div>

          <div className="absolute inset-0 flex items-center">
            <div className="container mx-auto px-6 lg:px-12">
              <div className={`max-w-2xl transform transition-all duration-1000 delay-300 ${
                index === currentSlide ? 'translate-x-0 opacity-100' : '-translate-x-10 opacity-0'
              }`}>
                <div className="inline-flex items-center space-x-2 mb-6">
                  <span className={`bg-gradient-to-r ${slide.gradient} text-white text-xs font-bold px-4 py-2 rounded-full animate-pulse`}>
                    {slide.badge}
                  </span>
                  {slide.discount !== 'VIP' && (
                    <span className="bg-yellow-500 text-black text-sm font-bold px-4 py-2 rounded-full">
                      {slide.discount}
                    </span>
                  )}
                </div>

                <h1 className="text-4xl lg:text-6xl font-bold text-white mb-4 leading-tight">
                  {slide.title}
                </h1>
                
                <p className="text-xl lg:text-2xl text-gray-200 mb-4">
                  {slide.subtitle}
                </p>
                
                <p className="text-lg text-gray-300 mb-8">
                  {slide.description}
                </p>

                <div className="flex flex-wrap gap-4">
                  <button className={`group/btn bg-gradient-to-r ${slide.gradient} text-white px-8 py-4 rounded-full font-semibold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center space-x-2`}>
                    <span>{slide.cta}</span>
                    <ArrowRightIcon className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                  
                  <button className="bg-white/20 backdrop-blur-md text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white/30 transition-all duration-300 border border-white/30">
                    Xem thêm
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-3 z-10">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`transition-all duration-300 ${
              index === currentSlide ? 'w-12 h-3 bg-white rounded-full' : 'w-3 h-3 bg-white/50 rounded-full hover:bg-white/70'
            }`}
          />
        ))}
      </div>

      <button
        onClick={() => goToSlide((currentSlide - 1 + slides.length) % slides.length)}
        className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all opacity-0 group-hover:opacity-100"
      >
        <ChevronRightIcon className="w-6 h-6 rotate-180" />
      </button>
      
      <button
        onClick={() => goToSlide((currentSlide + 1) % slides.length)}
        className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all opacity-0 group-hover:opacity-100"
      >
        <ChevronRightIcon className="w-6 h-6" />
      </button>
    </div>
  );
});

// Enhanced Flash Sale with Real Data
const EnhancedFlashSale: React.FC = React.memo(() => {
  const [flashSales, setFlashSales] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFlashSales();
  }, []);

  const fetchFlashSales = async () => {
    try {
      const { data } = await axios.get('/flash-sales/active');
      setFlashSales(data);
      
      if (data.length > 0 && data[0].timeRemaining) {
        updateTimeFromSeconds(data[0].timeRemaining);
      }
    } catch (error) {
      console.error('Error fetching flash sales:', error);
      setTimeLeft({ hours: 23, minutes: 59, seconds: 59 });
    } finally {
      setLoading(false);
    }
  };

  const updateTimeFromSeconds = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    setTimeLeft({ hours, minutes, seconds: secs });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return { hours: 23, minutes: 59, seconds: 59 };
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <div className="mb-20 p-8 lg:p-12 bg-gradient-to-r from-red-50 to-orange-50 rounded-3xl">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4">
                <div className="h-64 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (flashSales.length === 0) return null;

  const currentSale = flashSales[0];
  const products = currentSale.products || [];

  return (
    <div className="mb-20 relative">
      <div className="absolute inset-0 bg-gradient-to-r from-red-50 to-orange-50 rounded-3xl -z-10" />
      
      <div className="p-8 lg:p-12">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-10">
          <div className="flex items-center space-x-4 mb-4 lg:mb-0">
            <div className="relative">
              <FireIcon className="w-10 h-10 text-red-500 animate-pulse" />
              <div className="absolute -inset-1 bg-red-500/20 rounded-full blur-xl animate-ping" />
            </div>
            <div>
              <h2 className="text-4xl font-bold text-gray-900">{currentSale.name || 'Flash Sale'}</h2>
              <p className="text-gray-600">{currentSale.description || 'Ưu đãi có hạn - Nhanh tay kẻo lỡ!'}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <ClockIcon className="w-6 h-6 text-red-500" />
            <div className="flex space-x-2">
              {[
                { value: timeLeft.hours, label: 'Giờ' },
                { value: timeLeft.minutes, label: 'Phút' },
                { value: timeLeft.seconds, label: 'Giây' }
              ].map((item, index) => (
                <React.Fragment key={item.label}>
                  {index > 0 && <span className="text-2xl font-bold text-red-500">:</span>}
                  <div className="text-center">
                    <div className="bg-gray-900 text-white text-2xl font-bold w-16 py-2 rounded-lg">
                      {String(item.value).padStart(2, '0')}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{item.label}</p>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.slice(0, 4).map((item: any) => (
            <Link to={`/product/${item._id}`} key={item._id} className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all group">
              <div className="relative">
                <ImageWithFallback
                  src={item.images?.[0] || '/placeholder.jpg'}
                  alt={item.name}
                  className="w-full h-64 group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                  -{item.discountPercentage}%
                </div>
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-2 rounded-full">
                  <HeartIcon className="w-5 h-5 text-gray-600 hover:text-red-500 cursor-pointer transition-colors" />
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{item.name}</h3>
                
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-2xl font-bold text-red-500">
                    {item.discountPrice?.toLocaleString('vi-VN')}₫
                  </span>
                  <span className="text-gray-400 line-through text-sm">
                    {item.originalPrice?.toLocaleString('vi-VN')}₫
                  </span>
                </div>
                
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Đã bán {item.soldQuantity || 0}</span>
                    <span>Còn {(item.maxQuantity || 100) - (item.soldQuantity || 0)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-300"
                      style={{ width: `${item.progressPercentage || 0}%` }}
                    />
                  </div>
                </div>
                
                <button className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-2 rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all">
                  Mua ngay
                </button>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
});

// Footer Component
const Footer: React.FC = () => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <footer className="bg-gray-900 text-white mt-20 w-full">
      {/* Main Footer Content - removed container for full width */}
      <div className="w-full px-8 lg:px-16 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <ShoppingBagIcon className="w-8 h-8 text-blue-400" />
              <span className="text-2xl font-bold">Fashion Shop</span>
            </div>
            <p className="text-gray-400 mb-6">
              Điểm đến tin cậy cho thời trang chất lượng cao với giá cả hợp lý.
            </p>
            <div className="flex space-x-4">
              {/* Social Media Icons */}
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-lg mb-4 lg:mb-6">
              <button 
                onClick={() => toggleSection('links')}
                className="flex items-center justify-between w-full lg:cursor-default"
              >
                <span>Liên kết nhanh</span>
                <ChevronDownIcon className={`w-5 h-5 lg:hidden transition-transform ${expandedSection === 'links' ? 'rotate-180' : ''}`} />
              </button>
            </h4>
            <ul className={`space-y-3 text-gray-400 ${expandedSection === 'links' || 'hidden lg:block'}`}>
              <li><Link to="/about" className="hover:text-white transition-colors">Về chúng tôi</Link></li>
              <li><Link to="/products" className="hover:text-white transition-colors">Sản phẩm</Link></li>
              <li><Link to="/promotions" className="hover:text-white transition-colors">Khuyến mãi</Link></li>
              <li><Link to="/blog" className="hover:text-white transition-colors">Blog thời trang</Link></li>
              <li><Link to="/size-guide" className="hover:text-white transition-colors">Hướng dẫn chọn size</Link></li>
              <li><Link to="/careers" className="hover:text-white transition-colors">Tuyển dụng</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="font-semibold text-lg mb-4 lg:mb-6">
              <button 
                onClick={() => toggleSection('service')}
                className="flex items-center justify-between w-full lg:cursor-default"
              >
                <span>Dịch vụ khách hàng</span>
                <ChevronDownIcon className={`w-5 h-5 lg:hidden transition-transform ${expandedSection === 'service' ? 'rotate-180' : ''}`} />
              </button>
            </h4>
            <ul className={`space-y-3 text-gray-400 ${expandedSection === 'service' || 'hidden lg:block'}`}>
              <li><Link to="/shipping" className="hover:text-white transition-colors">Chính sách vận chuyển</Link></li>
              <li><Link to="/returns" className="hover:text-white transition-colors">Đổi trả & Hoàn tiền</Link></li>
              <li><Link to="/payment" className="hover:text-white transition-colors">Phương thức thanh toán</Link></li>
              <li><Link to="/faq" className="hover:text-white transition-colors">Câu hỏi thường gặp</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Liên hệ hỗ trợ</Link></li>
              <li><Link to="/track-order" className="hover:text-white transition-colors">Theo dõi đơn hàng</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-semibold text-lg mb-4 lg:mb-6">
              <button 
                onClick={() => toggleSection('contact')}
                className="flex items-center justify-between w-full lg:cursor-default"
              >
                <span>Thông tin liên hệ</span>
                <ChevronDownIcon className={`w-5 h-5 lg:hidden transition-transform ${expandedSection === 'contact' ? 'rotate-180' : ''}`} />
              </button>
            </h4>
            <div className={`space-y-4 text-gray-400 ${expandedSection === 'contact' || 'hidden lg:block'}`}>
              <div className="flex items-start space-x-3">
                <MapPinIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span className="text-sm">123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh</span>
              </div>
              <div className="flex items-start space-x-3">
                <PhoneIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p>Hotline: 1900 1234</p>
                  <p className="text-xs">(8:00 - 22:00 hàng ngày)</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <EnvelopeIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span className="text-sm">support@fashionshop.vn</span>
              </div>
            </div>
          </div>
        </div>

        {/* App Download Section */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h4 className="font-semibold text-lg mb-2">Tải ứng dụng FashionShop</h4>
              <p className="text-gray-400 text-sm">Nhận thông báo độc quyền và ưu đãi đặc biệt</p>
            </div>
            <div className="flex space-x-4">
              <a href="#" className="block">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Download_on_the_App_Store_Badge.svg/203px-Download_on_the_App_Store_Badge.svg.png" alt="App Store" className="h-10" />
              </a>
              <a href="#" className="block">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Google_Play_Store_badge_EN.svg/270px-Google_Play_Store_badge_EN.svg.png" alt="Google Play" className="h-10" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer - full width */}
      <div className="bg-gray-950 py-6 w-full">
        <div className="px-8 lg:px-16">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © 2025 FashionShop. Tất cả quyền được bảo lưu.
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <Link to="/privacy" className="hover:text-white transition-colors">Chính sách bảo mật</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Điều khoản sử dụng</Link>
              <Link to="/cookies" className="hover:text-white transition-colors">Cookie</Link>
              <Link to="/sitemap" className="hover:text-white transition-colors">Sơ đồ trang</Link>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span>Phương thức thanh toán:</span>
              <div className="flex space-x-2">
                <span className="px-2 py-1 bg-gray-800 rounded text-xs">VISA</span>
                <span className="px-2 py-1 bg-gray-800 rounded text-xs">MasterCard</span>
                <span className="px-2 py-1 bg-gray-800 rounded text-xs">PayPal</span>
                <span className="px-2 py-1 bg-gray-800 rounded text-xs">COD</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Main Home Component with Enhanced Features
interface ProductFilters {
  search?: string;
  category?: string;
  brand?: string;
  size?: string | string[];
  color?: string | string[];
  rating?: string;
  price?: {
    min?: number;
    max?: number;
  };
}

const Home: React.FC = () => {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState<ProductFilters>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('newest');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const { user } = useAuth();

  const isSearching = useMemo(() => Boolean(searchQuery || Object.keys(filters).length > 0), [searchQuery, filters]);

  // Fetch products with filters - fixed duplicate issue
  const fetchProducts = useCallback(async () => {
    const controller = new AbortController();
    
    try {
      setLoading(true);
      
      // Build clean params
      const params: any = {
        page: pagination.page,
        sort: sortBy,
        limit: 12
      };

      // Add filter params properly
      if (filters.search) params.search = filters.search;
      if (filters.category) params.category = filters.category;
      if (filters.brand) params.brand = filters.brand;
      if (filters.size) params.size = filters.size;
      if (filters.color) params.color = filters.color;
      if (filters.rating) params.rating = filters.rating;
      
      // Handle price range properly
      if (filters.price && typeof filters.price === 'object') {
        if (filters.price.min !== undefined) params.minPrice = filters.price.min;
        if (filters.price.max !== undefined) params.maxPrice = filters.price.max;
      }
      
      const { data } = await axios.get('/products', {
        params,
        signal: controller.signal
      });
      
      if (data.products) {
        setProducts(data.products);
        setPagination(prev => ({
          ...prev,
          pages: data.pagination?.pages || 1,
          total: data.pagination?.total || data.products.length
        }));
      } else {
        setProducts(data);
        setPagination(prev => ({ 
          ...prev,
          pages: 1, 
          total: data.length 
        }));
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching products:', error);
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, [pagination.page, filters, sortBy]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const runFetch = async () => {
      cleanup = await fetchProducts();
    };

    runFetch();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [fetchProducts]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setFilters(prev => ({ ...prev, search: query }));
    setPagination({ page: 1, pages: 1, total: 0 });
  }, []);

  const handleFilterChange = useCallback((newFilters: any) => {
    setFilters(newFilters);
    setPagination({ page: 1, pages: 1, total: 0 });
  }, []);

  const handleSortChange = useCallback((sort: string) => {
    setSortBy(sort);
    setPagination({ page: 1, pages: 1, total: 0 });
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    // Removed scroll to top for smoother experience
  }, []);

  const handleProductView = useCallback((productId: string, duration: number) => {
    console.log(`Product ${productId} viewed for ${duration} seconds`);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Sticky Header with Search */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-2">
            </Link>

            <div className="hidden lg:block flex-1 max-w-2xl mx-8">
              <SearchBar onSearch={handleSearch} />
            </div>

            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  <img 
                    src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=6366f1&color=fff`}
                    alt={user.name}
                    className="w-10 h-10 rounded-full border-2 border-blue-600"
                  />
                </div>
              ) : (
                <div className="hidden md:flex space-x-3">
                  <Link to="/login" className="px-4 py-2 text-gray-700 hover:text-blue-600 transition-colors">
                    Đăng nhập
                  </Link>
                  <Link to="/register" className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all">
                    Đăng ký
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="lg:hidden mt-4">
            <SearchBar onSearch={handleSearch} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section and Flash Sale - Only show when not searching/filtering */}
        {!isSearching && (
          <>
            <HeroBanner />
            <EnhancedFlashSale />
          </>
        )}

        {/* Personalized Recommendations */}
        {user && !isSearching && (
          <div className="mb-16">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <SparklesIcon className="w-8 h-8 text-purple-600" />
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">Dành riêng cho bạn</h2>
                  <p className="text-gray-600">Được đề xuất dựa trên sở thích của bạn</p>
                </div>
              </div>
            </div>
            
            <RecommendationManager 
              userId={user._id}
              showControls={true}
              onProductView={handleProductView}
              sections={[
                { type: 'mixed', title: 'Đề xuất cho bạn', enabled: true },
                { type: 'trending', title: 'Đang thịnh hành', enabled: true },
                { type: 'new', title: 'Sản phẩm mới', enabled: true }
              ]}
            />
          </div>
        )}

        {/* CTA for non-logged users */}
        {!user && !isSearching && (
          <div className="mb-16 relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-12 text-white">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse" />
              <div className="absolute bottom-10 right-10 w-40 h-40 bg-yellow-300 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>
            
            <div className="relative z-10 text-center max-w-2xl mx-auto">
              <SparklesIcon className="w-16 h-16 mx-auto mb-6 animate-bounce" />
              <h3 className="text-4xl font-bold mb-4">Trải nghiệm mua sắm thông minh</h3>
              <p className="text-xl mb-8 text-white/90">
                Nhận đề xuất cá nhân hóa, ưu đãi độc quyền và theo dõi đơn hàng dễ dàng
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/login" className="bg-white text-purple-600 px-8 py-4 rounded-full font-bold text-lg hover:shadow-2xl transform hover:scale-105 transition-all">
                  Đăng nhập ngay
                </Link>
                <Link to="/register" className="bg-white/20 backdrop-blur-md border-2 border-white text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/30 transition-all">
                  Tạo tài khoản mới
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Products Section with Filters */}
        <div className="mb-16">
          {/* Section Header with Controls */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <ArrowTrendingUpIcon className="w-8 h-8 text-blue-600" />
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    {searchQuery ? `Kết quả cho "${searchQuery}"` : 'Khám phá sản phẩm'}
                  </h2>
                  <p className="text-gray-600">{pagination.total} sản phẩm</p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="newest">Mới nhất</option>
                  <option value="price-asc">Giá tăng dần</option>
                  <option value="price-desc">Giá giảm dần</option>
                  <option value="popular">Phổ biến nhất</option>
                  <option value="rating">Đánh giá cao</option>
                </select>

                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
                  >
                    <Squares2X2Icon className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                  >
                    <ListBulletIcon className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                    showFilters 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <AdjustmentsHorizontalIcon className="w-5 h-5" />
                  <span>Bộ lọc</span>
                  {Object.keys(filters).filter(k => k !== 'search').length > 0 && (
                    <span className="bg-white text-blue-600 text-xs px-2 py-0.5 rounded-full">
                      {Object.keys(filters).filter(k => k !== 'search').length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Main Layout with Filters and Products */}
          <div className="flex gap-6">
            {/* Enhanced Filter Sidebar */}
            <div className={`transition-all duration-300 ${
              showFilters ? 'w-80' : 'w-0'
            } overflow-hidden`}>
              <div className="w-80">
                <div className="bg-white rounded-2xl shadow-lg sticky top-24">
                  <div className="p-6 border-b">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg flex items-center">
                        <FunnelIcon className="w-5 h-5 mr-2 text-blue-600" />
                        Bộ lọc nâng cao
                      </h3>
                      <button 
                        onClick={() => setFilters({})}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Xóa tất cả
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                    <ProductFilter 
                      filters={filters} 
                      onFilterChange={handleFilterChange} 
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Products Grid/List */}
            <div className="flex-1">
              {loading ? (
                <div className={`grid ${
                  viewMode === 'grid' 
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                    : 'grid-cols-1'
                } gap-6`}>
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="bg-gray-200 rounded-2xl h-80 mb-4"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl">
                  <div className="inline-flex p-6 bg-gray-100 rounded-full mb-6">
                    <ShoppingBagIcon className="w-16 h-16 text-gray-400" />
                  </div>
                  <p className="text-2xl font-semibold text-gray-600 mb-2">
                    Không tìm thấy sản phẩm nào
                  </p>
                  <p className="text-gray-500 mb-6">
                    Thử điều chỉnh bộ lọc hoặc tìm kiếm khác
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilters({});
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              ) : (
                <>
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {products.map((product: any) => (
                        <ProductCard 
                          key={product._id} 
                          product={product}
                          onProductView={handleProductView}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {products.map((product: any) => (
                        <div key={product._id} className="bg-white rounded-xl shadow-sm p-4 flex gap-4 hover:shadow-lg transition-shadow">
                          <img 
                            src={product.images?.[0] || '/placeholder.jpg'}
                            alt={product.name}
                            className="w-32 h-32 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
                            <div className="flex items-center mb-2">
                              {[...Array(5)].map((_, i) => (
                                <StarIcon key={i} className={`h-4 w-4 ${
                                  i < Math.floor(product.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
                                }`} />
                              ))}
                              <span className="ml-2 text-sm text-gray-600">({product.totalReviews})</span>
                            </div>
                            <p className="text-gray-600 text-sm mb-2 line-clamp-2">{product.description}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-2xl font-bold text-red-600">
                                {product.price.toLocaleString('vi-VN')}₫
                              </span>
                              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                Thêm vào giỏ
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Modern Pagination */}
                  {pagination.pages > 1 && (
                    <div className="mt-12 flex justify-center">
                      <div className="flex items-center space-x-2 bg-white rounded-lg shadow-sm p-2">
                        <button
                          onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                          disabled={pagination.page === 1}
                          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRightIcon className="w-5 h-5 rotate-180" />
                        </button>

                        {(() => {
                          const totalPages = pagination.pages;
                          const currentPage = pagination.page;
                          const pages = [];
                          
                          // Always show first page
                          pages.push(1);
                          
                          // Show dots if needed
                          if (currentPage > 3) {
                            pages.push('...');
                          }
                          
                          // Show pages around current page
                          for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                            if (!pages.includes(i)) {
                              pages.push(i);
                            }
                          }
                          
                          // Show dots if needed
                          if (currentPage < totalPages - 2) {
                            pages.push('...');
                          }
                          
                          // Always show last page if more than 1 page
                          if (totalPages > 1 && !pages.includes(totalPages)) {
                            pages.push(totalPages);
                          }
                          
                          return pages.map((pageNum, idx) => {
                            if (pageNum === '...') {
                              return (
                                <span key={`dots-${idx}`} className="px-2 text-gray-400">...</span>
                              );
                            }
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(Number(pageNum))}
                                className={`w-10 h-10 rounded-lg font-medium transition-all ${
                                  currentPage === pageNum
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                    : 'hover:bg-gray-100 text-gray-700'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          });
                        })()}

                        <button
                          onClick={() => handlePageChange(Math.min(pagination.pages, pagination.page + 1))}
                          disabled={pagination.page === pagination.pages}
                          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRightIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Floating Action Button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-2xl flex items-center justify-center transform hover:scale-110 transition-all z-30"
      >
        <ChevronRightIcon className="w-6 h-6 rotate-[-90deg]" />
      </button>
    </div>
  );
};

export default Home;
