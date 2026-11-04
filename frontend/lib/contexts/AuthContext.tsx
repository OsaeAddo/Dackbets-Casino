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
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Non-secret marker set alongside the HttpOnly auth cookies. Its presence means
// a refresh session may exist, so it is worth asking /auth/me.
const SESSION_COOKIE = 'casino_session';

function hasSessionMarker(): boolean {
  return document.cookie.split('; ').some((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
}

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
    if (!hasSessionMarker()) {
      setLoading(false);
      return;
    }

    try {
      setUser(await fetchCurrentUser());
    } catch (error: unknown) {
      // A 401 here means the refresh cookie is gone or was revoked; the API
      // client has already attempted one rotation. Do not clear anything else.
      if (axios.isAxiosError(error) && error.response?.status === 401) {
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

  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      // The backend sets HttpOnly access/refresh cookies plus the CSRF cookie.
      await apiClient.post('/auth/signin', { email, password });

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
        requires_confirmation?: boolean;
        message?: string;
      };

      // Email confirmation required (or no session returned): do not assume
      // the user is logged in.
      if (data.requires_confirmation) {
        // Only a non-secret convenience value; it is removed after verification.
        sessionStorage.setItem('pending_email', email);

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

      // Email already confirmed (auto-confirm in dev): the response already set
      // the auth cookies.
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

  const logout = async () => {
    try {
      // Revokes the refresh session server-side and expires every auth cookie.
      await apiClient.post('/auth/signout');
    } catch {
      // Logging out locally must not depend on the network.
    }
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
