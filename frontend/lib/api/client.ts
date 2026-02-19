// Create API Client 

import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Helper to clear all auth data
const clearAuthData = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('supabase_token');
  
  // Clear cookie (set with empty value and immediate expiry)
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  
  // Optional: Force page reload to reset all state
  // window.location.href = '/login';
};

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for CORS with credentials
});

// Add request interceptor to ensure proper headers
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const accessToken = localStorage.getItem('access_token');
    const supabaseToken = localStorage.getItem('supabase_token');

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    // Send supabase token in custom header
    if (supabaseToken) {
      config.headers['X-Supabase-Token'] = supabaseToken;
    }
  }
   // Ensure these headers are always present
  // config.headers['Accept'] = 'application/json';
  return config;
});

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthData();
      // Unauthorized - clear token and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);