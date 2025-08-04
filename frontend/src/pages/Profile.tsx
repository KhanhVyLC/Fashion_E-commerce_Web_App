// src/pages/Profile.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from '../utils/axios';
import { 
  UserIcon, 
  EnvelopeIcon, 
  PhoneIcon, 
  HomeIcon, 
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon,
  TagIcon,
  SwatchIcon
} from '@heroicons/react/24/outline';

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  preferences?: {
    size?: string;
    style?: string[];
    favoriteColors?: string[];
    priceRange?: {
      min: number;
      max: number;
    };
    preferredBrands?: string[];
    preferredCategories?: string[];
  };
  analytics?: {
    totalSpent: number;
    totalOrders: number;
    averageOrderValue: number;
    lastPurchaseDate?: string;
    favoriteCategory?: string;
    favoriteBrand?: string;
  };
}

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    preferences: {
      size: '',
      style: [] as string[],
      favoriteColors: [] as string[],
      priceRange: {
        min: 0,
        max: 10000000
      },
      preferredBrands: [] as string[],
      preferredCategories: [] as string[]
    }
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const sizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const styleOptions = ['Casual', 'Formal', 'Sporty', 'Vintage', 'Modern', 'Classic'];
  const colorOptions = ['Đen', 'Trắng', 'Xanh', 'Đỏ', 'Vàng', 'Xám', 'Nâu', 'Hồng'];
  const categoryOptions = ['Áo thun', 'Áo sơ mi', 'Quần jean', 'Váy đầm', 'Áo khoác', 'Phụ kiện'];

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/users/me');
      setProfile(response.data);
      setFormData({
        name: response.data.name || '',
        phone: response.data.phone || '',
        address: response.data.address || '',
        preferences: {
          size: response.data.preferences?.size || '',
          style: response.data.preferences?.style || [],
          favoriteColors: response.data.preferences?.favoriteColors || [],
          priceRange: response.data.preferences?.priceRange || { min: 0, max: 10000000 },
          preferredBrands: response.data.preferences?.preferredBrands || [],
          preferredCategories: response.data.preferences?.preferredCategories || []
        }
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Không thể tải thông tin người dùng');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await axios.put('/users/me', formData);
      setProfile(response.data);
      setEditing(false);
      setSuccess('Cập nhật thông tin thành công!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Không thể cập nhật thông tin');
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setError('');
    // Reset form to original values
    if (profile) {
      setFormData({
        name: profile.name || '',
        phone: profile.phone || '',
        address: profile.address || '',
        preferences: {
          size: profile.preferences?.size || '',
          style: profile.preferences?.style || [],
          favoriteColors: profile.preferences?.favoriteColors || [],
          priceRange: profile.preferences?.priceRange || { min: 0, max: 10000000 },
          preferredBrands: profile.preferences?.preferredBrands || [],
          preferredCategories: profile.preferences?.preferredCategories || []
        }
      });
    }
  };

  const toggleArrayItem = (array: string[], item: string) => {
    return array.includes(item) 
      ? array.filter(i => i !== item)
      : [...array, item];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Không thể tải thông tin người dùng</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Thông tin tài khoản</h1>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700">
          {success}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Column - Basic Info & Stats */}
        <div className="md:col-span-1">
          {/* User Avatar & Basic Info */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mb-4">
                <UserIcon className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-xl font-semibold mb-2">{profile.name}</h2>
              <p className="text-gray-600 text-sm mb-4">{profile.email}</p>
              
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-700"
                >
                  <PencilIcon className="w-4 h-4" />
                  <span>Chỉnh sửa thông tin</span>
                </button>
              )}
            </div>
          </div>

          {/* Shopping Stats */}
          {profile.analytics && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-semibold mb-4">Thống kê mua sắm</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-gray-600">
                    <ShoppingBagIcon className="w-5 h-5" />
                    <span className="text-sm">Tổng đơn hàng</span>
                  </div>
                  <span className="font-medium">{profile.analytics.totalOrders}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-gray-600">
                    <CurrencyDollarIcon className="w-5 h-5" />
                    <span className="text-sm">Tổng chi tiêu</span>
                  </div>
                  <span className="font-medium text-green-600">
                    {formatCurrency(profile.analytics.totalSpent)}
                  </span>
                </div>
                
                {profile.analytics.favoriteCategory && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-gray-600">
                      <TagIcon className="w-5 h-5" />
                      <span className="text-sm">Danh mục yêu thích</span>
                    </div>
                    <span className="font-medium">{profile.analytics.favoriteCategory}</span>
                  </div>
                )}
                
                {profile.analytics.lastPurchaseDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Mua hàng gần nhất</span>
                    <span className="font-medium">
                      {formatDate(profile.analytics.lastPurchaseDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Editable Form */}
        <div className="md:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Thông tin cá nhân</h3>
              {editing && (
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    className="flex items-center space-x-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    <CheckIcon className="w-4 h-4" />
                    <span>Lưu</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex items-center space-x-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                  >
                    <XMarkIcon className="w-4 h-4" />
                    <span>Hủy</span>
                  </button>
                </div>
              )}
            </div>

            {/* Basic Information */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-1">
                  <UserIcon className="w-4 h-4" />
                  <span>Họ và tên</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-1">
                  <EnvelopeIcon className="w-4 h-4" />
                  <span>Email</span>
                </label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-1">
                  <PhoneIcon className="w-4 h-4" />
                  <span>Số điện thoại</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!editing}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-1">
                  <HomeIcon className="w-4 h-4" />
                  <span>Địa chỉ</span>
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={!editing}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
            </div>

            {/* Preferences */}
            <div className="border-t pt-6">
              <h4 className="font-semibold mb-4">Sở thích mua sắm</h4>
              
              {/* Size */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Kích cỡ thường mặc
                </label>
                <div className="flex flex-wrap gap-2">
                  {sizeOptions.map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => editing && setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, size }
                      })}
                      disabled={!editing}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        formData.preferences.size === size
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      } disabled:cursor-not-allowed`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Phong cách yêu thích
                </label>
                <div className="flex flex-wrap gap-2">
                  {styleOptions.map(style => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => editing && setFormData({
                        ...formData,
                        preferences: {
                          ...formData.preferences,
                          style: toggleArrayItem(formData.preferences.style, style)
                        }
                      })}
                      disabled={!editing}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        formData.preferences.style.includes(style)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      } disabled:cursor-not-allowed`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="mb-4">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
                  <SwatchIcon className="w-4 h-4" />
                  <span>Màu sắc yêu thích</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => editing && setFormData({
                        ...formData,
                        preferences: {
                          ...formData.preferences,
                          favoriteColors: toggleArrayItem(formData.preferences.favoriteColors, color)
                        }
                      })}
                      disabled={!editing}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        formData.preferences.favoriteColors.includes(color)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      } disabled:cursor-not-allowed`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Categories */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Danh mục quan tâm
                </label>
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map(category => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => editing && setFormData({
                        ...formData,
                        preferences: {
                          ...formData.preferences,
                          preferredCategories: toggleArrayItem(formData.preferences.preferredCategories, category)
                        }
                      })}
                      disabled={!editing}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        formData.preferences.preferredCategories.includes(category)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      } disabled:cursor-not-allowed`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Khoảng giá quan tâm
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Từ</label>
                    <input
                      type="number"
                      value={formData.preferences.priceRange.min}
                      onChange={(e) => editing && setFormData({
                        ...formData,
                        preferences: {
                          ...formData.preferences,
                          priceRange: {
                            ...formData.preferences.priceRange,
                            min: parseInt(e.target.value) || 0
                          }
                        }
                      })}
                      disabled={!editing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Đến</label>
                    <input
                      type="number"
                      value={formData.preferences.priceRange.max}
                      onChange={(e) => editing && setFormData({
                        ...formData,
                        preferences: {
                          ...formData.preferences,
                          priceRange: {
                            ...formData.preferences.priceRange,
                            max: parseInt(e.target.value) || 10000000
                          }
                        }
                      })}
                      disabled={!editing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;