// src/pages/Chat.tsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import ChatbotAdmin from '../components/ChatbotAdmin';
import ChatbotClient from '../components/ChatbotClient';

// Lấy danh sách admin emails từ environment variable
const ADMIN_EMAILS = (process.env.REACT_APP_ADMIN_EMAILS || 'admin@gmail.com').split(',').map(email => email.trim().toLowerCase());

const Chat: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Chào mừng đến với Chat Support</h2>
            <p className="text-gray-600 mb-6">Vui lòng đăng nhập để sử dụng tính năng chat</p>
            <button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium py-3 px-4 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 transform hover:scale-105">
              Đăng nhập ngay
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Xác định vai trò dựa trên email - kiểm tra với danh sách admin emails
  const userRole = ADMIN_EMAILS.includes(user.email.toLowerCase()) ? 'admin' : 'client';

  return (
    <div className="h-[calc(100vh-80px)]">
      {userRole === 'admin' ? (
        <ChatbotAdmin 
          currentUser={{
            _id: user._id,
            email: user.email,
            name: user.name,
            role: 'admin'
          }}
        />
      ) : (
        <ChatbotClient 
          currentUser={{
            _id: user._id,
            email: user.email,
            name: user.name,
            role: 'client'
          }}
        />
      )}
    </div>
  );
};

export default Chat;
