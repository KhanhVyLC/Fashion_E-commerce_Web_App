// src/context/AuthContext.tsx - Updated with activity tracking
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from '../utils/axios';
import userActivityService from '../services/userActivityService';

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role?: string;
  token?: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, phone: string, address: string) => Promise<User>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (storedUser && token) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post('/auth/login', { email, password });
      
      const userData = response.data;
      
      // Add isAdmin flag based on email or role
      if (userData.email === 'admin@gmail.com' || userData.role === 'admin') {
        userData.isAdmin = true;
      }
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', userData.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
      
      // Track login activity
      try {
        await userActivityService.trackLogin();
        userActivityService.trackPageView(window.location.pathname);
      } catch (error) {
        console.error('Failed to track login activity:', error);
      }
      
      return userData;
    } catch (error) {
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string, phone: string, address: string) => {
    try {
      const response = await axios.post('/auth/register', { 
        name, 
        email, 
        password,
        phone,
        address
      });
      
      const userData = response.data;
      
      // Add isAdmin flag based on email or role
      if (userData.email === 'admin@gmail.com' || userData.role === 'admin') {
        userData.isAdmin = true;
      }
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', userData.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
      
      // Track registration as login
      try {
        await userActivityService.trackLogin();
        userActivityService.trackPageView(window.location.pathname);
      } catch (error) {
        console.error('Failed to track registration activity:', error);
      }
      
      return userData;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    // Clean up activity tracking
    try {
      await userActivityService.cleanup();
    } catch (error) {
      console.error('Failed to cleanup activity service:', error);
    }
    
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    delete axios.defaults.headers.common['Authorization'];
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};