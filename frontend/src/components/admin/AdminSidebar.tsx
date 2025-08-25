// src/components/admin/AdminSidebar.tsx - Updated with Voucher menu
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Star,
  MessageSquare,
  ChartBarIcon,
  Gift,
  LogOut,
  Flame
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AdminSidebarProps {
  isOpen: boolean;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen }) => {
  const { logout } = useAuth();

  const menuItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/products', icon: Package, label: 'Sản phẩm' },
    { path: '/admin/orders', icon: ShoppingCart, label: 'Đơn hàng' },
    { path: '/admin/customers', icon: Users, label: 'Khách hàng' },
    { path: '/admin/vouchers', icon: Gift, label: 'Voucher' },
    { path: '/admin/reviews', icon: Star, label: 'Đánh giá' },
    { path: '/admin/recommendations', icon: ChartBarIcon, label: 'Quản lý đề xuất' },
    { path: '/admin/chat', icon: MessageSquare, label: 'Chat' },
    { path: '/admin/flash-sales', icon: Flame, label: 'Flash Sale' },
  ];

  return (
    <div className={`${isOpen ? 'w-64' : 'w-20'} bg-gray-800 transition-all duration-300`}>
      <div className="flex items-center justify-center h-16 bg-gray-900">
        <h1 className={`text-white font-bold ${isOpen ? 'text-xl' : 'text-sm'}`}>
          {isOpen ? 'Fashion Admin' : 'FA'}
        </h1>
      </div>
      <nav className="mt-8">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-6 py-3 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors ${
                isActive ? 'bg-gray-700 text-white border-l-4 border-blue-500' : ''
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {isOpen && <span className="ml-3">{item.label}</span>}
          </NavLink>
        ))}
        
        <button
          onClick={logout}
          className="flex items-center w-full px-6 py-3 mt-8 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          {isOpen && <span className="ml-3">Đăng xuất</span>}
        </button>
      </nav>
    </div>
  );
};

export default AdminSidebar;
