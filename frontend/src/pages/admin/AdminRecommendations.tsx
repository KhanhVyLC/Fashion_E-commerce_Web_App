// src/pages/admin/AdminRecommendations.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ChartBarIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  ShoppingCartIcon,
  EyeIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

// Interfaces
interface UserBehavior {
  _id: string;
  name: string;
  email: string;
  viewCount: number;
  searchCount: number;
  wishlistCount: number;
  cartAddCount: number;
  totalSpent: number;
  totalOrders: number;
  lastLogin: string | null;
}

interface ProductStat {
  _id: string;
  name: string;
  category: string;
  viewCount: number;
  totalOrders: number;
  conversionRate: number;
}

interface ChurnPrediction {
  userId: string;
  name: string;
  email: string;
  riskScore: number;
  riskLevel: string;
  factors: Array<{
    factor: string;
    value: string;
    weight: number;
  }>;
  recommendations: string[];
}

interface Analytics {
  totalUsers: number;
  activeUsers: number;
  activeRate: string;
}

interface UserDetail {
  user: {
    _id: string;
    name: string;
    email: string;
    registrationDate: string;
    analytics: {
      totalSpent: number;
      totalOrders: number;
      averageOrderValue: number;
      lastLoginDate: string | null;
      lastPurchaseDate: string | null;
    };
  };
  viewHistory: Array<{
    _id: string;
    product?: {
      _id: string;
      name: string;
      price: number;
      category: string;
    };
    viewedAt: string;
    duration?: number;
    source?: string;
  }>;
  searchHistory: Array<{
    query: string;
    searchedAt: string;
    resultsCount: number;
  }>;
  wishlist: Array<{
    product?: {
      _id: string;
      name: string;
      price: number;
    };
    addedAt: string;
  }>;
  cartHistory: Array<{
    product?: {
      _id: string;
      name: string;
      price: number;
    };
    timestamp: string;
    removed: boolean;
  }>;
  orders: Array<{
    _id: string;
    totalAmount: number;
    createdAt: string;
    orderStatus: string;
    items: Array<{
      product?: {
        name: string;
      };
      quantity: number;
      price: number;
    }>;
  }>;
}

const AdminRecommendations: React.FC = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState<Analytics>({
    totalUsers: 0,
    activeUsers: 0,
    activeRate: '0'
  });
  const [userBehaviors, setUserBehaviors] = useState<UserBehavior[]>([]);
  const [productStats, setProductStats] = useState<ProductStat[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [churnPredictions, setChurnPredictions] = useState<ChurnPrediction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  // Get auth token
  const getAuthToken = () => {
    const adminToken = localStorage.getItem('adminToken');
    const userToken = localStorage.getItem('token');
    return adminToken || userToken || '';
  };

  // API base URL
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getAuthToken();
      if (!token) {
        throw new Error('Vui lòng đăng nhập để tiếp tục');
      }

      // Fetch analytics data
      const analyticsRes = await axios.get(`${API_BASE_URL}/admin/recommendations/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAnalytics(analyticsRes.data.overview || {
        totalUsers: 0,
        activeUsers: 0,
        activeRate: '0'
      });
      setProductStats(analyticsRes.data.productStats || []);
      setUserBehaviors(analyticsRes.data.userBehaviors || []);
      
      // Fetch churn predictions
      try {
        const churnRes = await axios.post(
          `${API_BASE_URL}/admin/recommendations/predict-churn`, 
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (Array.isArray(churnRes.data)) {
          setChurnPredictions(churnRes.data);
        } else {
          setChurnPredictions([]);
        }
      } catch (churnError) {
        console.error('Error fetching churn predictions:', churnError);
        setChurnPredictions([]);
      }
      
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      
      if (error.response?.status === 401) {
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        setTimeout(() => {
          window.location.href = '/admin/login';
        }, 2000);
      } else {
        setError(
          error.response?.data?.message || 
          error.message || 
          'Không thể tải dữ liệu phân tích'
        );
      }
      
      // Set default values
      setAnalytics({
        totalUsers: 0,
        activeUsers: 0,
        activeRate: '0'
      });
      setProductStats([]);
      setUserBehaviors([]);
      setChurnPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      setUserDetailLoading(true);
      
      const token = getAuthToken();
      if (!token) {
        throw new Error('Vui lòng đăng nhập để tiếp tục');
      }

      const { data } = await axios.get(
        `${API_BASE_URL}/admin/recommendations/user/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSelectedUser(data);
    } catch (error: any) {
      console.error('Error fetching user details:', error);
      alert(
        error.response?.data?.message || 
        error.message || 
        'Không thể tải chi tiết người dùng'
      );
    } finally {
      setUserDetailLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    const normalizedLevel = level.toLowerCase();
    if (normalizedLevel === 'cao' || normalizedLevel === 'high') {
      return 'text-red-600 bg-red-100';
    } else if (normalizedLevel === 'trung bình' || normalizedLevel === 'medium') {
      return 'text-yellow-600 bg-yellow-100';
    } else {
      return 'text-green-600 bg-green-100';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'Chưa có';
    try {
      return new Date(date).toLocaleDateString('vi-VN');
    } catch {
      return 'Không hợp lệ';
    }
  };

  const formatDateTime = (date: string | null | undefined) => {
    if (!date) return 'Chưa có';
    try {
      return new Date(date).toLocaleString('vi-VN');
    } catch {
      return 'Không hợp lệ';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải dữ liệu phân tích...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !analytics.totalUsers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <ChartBarIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold">Quản lý đề xuất & Phân tích</h1>
        </div>
        <button
          onClick={refreshData}
          disabled={refreshing}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            refreshing 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Đang làm mới...' : 'Làm mới dữ liệu'}</span>
        </button>
      </div>

      {/* Show error if exists but still display data */}
      {error && analytics.totalUsers > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mr-2" />
            <p className="text-yellow-800 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Tổng quan' },
            { id: 'users', label: 'Hành vi người dùng' },
            { id: 'products', label: 'Thống kê sản phẩm' },
            { id: 'churn', label: 'Dự đoán rời bỏ' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Tổng người dùng</p>
                <p className="text-2xl font-bold">{analytics.totalUsers}</p>
              </div>
              <UserGroupIcon className="h-12 w-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Người dùng hoạt động</p>
                <p className="text-2xl font-bold">{analytics.activeUsers}</p>
                <p className="text-sm text-green-600">
                  {analytics.activeRate}% trong 30 ngày
                </p>
              </div>
              <ArrowTrendingUpIcon className="h-12 w-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Tỷ lệ churn dự đoán</p>
                <p className="text-2xl font-bold">
                  {churnPredictions.length > 0 
                    ? ((churnPredictions.filter(p => 
                        p.riskLevel === 'Cao' || p.riskLevel.toLowerCase() === 'high'
                      ).length / churnPredictions.length) * 100).toFixed(1)
                    : '0'}%
                </p>
                <p className="text-sm text-red-600">
                  {churnPredictions.filter(p => 
                    p.riskLevel === 'Cao' || p.riskLevel.toLowerCase() === 'high'
                  ).length} người dùng rủi ro cao
                </p>
              </div>
              <ExclamationTriangleIcon className="h-12 w-12 text-red-500" />
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {userBehaviors.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <UserGroupIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p>Chưa có dữ liệu người dùng</p>
              <p className="text-sm mt-2">Dữ liệu sẽ được cập nhật khi có hoạt động từ người dùng</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Người dùng
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <EyeIcon className="h-4 w-4 inline mr-1" />
                      Xem
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <MagnifyingGlassIcon className="h-4 w-4 inline mr-1" />
                      Tìm
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <HeartIcon className="h-4 w-4 inline mr-1" />
                      Thích
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <ShoppingCartIcon className="h-4 w-4 inline mr-1" />
                      Giỏ
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chi tiêu
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <ClockIcon className="h-4 w-4 inline mr-1" />
                      Đăng nhập cuối
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userBehaviors.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.name || 'Không tên'}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        {user.viewCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        {user.searchCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        {user.wishlistCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        {user.cartAddCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-sm">
                        {formatCurrency(user.totalSpent)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                        {formatDate(user.lastLogin)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => fetchUserDetails(user._id)}
                          className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {productStats.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCartIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p>Chưa có dữ liệu sản phẩm</p>
              <p className="text-sm mt-2">Dữ liệu sẽ được cập nhật khi có lượt xem và đơn hàng</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sản phẩm
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Danh mục
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lượt xem
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Đơn hàng
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tỷ lệ chuyển đổi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productStats.map((product) => (
                    <tr key={product._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {product.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.category || 'Không phân loại'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {product.viewCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {product.totalOrders}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          product.conversionRate > 10 ? 'bg-green-100 text-green-800' :
                          product.conversionRate > 5 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {product.conversionRate.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Churn Predictions Tab */}
      {activeTab === 'churn' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 p-4 rounded-lg">
              <h3 className="font-semibold text-red-800">Rủi ro cao</h3>
              <p className="text-2xl font-bold text-red-600">
                {churnPredictions.filter(p => 
                  p.riskLevel === 'Cao' || p.riskLevel.toLowerCase() === 'high'
                ).length}
              </p>
              <p className="text-sm text-red-600">người dùng</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="font-semibold text-yellow-800">Rủi ro trung bình</h3>
              <p className="text-2xl font-bold text-yellow-600">
                {churnPredictions.filter(p => 
                  p.riskLevel === 'Trung bình' || p.riskLevel.toLowerCase() === 'medium'
                ).length}
              </p>
              <p className="text-sm text-yellow-600">người dùng</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800">Rủi ro thấp</h3>
              <p className="text-2xl font-bold text-green-600">
                {churnPredictions.filter(p => 
                  p.riskLevel === 'Thấp' || p.riskLevel.toLowerCase() === 'low'
                ).length}
              </p>
              <p className="text-sm text-green-600">người dùng</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {churnPredictions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ExclamationTriangleIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p>Chưa có dữ liệu dự đoán</p>
                <p className="text-sm mt-2">Cần thêm dữ liệu người dùng để phân tích</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Người dùng
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Điểm rủi ro
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mức độ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Yếu tố rủi ro
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Đề xuất hành động
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {churnPredictions.map((prediction) => (
                      <tr key={prediction.userId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {prediction.name || 'Không tên'}
                            </div>
                            <div className="text-sm text-gray-500">{prediction.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center">
                            <span className="text-lg font-bold">{prediction.riskScore}</span>
                            <span className="text-sm text-gray-500">/100</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskColor(prediction.riskLevel)}`}>
                            {prediction.riskLevel}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <ul className="text-xs space-y-1">
                            {prediction.factors.map((factor, idx) => (
                              <li key={idx} className="flex items-center">
                                <span className="font-medium mr-1">{factor.factor}:</span>
                                <span className="text-gray-600">{factor.value}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-6 py-4">
                          <ul className="text-xs space-y-1">
                            {prediction.recommendations.map((rec, idx) => (
                              <li key={idx} className="text-blue-600">• {rec}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Chi tiết người dùng: {selectedUser.user?.name || 'Unknown'}
              </h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {userDetailLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* User Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3 text-gray-700">Thông tin cơ bản</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2 font-medium">{selectedUser.user?.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Ngày đăng ký:</span>
                      <span className="ml-2 font-medium">
                        {formatDate(selectedUser.user?.registrationDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Lần đăng nhập cuối:</span>
                      <span className="ml-2 font-medium">
                        {formatDateTime(selectedUser.user?.analytics?.lastLoginDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Lần mua hàng cuối:</span>
                      <span className="ml-2 font-medium">
                        {formatDate(selectedUser.user?.analytics?.lastPurchaseDate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Analytics */}
                <div>
                  <h3 className="font-semibold mb-3 text-gray-700">Thống kê</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-gray-600 text-sm">Tổng chi tiêu</p>
                      <p className="font-bold text-lg text-blue-700">
                        {formatCurrency(selectedUser.user?.analytics?.totalSpent || 0)}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-gray-600 text-sm">Tổng đơn hàng</p>
                      <p className="font-bold text-lg text-green-700">
                        {selectedUser.user?.analytics?.totalOrders || 0}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-gray-600 text-sm">Giá trị TB/đơn</p>
                      <p className="font-bold text-lg text-purple-700">
                        {formatCurrency(selectedUser.user?.analytics?.averageOrderValue || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent Activities */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700">Hoạt động gần đây</h3>
                  
                  {/* View History */}
                  {selectedUser.viewHistory && selectedUser.viewHistory.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                        <EyeIcon className="h-4 w-4 mr-2" />
                        Sản phẩm đã xem gần đây
                      </h4>
                      <div className="space-y-2">
                        {selectedUser.viewHistory.slice(-5).map((view, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded">
                            <div className="flex-1">
                              <span className="font-medium">
                                {view.product?.name || 'Sản phẩm đã xóa'}
                              </span>
                              {view.product && (
                                <span className="text-gray-500 ml-2">
                                  ({view.product.category})
                                </span>
                              )}
                            </div>
                            <div className="text-right text-gray-500">
                              <div>{formatDateTime(view.viewedAt)}</div>
                              {view.duration && (
                                <div className="text-xs">
                                  Xem {Math.round(view.duration)} giây
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedUser.viewHistory.length > 5 && (
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          Và {selectedUser.viewHistory.length - 5} sản phẩm khác...
                        </p>
                      )}
                    </div>
                  )}

                  {/* Search History */}
                  {selectedUser.searchHistory && selectedUser.searchHistory.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                        <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                        Lịch sử tìm kiếm
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedUser.searchHistory.slice(0, 10).map((search, idx) => (
                          <span key={idx} className="bg-white px-3 py-1 rounded-full text-sm border border-gray-200">
                            {search.query}
                            <span className="text-gray-400 ml-1">({search.resultsCount})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Wishlist */}
                  {selectedUser.wishlist && selectedUser.wishlist.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                        <HeartIcon className="h-4 w-4 mr-2" />
                        Danh sách yêu thích
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedUser.wishlist.map((item, idx) => (
                          <div key={idx} className="bg-white p-2 rounded text-sm">
                            <span className="font-medium">
                              {item.product?.name || 'Sản phẩm đã xóa'}
                            </span>
                            {item.product && (
                              <span className="text-blue-600 ml-2">
                                {formatCurrency(item.product.price)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Orders */}
                  {selectedUser.orders && selectedUser.orders.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                        <ShoppingCartIcon className="h-4 w-4 mr-2" />
                        Đơn hàng gần đây
                      </h4>
                      <div className="space-y-2">
                        {selectedUser.orders.slice(0, 3).map((order, idx) => (
                          <div key={idx} className="bg-white p-3 rounded">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm">
                                  Đơn hàng #{order._id.slice(-6)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatDateTime(order.createdAt)}
                                </p>
                                <p className="text-xs mt-1">
                                  {order.items.length} sản phẩm - 
                                  <span className={`ml-1 font-medium ${
                                    order.orderStatus === 'delivered' ? 'text-green-600' :
                                    order.orderStatus === 'cancelled' ? 'text-red-600' :
                                    'text-yellow-600'
                                  }`}>
                                    {order.orderStatus === 'pending' && 'Chờ xử lý'}
                                    {order.orderStatus === 'processing' && 'Đang xử lý'}
                                    {order.orderStatus === 'shipped' && 'Đang giao'}
                                    {order.orderStatus === 'delivered' && 'Đã giao'}
                                    {order.orderStatus === 'cancelled' && 'Đã hủy'}
                                  </span>
                                </p>
                              </div>
                              <p className="font-bold text-blue-600">
                                {formatCurrency(order.totalAmount)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No activity message */}
                  {(!selectedUser.viewHistory || selectedUser.viewHistory.length === 0) &&
                   (!selectedUser.searchHistory || selectedUser.searchHistory.length === 0) &&
                   (!selectedUser.wishlist || selectedUser.wishlist.length === 0) &&
                   (!selectedUser.orders || selectedUser.orders.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      <ExclamationTriangleIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p>Người dùng chưa có hoạt động nào</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRecommendations;