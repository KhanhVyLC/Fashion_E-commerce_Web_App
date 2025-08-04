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
  };
  quantity: number;
  size: string;
  color: string;
  price: number;
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addToCart: (productId: string, quantity: number, size: string, color: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => void;
  fetchCart: () => Promise<void>;
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
  const { user } = useAuth();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const fetchCart = async () => {
    if (!user) return;
    try {
      const { data } = await axios.get('/cart');
      setItems(data.items || []);
    } catch (error) {
      console.error('Error fetching cart:', error);
      setItems([]);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCart();
    } else {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const addToCart = async (productId: string, quantity: number, size: string, color: string) => {
    try {
      const { data } = await axios.post('/cart/add', {
        productId,
        quantity,
        size,
        color,
      });
      setItems(data.items || []);
    } catch (error: any) {
      throw error;
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      const { data } = await axios.put(`/cart/update/${itemId}`, {
        quantity,
      });
      setItems(data.items || []);
    } catch (error: any) {
      throw error;
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      const { data } = await axios.delete(`/cart/remove/${itemId}`);
      setItems(data.items || []);
    } catch (error: any) {
      throw error;
    }
  };

  const clearCart = () => {
    setItems([]);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        totalPrice,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        fetchCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};