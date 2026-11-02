'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePrices } from '@/lib/contexts/PriceContext';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  WalletIcon, 
  ArrowDownIcon, 
  ArrowUpIcon, 
  HistoryIcon,
  CopyIcon,
  CheckCircleIcon,
  Dice1Icon,
  AwardIcon,
  RefreshCwIcon
} from 'lucide-react';
// Import crypto icons from react-icons
import { 
  FaBitcoin, 
  FaEthereum
} from 'react-icons/fa';
import { SiTether } from 'react-icons/si';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Wallet {
  id: string;
  currency: string;
  address: string;
  balance: number;
}

interface Transaction {
  id: string;
  transaction_type: 'deposit' | 'withdrawal' | 'bet' | 'win';
  currency: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
  metadata?: { tx_hash?: string } & Record<string, unknown>;
}

// Currency configuration with icons and colors
const currencyConfig = {
  ETH: { 
    icon: FaEthereum, 
    color: '#627EEA',
    label: 'Ethereum',
    format: (amount: number) => `${amount.toFixed(4)} ETH`
  },
  BTC: { 
    icon: FaBitcoin, 
    color: '#F7931A',
    label: 'Bitcoin',
    format: (amount: number) => `${amount.toFixed(6)} BTC`
  },
  USDT: { 
    icon: SiTether, 
    color: '#26A17B',
    label: 'Tether',
    format: (amount: number) => `${amount.toFixed(2)} USDT`
  },
  // SOL: { 
  //   icon: SiSolana, 
  //   color: '#9945FF',
  //   label: 'Solana',
  //   format: (amount: number) => `${amount.toFixed(2)} SOL`
  // }
};

