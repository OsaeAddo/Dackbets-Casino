'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/lib/contexts/AuthContext';
import { useState } from 'react';
import { CurrencyProvider } from '@/lib/contexts/CurrencyContext';

export function Providers({ children }: { children: React.ReactNode }) {
  // Create QueryClient instance (stays stable across re-renders)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        <AuthProvider>
          <CurrencyProvider>
            {children}
            <Toaster 
              position="top-right"
              richColors
              closeButton
              theme="dark"
            />
          </CurrencyProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}