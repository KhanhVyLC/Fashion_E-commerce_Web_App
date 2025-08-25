// src/pages/admin/AdminDashboard.tsx - Complete Version
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  ShoppingCart,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  AlertCircle,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Star,
  Calendar,
  AlertTriangle,
  CreditCard,
  ShoppingBag,
  UserPlus,
  RefreshCw,
  TrendingUp as TrendIcon
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  ComposedChart
} from 'recharts';
import axios from '../../utils/axios';

// ==================== INTERFACES ====================
interface DashboardStats {
  // Revenue metrics
  totalRevenue: number;
  todayRevenue: number;
  revenueGrowth: number;
  avgOrderValue: number;
  
  // Order metrics
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  todayOrders: number;
  orderGrowth: number;
  
  // Customer metrics
  totalCustomers: number;
  newCustomersThisMonth: number;
  activeUsers: number;
  customerGrowth: number;
  
  // Product metrics
  totalProducts: number;
  lowStockCount: number;
  
  // Arrays
  topProducts: any[];
  monthlyRevenue: any[];
  weeklyRevenue: any[];
  recentOrders: any[];
  categoryPerformance: any[];
  paymentMethodStats: any[];
  
  // Additional
  abandonedCarts: number;
}

interface RealtimeStats {
  recentOrders: number;
  recentUsers: number;
  recentViews: number;
  timestamp: Date;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  subtitle?: string | React.ReactNode;
  color: string;
  bgColor: string;
  loading?: boolean;
  onClick?: () => void;
}

