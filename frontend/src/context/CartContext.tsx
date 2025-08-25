// src/context/CartContext.tsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from '../utils/axios';
import { useAuth } from './AuthContext';

interface CartItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    price: number;
    images: string[];
    category?: string;
    brand?: string;
  };
  quantity: number;
  size: string;
  color: string;
  price: number; // This is the actual price (could be flash sale price)
  originalPrice?: number; // Original price before flash sale
  isFlashSaleItem?: boolean;
  discountPercentage?: number;
  flashSaleInfo?: {
    saleName: string;
    discountPrice: number;
    endDate: Date;
    addedAt: Date;
  };
  subtotal?: number;
  savings?: number;
}

interface CartData {
  items: CartItem[];
  totalPrice: number;
  totalDiscount: number;
  finalPrice: number;
  itemCount: number;
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  totalDiscount: number;
  addToCart: (productId: string, quantity: number, size: string, color: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => void;
  fetchCart: () => Promise<void>;
  loading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Calculate total items
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  
  // Calculate total price using the actual price (which includes flash sale price)
  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const fetchCart = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data } = await axios.get('/cart');
      
      // The backend returns formatted cart with all flash sale info
      if (data.items) {
        setItems(data.items);
        setTotalDiscount(data.totalDiscount || 0);
      } else {
        setItems([]);
        setTotalDiscount(0);
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
      setItems([]);
      setTotalDiscount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCart();
    } else {
      setItems([]);
      setTotalDiscount(0);
    }
  }, [user]);

  const addToCart = async (productId: string, quantity: number, size: string, color: string) => {
    try {
      const { data } = await axios.post('/cart/add', {
        productId,
        quantity,
        size,
        color,
      });
      
      // Update cart with response data
      if (data.cart) {
        setItems(data.cart.items || []);
        setTotalDiscount(data.cart.totalDiscount || 0);
      }
    } catch (error: any) {
      throw error;
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      const { data } = await axios.put(`/cart/update/${itemId}`, {
        quantity,
      });
      
      // Update cart with response data
      if (data.cart) {
        setItems(data.cart.items || []);
        setTotalDiscount(data.cart.totalDiscount || 0);
      }
    } catch (error: any) {
      throw error;
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      const { data } = await axios.delete(`/cart/remove/${itemId}`);
      
      // Update cart with response data
      if (data.cart) {
        setItems(data.cart.items || []);
        setTotalDiscount(data.cart.totalDiscount || 0);
      }
    } catch (error: any) {
      throw error;
    }
  };

  const clearCart = () => {
    setItems([]);
    setTotalDiscount(0);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        totalPrice,
        totalDiscount,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        fetchCart,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
