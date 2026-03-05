'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  username?: string;
  balance: Record<string, number>;
  kyc_status?: string;
  level?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, username?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cookie helpers
const setCookie = (name: string, value: string, days: number = 7) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const clearCookie = (name: string) => {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Listen for storage events (for multi-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'access_token') {
        if (!e.newValue) {
          // Token was removed in another tab
          setUser(null);
          clearCookie('access_token');
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Ensure cookie exists (in case it was cleared)
      setCookie('access_token', token, 7);

      const response = await apiClient.get('/auth/me');
      setUser(response.data);
    } catch (error:any) {
      //only clear everything if it's invalid token
      if (error.response?.status === 401){
        localStorage.removeItem('access_token');
        localStorage.removeItem('supabase_token');
        clearCookie('access_token');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.post('/auth/signin', { email, password });
      
      localStorage.setItem('access_token', response.data.access_token);
      if (response.data.supabase_token) {
        localStorage.setItem('supabase_token', response.data.supabase_token);
      }

      // --->Set the cookie for proxy.ts <---
      setCookie('access_token', response.data.access_token, 7); // Expires in 7 days

       // 🔥 Immediately fetch full profile
      const profileResponse = await apiClient.get('/auth/me');
      
      // Set user state from response
      setUser({
        id: profileResponse.data.user_id,
        email: profileResponse.data.email,
        username: profileResponse.data.username,
        balance: profileResponse.data.balance || {},
      });
      
      toast.success('Logged in successfully!');
      router.push('/dashboard');
      return { success: true };
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Login failed';
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const register = async (email: string, password: string, username?: string) => {
    try {
      const response = await apiClient.post('/auth/signup', { 
        email, 
        password, 
        username 
      });

      console.log('Registration response:', response.data);
      // Check if email confirmation is required
      if (response.data.requires_confirmation) {
        // Store email for later use
        localStorage.setItem('pending_email', email);

        // Redirect to confirmation pending page
        router.push('/auth/verify-email');

        toast.success('Please check your email to confirm your account', {
          duration: 6000,
          action: {
            label: 'Open Mailpit',
            onClick: () => window.open('http://localhost:54324', '_blank')
          }
        });

        return {
          success: true,
          requiresConfirmation: true,
          email: email
        };
      }

      // Email already confirmed (auto-confirm in dev)
      localStorage.setItem('access_token', response.data.access_token);
      if (response.data.supabase_token) {
        localStorage.setItem('supabase_token', response.data.supabase_token);
      }

      setCookie('access_token', response.data.access_token, 7);

      const profileResponse = await apiClient.get('/auth/me');
      setUser({
        id: profileResponse.data.user_id,
        email: profileResponse.data.email,
        username: profileResponse.data.username,
        balance: profileResponse.data.balance || {},
      });
      toast.success('Account created successfully!');
      router.push('/dashboard');
      
      return { success: true };
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Registration failed';
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('supabase_token');
    clearCookie('access_token');
    setUser(null);

    router.push('/');
    toast.success('Logged out successfully');
  };

  const refreshUser = async () => {
    try {
      const response = await apiClient.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout,
      refreshUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}