// Create Auth Hook
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  username?: string;
  balance: Record<string, number>;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await apiClient.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('access_token');
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
      
      setUser({
        id: response.data.user_id,
        email: response.data.email,
        username: response.data.username,
        balance: response.data.balance || {},
      });
      
      toast.success('Logged in successfully!');
      router.push('/dashboard');
      return { success: true };
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Login failed');
      return { success: false, error: error.response?.data?.detail };
    }
  };

  const register = async (email: string, password: string, username?: string) => {
    try {
      const response = await apiClient.post('/auth/signup', { 
        email, 
        password, 
        username 
      });
      
      localStorage.setItem('access_token', response.data.access_token);
      if (response.data.supabase_token) {
        localStorage.setItem('supabase_token', response.data.supabase_token);
      }
      
      setUser({
        id: response.data.user_id,
        email: response.data.email,
        username: response.data.username,
        balance: response.data.balance || {},
      });
      
      toast.success('Account created successfully!');
      router.push('/dashboard');
      return { success: true };
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Registration failed');
      return { success: false, error: error.response?.data?.detail };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('supabase_token');
    setUser(null);
    router.push('/');
    toast.success('Logged out successfully');
  };

  return {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };
}