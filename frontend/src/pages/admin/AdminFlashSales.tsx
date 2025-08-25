// src/pages/admin/AdminFlashSales.tsx - Enhanced with Stock Validation
import React, { useState, useEffect } from 'react';
import axios from '../../utils/axios';
import { 
  FireIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  ClockIcon,
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  category: string;
  brand?: string;
  totalStock: number;
  availableForFlashSale: number;
  stock?: Array<{
    size: string;
    color: string;
    quantity: number;
  }>;
}

interface FlashSaleProduct {
  product: any;
  originalPrice: number;
  discountPrice: number;
  discountPercentage: number;
  maxQuantity: number;
  soldQuantity: number;
  isActive: boolean;
  currentStock?: number;
  remainingInSale?: number;
}

interface FlashSale {
  _id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  products: FlashSaleProduct[];
  banner?: {
    image?: string;
    title?: string;
    subtitle?: string;
    gradient?: string;
  };
  priority: number;
  statistics?: any;
  isCurrentlyActive?: boolean;
  timeRemaining?: number;
}

const AdminFlashSales: React.FC = () => {
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSale, setEditingSale] = useState<FlashSale | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming' | 'ended'>('all');
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [stockErrors, setStockErrors] = useState<{[key: string]: string}>({});
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    priority: 0,
    isActive: true,
    banner: {
      image: '',
      title: '',
      subtitle: '',
      gradient: 'from-red-600 to-orange-600'
    }
  });

  useEffect(() => {
    fetchFlashSales();
  }, [filter]);

  useEffect(() => {
    if (showModal) {
      fetchProductsWithStock();
    }
  }, [showModal, editingSale]);

  const fetchFlashSales = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/admin/flash-sales', {
        params: { status: filter === 'all' ? undefined : filter }
      });
      
      let sales = [];
      if (response.data) {
        if (Array.isArray(response.data)) {
          sales = response.data;
        } else if (response.data.flashSales && Array.isArray(response.data.flashSales)) {
          sales = response.data.flashSales;
        }
      }
      
      setFlashSales(sales);
    } catch (error) {
      console.error('Error fetching flash sales:', error);
      setFlashSales([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductsWithStock = async () => {
    try {
      setProductsLoading(true);
      
      // Use the new endpoint that includes stock information
      const response = await axios.get('/admin/flash-sales/products-with-stock', {
        params: editingSale ? { excludeSaleId: editingSale._id } : {}
      });
      
      const products = response.data.products || [];
      setAvailableProducts(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      setAvailableProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const validateProductQuantity = (productId: string, quantity: number): boolean => {
    const product = availableProducts.find(p => p._id === productId);
    if (!product) return false;
    
    if (quantity > product.availableForFlashSale) {
      setStockErrors(prev => ({
        ...prev,
        [productId]: `Số lượng vượt quá tồn kho khả dụng (${product.availableForFlashSale})`
      }));
      return false;
    }
    
    setStockErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[productId];
      return newErrors;
    });
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedProducts.length === 0) {
      alert('Vui lòng chọn ít nhất một sản phẩm!');
      return;
    }
    
    // Validate all product quantities
    let hasError = false;
    selectedProducts.forEach(p => {
      const productId = p.product._id || p.product;
      if (!validateProductQuantity(productId, p.maxQuantity)) {
        hasError = true;
      }
    });
    
    if (hasError) {
      alert('Có lỗi về số lượng sản phẩm. Vui lòng kiểm tra lại!');
      return;
    }
    
    try {
      const data = {
        ...formData,
        products: selectedProducts.map(p => ({
          productId: p.product._id || p.product,
          discountPercentage: p.discountPercentage,
          maxQuantity: p.maxQuantity,
          originalPrice: p.originalPrice || p.product.price
        }))
      };

      if (editingSale) {
        await axios.put(`/admin/flash-sales/${editingSale._id}`, data);
        alert('Flash sale đã được cập nhật!');
      } else {
        await axios.post('/admin/flash-sales', data);
        alert('Flash sale đã được tạo!');
      }

      setShowModal(false);
      resetForm();
      fetchFlashSales();
    } catch (error: any) {
      if (error.response?.data?.errors) {
        alert('Lỗi:\n' + error.response.data.errors.join('\n'));
      } else {
        alert(error.response?.data?.message || 'Có lỗi xảy ra khi lưu flash sale');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa flash sale này?')) return;
    
    try {
      await axios.delete(`/admin/flash-sales/${id}`);
      alert('Flash sale đã được xóa!');
      fetchFlashSales();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Có lỗi xảy ra khi xóa flash sale');
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      await axios.patch(`/admin/flash-sales/${id}/toggle`);
      fetchFlashSales();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      priority: 0,
      isActive: true,
      banner: {
        image: '',
        title: '',
        subtitle: '',
        gradient: 'from-red-600 to-orange-600'
      }
    });
    setSelectedProducts([]);
    setEditingSale(null);
    setStockErrors({});
  };

  const openEditModal = (sale: FlashSale) => {
    setEditingSale(sale);
    setFormData({
      name: sale.name,
      description: sale.description,
      startDate: format(new Date(sale.startDate), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(sale.endDate), "yyyy-MM-dd'T'HH:mm"),
      priority: sale.priority,
      isActive: sale.isActive,
      banner: {
        image: sale.banner?.image || '',
        title: sale.banner?.title || '',
        subtitle: sale.banner?.subtitle || '',
        gradient: sale.banner?.gradient || 'from-red-600 to-orange-600'
      }
    });
    setSelectedProducts(sale.products || []);
    setShowModal(true);
  };

  const addProductToSale = (product: Product) => {
    if (!product) return;
    
    if (selectedProducts.find(p => (p.product._id || p.product) === product._id)) {
      alert('Sản phẩm đã được thêm!');
      return;
    }
    
    if (product.availableForFlashSale === 0) {
      alert('Sản phẩm này không còn hàng khả dụng cho flash sale!');
      return;
    }
    
    const defaultQuantity = Math.min(10, product.availableForFlashSale);
    
    setSelectedProducts([...selectedProducts, {
      product: product,
      originalPrice: product.price,
      discountPercentage: 50,
      discountPrice: Math.round(product.price * 0.5),
      maxQuantity: defaultQuantity,
      soldQuantity: 0,
      isActive: true
    }]);
  };

  const updateProductDiscount = (productId: string, field: string, value: any) => {
    if (field === 'maxQuantity') {
      const numValue = parseInt(value) || 0;
      if (!validateProductQuantity(productId, numValue)) {
        return;
      }
    }
    
    setSelectedProducts(prev => 
      prev.map(p => {
        const id = p.product._id || p.product;
        if (id === productId) {
          const updated = { ...p, [field]: value };
          
          if (field === 'discountPercentage') {
            updated.discountPrice = Math.round(updated.originalPrice * (1 - value / 100));
          }
          
          return updated;
        }
        return p;
      })
    );
  };

  const removeProductFromSale = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => (p.product._id || p.product) !== productId));
    setStockErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[productId];
      return newErrors;
    });
  };

  const formatTimeRemaining = (seconds: number) => {
    if (!seconds || seconds <= 0) return 'Đã kết thúc';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const getStockStatusColor = (available: number, total: number) => {
    const percentage = (available / total) * 100;
    if (percentage > 50) return 'text-green-600';
    if (percentage > 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <FireIcon className="w-8 h-8 text-red-500" />
            <h1 className="text-2xl font-bold">Quản lý Flash Sale</h1>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center space-x-2"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Tạo Flash Sale</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-4 mt-6">
          {(['all', 'active', 'upcoming', 'ended'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'Tất cả' :
               status === 'active' ? 'Đang diễn ra' :
               status === 'upcoming' ? 'Sắp diễn ra' : 'Đã kết thúc'}
            </button>
          ))}
        </div>
      </div>

      {/* Flash Sales List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
        </div>
      ) : flashSales.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FireIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Chưa có flash sale nào</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {flashSales.map((sale) => (
            <div key={sale._id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{sale.name}</h3>
                  <p className="text-gray-600 mt-1">{sale.description}</p>
                  <div className="flex items-center space-x-4 mt-2 text-sm">
                    <span className="text-gray-500">
                      Bắt đầu: {format(new Date(sale.startDate), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </span>
                    <span className="text-gray-500">
                      Kết thúc: {format(new Date(sale.endDate), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {sale.isCurrentlyActive ? (
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                      <ClockIcon className="w-4 h-4 mr-1" />
                      {formatTimeRemaining(sale.timeRemaining || 0)}
                    </span>
                  ) : sale.isActive ? (
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                      Sắp diễn ra
                    </span>
                  ) : (
                    <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
                      Đã kết thúc
                    </span>
                  )}
                  
                  <button
                    onClick={() => toggleStatus(sale._id)}
                    className={`p-2 rounded-lg ${
                      sale.isActive 
                        ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={sale.isActive ? 'Tắt' : 'Bật'}
                  >
                    {sale.isActive ? <CheckCircleIcon className="w-5 h-5" /> : <XCircleIcon className="w-5 h-5" />}
                  </button>
                  
                  <button
                    onClick={() => openEditModal(sale)}
                    className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                    title="Chỉnh sửa"
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  
                  <button
                    onClick={() => handleDelete(sale._id)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                    title="Xóa"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Statistics */}
              {sale.statistics && (
                <div className="grid grid-cols-5 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-gray-500 text-sm">Tổng sản phẩm</p>
                    <p className="text-xl font-bold">{sale.statistics.totalProducts}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Đã bán</p>
                    <p className="text-xl font-bold text-green-600">{sale.statistics.totalSold}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Doanh thu</p>
                    <p className="text-xl font-bold text-blue-600">
                      {sale.statistics.totalRevenue?.toLocaleString('vi-VN')}₫
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Giảm giá TB</p>
                    <p className="text-xl font-bold text-orange-600">
                      {Math.round(sale.statistics.averageDiscount || 0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Hết hàng</p>
                    <p className="text-xl font-bold text-red-600">{sale.statistics.productsOutOfStock}</p>
                  </div>
                </div>
              )}

              {/* Products with Stock Info */}
              {sale.products && sale.products.length > 0 && (
                <div className="grid grid-cols-4 gap-4">
                  {sale.products.slice(0, 4).map((item) => (
                    <div key={item.product?._id || Math.random()} className="border rounded-lg p-3">
                      <img 
                        src={item.product?.images?.[0] || '/placeholder.jpg'}
                        alt={item.product?.name || 'Product'}
                        className="w-full h-32 object-cover rounded mb-2"
                      />
                      <h4 className="font-medium text-sm line-clamp-1">{item.product?.name || 'Unknown'}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-red-600 font-bold">
                          {(item.discountPrice || 0).toLocaleString('vi-VN')}₫
                        </span>
                        <span className="text-gray-400 line-through text-sm">
                          {(item.originalPrice || 0).toLocaleString('vi-VN')}₫
                        </span>
                      </div>
                      
                      {/* Stock Info */}
                      {item.currentStock !== undefined && (
                        <div className="mt-1 text-xs text-gray-600">
                          <span>Kho: {item.currentStock}</span>
                        </div>
                      )}
                      
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Đã bán: {item.soldQuantity || 0}</span>
                          <span>Còn: {item.remainingInSale || ((item.maxQuantity || 0) - (item.soldQuantity || 0))}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                            style={{ width: `${((item.soldQuantity || 0) / (item.maxQuantity || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {sale.products.length > 4 && (
                    <div className="flex items-center justify-center text-gray-500 border rounded-lg">
                      +{sale.products.length - 4} sản phẩm khác
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">
                {editingSale ? 'Chỉnh sửa Flash Sale' : 'Tạo Flash Sale mới'}
              </h2>

              <form onSubmit={handleSubmit}>
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tên Flash Sale
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Độ ưu tiên
                    </label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value) || 0})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mô tả
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    rows={3}
                    required
                  />
                </div>

                {/* Date Time */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Thời gian bắt đầu
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Thời gian kết thúc
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      required
                    />
                  </div>
                </div>

                {/* Product Selection with Stock Info */}
                <div className="mb-6">
                  <h3 className="font-medium mb-3">Chọn sản phẩm</h3>
                  
                  {/* Product Search with Stock Info */}
                  <div className="mb-4">
                    {productsLoading ? (
                      <p className="text-gray-500">Đang tải sản phẩm...</p>
                    ) : availableProducts.length === 0 ? (
                      <p className="text-red-500">Không có sản phẩm khả dụng cho flash sale</p>
                    ) : (
                      <select
                        onChange={(e) => {
                          const product = availableProducts.find(p => p._id === e.target.value);
                          if (product) addProductToSale(product);
                          e.target.value = '';
                        }}
                        className="w-full px-3 py-2 border rounded-lg"
                        value=""
                      >
                        <option value="">-- Chọn sản phẩm --</option>
                        {availableProducts.map(product => (
                          <option key={product._id} value={product._id}>
                            {product.name} - {product.price?.toLocaleString('vi-VN')}₫ 
                            (Khả dụng: {product.availableForFlashSale}/{product.totalStock})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Selected Products with Stock Validation */}
                  {selectedProducts.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedProducts.map((item) => {
                        const productId = item.product._id || item.product;
                        const availableProduct = availableProducts.find(p => p._id === productId);
                        const hasError = stockErrors[productId];
                        
                        return (
                          <div 
                            key={productId} 
                            className={`flex items-center space-x-4 p-3 rounded-lg ${
                              hasError ? 'bg-red-50 border border-red-300' : 'bg-gray-50'
                            }`}
                          >
                            <img 
                              src={item.product.images?.[0] || '/placeholder.jpg'}
                              alt={item.product.name || 'Product'}
                              className="w-16 h-16 object-cover rounded"
                            />
                            <div className="flex-1">
                              <p className="font-medium">{item.product.name || 'Unknown Product'}</p>
                              <p className="text-sm text-gray-600">
                                Giá gốc: {(item.originalPrice || 0).toLocaleString('vi-VN')}₫
                              </p>
                              {availableProduct && (
                                <p className={`text-xs ${getStockStatusColor(availableProduct.availableForFlashSale, availableProduct.totalStock)}`}>
                                  <CubeIcon className="w-3 h-3 inline mr-1" />
                                  Kho khả dụng: {availableProduct.availableForFlashSale}/{availableProduct.totalStock}
                                </p>
                              )}
                              {hasError && (
                                <p className="text-xs text-red-600 flex items-center mt-1">
                                  <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                                  {hasError}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <div>
                                <label className="text-xs text-gray-500">Giảm %</label>
                                <input
                                  type="number"
                                  value={item.discountPercentage}
                                  onChange={(e) => updateProductDiscount(productId, 'discountPercentage', parseInt(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 border rounded"
                                  min="0"
                                  max="100"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">SL</label>
                                <input
                                  type="number"
                                  value={item.maxQuantity}
                                  onChange={(e) => updateProductDiscount(productId, 'maxQuantity', parseInt(e.target.value) || 1)}
                                  className={`w-20 px-2 py-1 border rounded ${hasError ? 'border-red-500' : ''}`}
                                  min="1"
                                  max={availableProduct?.availableForFlashSale || 999}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeProductFromSale(productId)}
                                className="text-red-600 hover:text-red-800 mt-4"
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-4">
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
                    disabled={Object.keys(stockErrors).length > 0}
                    className={`px-4 py-2 rounded-lg text-white ${
                      Object.keys(stockErrors).length > 0 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {editingSale ? 'Cập nhật' : 'Tạo mới'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFlashSales;