// src/components/AdminRoute.tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminRoute: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user.email !== 'admin@gmail.com') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
