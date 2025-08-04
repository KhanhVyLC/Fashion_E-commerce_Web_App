import React, { useState } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  category: string;
  brand: string;
  rating: number;
  features?: string[];
}

interface ProductComparisonProps {
  products: Product[];
  onClose: () => void;
}

const ProductComparison: React.FC<ProductComparisonProps> = ({ products, onClose }) => {
  const features = [
    'Giá',
    'Đánh giá',
    'Thương hiệu',
    'Danh mục',
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">So sánh sản phẩm</h2>
          <button onClick={onClose}>
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product._id} className="text-center">
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
                <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
              </div>
            ))}
          </div>

          <table className="w-full mt-6">
            <tbody>
              <tr className="border-t">
                <td className="py-3 font-medium">Giá</td>
                {products.map((product) => (
                  <td key={product._id} className="py-3 text-center">
                    <span className="text-xl font-bold text-red-600">
                      {product.price.toLocaleString('vi-VN')}₫
                    </span>
                  </td>
                ))}
              </tr>
              
              <tr className="border-t">
                <td className="py-3 font-medium">Đánh giá</td>
                {products.map((product) => (
                  <td key={product._id} className="py-3 text-center">
                    <div className="flex justify-center items-center">
                      <span className="text-yellow-500 mr-1">★</span>
                      {product.rating.toFixed(1)}
                    </div>
                  </td>
                ))}
              </tr>
              
              <tr className="border-t">
                <td className="py-3 font-medium">Thương hiệu</td>
                {products.map((product) => (
                  <td key={product._id} className="py-3 text-center">
                    {product.brand}
                  </td>
                ))}
              </tr>
              
              <tr className="border-t">
                <td className="py-3 font-medium">Danh mục</td>
                {products.map((product) => (
                  <td key={product._id} className="py-3 text-center">
                    {product.category}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductComparison;