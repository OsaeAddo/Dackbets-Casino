import { apiClient } from '@/lib/api/client';

export interface PriceData {
    [currency: string]: {
        usd: number;
        last_updated: string;
    };
}

export interface ExchangeRates {
    ETH: number;
    BTC: number;
    USDT: number;
    SOL?: number;
}

class PriceService {
    private cache: ExchangeRates | null = null;
    private lastFetch: number = 0;
    private cacheDuration = 60000; // 1 minute cache

    async fetchPrices(): Promise<ExchangeRates> {
        const now = Date.now();

        // Return cached data if still valid
        if (this.cache && (now - this.lastFetch) < this.cacheDuration) {
            return this.cache;
        }

        try {
            // CoinGecko free API - no key required[citation:4][citation:8]
            const response = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd'
            );

            const data = await response.json();

            const rates: ExchangeRates = {
                BTC: data.bitcoin.usd,
                ETH: data.ethereum.usd,
                USDT: data.tether.usd,
            };

            // Update cache
            this.cache = rates;
            this.lastFetch = now;

            return rates;
        } catch (error) {
            console.error('Failed to fetch prices:', error);

            // Return last cached data if available, otherwise throw
            if (this.cache) {
                console.warn('Returning stale cached prices');
                return this.cache;
            }

            throw new Error('Unable to fetch crypto prices');
        }
    }

    async getPrice(currency: keyof ExchangeRates): Promise<number> {
        const rates = await this.fetchPrices();
        return rates[currency] ?? 0;
    }

    async calculateUSDValue(currency: keyof ExchangeRates, amount: number): Promise<number> {
        const rate = await this.getPrice(currency);
        return amount * rate;
    }

    clearCache() {
        this.cache = null;
        this.lastFetch = 0;
    }
}

export const priceService = new PriceService();