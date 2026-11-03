'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { priceService, ExchangeRates } from '@/lib/services/priceService';

interface PriceContextType {
    prices: ExchangeRates | null;
    loading: boolean;
    error: string | null;
    refreshPrices: () => Promise<void>;
    convertToUSD: (currency: keyof ExchangeRates, amount: number) => number;
}

const PriceContext = createContext<PriceContextType | undefined>(undefined);

export function PriceProvider({ children }: { children: React.ReactNode }) {
    const [prices, setPrices] = useState<ExchangeRates | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPrices = useCallback(async () => {
        try {
            setError(null);
            const data = await priceService.fetchPrices();
            setPrices(data);
        } catch (err) {
            setError('Failed to load crypto prices');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshPrices = useCallback(async () => {
        setLoading(true);
        priceService.clearCache();
        await fetchPrices();
    }, [fetchPrices]);

    const convertToUSD = (currency: keyof ExchangeRates, amount: number): number => {
        if (!prices || !prices[currency]) return 0;
        return amount * prices[currency];
    };

    useEffect(() => {
        const run = async () => {
            await fetchPrices();
        };
        void run();

        // Refresh every 60 seconds
        const interval = setInterval(fetchPrices, 60000);

        return () => clearInterval(interval);
    }, [fetchPrices]);

    return (
        <PriceContext.Provider value={{
            prices,
            loading,
            error,
            refreshPrices,
            convertToUSD
        }}>
            {children}
        </PriceContext.Provider>
    );
}

export function usePrices() {
    const context = useContext(PriceContext);
    if (!context) {
        throw new Error('usePrices must be used within PriceProvider');
    }
    return context;
}