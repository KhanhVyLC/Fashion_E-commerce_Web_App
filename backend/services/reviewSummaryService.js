// backend/services/reviewSummaryService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

class ReviewSummaryService {
  constructor() {
    // Khởi tạo Gemini API
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    
    // Debug logging
    console.log('ReviewSummaryService initializing...');
    console.log('Environment check:');
    console.log('   - NODE_ENV:', process.env.NODE_ENV || 'not set');
    console.log('   - GEMINI_API_KEY:', this.geminiApiKey ? `${this.geminiApiKey.substring(0, 10)}...` : ' NOT FOUND');
    
    if (this.geminiApiKey && this.geminiApiKey !== 'YOUR_API_KEY_HERE') {
      try {
        this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log('Gemini AI initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Gemini:', error.message);
        this.model = null;
      }
    } else {
      console.warn('Gemini API key not configured - AI summaries disabled');
      console.log('To enable AI summaries:');
      console.log('1. Get API key from https://makersuite.google.com/app/apikey');
      console.log('2. Add to .env file: GEMINI_API_KEY=your_key_here');
      this.model = null;
    }
  }

  async summarizeReviews(reviews) {
    try {
      if (!reviews || reviews.length === 0) {
        return this.getEmptyResponse();
      }

      console.log(`Summarizing ${reviews.length} reviews...`);

      // 1. Tính metrics cơ bản
      const metrics = this.calculateMetrics(reviews);
      
      // 2. Phân tích sentiment
      const sentiment = this.analyzeSentiment(metrics.averageRating, reviews);
      
      // 3. Trích xuất highlights
      const highlights = this.extractHighlights(reviews);
      
      // 4. Gọi Gemini API để tóm tắt
      let aiSummary = '';
      if (this.model && this.geminiApiKey) {
        try {
          aiSummary = await this.generateGeminiSummary(reviews, metrics);
          console.log('AI Summary generated successfully');
        } catch (error) {
          console.warn('AI summary failed, using rule-based fallback:', error.message);
          aiSummary = this.generateRuleBasedSummary(reviews, metrics);
        }
      } else {
        console.log('Using rule-based summary (AI not configured)');
        aiSummary = this.generateRuleBasedSummary(reviews, metrics);
      }
      
      // 5. Tạo summary cuối cùng
      const finalSummary = this.createFinalSummary(aiSummary, metrics, sentiment);
      
      // 6. Trích xuất keywords
      const keywords = this.extractKeywords(reviews);
      
      // 7. Phân tích theo thời gian
      const timeTrends = this.analyzeTimeTrends(reviews);
      
      // 8. Phân tích theo khía cạnh
      const aspectAnalysis = this.analyzeAspects(reviews);

      return {
        summary: finalSummary,
        highlights,
        sentiment,
        keywords,
        totalReviews: reviews.length,
        averageRating: metrics.averageRating.toString(),
        timeTrends,
        aspectAnalysis
      };
    } catch (error) {
      console.error('Error in summarizeReviews:', error);
      return this.getFallbackSummary(reviews);
    }
  }

