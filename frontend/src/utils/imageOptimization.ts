// src/utils/imageOptimization.ts
export class ImageOptimizer {
  static getOptimizedUrl(url: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  } = {}) {
    const { width, height, quality = 80, format = 'webp' } = options;
    
    // For Unsplash images
    if (url.includes('unsplash.com')) {
      const params = new URLSearchParams();
      if (width) params.append('w', width.toString());
      if (height) params.append('h', height.toString());
      params.append('q', quality.toString());
      params.append('fm', format);
      params.append('auto', 'format');
      
      return `${url}&${params.toString()}`;
    }
    
    // For local images, return as is (implement CDN logic here if needed)
    return url;
  }
  
  static preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
  }
}