'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { FaBitcoin, FaEthereum } from 'react-icons/fa';
import { SiTether } from 'react-icons/si';

type Currency = 'ETH' | 'BTC' | 'USDT';

interface CurrencyConfig {
    value: Currency;
    label: string;
    symbol: string;
    minBet: number;
    icon: any;
    color: string;
    format: (amount: number) => string;
}

interface CurrencyContextType {
    selectedCurrency: Currency;
    setSelectedCurrency: (currency: Currency) => void;
    currencyConfig: Record<Currency, CurrencyConfig>;
}

const currencyConfig: Record<Currency, CurrencyConfig> = {
    ETH: {
        value: 'ETH',
        label: 'Ethereum',
        symbol: 'Ξ',
        minBet: 0.001,
        icon: FaEthereum,
        color: '#627EEA',
        format: (amount: number) => `${amount.toFixed(4)} ETH`
    },
    BTC: {
        value: 'BTC',
        label: 'Bitcoin',
        symbol: '₿',
        minBet: 0.0001,
        icon: FaBitcoin,
        color: '#F7931A',
        format: (amount: number) => `${amount.toFixed(6)} BTC`
    },
    USDT: {
        value: 'USDT',
        label: 'Tether',
        symbol: '₮',
        minBet: 10,
        icon: SiTether,
        color: '#26A17B',
        format: (amount: number) => `${amount.toFixed(2)} USDT`
    }
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const [selectedCurrency, setSelectedCurrency] = useState<Currency>('ETH');

    // Load saved preference from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('preferredCurrency') as Currency;
        if (saved && currencyConfig[saved]) {
            setSelectedCurrency(saved);
        }
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