  // Gọi Gemini API để tóm tắt
  async generateGeminiSummary(reviews, metrics) {
    // Double check
    if (!this.model || !this.geminiApiKey) {
      throw new Error('Gemini not initialized');
    }

    try {
      // Chuẩn bị dữ liệu cho Gemini
      const reviewTexts = reviews
        .filter(r => r.comment && r.comment.length > 20)
        .slice(0, 10) // Lấy tối đa 10 reviews
        .map(r => `[${r.rating} sao] ${r.comment}`)
        .join('\n');

      if (!reviewTexts) {
        throw new Error('No valid review texts to summarize');
      }

      // Tạo prompt cho Gemini
      const prompt = `
Bạn là một chuyên gia phân tích đánh giá sản phẩm. Hãy tóm tắt các đánh giá sau đây thành một đoạn văn ngắn gọn, súc tích bằng tiếng Việt.

Thông tin tổng quan:
- Tổng số đánh giá: ${metrics.totalReviews}
- Điểm trung bình: ${metrics.averageRating}/5
- Phân bố: ${Object.entries(metrics.distribution).map(([star, count]) => `${star} sao: ${count}`).join(', ')}

Các đánh giá chi tiết:
${reviewTexts}

Yêu cầu:
1. Tóm tắt trong 2-3 câu
2. Nêu rõ điểm mạnh và điểm yếu (nếu có)
3. Đưa ra nhận xét tổng quan về sản phẩm
4. Sử dụng ngôn ngữ tự nhiên, dễ hiểu
5. KHÔNG đề cập đến số liệu cụ thể (vì đã có ở phần khác)

Tóm tắt:`;

      console.log('Calling Gemini API...');
      
      // Gọi Gemini API với timeout
      const result = await Promise.race([
        this.model.generateContent(prompt),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Gemini API timeout')), 15000)
        )
      ]);
      
      const response = await result.response;
      const summary = response.text();
      
      // Làm sạch kết quả
      const cleaned = summary
        .trim()
        .replace(/\*\*/g, '') // Xóa markdown bold
        .replace(/\n+/g, ' ') // Thay xuống dòng bằng space
        .replace(/\s+/g, ' ') // Chuẩn hóa khoảng trắng
        .replace(/^Tóm tắt:?\s*/i, ''); // Xóa "Tóm tắt:" nếu có
      
      if (cleaned.length < 20) {
        throw new Error('Generated summary too short');
      }
      
      return cleaned;
    } catch (error) {
      console.error('Gemini API error:', error.message);
      if (error.message.includes('API_KEY_INVALID')) {
        console.error('Invalid API key - please check your GEMINI_API_KEY');
      } else if (error.message.includes('RATE_LIMIT_EXCEEDED')) {
        console.error('Rate limit exceeded - please wait and try again');
      }
      throw error;
    }
  }

  // Tạo summary cuối cùng
  createFinalSummary(aiSummary, metrics, sentiment) {
    let finalSummary = '';
    
    // Thông tin cơ bản
    finalSummary += `Sản phẩm có ${metrics.totalReviews} đánh giá với điểm trung bình ${metrics.averageRating}/5. `;
    
    // Thêm phân tích phân bố
    const highRatings = metrics.distribution['5'] + metrics.distribution['4'];
    const percentage = Math.round((highRatings / metrics.totalReviews) * 100);
    finalSummary += `${percentage}% khách hàng đánh giá tích cực. `;
    
    // Thêm AI summary nếu có
    if (aiSummary && aiSummary.length > 20) {
      finalSummary += aiSummary;
    } else {
      // Fallback nếu không có AI summary
      if (sentiment.type === 'very_positive' || sentiment.type === 'positive') {
        finalSummary += 'Phần lớn khách hàng hài lòng với chất lượng sản phẩm và dịch vụ. ';
      } else if (sentiment.type === 'negative' || sentiment.type === 'very_negative') {
        finalSummary += 'Một số khách hàng chưa hài lòng với sản phẩm, cần cải thiện chất lượng. ';
      } else {
        finalSummary += 'Sản phẩm nhận được đánh giá đa dạng từ khách hàng. ';
      }
    }
    
    return finalSummary;
  }

  // Các hàm phụ trợ (giữ nguyên)
  calculateMetrics(reviews) {
    const distribution = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    let totalRating = 0;

    reviews.forEach(review => {
      distribution[review.rating]++;
      totalRating += review.rating;
    });

    return {
      totalReviews: reviews.length,
      averageRating: (totalRating / reviews.length).toFixed(1),
      distribution
    };
  }

  analyzeSentiment(avgRating, reviews) {
    if (avgRating >= 4.5) return { type: 'very_positive', label: 'Rất tích cực' };
    if (avgRating >= 3.5) return { type: 'positive', label: 'Tích cực' };
    if (avgRating >= 2.5) return { type: 'neutral', label: 'Trung bình' };
    if (avgRating >= 1.5) return { type: 'negative', label: 'Tiêu cực' };
    return { type: 'very_negative', label: 'Rất tiêu cực' };
  }

  extractHighlights(reviews) {
    const highlights = { pros: [], cons: [] };
    
    // Lấy điểm tích cực từ reviews 4-5 sao
    const goodReviews = reviews
      .filter(r => r.rating >= 4 && r.comment && r.comment.length > 20)
      .sort((a, b) => b.rating - a.rating);
      
    goodReviews.slice(0, 3).forEach(review => {
      const sentences = review.comment.split(/[.!?]/).filter(s => s.trim().length > 10);
      if (sentences.length > 0) {
        highlights.pros.push(sentences[0].trim());
      }
    });
    
    // Lấy điểm tiêu cực từ reviews 1-2 sao
    const badReviews = reviews
      .filter(r => r.rating <= 2 && r.comment && r.comment.length > 20)
      .sort((a, b) => a.rating - b.rating);
      
    badReviews.slice(0, 3).forEach(review => {
      const sentences = review.comment.split(/[.!?]/).filter(s => s.trim().length > 10);
      if (sentences.length > 0) {
        highlights.cons.push(sentences[0].trim());
      }
    });
    
    return highlights;
  }

  extractKeywords(reviews) {
    const wordFreq = {};
    const stopWords = new Set([
      'và', 'là', 'của', 'có', 'được', 'cho', 'với', 'này', 'khi', 'để',
      'từ', 'trong', 'rất', 'cũng', 'nên', 'vì', 'do', 'nếu', 'thì',
      'mình', 'tôi', 'sản', 'phẩm', 'mua', 'hàng', 'nhưng', 'như',
      'một', 'những', 'các', 'đã', 'sẽ', 'về', 'cái', 'đến', 'không',
      'bạn', 'này', 'đó', 'vậy', 'thế', 'nó', 'ấy', 'họ', 'ta'
    ]);

    reviews.forEach(review => {
      if (review.comment) {
        const words = review.comment
          .toLowerCase()
          .replace(/[.,!?;:()]/g, '')
          .split(/\s+/)
          .filter(word => 
            word.length > 2 && 
            !stopWords.has(word) && 
            !word.match(/^\d+$/)
          );

        words.forEach(word => {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
      }
    });

    return Object.entries(wordFreq)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));
  }

  analyzeTimeTrends(reviews) {
    const monthlyData = {};
    
    reviews.forEach(review => {
      if (!review.createdAt) return;
      
      const month = new Date(review.createdAt).toISOString().substring(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = { count: 0, totalRating: 0 };
      }
      monthlyData[month].count++;
      monthlyData[month].totalRating += review.rating;
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        averageRating: (data.totalRating / data.count).toFixed(1),
        reviewCount: data.count
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  analyzeAspects(reviews) {
    const aspects = {
      quality: { keywords: ['chất lượng', 'bền', 'tốt', 'xấu', 'kém', 'đẹp'], ratings: [] },
      price: { keywords: ['giá', 'rẻ', 'đắt', 'hợp lý', 'tiền'], ratings: [] },
      delivery: { keywords: ['giao', 'ship', 'nhanh', 'chậm', 'vận chuyển'], ratings: [] },
      service: { keywords: ['phục vụ', 'hỗ trợ', 'tư vấn', 'chăm sóc'], ratings: [] },
      packaging: { keywords: ['đóng gói', 'bao bì', 'gói hàng'], ratings: [] }
    };

    reviews.forEach(review => {
      if (!review.comment) return;
      const comment = review.comment.toLowerCase();

      Object.entries(aspects).forEach(([aspect, data]) => {
        if (data.keywords.some(keyword => comment.includes(keyword))) {
          data.ratings.push(review.rating);
        }
      });
    });

    const aspectScores = {};
    Object.entries(aspects).forEach(([aspect, data]) => {
      if (data.ratings.length > 0) {
        const avg = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
        aspectScores[aspect] = {
          score: avg.toFixed(1),
          count: data.ratings.length
        };
      }
    });

    return aspectScores;
  }

  // Tạo summary dựa trên rules khi AI fail
  generateRuleBasedSummary(reviews, metrics) {
    const positiveReviews = reviews.filter(r => r.rating >= 4);
    const negativeReviews = reviews.filter(r => r.rating <= 2);
    
    let summary = '';
    
    // Phân tích điểm mạnh
    if (positiveReviews.length > 0) {
      const commonPositives = this.findCommonThemes(positiveReviews);
      if (commonPositives.length > 0) {
        summary += `Khách hàng đánh giá cao về ${commonPositives.join(', ')}. `;
      } else {
        summary += 'Nhiều khách hàng hài lòng với sản phẩm. ';
      }
    }
    
    // Phân tích điểm yếu
    if (negativeReviews.length > 0) {
      const commonNegatives = this.findCommonThemes(negativeReviews);
      if (commonNegatives.length > 0) {
        summary += `Một số khách hàng chưa hài lòng về ${commonNegatives.join(', ')}. `;
      } else if (negativeReviews.length >= 2) {
        summary += 'Một số khách hàng gặp vấn đề với sản phẩm. ';
      }
    }
    
    // Kết luận
    if (metrics.averageRating >= 4) {
      summary += 'Đây là sản phẩm được đánh giá cao và đáng tin cậy.';
    } else if (metrics.averageRating >= 3) {
      summary += 'Sản phẩm phù hợp với nhiều khách hàng.';
    } else {
      summary += 'Cần cân nhắc kỹ trước khi mua sản phẩm này.';
    }
    
    return summary;
  }

  // Tìm chủ đề chung trong reviews
  findCommonThemes(reviews) {
    const themes = {
      'chất lượng': ['chất lượng', 'quality', 'tốt', 'bền', 'đẹp', 'xịn'],
      'giá cả': ['giá', 'price', 'rẻ', 'đắt', 'hợp lý', 'tiền'],
      'giao hàng': ['giao', 'ship', 'delivery', 'nhanh', 'chậm', 'vận chuyển'],
      'dịch vụ': ['phục vụ', 'service', 'hỗ trợ', 'tư vấn', 'shop'],
      'đóng gói': ['đóng gói', 'package', 'bao bì', 'gói']
    };
    
    const foundThemes = [];
    
    Object.entries(themes).forEach(([theme, keywords]) => {
      const count = reviews.filter(r => 
        r.comment && keywords.some(kw => 
          r.comment.toLowerCase().includes(kw)
        )
      ).length;
      
      if (count >= Math.max(2, reviews.length * 0.3)) {
        foundThemes.push(theme);
      }
    });
    
    return foundThemes;
  }

  getEmptyResponse() {
    return {
      summary: 'Chưa có đánh giá nào cho sản phẩm này.',
      highlights: { pros: [], cons: [] },
      sentiment: { type: 'neutral', label: 'Chưa có dữ liệu' },
      keywords: [],
      totalReviews: 0,
      averageRating: '0',
      timeTrends: [],
      aspectAnalysis: {}
    };
  }

  getFallbackSummary(reviews) {
    if (!reviews || reviews.length === 0) {
      return this.getEmptyResponse();
    }
    
    const metrics = this.calculateMetrics(reviews);
    const sentiment = this.analyzeSentiment(metrics.averageRating, reviews);
    const ruleBasedSummary = this.generateRuleBasedSummary(reviews, metrics);
    
    return {
      summary: this.createFinalSummary(ruleBasedSummary, metrics, sentiment),
      highlights: this.extractHighlights(reviews),
      sentiment: sentiment,
      keywords: this.extractKeywords(reviews),
      totalReviews: metrics.totalReviews,
      averageRating: metrics.averageRating,
      timeTrends: this.analyzeTimeTrends(reviews),
      aspectAnalysis: this.analyzeAspects(reviews)
    };
  }
}

// Export singleton instance
module.exports = new ReviewSummaryService();