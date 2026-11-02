'use client';

import { useState } from 'react';
import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  ArrowLeftIcon,
  CopyIcon,
  CheckCircleIcon,
  AlertCircleIcon
} from 'lucide-react';
// Import crypto icons
import { 
  FaBitcoin, 
  FaEthereum
} from 'react-icons/fa';
import { SiTether } from 'react-icons/si';
import Link from 'next/link';
import { toast } from 'sonner';
import Image from 'next/image';

interface DepositResponse {
  transaction_id: string;
  currency: string;
  amount: number;
  deposit_address: string;
  qr_code_url?: string;
  expires_at: string;
}

// Currency configuration with icons
const currencyConfig = {
  ETH: { 
    icon: FaEthereum, 
    color: '#627EEA',
    label: 'Ethereum',
    symbol: 'Ξ',
    min: 0.01
  },
  BTC: { 
    icon: FaBitcoin, 
    color: '#F7931A',
    label: 'Bitcoin',
    symbol: '₿',
    min: 0.0001
  },
  USDT: { 
    icon: SiTether, 
    color: '#26A17B',
    label: 'Tether',
    symbol: '₮',
    min: 10
  },
};

export default function DepositPage() {
  const [selectedCurrency, setSelectedCurrency] = useState('ETH');
  const [amount, setAmount] = useState('');
  const [depositResponse, setDepositResponse] = useState<DepositResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'select' | 'address' | 'confirm'>('select');

  const currencies = Object.entries(currencyConfig).map(([value, config]) => ({
    value,
    ...config
  }));

  const handleCreateDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/wallet/deposit', {
        currency: selectedCurrency,
        amount: parseFloat(amount)
      });

      setDepositResponse(response.data);
      setStep('confirm');
      toast.success('Deposit request created');
    } catch (error) {
      toast.error(isAxiosError(error) ? (error.response?.data?.detail ?? 'Failed to create deposit') : 'Failed to create deposit');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Address copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const getCurrencyInfo = () => {
    return currencyConfig[selectedCurrency as keyof typeof currencyConfig];
  };

  const handleReset = () => {
    setStep('select');
    setAmount('');
    setDepositResponse(null);
  };

  const CurrencyIcon = getCurrencyInfo()?.icon;

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
          <CardTitle>Deposit Funds</CardTitle>
          <CardDescription>
            Add cryptocurrency to your wallet. Minimum deposit amounts apply.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 'select' && (
            <>
              {/* Currency Selection */}
              <div className="space-y-3">
                <Label>Select Currency</Label>
                <RadioGroup value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  {currencies.map((currency) => {
                    const Icon = currency.icon;
                    return (
                      <div key={currency.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={currency.value} id={currency.value} />
                        <Label htmlFor={currency.value} className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-800/50">
                            <div className="flex items-center space-x-3">
                              <Icon className="h-5 w-5" style={{ color: currency.color }} />
                              <div>
                                <span className="font-medium">{currency.label}</span>
                                <p className="text-sm text-gray-400">
                                  Min: {currency.symbol}{currency.min}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm text-gray-400">Network</span>
                              <p className="font-mono text-xs">{currency.value}</p>
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
                <Label htmlFor="amount">Deposit Amount</Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    step={getCurrencyInfo()?.min}
                    min={getCurrencyInfo()?.min}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Min ${getCurrencyInfo()?.symbol}${getCurrencyInfo()?.min}`}
                    className="pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {getCurrencyInfo()?.symbol}
                  </span>
                </div>
                <p className="text-sm text-gray-400">
                  You will receive exactly {amount || '0'} {selectedCurrency} after deposit
                </p>
              </div>

              {/* Continue Button */}
              <Button 
                onClick={handleCreateDeposit} 
                disabled={!amount || parseFloat(amount) < (getCurrencyInfo()?.min || 0) || loading}
                className="w-full"
              >
                {loading ? 'Creating...' : 'Continue to Deposit'}
              </Button>
            </>
          )}

          {step === 'confirm' && depositResponse && (
            <div className="space-y-6">
              {/* Success Message */}
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <CheckCircleIcon className="h-6 w-6 text-green-400" />
                </div>
                <h3 className="text-lg font-medium">Deposit Address Generated</h3>
                <p className="text-sm text-gray-400 flex items-center justify-center gap-1">
                  Send exactly {depositResponse.amount} 
                  {CurrencyIcon && <CurrencyIcon className="h-4 w-4" style={{ color: getCurrencyInfo()?.color }} />}
                  {depositResponse.currency} to this address
                </p>
              </div>

              {/* Deposit Address */}
              <Card className="bg-gray-900/50">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* QR Code (if available) */}
                    {depositResponse.qr_code_url && (
                      <div className="flex justify-center">
                        <Image 
                          src={depositResponse.qr_code_url} 
                          alt="Deposit QR Code"
                          width={128}
                          height={128}
                          unoptimized
                          className="w-32 h-32"
                        />
                      </div>
                    )}

                    {/* Address Display */}
                    <div>
                      <Label className="text-xs text-gray-400">Deposit Address</Label>
                      <div className="flex items-center space-x-2 mt-1 p-3 bg-gray-800 rounded-lg">
                        <code className="text-sm break-all flex-1 font-mono">
                          {depositResponse.deposit_address}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(depositResponse.deposit_address)}
                        >
                          {copied ? (
                            <CheckCircleIcon className="h-4 w-4 text-green-400" />
                          ) : (
                            <CopyIcon className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Important Info */}
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <AlertCircleIcon className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-yellow-400 mb-1">Important</p>
                          <ul className="space-y-1 text-gray-300">
                            <li className="flex items-center gap-1">
                              • Send only {depositResponse.currency} 
                              {CurrencyIcon && <CurrencyIcon className="h-3 w-3" style={{ color: getCurrencyInfo()?.color }} />}
                              to this address
                            </li>
                            <li>• Minimum deposit: {getCurrencyInfo()?.symbol}{getCurrencyInfo()?.min}</li>
                            <li>• Network confirmations required: 12 for ETH, 3 for BTC</li>
                            <li>• This address expires: {new Date(depositResponse.expires_at).toLocaleString()}</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Transaction ID */}
                    <div className="text-sm">
                      <span className="text-gray-400">Transaction ID: </span>
                      <code className="font-mono text-xs">{depositResponse.transaction_id}</code>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" onClick={handleReset}>
                  New Deposit
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