// ==================== MAIN COMPONENT ====================
const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [realtimeStats, setRealtimeStats] = useState<RealtimeStats | null>(null);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<'day' | 'month' | 'year'>('month');

  // ==================== DATA FETCHING ====================
  const fetchDashboardStats = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await axios.get('/admin/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchRealtimeStats = useCallback(async () => {
    try {
      const response = await axios.get('/admin/dashboard/stats/realtime');
      setRealtimeStats(response.data);
    } catch (error) {
      console.error('Error fetching realtime stats:', error);
    }
  }, []);

  const fetchHourlyStats = useCallback(async () => {
    try {
      const response = await axios.get('/admin/dashboard/stats/hourly');
      setHourlyData(response.data);
    } catch (error) {
      console.error('Error fetching hourly stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
    fetchRealtimeStats();
    fetchHourlyStats();
    
    // Auto refresh main stats every 5 minutes
    const statsInterval = setInterval(fetchDashboardStats, 5 * 60 * 1000);
    // Auto refresh realtime stats every 30 seconds
    const realtimeInterval = setInterval(fetchRealtimeStats, 30 * 1000);
    // Auto refresh hourly stats every minute when on day view
    let hourlyInterval: NodeJS.Timeout;
    if (chartPeriod === 'day') {
      hourlyInterval = setInterval(fetchHourlyStats, 60 * 1000);
    }
    
    return () => {
      clearInterval(statsInterval);
      clearInterval(realtimeInterval);
      if (hourlyInterval) clearInterval(hourlyInterval);
    };
  }, [fetchDashboardStats, fetchRealtimeStats, fetchHourlyStats, chartPeriod]);

  // ==================== HELPER FUNCTIONS ====================
  const formatCurrency = useCallback((amount: number) => {
    if (amount >= 1000000000) {
      return `${(amount / 1000000000).toFixed(1)}B₫`;
    }
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M₫`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K₫`;
    }
    return `${amount}₫`;
  }, []);

  const formatFullCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0
    }).format(amount);
  }, []);

  const formatNumber = useCallback((num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }, []);

  // ==================== DATA PREPARATION ====================
  const monthData = useMemo(() => {
    if (!stats?.monthlyRevenue) return [];
    const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    return stats.monthlyRevenue.map(item => ({
      label: months[item._id.month - 1],
      revenue: item.revenue,
      orders: item.orders,
      avgOrderValue: item.avgOrderValue || 0
    }));
  }, [stats?.monthlyRevenue]);

  // Chart data based on selected period
  const chartData = useMemo(() => {
    if (chartPeriod === 'day') {
      // Use hourly data fetched from backend
      return hourlyData;
    } else if (chartPeriod === 'year') {
      // Group monthly data by quarters
      const quarterData = [];
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
      
      for (let i = 0; i < 4; i++) {
        const quarterMonths = monthData.slice(i * 3, (i + 1) * 3);
        if (quarterMonths.length > 0) {
          const quarterRevenue = quarterMonths.reduce((sum, m) => sum + m.revenue, 0);
          const quarterOrders = quarterMonths.reduce((sum, m) => sum + m.orders, 0);
          quarterData.push({
            label: quarters[i],
            revenue: quarterRevenue,
            orders: quarterOrders
          });
        }
      }
      
      return quarterData.length > 0 ? quarterData : [
        { label: 'Q1', revenue: 0, orders: 0 },
        { label: 'Q2', revenue: 0, orders: 0 },
        { label: 'Q3', revenue: 0, orders: 0 },
        { label: 'Q4', revenue: 0, orders: 0 }
      ];
    }
    
    // Default to monthly data
    return monthData;
  }, [chartPeriod, monthData, hourlyData]);

  const weekData = useMemo(() => {
    if (!stats?.weeklyRevenue) return [];
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const today = new Date();
    const weekData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayData = stats.weeklyRevenue.find(
        d => d._id.day === date.getDate() && 
             d._id.month === (date.getMonth() + 1)
      );
      
      weekData.push({
        day: days[date.getDay()],
        date: `${date.getDate()}/${date.getMonth() + 1}`,
        revenue: dayData?.revenue || 0,
        orders: dayData?.orders || 0
      });
    }
    
    return weekData;
  }, [stats?.weeklyRevenue]);

  const orderStatusData = useMemo(() => {
    if (!stats) return [];
    const total = stats.totalOrders || 1;
    return [
      { name: 'Chờ xử lý', value: stats.pendingOrders, color: '#F59E0B', percentage: 0 },
      { name: 'Đang xử lý', value: stats.processingOrders, color: '#3B82F6', percentage: 0 },
      { name: 'Đang giao', value: stats.shippedOrders, color: '#8B5CF6', percentage: 0 },
      { name: 'Đã giao', value: stats.deliveredOrders, color: '#10B981', percentage: 0 },
      { name: 'Đã hủy', value: stats.cancelledOrders, color: '#EF4444', percentage: 0 }
    ].map(item => ({
      ...item,
      percentage: Math.round((item.value / total) * 100)
    }));
  }, [stats]);

  const paymentMethodData = useMemo(() => {
    if (!stats?.paymentMethodStats) return [];
    const total = stats.paymentMethodStats.reduce((sum, item) => sum + item.count, 0);
    const colors: any = {
      'COD': '#F59E0B',
      'BankTransfer': '#3B82F6',
      'CreditCard': '#8B5CF6',
      'EWallet': '#10B981'
    };
    const labels: any = {
      'COD': 'Tiền mặt',
      'BankTransfer': 'Chuyển khoản',
      'CreditCard': 'Thẻ tín dụng',
      'EWallet': 'Ví điện tử'
    };
    
    return stats.paymentMethodStats.map(item => ({
      name: labels[item._id] || item._id,
      value: item.count,
      revenue: item.revenue,
      percentage: Math.round((item.count / total) * 100),
      color: colors[item._id] || '#6B7280'
    }));
  }, [stats?.paymentMethodStats]);

  const categoryData = useMemo(() => {
    if (!stats?.categoryPerformance) return [];
    return stats.categoryPerformance.map(cat => ({
      category: cat._id || 'Khác',
      revenue: cat.revenue,
      orders: cat.orders,
      quantity: cat.quantity
    }));
  }, [stats?.categoryPerformance]);

  // ==================== RENDER FUNCTIONS ====================
  if (loading && !stats) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              Dashboard Tổng Quan
            </h1>
            <p className="text-gray-600 mt-1">
              Theo dõi hiệu suất kinh doanh của bạn
              {realtimeStats && (
                <span className="ml-2 text-xs text-green-600 inline-flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Cập nhật realtime
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                fetchDashboardStats();
                fetchRealtimeStats();
              }}
              disabled={refreshing}
              className={`px-4 py-2 bg-white border border-gray-200 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                refreshing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats - Enhanced */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Doanh thu tổng"
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={<DollarSign className="w-6 h-6" />}
          trend={stats?.revenueGrowth}
          subtitle={`Hôm nay: ${formatCurrency(stats?.todayRevenue || 0)}`}
          color="text-green-600"
          bgColor="bg-green-50"
          loading={refreshing}
        />
        <MetricCard
          title="Đơn hàng"
          value={stats?.totalOrders || 0}
          icon={<ShoppingCart className="w-6 h-6" />}
          trend={stats?.orderGrowth}
          subtitle={`Hôm nay: ${stats?.todayOrders || 0} | Chờ: ${stats?.pendingOrders || 0}`}
          color="text-blue-600"
          bgColor="bg-blue-50"
          loading={refreshing}
        />
        <MetricCard
          title="Khách hàng"
          value={formatNumber(stats?.totalCustomers || 0)}
          icon={<Users className="w-6 h-6" />}
          trend={stats?.customerGrowth}
          subtitle={`Mới: ${stats?.newCustomersThisMonth || 0} | Hoạt động: ${stats?.activeUsers || 0}`}
          color="text-purple-600"
          bgColor="bg-purple-50"
          loading={refreshing}
        />
        <MetricCard
          title="Sản phẩm"
          value={stats?.totalProducts || 0}
          icon={<Package className="w-6 h-6" />}
          trend={0}
          subtitle={stats?.lowStockCount && stats?.lowStockCount > 0 ? (
            <span className="text-orange-600 font-medium">
              ⚠️ {stats.lowStockCount} sản phẩm sắp hết
            </span>
          ) : (
            <span>Tồn kho ổn định</span>
          )}
          color="text-indigo-600"
          bgColor="bg-indigo-50"
          loading={refreshing}
        />
      </div>

      {/* Realtime Activity Bar */}
      {realtimeStats && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500 animate-pulse" />
              <span className="text-sm font-medium text-gray-700">Hoạt động 5 phút gần đây</span>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-600">Đơn mới:</span>
                <span className="text-sm font-bold text-blue-600">{realtimeStats.recentOrders}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-gray-600">Người dùng:</span>
                <span className="text-sm font-bold text-purple-600">{realtimeStats.recentUsers}</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-green-500" />
                <span className="text-sm text-gray-600">Lượt xem:</span>
                <span className="text-sm font-bold text-green-600">{realtimeStats.recentViews}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue & Orders Chart */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">
                Doanh thu & Đơn hàng
              </h2>
              <div className="flex items-center gap-4">
                {/* Period Filter */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setChartPeriod('day')}
                    className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                      chartPeriod === 'day'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Hôm nay
                  </button>
                  <button
                    onClick={() => setChartPeriod('month')}
                    className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                      chartPeriod === 'month'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Tháng
                  </button>
                  <button
                    onClick={() => setChartPeriod('year')}
                    className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                      chartPeriod === 'year'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Năm
                  </button>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">Doanh thu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-600">Đơn hàng</span>
                  </div>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="label" 
                  stroke="#6B7280" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="left" 
                  stroke="#6B7280"
                  tickFormatter={(value) => {
                    if (value >= 1000000000) return `${(value / 1000000000).toFixed(0)}B`;
                    if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                    return value;
                  }}
                  width={65}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  stroke="#6B7280"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'Doanh thu') return formatFullCurrency(value);
                    return value;
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name="Doanh thu"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="orders"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorOrders)"
                  name="Đơn hàng"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Trạng thái đơn hàng</h2>
          <div className="space-y-4">
            {orderStatusData.map((status, index) => (
              <OrderStatusBar key={index} {...status} />
            ))}
          </div>
          <div className="mt-6 pt-6 border-t">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tổng đơn hàng</span>
              <span className="text-2xl font-bold text-gray-800">{stats?.totalOrders || 0}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-gray-600">Giá trị TB</span>
              <span className="text-lg font-semibold text-green-600">
                {formatCurrency(stats?.avgOrderValue || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Weekly Revenue */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Doanh thu 7 ngày</h2>
            <TrendIcon className="h-5 w-5 text-blue-500" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={weekData}>
              <defs>
                <linearGradient id="colorWeekRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip 
                formatter={(value: any) => formatFullCurrency(value)}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorWeekRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Phương thức thanh toán</h2>
            <CreditCard className="h-5 w-5 text-purple-500" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={paymentMethodData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentMethodData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => value} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {paymentMethodData.map((method, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-600">{method.name}</span>
                <span className="font-medium">{formatCurrency(method.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Top sản phẩm bán chạy</h2>
            <Star className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="space-y-4">
            {stats?.topProducts.slice(0, 5).map((item, index) => (
              <TopProductItem key={index} item={item} index={index} formatCurrency={formatFullCurrency} />
            ))}
          </div>
        </div>

        {/* Category Performance */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Hiệu suất danh mục</h2>
            <BarChart3 className="h-5 w-5 text-indigo-500" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
              <defs>
                <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.3}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="category" 
                stroke="#6B7280"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                stroke="#6B7280"
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value;
                }}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: any) => formatFullCurrency(value)}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Bar 
                dataKey="revenue" 
                fill="url(#colorBar)"
                radius={[8, 8, 0, 0]}
                animationDuration={1000}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// ==================== SUB-COMPONENTS ====================
const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  trend = 0,
  subtitle,
  color,
  bgColor,
  loading = false,
  onClick
}) => {
  const isPositive = trend >= 0;
  
  return (
    <div 
      className={`bg-white rounded-xl shadow-sm p-6 transition-all hover:shadow-md ${loading ? 'animate-pulse' : ''} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mb-2">{value}</p>
          {trend !== 0 && (
            <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              <span className="font-medium">{Math.abs(trend)}%</span>
              <span className="text-gray-500 ml-1">so với tháng trước</span>
            </div>
          )}
          {subtitle && (
            <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
          )}
        </div>
        <div className={`${bgColor} p-3 rounded-lg ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const OrderStatusBar: React.FC<{
  name: string;
  value: number;
  color: string;
  percentage: number;
}> = ({ name, value, color, percentage }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <span className="text-sm text-gray-600">{name}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-800">{value}</span>
        <span className="text-xs text-gray-500">({percentage}%)</span>
      </div>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

const TopProductItem: React.FC<{
  item: any;
  index: number;
  formatCurrency: (amount: number) => string;
}> = ({ item, index, formatCurrency }) => (
  <div className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
      index === 0 ? 'bg-yellow-500' :
      index === 1 ? 'bg-gray-400' :
      index === 2 ? 'bg-orange-600' :
      'bg-gray-300'
    }`}>
      {index + 1}
    </div>
    <img
      className="w-12 h-12 rounded-lg object-cover"
      src={item.product.images[0]?.startsWith('http') 
        ? item.product.images[0] 
        : `http://localhost:5000${item.product.images[0]}`
      }
      alt={item.product.name}
      onError={(e) => {
        e.currentTarget.src = '/placeholder-image.png';
      }}
    />
    <div className="flex-1">
      <p className="font-medium text-gray-800 line-clamp-1">{item.product.name}</p>
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>{item.totalSold} đã bán</span>
        {item.product.rating > 0 && (
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 text-yellow-500 fill-current" />
            {item.product.rating.toFixed(1)}
          </span>
        )}
      </div>
    </div>
    <div className="text-right">
      <p className="font-semibold text-gray-800">{formatCurrency(item.revenue)}</p>
      <p className="text-xs text-gray-500">{formatCurrency(item.product.price)}/sp</p>
    </div>
  </div>
);

const LoadingScreen: React.FC = () => (
  <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <div className="text-center">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
        <BarChart3 className="h-8 w-8 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
      </div>
      <p className="mt-4 text-gray-600 font-medium">Đang tải dữ liệu...</p>
      <p className="text-sm text-gray-400 mt-1">Vui lòng chờ trong giây lát</p>
    </div>
  </div>
);

// Custom Tooltip for better formatting
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-800 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium text-gray-800">
              {formatter ? formatter(entry.value, entry.name) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default AdminDashboard;
