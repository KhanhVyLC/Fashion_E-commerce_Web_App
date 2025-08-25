//src/page/admin/AdminVouchers.tsx
import React, { useState, useEffect } from 'react';
import {
  Gift,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Copy,
  ToggleLeft,
  ToggleRight,
  Calendar,
  DollarSign,
  Percent,
  Users,
  TrendingUp,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import axios from '../../utils/axios';

interface Voucher {
  _id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  quantity: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status?: string;
  remainingQuantity?: number;
  createdBy?: {
    name: string;
    email: string;
  };
  maxUsagePerUser: number;
  applicableCategories: string[];
  applicableBrands: string[];
}

const AdminVouchers: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null);
  const [voucherStats, setVoucherStats] = useState<any>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    minOrderAmount: '',
    maxDiscountAmount: '',
    quantity: '',
    startDate: '',
    endDate: '',
    maxUsagePerUser: '1',
    applicableCategories: [] as string[],
    applicableBrands: [] as string[],
    generateCode: false
  });

  useEffect(() => {
    fetchVouchers();
  }, [currentPage, search, statusFilter]);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/admin/vouchers', {
        params: {
          page: currentPage,
          limit: 10,
          search,
          status: statusFilter
        }
      });
      setVouchers(response.data.vouchers);
      setTotalPages(response.data.pages);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVoucherStats = async (voucherId: string) => {
    try {
      const response = await axios.get(`/admin/vouchers/${voucherId}/stats`);
      setVoucherStats(response.data);
      setSelectedVoucherId(voucherId);
      setShowStatsModal(true);
    } catch (error) {
      console.error('Error fetching voucher stats:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const data = {
        ...formData,
        discountValue: Number(formData.discountValue),
        minOrderAmount: Number(formData.minOrderAmount) || 0,
        maxDiscountAmount: formData.discountType === 'percentage' 
          ? (Number(formData.maxDiscountAmount) || null)
          : null,
        quantity: Number(formData.quantity),
        maxUsagePerUser: Number(formData.maxUsagePerUser) || 1
      };

      if (editingVoucher) {
        await axios.put(`/admin/vouchers/${editingVoucher._id}`, data);
      } else {
        await axios.post('/admin/vouchers', data);
      }
      
      setShowModal(false);
      resetForm();
      fetchVouchers();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Lỗi khi lưu voucher');
    }
  };

  const handleToggleStatus = async (voucherId: string) => {
    try {
      await axios.patch(`/admin/vouchers/${voucherId}/toggle-status`);
      fetchVouchers();
    } catch (error) {
      console.error('Error toggling voucher status:', error);
    }
  };

  const handleDelete = async (voucherId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa voucher này?')) {
      try {
        await axios.delete(`/admin/vouchers/${voucherId}`);
        fetchVouchers();
      } catch (error: any) {
        alert(error.response?.data?.message || 'Lỗi khi xóa voucher');
      }
    }
  };

  const handleEdit = (voucher: Voucher) => {
    setEditingVoucher(voucher);
    setFormData({
      code: voucher.code,
      description: voucher.description,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue.toString(),
      minOrderAmount: voucher.minOrderAmount.toString(),
      maxDiscountAmount: voucher.maxDiscountAmount?.toString() || '',
      quantity: voucher.quantity.toString(),
      startDate: new Date(voucher.startDate).toISOString().split('T')[0],
      endDate: new Date(voucher.endDate).toISOString().split('T')[0],
      maxUsagePerUser: voucher.maxUsagePerUser.toString(),
      applicableCategories: voucher.applicableCategories,
      applicableBrands: voucher.applicableBrands,
      generateCode: false
    });
    setShowModal(true);
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: '',
      minOrderAmount: '',
      maxDiscountAmount: '',
      quantity: '',
      startDate: '',
      endDate: '',
      maxUsagePerUser: '1',
      applicableCategories: [],
      applicableBrands: [],
      generateCode: false
    });
    setEditingVoucher(null);
  };

  const getStatusBadge = (voucher: Voucher) => {
    const statusColors = {
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      used_up: 'bg-gray-100 text-gray-800',
      not_started: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800'
    };

    const statusText = {
      active: 'Đang hoạt động',
      expired: 'Đã hết hạn',
      used_up: 'Đã dùng hết',
      not_started: 'Chưa bắt đầu',
      inactive: 'Không hoạt động'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[voucher.status as keyof typeof statusColors]}`}>
        {statusText[voucher.status as keyof typeof statusText]}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <Gift className="w-8 h-8 mr-3 text-purple-600" />
          Quản lý Voucher
        </h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tạo voucher mới
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Tìm kiếm mã voucher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="expired">Đã hết hạn</option>
            <option value="used">Đã dùng hết</option>
          </select>
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mã Voucher
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Giảm giá
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Số lượng
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Thời gian
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trạng thái
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <span className="ml-2">Đang tải...</span>
                  </div>
                </td>
              </tr>
            ) : vouchers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  <Gift className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Chưa có voucher nào</p>
                </td>
              </tr>
            ) : (
              vouchers.map((voucher) => (
                <tr key={voucher._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="font-mono font-bold text-purple-600">
                        {voucher.code}
                      </span>
                      <button
                        onClick={() => copyToClipboard(voucher.code)}
                        className="ml-2 text-gray-400 hover:text-gray-600"
                      >
                        {copiedCode === voucher.code ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-gray-500">{voucher.description}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {voucher.discountType === 'percentage' ? (
                        <Percent className="w-4 h-4 mr-1 text-blue-500" />
                      ) : (
                        <DollarSign className="w-4 h-4 mr-1 text-green-500" />
                      )}
                      <span className="font-medium">
                        {voucher.discountType === 'percentage'
                          ? `${voucher.discountValue}%`
                          : formatCurrency(voucher.discountValue)}
                      </span>
                    </div>
                    {voucher.minOrderAmount > 0 && (
                      <p className="text-xs text-gray-500">
                        Đơn tối thiểu: {formatCurrency(voucher.minOrderAmount)}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="font-medium">
                        {voucher.usedCount} / {voucher.quantity}
                      </div>
                      <div className="text-gray-500">
                        Còn lại: {voucher.remainingQuantity}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center text-gray-500">
                      <Calendar className="w-4 h-4 mr-1" />
                      <div>
                        <p>{new Date(voucher.startDate).toLocaleDateString('vi-VN')}</p>
                        <p>{new Date(voucher.endDate).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(voucher)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => fetchVoucherStats(voucher._id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Xem thống kê"
                      >
                        <TrendingUp className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(voucher._id)}
                        className={`${voucher.isActive ? 'text-green-600' : 'text-gray-400'} hover:text-gray-700`}
                        title={voucher.isActive ? 'Tắt voucher' : 'Bật voucher'}
                      >
                        {voucher.isActive ? (
                          <ToggleRight className="w-5 h-5" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(voucher)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Chỉnh sửa"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(voucher._id)}
                        className="text-red-600 hover:text-red-900"
                        title="Xóa"
                        disabled={voucher.usedCount > 0}
                      >
                        <Trash2 className={`w-5 h-5 ${voucher.usedCount > 0 ? 'opacity-50 cursor-not-allowed' : ''}`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
          >
            Previous
          </button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i + 1}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 border rounded ${
                currentPage === i + 1 ? 'bg-purple-600 text-white' : 'hover:bg-gray-100'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Create/Edit Voucher Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">
                {editingVoucher ? 'Chỉnh sửa voucher' : 'Tạo voucher mới'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mã voucher
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="VD: SALE50"
                      required={!formData.generateCode}
                      disabled={formData.generateCode || (editingVoucher !== null && editingVoucher.usedCount > 0)}
                    />
                    {!editingVoucher && (
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.generateCode}
                          onChange={(e) => setFormData({ ...formData, generateCode: e.target.checked })}
                          className="mr-2"
                        />
                        <span className="text-sm">Tự động</span>
                      </label>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Số lượng
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mô tả
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={2}
                  required
                  placeholder="VD: Giảm giá 50% cho đơn hàng từ 500k"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Loại giảm giá
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value as 'percentage' | 'fixed' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="percentage">Phần trăm (%)</option>
                    <option value="fixed">Số tiền cố định</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Giá trị giảm
                  </label>
                  <input
                    type="number"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="0"
                    max={formData.discountType === 'percentage' ? '100' : undefined}
                    step={formData.discountType === 'percentage' ? '1' : '1000'}
                    required
                    placeholder={formData.discountType === 'percentage' ? '50' : '50000'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Đơn hàng tối thiểu
                  </label>
                  <input
                    type="number"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    min="0"
                    step="1000"
                    placeholder="0"
                  />
                </div>

                {formData.discountType === 'percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Giảm tối đa
                    </label>
                    <input
                      type="number"
                      value={formData.maxDiscountAmount}
                      onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      min="0"
                      step="1000"
                      placeholder="Không giới hạn"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ngày bắt đầu
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ngày kết thúc
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Số lần sử dụng tối đa/người
                </label>
                <input
                  type="number"
                  value={formData.maxUsagePerUser}
                  onChange={(e) => setFormData({ ...formData, maxUsagePerUser: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  min="1"
                  placeholder="1"
                />
              </div>

              <div className="flex justify-end space-x-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  {editingVoucher ? 'Cập nhật' : 'Tạo voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStatsModal && voucherStats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Thống kê Voucher</h2>
              <button
                onClick={() => setShowStatsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Đã sử dụng</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {voucherStats.totalUsed}/{voucherStats.totalQuantity}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Tỷ lệ sử dụng</p>
                  <p className="text-2xl font-bold text-green-800">
                    {voucherStats.usageRate}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-purple-600 font-medium">Tổng giảm giá</p>
                  <p className="text-2xl font-bold text-purple-800">
                    {formatCurrency(voucherStats.totalDiscountGiven)}
                  </p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-600 font-medium">TB/lần dùng</p>
                  <p className="text-2xl font-bold text-yellow-800">
                    {formatCurrency(voucherStats.averageDiscountPerUse)}
                  </p>
                </div>
              </div>

              {voucherStats.recentUsage.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Lịch sử sử dụng gần đây</h3>
                  <div className="space-y-2">
                    {voucherStats.recentUsage.map((usage: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{usage.user?.name || 'Unknown'}</p>
                          <p className="text-sm text-gray-500">{usage.user?.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {usage.orderId && formatCurrency(usage.orderId.totalAmount)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(usage.usedAt).toLocaleString('vi-VN')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVouchers;