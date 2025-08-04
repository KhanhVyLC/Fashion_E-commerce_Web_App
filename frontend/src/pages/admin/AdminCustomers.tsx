// src/pages/admin/AdminCustomers.tsx
import React, { useState, useEffect } from 'react';
import {
  Search,
  User,
  Eye,
  Trash2,
  Edit,
  ShoppingBag,
  X
} from 'lucide-react';
import axios from '../../utils/axios';

interface Customer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  analytics: {
    totalSpent: number;
    totalOrders: number;
    averageOrderValue: number;
    lastPurchaseDate?: string;
  };
  createdAt: string;
}

interface CustomerDetail extends Customer {
  orders: any[];
}

const AdminCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loadingCustomerDetail, setLoadingCustomerDetail] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, [currentPage, search]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/admin/users', {
        params: {
          page: currentPage,
          limit: 10,
          search
        }
      });
      setCustomers(response.data.users);
      setTotalPages(response.data.pages);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (customerId: string) => {
    try {
      setLoadingCustomerDetail(true);
      setShowDetailModal(true);
      
      const response = await axios.get(`/admin/users/${customerId}`);
      setSelectedCustomer({
        ...response.data.user,
        orders: response.data.orders
      });
    } catch (error) {
      console.error('Error fetching customer details:', error);
      setShowDetailModal(false);
    } finally {
      setLoadingCustomerDetail(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone || '',
      address: customer.address || ''
    });
    setSelectedCustomer(customer as CustomerDetail);
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    try {
      await axios.put(`/admin/users/${selectedCustomer._id}`, editFormData);
      setShowEditModal(false);
      
      // Cập nhật lại danh sách khách hàng
      await fetchCustomers();
      
      // Nếu modal chi tiết đang mở, cập nhật lại thông tin chi tiết
      if (showDetailModal) {
        const response = await axios.get(`/admin/users/${selectedCustomer._id}`);
        setSelectedCustomer({
          ...response.data.user,
          orders: response.data.orders
        });
      }
    } catch (error) {
      console.error('Error updating customer:', error);
    }
  };

  const handleDelete = async (customerId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa khách hàng này? Lưu ý: Không thể xóa khách hàng có đơn hàng.')) {
      try {
        await axios.delete(`/admin/users/${customerId}`);
        
        // Đóng modal nếu đang xem chi tiết khách hàng bị xóa
        if (selectedCustomer?._id === customerId) {
          setShowDetailModal(false);
          setSelectedCustomer(null);
        }
        
        fetchCustomers();
      } catch (error: any) {
        alert(error.response?.data?.message || 'Không thể xóa khách hàng');
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  // Hàm refresh dữ liệu chi tiết khách hàng
  const refreshCustomerDetail = async () => {
    if (!selectedCustomer) return;
    
    try {
      setLoadingCustomerDetail(true);
      const response = await axios.get(`/admin/users/${selectedCustomer._id}`);
      setSelectedCustomer({
        ...response.data.user,
        orders: response.data.orders
      });
    } catch (error) {
      console.error('Error refreshing customer details:', error);
    } finally {
      setLoadingCustomerDetail(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Quản lý khách hàng</h1>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm kiếm khách hàng..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Khách hàng
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Liên hệ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tổng chi tiêu
                <div className="text-xs text-gray-400 normal-case">(Đơn đã giao)</div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Số đơn hàng
                <div className="text-xs text-gray-400 normal-case">(Đã giao)</div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ngày tham gia
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
                  Đang tải...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  Không tìm thấy khách hàng nào
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-gray-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {customer.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{customer.email}</div>
                    <div className="text-sm text-gray-500">{customer.phone || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(customer.analytics.totalSpent)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {customer.analytics.totalOrders}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(customer.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleViewDetails(customer._id)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleEdit(customer)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(customer._id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
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
                currentPage === i + 1 ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
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

      {/* Customer Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Chi tiết khách hàng</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={refreshCustomerDetail}
                  className="text-blue-600 hover:text-blue-800 p-1"
                  title="Làm mới dữ liệu"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {loadingCustomerDetail ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Đang tải dữ liệu...</p>
              </div>
            ) : selectedCustomer ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="font-semibold mb-3">Thông tin cá nhân</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p><strong>Tên:</strong> {selectedCustomer.name}</p>
                      <p><strong>Email:</strong> {selectedCustomer.email}</p>
                      <p><strong>SĐT:</strong> {selectedCustomer.phone || 'N/A'}</p>
                      <p><strong>Địa chỉ:</strong> {selectedCustomer.address || 'N/A'}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">
                      Thống kê mua hàng 
                      <span className="text-sm font-normal text-gray-500 ml-2">(Chỉ tính đơn đã giao)</span>
                    </h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p><strong>Tổng chi tiêu:</strong> {formatCurrency(selectedCustomer.analytics.totalSpent)}</p>
                      <p><strong>Số đơn hàng:</strong> {selectedCustomer.analytics.totalOrders}</p>
                      <p><strong>Giá trị TB:</strong> {formatCurrency(selectedCustomer.analytics.averageOrderValue)}</p>
                      <p><strong>Lần mua cuối:</strong> {selectedCustomer.analytics.lastPurchaseDate ? formatDate(selectedCustomer.analytics.lastPurchaseDate) : 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Order History */}
                <h3 className="font-semibold mb-3">Lịch sử đơn hàng (Tất cả trạng thái)</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Mã đơn</th>
                        <th className="px-4 py-2 text-left">Ngày đặt</th>
                        <th className="px-4 py-2 text-left">Trạng thái</th>
                        <th className="px-4 py-2 text-right">Tổng tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedCustomer.orders.map((order) => (
                        <tr key={order._id}>
                          <td className="px-4 py-2">#{order._id.slice(-8)}</td>
                          <td className="px-4 py-2">{formatDate(order.createdAt)}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              order.orderStatus === 'delivered' ? 'bg-green-100 text-green-800' :
                              order.orderStatus === 'cancelled' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {order.orderStatus}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">{formatCurrency(order.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Không thể tải thông tin khách hàng
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Chỉnh sửa khách hàng</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Địa chỉ
                </label>
                <textarea
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Cập nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCustomers;