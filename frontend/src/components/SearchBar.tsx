// src/components/SearchBar.tsx - FIXED VERSION WITH USER-SPECIFIC HISTORY
import React, { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../context/AuthContext';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

interface SearchSuggestion {
  _id: string;
  name: string;
  category: string;
  price: number;
  images: string[];
  rating?: number;
  totalReviews?: number;
  stock?: Array<{ quantity: number }>;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [clickedResults, setClickedResults] = useState<string[]>([]);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const debouncedQuery = useDebounce(query, 300);

  // Get storage key for user-specific search history
  const getStorageKey = () => {
    if (user && user._id) {
      return `recentSearches_${user._id}`;
    }
    return 'recentSearches_guest';
  };

  // Load recent searches from localStorage - USER SPECIFIC
  useEffect(() => {
    const loadRecentSearches = () => {
      const storageKey = getStorageKey();
      const saved = localStorage.getItem(storageKey);
      
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Ensure it's an array
          if (Array.isArray(parsed)) {
            setRecentSearches(parsed);
          } else {
            setRecentSearches([]);
            localStorage.removeItem(storageKey);
          }
        } catch (error) {
          console.error('Error parsing recent searches:', error);
          setRecentSearches([]);
          localStorage.removeItem(storageKey);
        }
      } else {
        setRecentSearches([]);
      }
    };

    loadRecentSearches();
  }, [user]); // Reload when user changes

  // Fetch suggestions when query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      fetchSuggestions(debouncedQuery);
    } else {
      setSuggestions([]);
      setClickedResults([]);
    }
  }, [debouncedQuery]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (searchQuery: string) => {
    try {
      setLoading(true);
      const response = await axios.get('/products', {
        params: { 
          search: searchQuery,
          limit: 8
        }
      });
      
      // Handle response format
      let products = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          products = response.data;
        } else if (response.data.products && Array.isArray(response.data.products)) {
          products = response.data.products;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          products = response.data.data;
        }
      }
      
      // Validate and filter products
      const validProducts = products
        .filter((p: any) => p && p._id && p.name && typeof p.price === 'number')
        .slice(0, 8);
      
      setSuggestions(validProducts);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Save search to user-specific storage
  const saveRecentSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    try {
      const trimmedQuery = searchQuery.trim();
      const storageKey = getStorageKey();
      
      // Get current searches for this user
      const filtered = Array.isArray(recentSearches) 
        ? recentSearches.filter(s => s !== trimmedQuery)
        : [];
      const updated = [trimmedQuery, ...filtered].slice(0, 8);
      
      setRecentSearches(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      
      // Clean up old guest searches when user logs in
      if (user && user._id) {
        const guestKey = 'recentSearches_guest';
        if (localStorage.getItem(guestKey)) {
          localStorage.removeItem(guestKey);
        }
      }
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  const trackSearch = async (searchQuery: string, resultsCount: number, clickedProductIds: string[] = []) => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const trimmedQuery = searchQuery.trim();
      
      // Track search in user's search history
      try {
        await axios.post('/users/search-history', {
          query: trimmedQuery,
          resultsCount: resultsCount,
          clickedResults: clickedProductIds
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Search tracked in user history');
      } catch (error) {
        console.warn('Failed to track search in user history:', error);
      }
      
      // Also track in recommendations
      try {
        await axios.post('/recommendations/track', {
          action: 'search',
          metadata: {
            query: trimmedQuery,
            resultsCount: resultsCount,
            clickedResults: clickedProductIds,
            source: 'search_bar'
          }
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Search tracked in recommendations');
      } catch (error) {
        console.warn('Failed to track search in recommendations:', error);
      }
      
    } catch (error) {
      console.warn('Failed to track search:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    
    if (trimmedQuery) {
      saveRecentSearch(trimmedQuery);
      
      // Track search with clicked results
      await trackSearch(trimmedQuery, suggestions.length, clickedResults);
      
      onSearch(trimmedQuery);
      setShowSuggestions(false);
      setClickedResults([]);
      inputRef.current?.blur();
    }
  };

  const handleSuggestionClick = async (product: SearchSuggestion) => {
    // Track clicked result
    const updatedClicked = [...clickedResults, product._id];
    setClickedResults(updatedClicked);
    
    // Save the product name as a search
    saveRecentSearch(product.name);
    
    // Track search with this specific click
    await trackSearch(query, suggestions.length, updatedClicked);
    
    // Track product click from search
    if (user) {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          await axios.post('/recommendations/track', {
            action: 'click',
            productId: product._id,
            metadata: {
              recommendationType: 'search_result',
              query: query,
              position: suggestions.findIndex(p => p._id === product._id) + 1
            }
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      } catch (error) {
        console.warn('Failed to track product click:', error);
      }
    }
    
    setShowSuggestions(false);
    setQuery('');
    navigate(`/product/${product._id}`);
  };

  const handleRecentSearchClick = (search: string) => {
    setQuery(search);
    onSearch(search);
    setShowSuggestions(false);
    
    // Move to top of recent searches
    saveRecentSearch(search);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    const storageKey = getStorageKey();
    localStorage.removeItem(storageKey);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionClick(suggestions[selectedIndex]);
        } else {
          handleSubmit(e);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        inputRef.current?.blur();
        break;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const isInStock = (product: SearchSuggestion) => {
    return product.stock?.some(item => item.quantity > 0) ?? true;
  };

  // Get popular searches based on user
  const getPopularSearches = () => {
    if (user) {
      // Could fetch user-specific popular searches from backend
      return ['Áo thun', 'Quần jean', 'Váy đầm', 'Giày sneaker', 'Áo khoác', 'Túi xách', 'Phụ kiện'];
    }
    // Generic popular searches for guests
    return ['Sản phẩm mới', 'Khuyến mãi', 'Áo thun', 'Quần jean', 'Giày dép', 'Phụ kiện'];
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="Tìm kiếm sản phẩm, danh mục, thương hiệu..."
          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
        />
        <MagnifyingGlassIcon className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
        
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setClickedResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-10 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
        
        <button
          type="submit"
          className="absolute right-2 top-2 bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700 transition-colors"
          aria-label="Tìm kiếm"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
        </button>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div className="absolute z-50 w-full bg-white mt-1 rounded-lg shadow-lg border border-gray-200 max-h-[480px] overflow-y-auto">
          {/* Loading State */}
          {loading && (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-500">Đang tìm kiếm...</p>
            </div>
          )}

          {/* Product Suggestions */}
          {!loading && query && suggestions.length > 0 && (
            <div>
              <div className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border-b border-gray-200">
                Sản phẩm gợi ý ({suggestions.length})
              </div>
              {suggestions.map((product, index) => (
                <div
                  key={product._id}
                  onClick={() => handleSuggestionClick(product)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${
                    selectedIndex === index ? 'bg-gray-50' : ''
                  } ${!isInStock(product) ? 'opacity-60' : ''}`}
                >
                  <div className="relative">
                    <img
                      src={product.images?.[0] || '/placeholder.jpg'}
                      alt={product.name}
                      className="w-16 h-16 object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.jpg';
                      }}
                    />
                    {!isInStock(product) && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                        <span className="text-white text-xs font-medium">Hết hàng</span>
                      </div>
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500 mb-1">{product.category}</p>
                    {product.rating !== undefined && product.totalReviews !== undefined && (
                      <div className="flex items-center text-xs">
                        <span className="text-yellow-500">★</span>
                        <span className="ml-1 text-gray-600">
                          {product.rating.toFixed(1)} ({product.totalReviews})
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-blue-600">
                    {formatPrice(product.price)}
                  </p>
                </div>
              ))}
              
              {/* View all results */}
              <div
                onClick={handleSubmit}
                className="px-4 py-3 text-center text-sm text-blue-600 hover:bg-gray-50 cursor-pointer border-t border-gray-200 font-medium"
              >
                Xem tất cả kết quả cho "{query}"
              </div>
            </div>
          )}

          {/* Recent Searches - User specific */}
          {!loading && !query && Array.isArray(recentSearches) && recentSearches.length > 0 && (
            <div>
              <div className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <span>Tìm kiếm gần đây {user ? `của ${user.name}` : '(Khách)'}</span>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Xóa tất cả
                </button>
              </div>
              {recentSearches.map((search, index) => (
                <div
                  key={`${search}-${index}`}
                  onClick={() => handleRecentSearchClick(search)}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="flex items-center">
                    <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-700">{search}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results */}
          {!loading && query && suggestions.length === 0 && (
            <div className="p-8 text-center">
              <div className="mb-2">
                <MagnifyingGlassIcon className="h-12 w-12 text-gray-300 mx-auto" />
              </div>
              <p className="text-gray-500 text-sm mb-1">
                Không tìm thấy sản phẩm nào cho
              </p>
              <p className="text-gray-900 font-medium">"{query}"</p>
              <p className="text-xs text-gray-400 mt-2">
                Thử tìm kiếm với từ khóa khác
              </p>
            </div>
          )}

          {/* Popular Searches - User specific */}
          {!loading && !query && (!recentSearches || recentSearches.length === 0) && (
            <div>
              <div className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border-b border-gray-200">
                Từ khóa phổ biến
              </div>
              {getPopularSearches().map((term, index) => (
                <div
                  key={term}
                  onClick={() => handleRecentSearchClick(term)}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{term}</span>
                    <span className="text-xs text-gray-400">#{index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search tips */}
          {!loading && !query && (
            <div className="px-4 py-3 bg-blue-50 text-xs text-blue-700">
              💡 Mẹo: Tìm kiếm theo tên sản phẩm, danh mục hoặc thương hiệu
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;