// src/pages/admin/AdminReviews.tsx
import React, { useState, useEffect } from 'react';
import {
  Star,
  Trash2,
  Filter,
  User,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import axios from '../../utils/axios';

interface Review {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
  };
  product: {
    _id: string;
    name: string;
    images: string[];
  };
  rating: number;
  comment: string;
  images?: string[];
  createdAt: string;
}

const AdminReviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [productFilter, setProductFilter] = useState('');
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchReviews();
  }, [currentPage, productFilter]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/admin/reviews', {
        params: {
          page: currentPage,
          limit: 10,
          productId: productFilter
        }
      });
      setReviews(response.data.reviews);
      setTotalPages(response.data.pages);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa đánh giá này?')) {
      try {
        await axios.delete(`/admin/reviews/${reviewId}`);
        fetchReviews();
      } catch (error) {
        console.error('Error deleting review:', error);
      }
    }
  };

  const toggleExpandReview = (reviewId: string) => {
    const newExpanded = new Set(expandedReviews);
    if (newExpanded.has(reviewId)) {
      newExpanded.delete(reviewId);
    } else {
      newExpanded.add(reviewId);
    }
    setExpandedReviews(newExpanded);
  };

  const renderStars = (rating: number) => {
    return [...Array(5)].map((_, index) => (
      <Star
        key={index}
        className={`w-4 h-4 ${
          index < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (!text) return 'Không có nhận xét';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Quản lý đánh giá</h1>

      {/* Reviews Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sản phẩm
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Khách hàng
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Đánh giá
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nhận xét
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày
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
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    Không có đánh giá nào
                  </td>
                </tr>
              ) : (
                reviews.map((review) => {
                  const isExpanded = expandedReviews.has(review._id);
                  const hasLongComment = review.comment && review.comment.length > 100;
                  
                  return (
                    <React.Fragment key={review._id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <img
                              className="w-10 h-10 rounded object-cover mr-3 flex-shrink-0"
                              src={review.product.images[0]?.startsWith('http') 
                                ? review.product.images[0] 
                                : `http://localhost:5000${review.product.images[0]}`
                              }
                              alt={review.product.name}
                              onError={(e) => {
                                e.currentTarget.src = '/placeholder-image.png';
                              }}
                            />
                            <span className="text-sm font-medium text-gray-900 break-words">
                              {review.product.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                              <User className="w-5 h-5 text-gray-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 break-words">
                                {review.user.name}
                              </div>
                              <div className="text-sm text-gray-500 break-words">
                                {review.user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {renderStars(review.rating)}
                            <span className="ml-2 text-sm text-gray-600">
                              ({review.rating})
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-md">
                            <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                              {isExpanded ? (review.comment || 'Không có nhận xét') : truncateText(review.comment)}
                            </p>
                            {hasLongComment && (
                              <button
                                onClick={() => toggleExpandReview(review._id)}
                                className="mt-2 text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-4 h-4 mr-1" />
                                    Thu gọn
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-4 h-4 mr-1" />
                                    Xem thêm
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(review.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDelete(review._id)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                            title="Xóa đánh giá"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                      
                      {/* Review Images Row - if expanded and has images */}
                      {isExpanded && review.images && review.images.length > 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-gray-700">Hình ảnh đánh giá:</h4>
                              <div className="flex flex-wrap gap-2">
                                {review.images.map((image, index) => (
                                  <img
                                    key={index}
                                    src={image.startsWith('http') ? image : `http://localhost:5000${image}`}
                                    alt={`Review image ${index + 1}`}
                                    className="w-20 h-20 object-cover rounded border hover:scale-110 transition-transform cursor-pointer"
                                    onClick={() => {
                                      // Optional: Open image in new tab or modal
                                      window.open(image.startsWith('http') ? image : `http://localhost:5000${image}`, '_blank');
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i + 1}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 border rounded transition-colors ${
                currentPage === i + 1 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'hover:bg-gray-100'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminReviews;
