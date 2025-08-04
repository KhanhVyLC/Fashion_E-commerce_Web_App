// src/pages/Home.tsx - Complete Updated Version
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from '../utils/axios';
import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import ProductFilter from '../components/ProductFilter';
import RecommendationManager from '../components/RecommendationManager';
import ImageWithFallback from '../components/ImageWithFallback';
import LazyGrid from '../components/LazyGrid';
import { useAuth } from '../context/AuthContext';
import { useImagePreloader } from '../hooks/useImagePreloader';
import { ImageOptimizer } from '../utils/imageOptimization';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

// Optimized Hero Banner Component
const HeroBanner: React.FC = React.memo(() => {
  const banners = useMemo(() => [
    {
      image: 'https://www.denverpost.com/wp-content/uploads/2016/06/uniqlo.jpg?w=1024',
      title: 'Bộ sưu tập mùa hè 2025',
      subtitle: 'Giảm giá đến 50%',
      cta: 'Khám phá ngay'
    },
    {
      image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200',
      title: 'Xu hướng thời trang mới',
      subtitle: 'Cập nhật phong cách của bạn',
      cta: 'Xem thêm'
    }
  ], []);

  const [currentBanner, setCurrentBanner] = useState(0);
  const { preloadImages } = useImagePreloader();

  // Preload banner images on mount
  useEffect(() => {
    const bannerUrls = banners.map(banner => 
      ImageOptimizer.getOptimizedUrl(banner.image, { width: 1200, height: 400, quality: 85 })
    );
    preloadImages(bannerUrls, { priority: 'high' });
  }, [banners, preloadImages]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  return (
    <div className="relative h-96 rounded-xl overflow-hidden mb-8">
      {banners.map((banner, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            index === currentBanner ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <ImageWithFallback
            src={ImageOptimizer.getOptimizedUrl(banner.image, { width: 1200, height: 400 })}
            alt={banner.title}
            className="w-full h-full"
            priority="high"
            loading="eager"
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <div className="text-center text-white">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">{banner.title}</h1>
              <p className="text-xl mb-6">{banner.subtitle}</p>
              <button className="bg-white text-black px-8 py-3 rounded-full font-semibold hover:bg-gray-100 transition">
                {banner.cta}
              </button>
            </div>
          </div>
        </div>
      ))}
      
      {/* Banner indicators */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentBanner(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentBanner ? 'bg-white w-8' : 'bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
});

HeroBanner.displayName = 'HeroBanner';

// Optimized Categories Grid Component
const CategoriesGrid: React.FC = React.memo(() => {
  const categories = useMemo(() => [
    { 
      name: 'Áo nam', 
      image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400',
      count: '120+ sản phẩm',
      link: '/products?category=ao-nam'
    },
    { 
      name: 'Áo nữ', 
      image: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=400',
      count: '200+ sản phẩm',
      link: '/products?category=ao-nu'
    },
    { 
      name: 'Quần jean', 
      image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400',
      count: '80+ sản phẩm',
      link: '/products?category=quan-jean'
    },
    { 
      name: 'Váy đầm', 
      image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400',
      count: '150+ sản phẩm',
      link: '/products?category=vay-dam'
    },
    { 
      name: 'Phụ kiện', 
      image: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=400',
      count: '50+ sản phẩm',
      link: '/products?category=phu-kien'
    },
    { 
      name: 'Giày dép', 
      image: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=400',
      count: '100+ sản phẩm',
      link: '/products?category=giay-dep'
    }
  ], []);

  const { preloadImages } = useImagePreloader();

  // Preload category images
  useEffect(() => {
    const categoryUrls = categories.map(category => 
      ImageOptimizer.getOptimizedUrl(category.image, { width: 300, height: 200 })
    );
    preloadImages(categoryUrls, { priority: 'low' });
  }, [categories, preloadImages]);

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-6">Danh mục sản phẩm</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map((category) => (
          <a
            key={category.name}
            href={category.link}
            className="group cursor-pointer block"
          >
            <div className="relative overflow-hidden rounded-lg mb-2">
              <ImageWithFallback
                src={ImageOptimizer.getOptimizedUrl(category.image, { width: 300, height: 200 })}
                alt={category.name}
                className="w-full h-40 group-hover:scale-110 transition-transform duration-300"
                loading="lazy"
                priority="low"
              />
              <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-30 transition" />
            </div>
            <h3 className="font-semibold text-center">{category.name}</h3>
            <p className="text-sm text-gray-500 text-center">{category.count}</p>
          </a>
        ))}
      </div>
    </div>
  );
});

CategoriesGrid.displayName = 'CategoriesGrid';

// Optimized Product Grid Component
const ProductGrid: React.FC<{
  products: any[];
  loading: boolean;
  onProductView?: (productId: string, duration: number) => void;
}> = React.memo(({ products, loading, onProductView }) => {
  const { preloadImages } = useImagePreloader();

  // Preload visible product images
  useEffect(() => {
    if (products.length > 0) {
      // Preload first 12 product images (visible on screen)
      const visibleProducts = products.slice(0, 12);
      const imageUrls = visibleProducts
        .filter(product => product.images && product.images[0])
        .map(product => 
          ImageOptimizer.getOptimizedUrl(product.images[0], { width: 300, height: 300 })
        );
      
      preloadImages(imageUrls, { priority: 'low' }, 4);
    }
  }, [products, preloadImages]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 h-64 rounded-lg mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Không tìm thấy sản phẩm nào</p>
      </div>
    );
  }

  // Use virtualized grid for large product lists
  if (products.length > 20) {
    return (
      <LazyGrid
        products={products}
        onProductView={onProductView}
        columns={4}
        itemHeight={420}
      />
    );
  }

  // Regular grid for smaller lists
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map((product: any) => (
        <ProductCard 
          key={product._id} 
          product={product}
          onProductView={onProductView}
        />
      ))}
    </div>
  );
});

ProductGrid.displayName = 'ProductGrid';

// Pagination Component
const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}> = React.memo(({ currentPage, totalPages, onPageChange }) => {
  const pages = useMemo(() => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); 
         i <= Math.min(totalPages - 1, currentPage + delta); 
         i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  }, [currentPage, totalPages]);

  return (
    <div className="flex justify-center mt-8">
      <div className="flex space-x-2">
        {currentPage > 1 && (
          <button
            onClick={() => onPageChange(currentPage - 1)}
            className="px-3 py-1 border rounded hover:bg-gray-50"
          >
            Trước
          </button>
        )}
        
        {pages.map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            disabled={page === '...'}
            className={`px-3 py-1 border rounded ${
              page === currentPage 
                ? 'bg-blue-600 text-white' 
                : page === '...'
                ? 'cursor-default'
                : 'hover:bg-gray-50'
            }`}
          >
            {page}
          </button>
        ))}
        
        {currentPage < totalPages && (
          <button
            onClick={() => onPageChange(currentPage + 1)}
            className="px-3 py-1 border rounded hover:bg-gray-50"
          >
            Tiếp
          </button>
        )}
      </div>
    </div>
  );
});

