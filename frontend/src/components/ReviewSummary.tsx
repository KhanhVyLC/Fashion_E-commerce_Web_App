// src/components/ReviewSummary.tsx
import React, { useState, useEffect } from 'react';
import axios from '../utils/axios';
import { 
  StarIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon
} from '@heroicons/react/24/solid';
import { 
  ChatBubbleLeftRightIcon,
  ClockIcon,
  TagIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface ReviewSummaryProps {
  productId: string;
}

interface Highlight {
  pros: string[];
  cons: string[];
}

interface Sentiment {
  type: string;
  label: string;
}

interface Keyword {
  word: string;
  count: number;
}

interface TimeTrend {
  month: string;
  averageRating: string;
  reviewCount: number;
}

interface AspectScore {
  score: string;
  count: number;
}

interface ReviewSummaryData {
  summary: string;
  highlights: Highlight;
  sentiment: Sentiment;
  keywords: Keyword[];
  totalReviews: number;
  averageRating: string;
  ratingDistribution: {
    [key: string]: number;
  };
  timeTrends?: TimeTrend[];
  aspectAnalysis?: {
    [key: string]: AspectScore;
  };
}

const ReviewSummary: React.FC<ReviewSummaryProps> = ({ productId }) => {
  const [summaryData, setSummaryData] = useState<ReviewSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'keywords'>('overview');

  useEffect(() => {
    fetchReviewSummary();
  }, [productId]);

  const fetchReviewSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await axios.get(`/reviews/product/${productId}/summary`);
      setSummaryData(data);
    } catch (error) {
      console.error('Error fetching review summary:', error);
      setError('Không thể tải tóm tắt đánh giá');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (type: string) => {
    switch (type) {
      case 'very_positive': return 'text-green-600 bg-green-100';
      case 'positive': return 'text-green-500 bg-green-50';
      case 'neutral': return 'text-gray-600 bg-gray-100';
      case 'negative': return 'text-orange-500 bg-orange-50';
      case 'very_negative': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAspectLabel = (aspect: string) => {
    const labels: { [key: string]: string } = {
      quality: 'Chất lượng',
      price: 'Giá cả',
      delivery: 'Giao hàng',
      service: 'Dịch vụ',
      packaging: 'Đóng gói'
    };
    return labels[aspect] || aspect;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (error || !summaryData) {
    return (
      <div className="bg-red-50 rounded-lg p-6 text-center">
        <p className="text-red-600">{error || 'Không có dữ liệu'}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <SparklesIcon className="h-5 w-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-900">Tóm tắt đánh giá AI</h3>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(summaryData.sentiment.type)}`}>
            {summaryData.sentiment.label}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Tổng quan
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'trends'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Xu hướng
        </button>
        <button
          onClick={() => setActiveTab('keywords')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'keywords'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          Từ khóa
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* AI Summary */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-1">Tóm tắt AI</p>
                  <p className="text-gray-700">{summaryData.summary}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="space-y-6">
            {summaryData.timeTrends && summaryData.timeTrends.length > 0 ? (
              <>
                <div>
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                    <ClockIcon className="h-5 w-5 mr-2 text-gray-600" />
                    Xu hướng đánh giá theo thời gian
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Tháng</th>
                          <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">Điểm TB</th>
                          <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">Số đánh giá</th>
                          <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">Xu hướng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryData.timeTrends.map((trend, index) => {
                          const prevRating = index > 0 
                            ? parseFloat(summaryData.timeTrends![index - 1].averageRating)
                            : parseFloat(trend.averageRating);
                          const currentRating = parseFloat(trend.averageRating);
                          const isUp = currentRating > prevRating;
                          const isDown = currentRating < prevRating;
                          
                          return (
                            <tr key={trend.month} className="border-b border-gray-100">
                              <td className="py-2 px-4 text-sm text-gray-900">
                                {new Date(trend.month + '-01').toLocaleDateString('vi-VN', {
                                  year: 'numeric',
                                  month: 'long'
                                })}
                              </td>
                              <td className="py-2 px-4 text-sm text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  <span className="font-medium">{trend.averageRating}</span>
                                  <StarIcon className="h-4 w-4 text-yellow-400" />
                                </div>
                              </td>
                              <td className="py-2 px-4 text-sm text-center text-gray-600">
                                {trend.reviewCount}
                              </td>
                              <td className="py-2 px-4 text-sm text-center">
                                {isUp && (
                                  <ArrowTrendingUpIcon className="h-5 w-5 text-green-500 mx-auto" />
                                )}
                                {isDown && (
                                  <ArrowTrendingDownIcon className="h-5 w-5 text-red-500 mx-auto" />
                                )}
                                {!isUp && !isDown && (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Chart visualization could be added here */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <ChartBarIcon className="h-5 w-5" />
                    <p>Biểu đồ xu hướng đánh giá sẽ được cập nhật trong phiên bản tiếp theo</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ClockIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Chưa có đủ dữ liệu để phân tích xu hướng</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'keywords' && (
          <div className="space-y-6">
            {summaryData.keywords && summaryData.keywords.length > 0 ? (
              <>
                <div>
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                    <TagIcon className="h-5 w-5 mr-2 text-gray-600" />
                    Từ khóa được nhắc đến nhiều nhất
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {summaryData.keywords.map((keyword) => {
                      const size = keyword.count > 10 ? 'text-lg' : keyword.count > 5 ? 'text-base' : 'text-sm';
                      const opacity = keyword.count > 10 ? 'opacity-100' : keyword.count > 5 ? 'opacity-80' : 'opacity-60';
                      
                      return (
                        <div
                          key={keyword.word}
                          className={`px-3 py-1 bg-blue-100 text-blue-700 rounded-full ${size} ${opacity} hover:opacity-100 transition-opacity cursor-default`}
                          title={`Xuất hiện ${keyword.count} lần`}
                        >
                          {keyword.word}
                          <span className="ml-1 text-xs text-blue-500">({keyword.count})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Word cloud visualization note */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    💡 <strong>Mẹo:</strong> Kích thước từ khóa phản ánh tần suất xuất hiện trong các đánh giá
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <TagIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Chưa có đủ dữ liệu từ khóa</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewSummary;
