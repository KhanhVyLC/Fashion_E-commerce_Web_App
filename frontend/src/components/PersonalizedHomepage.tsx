import React from 'react';
import RecommendationSection from './RecommendationSection';
import { useAuth } from '../context/AuthContext';

const PersonalizedHomepage: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-8">
      <RecommendationSection 
        title="Dành riêng cho bạn" 
        type="content" 
      />
      
      <RecommendationSection 
        title="Xu hướng hiện tại" 
        type="trending" 
      />
      
      <RecommendationSection 
        title="Hàng mới về" 
        type="new" 
      />
      
      <RecommendationSection 
        title="Có thể bạn quan tâm" 
        type="collaborative" 
      />
    </div>
  );
};

export default PersonalizedHomepage;
