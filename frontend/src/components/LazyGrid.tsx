// src/components/LazyGrid.tsx - Virtualized grid for better performance
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import ProductCard from './ProductCard';

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  rating: number;
  totalReviews: number;
}

interface LazyGridProps {
  products: Product[];
  columns?: number;
  itemWidth?: number;
  itemHeight?: number;
  gap?: number;
  onProductView?: (productId: string, duration: number) => void;
  onAddToCart?: (productId: string) => void;
  onToggleWishlist?: (productId: string, isWishlisted: boolean) => void;
}

const LazyGrid: React.FC<LazyGridProps> = ({
  products,
  columns = 4,
  itemWidth = 280,
  itemHeight = 400,
  gap = 16,
  onProductView,
  onAddToCart,
  onToggleWishlist
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 600 });

  // Responsive columns
  const responsiveColumns = useMemo(() => {
    if (containerSize.width < 640) return 1;
    if (containerSize.width < 768) return 2;
    if (containerSize.width < 1024) return 3;
    return columns;
  }, [containerSize.width, columns]);

  // Calculate grid dimensions
  const columnCount = responsiveColumns;
  const rowCount = Math.ceil(products.length / columnCount);
  const columnWidth = (containerSize.width - (gap * (columnCount - 1))) / columnCount;

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setContainerSize(prev => ({ ...prev, width }));
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Grid item renderer
  const GridItem = useCallback(({ columnIndex, rowIndex, style }: any) => {
    const productIndex = rowIndex * columnCount + columnIndex;
    const product = products[productIndex];

    if (!product) return null;

    return (
      <div style={{
        ...style,
        left: style.left + gap / 2,
        top: style.top + gap / 2,
        width: style.width - gap,
        height: style.height - gap,
      }}>
        <ProductCard
          product={product}
          onProductView={onProductView}
          onAddToCart={onAddToCart}
          onToggleWishlist={onToggleWishlist}
        />
      </div>
    );
  }, [products, columnCount, gap, onProductView, onAddToCart, onToggleWishlist]);

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Không có sản phẩm nào</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      {containerSize.width > 0 && (
        <Grid
          columnCount={columnCount}
          columnWidth={columnWidth}
          height={Math.min(rowCount * (itemHeight + gap), 1200)} // Max height
          rowCount={rowCount}
          rowHeight={itemHeight + gap}
          width={containerSize.width}
          overscanRowCount={2} // Render 2 extra rows for smooth scrolling
          overscanColumnCount={1}
        >
          {GridItem}
        </Grid>
      )}
    </div>
  );
};

export default LazyGrid;