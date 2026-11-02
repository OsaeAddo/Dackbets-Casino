'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { FaBitcoin, FaEthereum } from 'react-icons/fa';
import { SiTether } from 'react-icons/si';
import type { IconType } from 'react-icons';
import { apiClient } from '@/lib/api/client';

export type Currency = 'ETH' | 'BTC' | 'USDT';

export interface CurrencyConfig {
    value: Currency;
    label: string;
    symbol: string;
    minBet: number;
    maxBet: number;
    icon: IconType;
    color: string;
    format: (amount: number) => string;
}

interface CurrencyContextType {
    selectedCurrency: Currency;
    setSelectedCurrency: (currency: Currency) => void;
    currencyConfig: Record<Currency, CurrencyConfig>;
}

interface BetLimit {
    min: number;
    max: number;
}

interface BetLimitsResponse {
    limits: Record<string, BetLimit>;
    defaults: BetLimit;
}

// Fallbacks are used until /games/limits responds (or if the API is offline).
const DEFAULT_CURRENCY_CONFIG: Record<Currency, CurrencyConfig> = {
    ETH: {
        value: 'ETH',
        label: 'Ethereum',
        symbol: 'Ξ',
        minBet: 0.001,
        maxBet: 100,
        icon: FaEthereum,
        color: '#627EEA',
        format: (amount: number) => `${amount.toFixed(4)} ETH`
    },
    BTC: {
        value: 'BTC',
        label: 'Bitcoin',
        symbol: '₿',
        minBet: 0.0001,
        maxBet: 10,
        icon: FaBitcoin,
        color: '#F7931A',
        format: (amount: number) => `${amount.toFixed(6)} BTC`
    },
    USDT: {
        value: 'USDT',
        label: 'Tether',
        symbol: '₮',
        minBet: 10,
        maxBet: 100000,
        icon: SiTether,
        color: '#26A17B',
        format: (amount: number) => `${amount.toFixed(2)} USDT`
    }
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const [selectedCurrency, setSelectedCurrency] = useState<Currency>('ETH');
    const [currencyConfig, setCurrencyConfig] = useState(DEFAULT_CURRENCY_CONFIG);

    // Load saved preference from localStorage without a synchronous effect
    // update (which would cause a cascading render).
    useEffect(() => {
        const loadPreference = async () => {
            const saved = localStorage.getItem('preferredCurrency') as Currency;
            if (saved && DEFAULT_CURRENCY_CONFIG[saved]) {
                setSelectedCurrency(saved);
            }
        };

        void loadPreference();
    }, []);

    // Fetch the server-side per-currency limits once, keeping fallbacks on error.
    useEffect(() => {
        let cancelled = false;

        const loadLimits = async () => {
            try {
                const response = await apiClient.get<BetLimitsResponse>('/games/limits');
                if (cancelled) {
                    return;
                }

                const limits = response.data?.limits ?? {};
                setCurrencyConfig((current) => {
                    const next = { ...current };
                    (Object.keys(next) as Currency[]).forEach((code) => {
                        const limit = limits[code];
                        if (
                            limit &&
                            typeof limit.min === 'number' &&
                            Number.isFinite(limit.min) &&
                            typeof limit.max === 'number' &&
                            Number.isFinite(limit.max)
                        ) {
                            next[code] = {
                                ...next[code],
                                minBet: limit.min,
                                maxBet: limit.max,
                            };
                        }
                    });
                    return next;
                });
            } catch (error) {
                console.warn('Failed to load bet limits; using fallback values.', error);
            }
        };

        void loadLimits();
        return () => {
            cancelled = true;
        };
    }, []);

    // Save preference when changed
    const handleCurrencyChange = (currency: Currency) => {
        setSelectedCurrency(currency);
        localStorage.setItem('preferredCurrency', currency);
    };

    return (
        <CurrencyContext.Provider value={{
            selectedCurrency,
            setSelectedCurrency: handleCurrencyChange,
            currencyConfig
        }}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    const context = useContext(CurrencyContext);
    if (!context) {
        throw new Error('useCurrency must be used within CurrencyProvider');
    }
    return context;
}