export default function WalletPage() {
  // const { user } = useAuth();
  const { prices, loading: pricesLoading, error, refreshPrices } = usePrices();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {  
    try {
      // Load wallets for supported currencies
      const currencies = ['ETH', 'BTC', 'USDT'];
      const walletPromises = currencies.map(async (currency) => {
        try {
          const response = await apiClient.get(`/wallet/address/${currency}`);
          return response.data;
        } catch (error) {
          console.error(`Failed to load ${currency} wallet:`, error);
          return null;
        }
      });

      const results = await Promise.all(walletPromises);
      setWallets(results.filter(Boolean));

      // Load recent transactions
      const txResponse = await apiClient.get('/wallet/transactions?limit=5');
      setRecentTransactions(txResponse.data);
    } catch (error) {
      console.error('Failed to load wallet data:', error);
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(id);
    toast.success('Address copied to clipboard');
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const getTotalBalanceUSD = () => {
    if (!prices) return 0; 
    
    return wallets.reduce((total, wallet) => {
      const currency = wallet.currency as keyof typeof prices;
      if (!prices[currency]) return total;

      return total + (wallet.balance * prices[currency]);
    }, 0);
  };

  const getCurrencyUSDValue = (currency: string, amount: number) => {
    if (!prices) return 0;
    const rate = prices[currency as keyof typeof prices];
    return rate ? amount * rate : 0;
  };

  const formatCurrency = (currency: string, amount: number) => {
    const config = currencyConfig[currency as keyof typeof currencyConfig];
    if (config) {
      return config.format(amount);
    }
    return `${amount.toFixed(4)} ${currency}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500/10 text-green-500';
      case 'pending': return 'bg-yellow-500/10 text-yellow-500';
      case 'failed': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getCurrencyIcon = (currency: string, className: string = "h-4 w-4") => {
    const config = currencyConfig[currency as keyof typeof currencyConfig];
    if (config) {
      const Icon = config.icon;
      return <Icon className={className} style={{ color: config.color }} />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Wallet</h1>
        <p className="text-gray-400">Manage your funds and view transaction history</p>
      </div>

      {/* Total Balance Card */}
      <Card className="mb-8 bg-linear-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Total Balance</p>
              <p className="text-4xl font-bold text-green-400">
                ${getTotalBalanceUSD().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </p>
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshPrices}
                disabled={pricesLoading}
                className="h-8 w-8"
                cursor-pointer
              >
                <RefreshCwIcon className={`h-4 w-4 ${pricesLoading ? 'animate-spin' : ''}`} />
              </Button>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {wallets.map(w => (
                  <div key={w.currency} className="flex items-center gap-1 text-sm text-gray-400">
                    {getCurrencyIcon(w.currency, "h-3 w-3")}
                    <span>{formatCurrency(w.currency, w.balance)}</span>
                    {prices && prices[w.currency as keyof typeof prices] && (
                      <span className="text-xs text-gray-500">
                        (${getCurrencyUSDValue(w.currency, w.balance).toFixed(2)})
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {error && (
                <p className="text-xs text-red-400 mt-2">{error}</p>
              )}
            </div>
            <WalletIcon className="h-12 w-12 text-purple-500 opacity-50" />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Button asChild size="lg" className="h-auto py-6">
          <Link href="/wallet/deposit">
            <ArrowDownIcon className="mr-2 h-5 w-5" />
            <div className="text-left">
              <div className="font-bold">Deposit</div>
              <div className="text-xs opacity-80">Add funds to your wallet</div>
            </div>
          </Link>
        </Button>

        <Button asChild size="lg" variant="outline" className="h-auto py-6">
          <Link href="/wallet/withdraw">
            <ArrowUpIcon className="mr-2 h-5 w-5" />
            <div className="text-left">
              <div className="font-bold">Withdraw</div>
              <div className="text-xs opacity-80">Withdraw to external wallet</div>
            </div>
          </Link>
        </Button>

        <Button asChild size="lg" variant="outline" className="h-auto py-6">
          <Link href="/wallet/history">
            <HistoryIcon className="mr-2 h-5 w-5" />
            <div className="text-left">
              <div className="font-bold">History</div>
              <div className="text-xs opacity-80">View all transactions</div>
            </div>
          </Link>
        </Button>
      </div>

      {/* Wallets Grid */}
      <h2 className="text-xl font-bold mb-4">Your Wallets</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {wallets.map((wallet) => {
          const currency = wallet.currency;
          const config = currencyConfig[currency as keyof typeof currencyConfig];
          const Icon = config?.icon;
          const usdValue = getCurrencyUSDValue(wallet.currency, wallet.balance)
          
          return (
            <Card key={wallet.currency} className="bg-gray-900/50 hover:bg-gray-900/80 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-5 w-5" style={{ color: config?.color }} />}
                    <span>{currency} Wallet</span>
                  </div>
                  <div className='text-right'>
                    <Badge variant="outline" className="font-mono flex items-center gap-1">
                      {Icon && <Icon className="h-3 w-3" style={{ color: config?.color }} />}
                      {wallet.balance?.toFixed(4)} {currency}
                    </Badge>
                    {prices && (
                      <span className="text-xs text-gray-400">
                        ≈ ${usdValue.toFixed(2)} USD
                      </span>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg">
                    <code className="text-xs truncate flex-1">
                      {wallet.address}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(wallet.address, wallet.currency)}
                      className="ml-2"
                    >
                      {copiedAddress === wallet.currency ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-400" />
                      ) : (
                        <CopyIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400">
                    Use this address to deposit {currency}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your latest wallet activity</CardDescription>
        </CardHeader>
        <CardContent>
          {recentTransactions.length > 0 ? (
            <div className="space-y-4">
              {recentTransactions.map((tx) => {
                const currency = tx.currency;
                const config = currencyConfig[currency as keyof typeof currencyConfig];
                const Icon = config?.icon;
                
                return (
                  <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center space-x-3">
                      {tx.transaction_type === 'deposit' && <ArrowDownIcon className="h-4 w-4 text-green-400" />}
                      {tx.transaction_type === 'withdrawal' && <ArrowUpIcon className="h-4 w-4 text-red-400" />}
                      {tx.transaction_type === 'bet' && <Dice1Icon className="h-4 w-4 text-purple-400" />}
                      {tx.transaction_type === 'win' && <AwardIcon className="h-4 w-4 text-yellow-400" />}
                      <div className="flex items-center gap-2">
                        {Icon && <Icon className="h-4 w-4" style={{ color: config?.color }} />}
                        <div>
                          <p className="font-medium capitalize">{tx.transaction_type}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium flex items-center gap-1 ${
                        tx.transaction_type === 'deposit' || tx.transaction_type === 'win' 
                          ? 'text-green-400' 
                          : 'text-red-400'
                      }`}>
                        {Icon && <Icon className="h-3 w-3" />}
                        {tx.transaction_type === 'deposit' || tx.transaction_type === 'win' ? '+' : '-'}
                        {tx.amount.toFixed(4)} {tx.currency}
                      </p>
                      <Badge className={`${getStatusColor(tx.status)}`}>
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">No transactions yet</p>
          )}
          
          <Button asChild variant="link" className="mt-4 w-full">
            <Link href="/wallet/history">View All Transactions →</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}