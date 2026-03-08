'use client';

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface PriceChartProps {
    currency: string;
    days?: number;
}

export function PriceChart({ currency, days = 7 }: PriceChartProps) {
    const [chartData, setChartData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistoricalData();
    }, [currency, days]);

    const fetchHistoricalData = async () => {
        try {
            const coinId = currency === 'BTC' ? 'bitcoin' :
                currency === 'ETH' ? 'ethereum' : 'tether';

            const response = await fetch(
                `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
            );

            const data = await response.json();

            const prices = data.prices.map((p: [number, number]) => ({
                date: new Date(p[0]).toLocaleDateString(),
                price: p[1]
            }));

            setChartData({
                labels: prices.map(p => p.date),
                datasets: [
                    {
                        label: `${currency} Price (USD)`,
                        data: prices.map(p => p.price),
                        borderColor: currency === 'BTC' ? '#F7931A' :
                            currency === 'ETH' ? '#627EEA' : '#26A17B',
                        backgroundColor: currency === 'BTC' ? 'rgba(247, 147, 26, 0.1)' :
                            currency === 'ETH' ? 'rgba(98, 126, 234, 0.1)' : 'rgba(38, 161, 123, 0.1)',
                        fill: true,
                        tension: 0.4,
                    }
                ]
            });
        } catch (error) {
            console.error('Failed to fetch historical data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !chartData) {
        return <div className="h-64 flex items-center justify-center">Loading chart...</div>;
    }

    return (
        <div className="h-64">
            <Line
                data={chartData}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false,
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                        },
                    },
                    scales: {
                        y: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                            },
                            ticks: {
                                callback: (value) => `$${value}`,
                            },
                        },
                        x: {
                            grid: {
                                display: false,
                            },
                            ticks: {
                                maxTicksLimit: 5,
                            },
                        },
                    },
                }}
            />
        </div>
    );
}