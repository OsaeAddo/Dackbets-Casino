'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';

export interface User {
  id: string;
  email: string;
  username?: string;
  balance: Record<string, number>;
  kycStatus?: string;
  level?: number;
  createdAt?: string;
  wageringRequirement?: number;
}

interface UserApiResponse {
  id: string;
  email: string;
  username?: string | null;
  balance?: Record<string, number> | null;
  kyc_status?: string | null;
  level?: number | null;
  created_at?: string | null;
  wagering_requirement?: number | null;
}

interface AuthResult {
  success: boolean;
  error?: string;
  requiresConfirmation?: boolean;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string, username?: string) => Promise<AuthResult>;
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

/**
 * Map the backend's snake_case /auth/me payload to the app's single User shape.
 * Used by checkAuth, login, register, and refreshUser so they cannot drift.
 */
export function mapUserResponse(data: UserApiResponse): User {
  return {
    id: data.id,
    email: data.email,
    username: data.username ?? undefined,
    balance: data.balance ?? {},
    kycStatus: data.kyc_status ?? undefined,
    level: data.level ?? undefined,
    createdAt: data.created_at ?? undefined,
    wageringRequirement: data.wagering_requirement ?? undefined,
  };
}

async function fetchCurrentUser(): Promise<User> {
  const response = await apiClient.get<UserApiResponse>('/auth/me');
  return mapUserResponse(response.data);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return;
      }

      // Ensure cookie exists (in case it was cleared)
      setCookie('access_token', token, 7);

      setUser(await fetchCurrentUser());
    } catch (error: unknown) {
      // Only clear everything if the token is invalid.
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('supabase_token');
        clearCookie('access_token');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Check authentication on mount
  useEffect(() => {
    const run = async () => {
      await checkAuth();
    };
    void run();
  }, [checkAuth]);

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

  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const response = await apiClient.post('/auth/signin', { email, password });
      const data = response.data as {
        access_token?: string;
        supabase_token?: string;
      };

      if (!data.access_token) {
        throw new Error('Login response did not include an access token');
      }

      localStorage.setItem('access_token', data.access_token);
      if (data.supabase_token) {
        localStorage.setItem('supabase_token', data.supabase_token);
      }

      // Set the cookie for proxy.ts
      setCookie('access_token', data.access_token, 7);

      setUser(await fetchCurrentUser());

      toast.success('Logged in successfully!');
      router.push('/dashboard');
      return { success: true };
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, 'Login failed');
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const register = async (
    email: string,
    password: string,
    username?: string
  ): Promise<AuthResult> => {
    try {
      const response = await apiClient.post('/auth/signup', {
        email,
        password,
        username,
      });
      const data = response.data as {
        access_token?: string;
        supabase_token?: string;
        requires_confirmation?: boolean;
        message?: string;
      };

      // Email confirmation required (or no session returned): do not assume
      // tokens exist and do not log the user in.
      if (data.requires_confirmation || !data.access_token) {
        localStorage.setItem('pending_email', email);

        toast.success(
          data.message || 'Please check your email to confirm your account',
          { duration: 6000 }
        );
        router.push('/verify-email');

        return {
          success: true,
          requiresConfirmation: true,
          email,
        };
      }

      // Email already confirmed (auto-confirm in dev)
      localStorage.setItem('access_token', data.access_token);
      if (data.supabase_token) {
        localStorage.setItem('supabase_token', data.supabase_token);
      }

      setCookie('access_token', data.access_token, 7);

      setUser(await fetchCurrentUser());
      toast.success('Account created successfully!');
      router.push('/dashboard');

      return { success: true };
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error, 'Registration failed');
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

  const refreshUser = useCallback(async () => {
    try {
      setUser(await fetchCurrentUser());
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

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
