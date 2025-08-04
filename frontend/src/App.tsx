// src/App.tsx - Fixed to allow public browsing
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

// Client Components
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';

// Client Pages
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderHistory from './pages/OrderHistory';
import Login from './pages/Login';
import Register from './pages/Register';
import Wishlist from './pages/Wishlist';
import ViewHistory from './pages/ViewHistory';
import Chat from './pages/Chat';
import Profile from './pages/Profile';


// Admin Components
import AdminLayout from './components/admin/AdminLayout';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminReviews from './pages/admin/AdminReviews';
import AdminRecommendations from './pages/admin/AdminRecommendations';

const queryClient = new QueryClient();

// Component for pages with navbar (both authenticated and public)
const PageWithNavbar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

// Component for protected pages that require authentication
const ProtectedPageWithNavbar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <PageWithNavbar>
      {children}
    </PageWithNavbar>
  );
};

// Auth pages without navbar
const AuthPage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <Router>
            <Routes>
              {/* PUBLIC ROUTES - No authentication required */}
              
              {/* Home page - accessible to everyone */}
              <Route path="/" element={
                <PageWithNavbar>
                  <Home />
                </PageWithNavbar>
              } />
              
              {/* Product detail - accessible to everyone */}
              <Route path="/product/:id" element={
                <PageWithNavbar>
                  <ProductDetail />
                </PageWithNavbar>
              } />
              
              {/* Auth pages */}
              <Route path="/login" element={
                <AuthPage>
                  <Login />
                </AuthPage>
              } />
              
              <Route path="/register" element={
                <AuthPage>
                  <Register />
                </AuthPage>
              } />

              {/* PROTECTED ROUTES - Require authentication */}
              
              <Route path="/cart" element={
                <ProtectedPageWithNavbar>
                  <Cart />
                </ProtectedPageWithNavbar>
              } />
              
              <Route path="/checkout" element={
                <ProtectedPageWithNavbar>
                  <Checkout />
                </ProtectedPageWithNavbar>
              } />
              
              <Route path="/orders" element={
                <ProtectedPageWithNavbar>
                  <OrderHistory />
                </ProtectedPageWithNavbar>
              } />
              
              <Route path="/wishlist" element={
                <ProtectedPageWithNavbar>
                  <Wishlist />
                </ProtectedPageWithNavbar>
              } />
              
              <Route path="/view-history" element={
                <ProtectedPageWithNavbar>
                  <ViewHistory />
                </ProtectedPageWithNavbar>
              } />
              
              <Route path="/chat" element={
                <ProtectedPageWithNavbar>
                  <Chat />
                </ProtectedPageWithNavbar>
              } />
              
              <Route path="/profile" element={
                <ProtectedPageWithNavbar>
                  <Profile />
                </ProtectedPageWithNavbar>
              } />

              {/* ADMIN ROUTES */}
              <Route path="/admin/login" element={<AdminLogin />} />
              
              <Route path="/admin" element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="customers" element={<AdminCustomers />} />
                  <Route path="reviews" element={<AdminReviews />} />
                  <Route path="chat" element={<Chat />} />
                  <Route path="recommendations" element={<AdminRecommendations />} />
                </Route>
              </Route>

              {/* Fallback for unknown routes */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;