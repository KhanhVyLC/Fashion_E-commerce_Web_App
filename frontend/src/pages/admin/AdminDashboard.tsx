// src/pages/admin/AdminDashboard.tsx
import React, { useState, useEffect } from 'react';
import {
  Package,
  ShoppingCart,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  AlertCircle
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
  Cell
} from 'recharts';
import axios from '../../utils/axios';

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalCustomers: number;
  totalProducts: number;
  topProducts: any[];
  monthlyRevenue: any[];
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get('/admin/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatMonthData = (data: any[]) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return data.map(item => ({
      month: months[item._id.month - 1],
      revenue: item.revenue,
      orders: item.orders
    }));
  };

  const orderStatusData = stats ? [
    { name: 'Chờ xử lý', value: stats.pendingOrders, color: '#FFA500' },
    { name: 'Đang xử lý', value: stats.processingOrders, color: '#33B5E5' },
    { name: 'Đang giao', value: stats.shippedOrders, color: '#2196F3' },
    { name: 'Đã giao', value: stats.deliveredOrders, color: '#4CAF50' },
    { name: 'Đã hủy', value: stats.cancelledOrders, color: '#F44336' }
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Đang tải dữ liệu...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng doanh thu</p>
              <p className="text-2xl font-bold text-gray-800">
                {formatCurrency(stats?.totalRevenue || 0)}
              </p>
            </div>
            <DollarSign className="w-12 h-12 text-green-500" />
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>+12% so với tháng trước</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng đơn hàng</p>
              <p className="text-2xl font-bold text-gray-800">{stats?.totalOrders || 0}</p>
            </div>
            <ShoppingCart className="w-12 h-12 text-blue-500" />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-orange-600 flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {stats?.pendingOrders || 0} chờ xử lý
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Khách hàng</p>
              <p className="text-2xl font-bold text-gray-800">{stats?.totalCustomers || 0}</p>
            </div>
            <Users className="w-12 h-12 text-purple-500" />
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Khách hàng đã đăng ký
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sản phẩm</p>
              <p className="text-2xl font-bold text-gray-800">{stats?.totalProducts || 0}</p>
            </div>
            <Package className="w-12 h-12 text-indigo-500" />
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Tổng sản phẩm trong kho
          </div>
        </div>
      </div>

      {/* Order Status Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Tổng quan trạng thái đơn hàng</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <Clock className="w-8 h-8 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-orange-600">{stats?.pendingOrders || 0}</p>
            <p className="text-sm text-gray-600">Chờ xử lý</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <AlertCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-600">{stats?.processingOrders || 0}</p>
            <p className="text-sm text-gray-600">Đang xử lý</p>
          </div>
          <div className="text-center p-4 bg-indigo-50 rounded-lg">
            <Truck className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-indigo-600">{stats?.shippedOrders || 0}</p>
            <p className="text-sm text-gray-600">Đang giao</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{stats?.deliveredOrders || 0}</p>
            <p className="text-sm text-gray-600">Đã giao</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-red-600">{stats?.cancelledOrders || 0}</p>
            <p className="text-sm text-gray-600">Đã hủy</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Doanh thu theo tháng</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={formatMonthData(stats?.monthlyRevenue || [])}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#3B82F6" 
                name="Doanh thu"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Phân bổ trạng thái đơn hàng</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={orderStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {orderStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Top 5 sản phẩm bán chạy</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Sản phẩm</th>
                <th className="text-center py-3 px-4">Số lượng bán</th>
                <th className="text-right py-3 px-4">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {stats?.topProducts.map((item, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      <img
                        className="w-10 h-10 rounded object-cover mr-3"
                        src={item.product.images[0].startsWith('http') 
                          ? item.product.images[0] 
                          : `http://localhost:5000${item.product.images[0]}`
                        }
                        alt={item.product.name}
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-image.png';
                        }}
                      />
                      <span className="font-medium">{item.product.name}</span>
                    </div>
                  </td>
                  <td className="text-center py-3 px-4">{item.totalSold}</td>
                  <td className="text-right py-3 px-4 font-medium">
                    {formatCurrency(item.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;