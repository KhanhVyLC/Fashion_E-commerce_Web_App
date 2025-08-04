// src/components/ReviewForm.tsx
import React, { useState } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline';
import axios from '../utils/axios'; // Import axios instance đã cấu hình

interface ReviewFormProps {
  productId: string;
  orderId: string;
  onSuccess: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ productId, orderId, onSuccess }) => {
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!comment.trim()) {
      setError('Vui lòng nhập nhận xét của bạn');
      return;
    }
    
    if (comment.trim().length < 10) {
      setError('Nhận xét phải có ít nhất 10 ký tự');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      // Sử dụng axios instance đã cấu hình
      const response = await axios.post('/reviews/create', {
        productId,
        orderId,
        rating,
        comment: comment.trim()
      });

      console.log('Review created:', response.data);
      
      // Reset form
      setRating(5);
      setComment('');
      
      // Call success callback
      onSuccess();
      
      // Show success message
      alert('Cảm ơn bạn đã đánh giá sản phẩm!');
    } catch (error: any) {
      console.error('Error submitting review:', error);
      
      // Handle specific error messages
      if (error.response?.status === 401) {
        setError('Vui lòng đăng nhập để đánh giá');
      } else if (error.response?.status === 400) {
        setError(error.response.data.message || 'Có lỗi xảy ra khi gửi đánh giá');
      } else {
        setError('Không thể gửi đánh giá. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getRatingText = (rating: number) => {
    switch (rating) {
      case 1: return 'Rất không hài lòng';
      case 2: return 'Không hài lòng';
      case 3: return 'Bình thường';
      case 4: return 'Hài lòng';
      case 5: return 'Rất hài lòng';
      default: return '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Đánh giá sản phẩm</h3>

      {/* Rating Stars */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mức độ hài lòng
        </label>
        <div className="flex items-center space-x-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              {star <= (hoveredRating || rating) ? (
                <StarIcon className="h-8 w-8 text-yellow-400" />
              ) : (
                <StarOutlineIcon className="h-8 w-8 text-gray-300" />
              )}
            </button>
          ))}
          <span className="ml-3 text-sm text-gray-600">
            {getRatingText(hoveredRating || rating)}
          </span>
        </div>
      </div>

      {/* Comment Textarea */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nhận xét của bạn
          <span className="text-red-500 ml-1">*</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setError(''); // Clear error when user types
          }}
          rows={4}
          className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..."
          disabled={loading}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">
            {comment.length}/500 ký tự
          </span>
          {comment.length < 10 && comment.length > 0 && (
            <span className="text-xs text-red-500">
              Cần ít nhất {10 - comment.length} ký tự nữa
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || comment.trim().length < 10}
        className={`w-full py-3 px-4 rounded-md font-medium transition-all duration-200 ${
          loading || comment.trim().length < 10
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg transform hover:-translate-y-0.5'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Đang gửi đánh giá...
          </span>
        ) : (
          'Gửi đánh giá'
        )}
      </button>

      {/* Guidelines */}
      <div className="mt-4 p-3 bg-gray-50 rounded-md">
        <p className="text-xs text-gray-600 font-medium mb-2">Hướng dẫn đánh giá:</p>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>• Đánh giá trung thực về trải nghiệm của bạn</li>
          <li>• Nhận xét cần ít nhất 10 ký tự</li>
          <li>• Tránh sử dụng ngôn từ không phù hợp</li>
          <li>• Bạn chỉ có thể đánh giá sản phẩm đã mua và nhận hàng</li>
        </ul>
      </div>
    </form>
  );
};

export default ReviewForm;