Pagination.displayName = 'Pagination';

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Main Home Component
const Home: React.FC = () => {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const { user } = useAuth();
  const location = useLocation();

  // Memoize expensive computations
  const isSearching = useMemo(() => Boolean(searchQuery), [searchQuery]);
  const showBanner = useMemo(() => !isSearching, [isSearching]);
  const showCategories = useMemo(() => !isSearching, [isSearching]);
  const showRecommendations = useMemo(() => user && !isSearching, [user, isSearching]);

  // Fetch products function that returns cleanup function properly
  const fetchProducts = useCallback(async () => {
    const controller = new AbortController();
    
    try {
      setLoading(true);
      const { data } = await axios.get('/products', {
        params: { ...filters, page: pagination.page },
        signal: controller.signal
      });
      
      // Handle both old and new response formats
      if (data.products) {
        setProducts(data.products);
        setPagination(data.pagination);
      } else {
        // Fallback for old format
        setProducts(data);
        setPagination({ page: 1, pages: 1, total: data.length });
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching products:', error);
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }

    // Return cleanup function
    return () => controller.abort();
  }, [filters, pagination.page]);

  // useEffect that properly handles async function
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const runFetch = async () => {
      cleanup = await fetchProducts();
    };

    runFetch();

    // Return cleanup function
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [filters, pagination.page]);

  // Debounced search handler
  const handleSearch = useCallback(
    debounce(async (query: string) => {
      setSearchQuery(query);
      setFilters({ ...filters, search: query });
      
      // Track search for recommendations (only for logged-in users)
      if (user && query) {
        try {
          const token = localStorage.getItem('token');
          if (token) {
            await axios.post('/recommendations/track', {
              action: 'search',
              query,
              metadata: { source: 'home_search' }
            }, {
              headers: { Authorization: `Bearer ${token}` }
            });
          }
        } catch (error) {
          console.warn('Failed to track search:', error);
        }
      }
    }, 300),
    [filters, user]
  );

  const handleProductView = useCallback((productId: string, duration: number) => {
    console.log(`Product ${productId} viewed for ${duration} seconds`);
  }, []);

  // Clear search handler
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setFilters({});
  }, []);

  // Pagination handlers - Updated to NOT scroll to top
  const handlePageChange = useCallback((newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    setFilters(prev => ({ ...prev, page: newPage }));
    
    // Không cuộn lên đầu trang khi chuyển trang
    // Giữ nguyên vị trí hiện tại để người dùng tiếp tục duyệt sản phẩm
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Search Bar */}
      <div className="mb-6">
        <SearchBar onSearch={handleSearch} />
      </div>

      {/* Hero Banner - Only show when not searching */}
      {showBanner && <HeroBanner />}

      {/* Categories Grid - Only show when not searching */}
      {showCategories && <CategoriesGrid />}

      {/* Personalized Recommendations for logged-in users ONLY with null check */}
      {showRecommendations && user && (
        <div className="mb-12">
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

      {/* Call-to-action for non-logged-in users */}
      {!user && !isSearching && (
        <div className="mb-12 bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <h3 className="text-xl font-semibold text-blue-800 mb-2">
            Đăng nhập để nhận đề xuất cá nhân hóa
          </h3>
          <p className="text-blue-600 mb-4">
            Khám phá sản phẩm phù hợp với sở thích của bạn
          </p>
          <div className="space-x-4">
            <a 
              href="/login"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Đăng nhập
            </a>
            <a 
              href="/register"
              className="inline-block border border-blue-600 text-blue-600 px-6 py-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Đăng ký
            </a>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex gap-8">
        {/* Mobile Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="lg:hidden fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>

        {/* Filters Sidebar */}
        <div className={`${
          showFilters ? 'fixed inset-0 z-50 bg-white lg:static lg:bg-transparent' : 'hidden lg:block'
        } lg:w-64 flex-shrink-0`}>
          {showFilters && (
            <div className="flex justify-between items-center p-4 border-b lg:hidden">
              <h2 className="text-lg font-semibold">Bộ lọc</h2>
              <button onClick={() => setShowFilters(false)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <div className="p-4 lg:p-0">
            <ProductFilter filters={filters} onFilterChange={setFilters} />
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              {isSearching ? `Kết quả tìm kiếm cho "${searchQuery}"` : 'Tất cả sản phẩm'}
            </h2>
            <p className="text-gray-600">{products.length} sản phẩm</p>
          </div>
          
          <ProductGrid 
            products={products}
            loading={loading}
            onProductView={handleProductView}
          />

          {/* No results state */}
          {!loading && products.length === 0 && isSearching && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg mb-4">Không tìm thấy sản phẩm nào</p>
              <button
                onClick={clearSearch}
                className="text-blue-600 hover:underline"
              >
                Xóa bộ lọc
              </button>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;