// src/pages/Chat.tsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import ChatbotAdmin from '../components/ChatbotAdmin';
import ChatbotClient from '../components/ChatbotClient';

const Chat: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Vui lòng đăng nhập để sử dụng chat</div>
      </div>
    );
  }

  // Xác định vai trò dựa trên email
  const userRole = user.email === 'admin@gmail.com' ? 'admin' : 'client';

  return (
    <div className="h-screen -m-8 -mt-4">
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