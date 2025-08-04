// src/components/ImageWithFallback.tsx - Component với fallback và skeleton loading
import React, { useState, useRef, useEffect } from 'react';
import { useImagePreloader } from '../hooks/useImagePreloader';

interface ImageWithFallbackProps {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  skeletonClassName?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  priority?: 'high' | 'medium' | 'low';
  onLoad?: () => void;
  onError?: () => void;
  showSkeleton?: boolean;
}

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  fallbackSrc = '/placeholder.jpg',
  alt,
  className = '',
  skeletonClassName = '',
  width,
  height,
  loading = 'lazy',
  priority = 'medium',
  onLoad,
  onError,
  showSkeleton = true
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);
  const { isImagePreloaded, preloadImage } = useImagePreloader();

  // Check if image is already preloaded
  useEffect(() => {
    if (isImagePreloaded(src)) {
      setImageLoaded(true);
    } else if (priority === 'high') {
      // Preload high priority images immediately
      preloadImage(src, { priority });
    }
  }, [src, isImagePreloaded, preloadImage, priority]);

  const handleLoad = () => {
    setImageLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    if (currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setImageError(false); // Reset error state for fallback
    } else {
      setImageError(true);
      onError?.();
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Skeleton Loading */}
      {showSkeleton && !imageLoaded && !imageError && (
        <div className={`absolute inset-0 bg-gray-200 animate-pulse ${skeletonClassName}`}>
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        </div>
      )}

      {/* Error State */}
      {imageError && (
        <div className={`absolute inset-0 bg-gray-100 flex items-center justify-center ${skeletonClassName}`}>
          <div className="text-center text-gray-400">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs">Lỗi tải ảnh</span>
          </div>
        </div>
      )}

      {/* Actual Image */}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        loading={loading}
        width={width}
        height={height}
        onLoad={handleLoad}
        onError={handleError}
        decoding="async"
        style={{ aspectRatio: width && height ? `${width}/${height}` : undefined }}
      />
    </div>
  );
};

export default ImageWithFallback;