// src/types/user.types.ts - User interface with avatar field
export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin' | 'vendor';
  avatar?: string; // Avatar field
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  wishlist?: string[]; // Product IDs
  searchHistory?: Array<{
    query: string;
    date: Date;
    resultsCount?: number;
  }>;
  preferences?: {
    categories?: string[];
    brands?: string[];
    priceRange?: {
      min: number;
      max: number;
    };
    notifications?: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
  };
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  isVerified?: boolean;
  isActive?: boolean;
}

// For authentication context
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  refreshToken: () => Promise<void>;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  phone?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: User;
  expiresIn?: number;
}

export interface UpdateProfileData {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  address?: User['address'];
  preferences?: User['preferences'];
}