// app/(main)/games/dice/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Dice1Icon, 
  Loader2Icon,
  InfoIcon,
  HistoryIcon,
  TrendingUpIcon,
  AwardIcon,
  StarIcon
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';

interface BetResult {
  bet_id: string;
  game_type: string;
  currency: string;
  amount: number;
  result: {
    roll: number;
    target: number;
    win: boolean;
    multiplier: number;
    win_amount: number;
    client_seed?: string;
    server_seed_hash?: string;
    nonce?: number;
  };
  win_amount: number;
  new_balance: Record<string, number>;
  timestamp: string;
}

export default function DiceGamePage() {
  const { user, refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [betAmount, setBetAmount] = useState(0.01);
  const [winChance, setWinChance] = useState(50);
  const [targetNumber, setTargetNumber] = useState(50);
  const [mode, setMode] = useState<'chance' | 'target'>('chance');
  const [clientSeed, setClientSeed] = useState('');
  const [lastBet, setLastBet] = useState<BetResult | null>(null);
  const [recentBets, setRecentBets] = useState<any[]>([]);

  // Calculate multiplier based on win chance
  const multiplier = (100 / winChance) * 0.99; // 1% house edge
  const potentialWin = betAmount * multiplier;

  // Update target when chance changes
  useEffect(() => {
    if (mode === 'chance') {
      setTargetNumber(winChance);
    }
  }, [winChance, mode]);

  // Update chance when target changes
  useEffect(() => {
    if (mode === 'target') {
      setWinChance(targetNumber);
    }
  }, [targetNumber, mode]);

  // Load recent bets
  useEffect(() => {
    loadRecentBets();
  }, []);

  const loadRecentBets = async () => {
    try {
      const response = await apiClient.get('/games/history?limit=10');
      setRecentBets(response.data);
    } catch (error) {
      console.error('Failed to load recent bets:', error);
    }
  };

  const handleBet = async () => {
    if (!user) {
      toast.error('Please login to play');
      return;
    }

    if (betAmount <= 0) {
      toast.error('Bet amount must be greater than 0');
      return;
    }

    const balance = user.balance?.ETH || 0;
    if (betAmount > balance) {
      toast.error('Insufficient balance');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post('/games/bet', {
        game_type: 'dice',
        currency: 'ETH',
        amount: betAmount,
        parameters: {
          win_chance: winChance,
          client_seed: clientSeed || undefined
        }
      });

      setLastBet(response.data);
      await refreshUser(); // Update balance
      await loadRecentBets(); // Refresh history
      
      if (response.data.win_amount > 0) {
        toast.success(`You won ${response.data.win_amount.toFixed(4)} ETH!`);
      } else {
        toast.error('Better luck next time!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Bet failed');
    } finally {
      setIsLoading(false);
    }
  };

  const generateClientSeed = () => {
    const seed = Math.random().toString(36).substring(2, 15) + 
                 Math.random().toString(36).substring(2, 15);
    setClientSeed(seed);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900">
      {/* Hero Section with Game Image */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        {/* Background Image - Replace with actual dice game image */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900 to-blue-900">
          <div className="absolute inset-0 opacity-20"
               style={{
                 backgroundImage: 'radial-gradient(circle at 2px 2px, #ffffff 1px, transparent 0)',
                 backgroundSize: '40px 40px'
               }}
          />
        </div>
        
        {/* Animated Dice Pattern */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-32 h-32 md:w-48 md:h-48 animate-bounce">
            <div className="absolute inset-0 bg-white/10 rounded-2xl transform rotate-12 backdrop-blur-sm" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Dice1Icon className="w-20 h-20 md:w-32 md:h-32 text-white/30" />
            </div>
          </div>
        </div>
        
        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-950 to-transparent p-8">
          <div className="container mx-auto">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg">
                <Dice1Icon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Dice</h1>
                <p className="text-gray-300">Roll under target, win big! 1% house edge</p>
              </div>
              <Badge className="ml-auto bg-purple-500/20 text-purple-400 border-purple-500/30">
                <StarIcon className="h-3 w-3 mr-1" />
                Originals
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Game Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Panel */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-900/50 border-gray-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Place Your Bet</CardTitle>
                <CardDescription>
                  Select your bet amount and win chance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Mode Selection */}
                <Tabs value={mode} onValueChange={(v) => setMode(v as 'chance' | 'target')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="chance">Win Chance</TabsTrigger>
                    <TabsTrigger value="target">Target Number</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="chance" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Win Chance: {winChance}%</Label>
                        <span className="text-sm text-gray-400">
                          Multiplier: {multiplier.toFixed(4)}x
                        </span>
                      </div>
                      <Slider
                        value={[winChance]}
                        onValueChange={(v) => setWinChance(v[0])}
                        min={1}
                        max={99}
                        step={1}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="target" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Target Number: {targetNumber}</Label>
                        <span className="text-sm text-gray-400">
                          Win Chance: {targetNumber}%
                        </span>
                      </div>
                      <Slider
                        value={[targetNumber]}
                        onValueChange={(v) => setTargetNumber(v[0])}
                        min={1}
                        max={99}
                        step={1}
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Bet Amount */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Bet Amount (ETH)</Label>
                    <span className="text-sm text-gray-400">
                      Balance: {user?.balance?.ETH?.toFixed(4) || '0.0000'} ETH
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0)}
                      step={0.001}
                      min={0.001}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => setBetAmount(prev => prev / 2)}
                      size="sm"
                    >
                      ½
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setBetAmount(prev => prev * 2)}
                      size="sm"
                    >
                      2×
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setBetAmount(user?.balance?.ETH || 0)}
                      size="sm"
                    >
                      Max
                    </Button>
                  </div>
                </div>

                {/* Client Seed (Provably Fair) */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Client Seed (Optional)</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={generateClientSeed}
                      className="h-auto p-0 text-purple-400"
                    >
                      Generate Random
                    </Button>
                  </div>
                  <Input
                    value={clientSeed}
                    onChange={(e) => setClientSeed(e.target.value)}
                    placeholder="Leave empty for random"
                  />
                  <p className="text-xs text-gray-500">
                    Your personal seed for provably fair verification
                  </p>
                </div>

                {/* Bet Summary */}
                <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Win Chance</span>
                    <span className="font-medium">{winChance}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Multiplier</span>
                    <span className="font-medium text-green-400">{multiplier.toFixed(4)}x</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Potential Win</span>
                    <span className="font-medium text-green-400">{potentialWin.toFixed(4)} ETH</span>
                  </div>
                  <div className="border-t border-gray-700 my-2 pt-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Total Payout</span>
                      <span className="font-bold text-green-400">
                        {potentialWin > 0 ? (potentialWin + betAmount).toFixed(4) : '0.0000'} ETH
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bet Button */}
                <Button
                  onClick={handleBet}
                  disabled={isLoading || !user || betAmount <= 0}
                  className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
                      Rolling...
                    </>
                  ) : !user ? (
                    <Link href="/login">Login to Play</Link>
                  ) : (
                    'Roll Dice'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Last Bet Result */}
            {lastBet && (
              <Card className="mt-6 bg-gray-900/50 border-gray-800">
                <CardHeader>
                  <CardTitle>Last Bet Result</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-4xl font-bold mb-2">
                        {lastBet.result.win ? '🎉 WIN' : '💔 LOSS'}
                      </div>
                      <div className="space-y-1">
                        <p>Roll: {lastBet.result.roll.toFixed(2)}</p>
                        <p>Target: {lastBet.result.target}</p>
                        <p>Bet: {lastBet.amount} ETH</p>
                        <p className="text-green-400">
                          Won: {lastBet.win_amount.toFixed(4)} ETH
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-2">
                        <InfoIcon className="h-3 w-3 mr-1" />
                        Provably Fair
                      </Badge>
                      <p className="text-xs text-gray-500">
                        Nonce: {lastBet.result.nonce}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Balance Card */}
            <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20">
              <CardHeader>
                <CardTitle>Your Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-400">
                  {user?.balance?.ETH?.toFixed(4) || '0.0000'} ETH
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  ≈ ${((user?.balance?.ETH || 0) * 2000).toFixed(2)} USD
                </p>
                <Button asChild className="w-full mt-4" variant="outline">
                  <Link href="/wallet">Deposit</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Game Info */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle>How to Play</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-400 font-medium">1</span>
                  </div>
                  <p>Set your win chance or target number</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-400 font-medium">2</span>
                  </div>
                  <p>Enter your bet amount in ETH</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-400 font-medium">3</span>
                  </div>
                  <p>Roll the dice. Win if roll is under target</p>
                </div>
                
                <Alert className="mt-4">
                  <InfoIcon className="h-4 w-4" />
                  <AlertDescription>
                    House edge: 1%. All results are provably fair.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Recent Bets */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <HistoryIcon className="h-4 w-4 mr-2" />
                  Recent Bets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentBets.slice(0, 5).map((bet, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        {bet.win_amount > 0 ? (
                          <TrendingUpIcon className="h-4 w-4 text-green-400 mr-2" />
                        ) : (
                          <Dice1Icon className="h-4 w-4 text-red-400 mr-2" />
                        )}
                        <span>{bet.amount.toFixed(3)} ETH</span>
                      </div>
                      <span className={bet.win_amount > 0 ? 'text-green-400' : 'text-red-400'}>
                        {bet.win_amount > 0 ? `+${bet.win_amount.toFixed(3)}` : `-${bet.amount.toFixed(3)}`}
                      </span>
                    </div>
                  ))}
                  {recentBets.length === 0 && (
                    <p className="text-center text-gray-500 py-4">
                      No bets yet. Be the first!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Provably Fair Badge */}
            <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20">
              <CardContent className="pt-6 text-center">
                <AwardIcon className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                <h3 className="font-medium mb-1">Provably Fair</h3>
                <p className="text-xs text-gray-400">
                  Every roll is verifiable using server seed, client seed, and nonce
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}