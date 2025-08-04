// src/hooks/useImagePreloader.ts - Clean Fixed version
import { useState, useCallback } from 'react';

interface PreloadOptions {
  priority?: 'high' | 'low'; // Only valid fetchPriority values
  quality?: number;
  width?: number;
  height?: number;
}

export const useImagePreloader = () => {
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const preloadImage = useCallback((src: string, options: PreloadOptions = {}) => {
    if (preloadedImages.has(src) || loadingImages.has(src) || failedImages.has(src)) {
      return Promise.resolve();
    }

    setLoadingImages(prev => new Set(prev).add(src));

    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      
      // Set loading priority for better performance
      if (options.priority === 'high') {
        img.loading = 'eager';
        // Check if fetchPriority is supported before setting
        if ('fetchPriority' in img) {
          (img as any).fetchPriority = 'high';
        }
      } else {
        img.loading = 'lazy';
        // Check if fetchPriority is supported before setting
        if ('fetchPriority' in img) {
          (img as any).fetchPriority = 'low';
        }
      }

      img.onload = () => {
        setPreloadedImages(prev => new Set(prev).add(src));
        setLoadingImages(prev => {
          const newSet = new Set(prev);
          newSet.delete(src);
          return newSet;
        });
        resolve();
      };

      img.onerror = () => {
        setFailedImages(prev => new Set(prev).add(src));
        setLoadingImages(prev => {
          const newSet = new Set(prev);
          newSet.delete(src);
          return newSet;
        });
        reject(new Error(`Failed to load image: ${src}`));
      };

      img.src = src;
    });
  }, [preloadedImages, loadingImages, failedImages]);

  const preloadImages = useCallback(async (
    urls: string[], 
    options: PreloadOptions = {},
    batchSize: number = 3 // Load images in batches to avoid overwhelming
  ) => {
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(url => preloadImage(url, options))
      );
      
      // Add small delay between batches to prevent blocking
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }, [preloadImage]);

  const isImagePreloaded = useCallback((src: string) => {
    return preloadedImages.has(src);
  }, [preloadedImages]);

  const isImageLoading = useCallback((src: string) => {
    return loadingImages.has(src);
  }, [loadingImages]);

  const hasImageFailed = useCallback((src: string) => {
    return failedImages.has(src);
  }, [failedImages]);

  const clearCache = useCallback(() => {
    setPreloadedImages(new Set());
    setLoadingImages(new Set());
    setFailedImages(new Set());
  }, []);

  return {
    preloadImage,
    preloadImages,
    isImagePreloaded,
    isImageLoading,
    hasImageFailed,
    clearCache,
    stats: {
      preloaded: preloadedImages.size,
      loading: loadingImages.size,
      failed: failedImages.size
    }
  };
};

// Extended version with more priority options for internal use
interface ExtendedPreloadOptions {
  priority?: 'high' | 'low' | 'auto'; // Match standard fetchPriority values
  quality?: number;
  width?: number;
  height?: number;
}

export const useExtendedImagePreloader = () => {
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const preloadImage = useCallback((src: string, options: ExtendedPreloadOptions = {}) => {
    if (preloadedImages.has(src) || loadingImages.has(src) || failedImages.has(src)) {
      return Promise.resolve();
    }

    setLoadingImages(prev => new Set(prev).add(src));

    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      
      // Set loading priority for better performance
      if (options.priority === 'high') {
        img.loading = 'eager';
      } else {
        img.loading = 'lazy';
      }

      // Set fetchPriority if supported
      if ('fetchPriority' in img) {
        (img as any).fetchPriority = options.priority || 'low';
      }

      img.onload = () => {
        setPreloadedImages(prev => new Set(prev).add(src));
        setLoadingImages(prev => {
          const newSet = new Set(prev);
          newSet.delete(src);
          return newSet;
        });
        resolve();
      };

      img.onerror = () => {
        setFailedImages(prev => new Set(prev).add(src));
        setLoadingImages(prev => {
          const newSet = new Set(prev);
          newSet.delete(src);
          return newSet;
        });
        reject(new Error(`Failed to load image: ${src}`));
      };

      img.src = src;
    });
  }, [preloadedImages, loadingImages, failedImages]);

  const preloadImages = useCallback(async (
    urls: string[], 
    options: ExtendedPreloadOptions = {},
    batchSize: number = 3
  ) => {
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(url => preloadImage(url, options))
      );
      
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }, [preloadImage]);

  const isImagePreloaded = useCallback((src: string) => {
    return preloadedImages.has(src);
  }, [preloadedImages]);

  const isImageLoading = useCallback((src: string) => {
    return loadingImages.has(src);
  }, [loadingImages]);

  const hasImageFailed = useCallback((src: string) => {
    return failedImages.has(src);
  }, [failedImages]);

  const clearCache = useCallback(() => {
    setPreloadedImages(new Set());
    setLoadingImages(new Set());
    setFailedImages(new Set());
  }, []);

  return {
    preloadImage,
    preloadImages,
    isImagePreloaded,
    isImageLoading,
    hasImageFailed,
    clearCache,
    stats: {
      preloaded: preloadedImages.size,
      loading: loadingImages.size,
      failed: failedImages.size
    }
  };
};