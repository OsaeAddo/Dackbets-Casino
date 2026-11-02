// app/(main)/wallet/withdraw/page.tsx
'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeftIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  Loader2Icon
} from 'lucide-react';
// Import crypto icons
import { 
  FaBitcoin, 
  FaEthereum
} from 'react-icons/fa';
import { SiTether } from 'react-icons/si';
import Link from 'next/link';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// Currency configuration with icons
const currencyConfig = {
  ETH: { 
    icon: FaEthereum, 
    color: '#627EEA',
    label: 'Ethereum',
    symbol: 'Ξ',
    min: 0.01,
    network: 'ERC20'
  },
  BTC: { 
    icon: FaBitcoin, 
    color: '#F7931A',
    label: 'Bitcoin',
    symbol: '₿',
    min: 0.0005,
    network: 'BTC'
  },
  USDT: { 
    icon: SiTether, 
    color: '#26A17B',
    label: 'Tether',
    symbol: '₮',
    min: 10,
    network: 'ERC20'
  },
};

interface WithdrawalResult {
  amount: number;
  currency: string;
  status: string;
  address: string;
  tx_hash?: string;
  estimated_time?: string;
}

export default function WithdrawPage() {
  const { user, refreshUser } = useAuth();
  const [selectedCurrency, setSelectedCurrency] = useState('ETH');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [withdrawalResult, setWithdrawalResult] = useState<WithdrawalResult | null>(null);
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const currencies = Object.entries(currencyConfig).map(([value, config]) => ({
    value,
    ...config
  }));

  const getCurrencyInfo = () => {
    return currencyConfig[selectedCurrency as keyof typeof currencyConfig];
  };

  // FIXED: Accept currency parameter
  const getBalance = (currency: string) => {
    return user?.balance?.[currency] || 0;
  };

  const validateAddress = (addr: string, currency: string) => {
    // Basic validation based on currency
    if (currency === 'ETH' || currency === 'USDT') {
      return addr.startsWith('0x') && addr.length === 42;
    }
    if (currency === 'BTC') {
      return (addr.startsWith('1') || addr.startsWith('3') || addr.startsWith('bc1')) && addr.length >= 26;
    }
    return true;
  };

  const handleWithdraw = async () => {
    const currencyInfo = getCurrencyInfo();
    const amountNum = parseFloat(amount);

    // Validation
    if (!amount || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amountNum < currencyInfo.min) {
      toast.error(`Minimum withdrawal is ${currencyInfo.symbol}${currencyInfo.min}`);
      return;
    }

    if (amountNum > getBalance(selectedCurrency)) {
      toast.error('Insufficient balance');
      return;
    }

    if (!address) {
      toast.error('Please enter a withdrawal address');
      return;
    }

    if (!validateAddress(address, selectedCurrency)) {
      toast.error(`Invalid ${selectedCurrency} address format`);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/wallet/withdraw', {
        currency: selectedCurrency,
        amount: amountNum,
        address: address
      });

      setWithdrawalResult(response.data);
      setStep('confirm');
      await refreshUser(); // Update balance
      toast.success('Withdrawal request submitted');
    } catch (error) {
      toast.error(isAxiosError(error) ? (error.response?.data?.detail ?? 'Withdrawal failed') : 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const handleNewWithdrawal = () => {
    setStep('form');
    setAmount('');
    setAddress('');
    setWithdrawalResult(null);
  };

  const CurrencyIcon = getCurrencyInfo()?.icon;
  const currentBalance = getBalance(selectedCurrency);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Back button */}
      <Button asChild variant="ghost" className="mb-4">
        <Link href="/wallet">
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Wallet
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Withdraw Funds</CardTitle>
          <CardDescription>
            Withdraw your winnings to an external wallet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 'form' && (
            <>
              {/* Currency Selection */}
              <div className="space-y-3">
                <Label>Select Currency</Label>
                <RadioGroup value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  {currencies.map((currency) => {
                    const Icon = currency.icon;
                    const balance = getBalance(currency.value); // Get balance for this specific currency
                    
                    return (
                      <div key={currency.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={currency.value} id={currency.value} />
                        <Label htmlFor={currency.value} className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-800/50">
                            <div className="flex items-center space-x-3">
                              <Icon className="h-5 w-5" style={{ color: currency.color }} />
                              <div>
                                <span className="font-medium">{currency.label}</span>
                                <p className="text-sm text-gray-400 flex items-center gap-1">
                                  Balance: {currency.symbol}{balance.toFixed(4)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm text-gray-400">Network</span>
                              <p className="font-mono text-xs">{currency.network}</p>
                            </div>
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="amount">Withdrawal Amount</Label>
                  <span className="text-sm text-gray-400 flex items-center gap-1">
                    Available: {getCurrencyInfo()?.symbol}{currentBalance.toFixed(4)}
                    {CurrencyIcon && <CurrencyIcon className="h-3 w-3" style={{ color: getCurrencyInfo()?.color }} />}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    step={getCurrencyInfo()?.min}
                    min={getCurrencyInfo()?.min}
                    max={currentBalance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Min ${getCurrencyInfo()?.symbol}${getCurrencyInfo()?.min}`}
                    className="pl-8"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setAmount((currentBalance * 0.25).toFixed(4))}
                  >
                    25%
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setAmount((currentBalance * 0.5).toFixed(4))}
                  >
                    50%
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setAmount((currentBalance * 0.75).toFixed(4))}
                  >
                    75%
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setAmount(currentBalance.toFixed(4))}
                  >
                    Max
                  </Button>
                </div>
              </div>

              {/* Withdrawal Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Withdrawal Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={`Enter your ${selectedCurrency} address`}
                  className="font-mono"
                />
                <p className="text-xs text-gray-400">
                  Make sure this address is correct and supports the {selectedCurrency} network
                </p>
              </div>

              {/* Fee Information */}
              <Alert>
                <AlertCircleIcon className="h-4 w-4" />
                <AlertDescription className="flex items-center gap-1">
                  Network fees will be deducted from your withdrawal amount. 
                  Minimum withdrawal: {getCurrencyInfo()?.min}
                  {CurrencyIcon && <CurrencyIcon className="h-3 w-3" style={{ color: getCurrencyInfo()?.color }} />}
                </AlertDescription>
              </Alert>

              {/* Submit Button */}
              <Button 
                onClick={handleWithdraw} 
                disabled={!amount || !address || loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Withdraw'
                )}
              </Button>
            </>
          )}

          {step === 'confirm' && withdrawalResult && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <CheckCircleIcon className="h-6 w-6 text-green-400" />
                </div>
                <h3 className="text-lg font-medium">Withdrawal Submitted</h3>
                <p className="text-sm text-gray-400 flex items-center justify-center gap-1">
                  Your withdrawal request has been submitted for processing
                </p>
              </div>

              <Card className="bg-gray-900/50">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount</span>
                    <span className="font-medium flex items-center gap-1">
                      {withdrawalResult.amount} {withdrawalResult.currency}
                      {CurrencyIcon && <CurrencyIcon className="h-4 w-4" style={{ color: getCurrencyInfo()?.color }} />}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Address</span>
                    <code className="text-xs font-mono">{withdrawalResult.address}</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status</span>
                    <span className="text-yellow-400 capitalize">{withdrawalResult.status}</span>
                  </div>
                  {withdrawalResult.tx_hash && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Transaction Hash</span>
                      <code className="text-xs font-mono">{withdrawalResult.tx_hash}</code>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Estimated Time</span>
                    <span>{withdrawalResult.estimated_time}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={handleNewWithdrawal}>
                  New Withdrawal
                </Button>
                <Button asChild>
                  <Link href="/wallet/history">View History</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}