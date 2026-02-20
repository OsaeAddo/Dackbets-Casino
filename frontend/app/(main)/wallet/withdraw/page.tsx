'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import Link from 'next/link';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function WithdrawPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [selectedCurrency, setSelectedCurrency] = useState('ETH');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [withdrawalResult, setWithdrawalResult] = useState<any>(null);
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const currencies = [
    { value: 'ETH', label: 'Ethereum', min: 0.01, icon: 'Ξ', network: 'ERC20' },
    { value: 'BTC', label: 'Bitcoin', min: 0.0005, icon: '₿', network: 'BTC' },
    { value: 'USDT', label: 'Tether', min: 10, icon: '₮', network: 'ERC20' },
  ];

  const getCurrencyInfo = () => {
    return currencies.find(c => c.value === selectedCurrency) || currencies[0];
  };

  const getBalance = () => {
    return user?.balance?.[selectedCurrency] || 0;
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
      toast.error(`Minimum withdrawal is ${currencyInfo.icon}${currencyInfo.min}`);
      return;
    }

    if (amountNum > getBalance()) {
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
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Withdrawal failed');
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
                  {currencies.map((currency) => (
                    <div key={currency.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={currency.value} id={currency.value} />
                      <Label htmlFor={currency.value} className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-800/50">
                          <div>
                            <span className="font-medium">{currency.label}</span>
                            <p className="text-sm text-gray-400">
                              Balance: {currency.icon}{getBalance().toFixed(4)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm text-gray-400">Network</span>
                            <p className="font-mono text-xs">{currency.network}</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="amount">Withdrawal Amount</Label>
                  <span className="text-sm text-gray-400">
                    Available: {getCurrencyInfo().icon}{getBalance().toFixed(4)}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    step={getCurrencyInfo().min}
                    min={getCurrencyInfo().min}
                    max={getBalance()}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Min ${getCurrencyInfo().icon}${getCurrencyInfo().min}`}
                    className="pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {getCurrencyInfo().icon}
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setAmount((getBalance() * 0.25).toFixed(4))}
                  >
                    25%
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setAmount((getBalance() * 0.5).toFixed(4))}
                  >
                    50%
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setAmount((getBalance() * 0.75).toFixed(4))}
                  >
                    75%
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setAmount(getBalance().toFixed(4))}
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
                <AlertDescription>
                  Network fees will be deducted from your withdrawal amount. 
                  Minimum withdrawal: {getCurrencyInfo().icon}{getCurrencyInfo().min}
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
                <p className="text-sm text-gray-400">
                  Your withdrawal request has been submitted for processing
                </p>
              </div>

              <Card className="bg-gray-900/50">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount</span>
                    <span className="font-medium">
                      {withdrawalResult.amount} {withdrawalResult.currency}
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