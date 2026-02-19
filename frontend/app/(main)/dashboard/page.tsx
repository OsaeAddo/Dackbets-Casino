// Homepage/Dashboard
'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dice1Icon, WalletIcon, HistoryIcon, Loader2Icon } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2Icon className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  const balance = user?.balance || {};
  const ethBalance = balance.ETH?.toFixed(4) || '0.0000';

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Welcome back, {user?.username || 'Player'}!</h1>
        <p className="text-gray-400 mt-2">Ready to try your luck?</p>
      </div>

      {/* Balance Card */}
      <Card className="mb-8 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
        <CardHeader>
          <CardTitle>Your Balance</CardTitle>
          <CardDescription>Available funds for playing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-400">{ethBalance} ETH</div>
          <Button className="mt-4" asChild>
            <Link href="/wallet">
              <WalletIcon className="mr-2 h-4 w-4" />
              Deposit More
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Games Grid */}
      <h2 className="text-2xl font-bold mb-4">Popular Games</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Dice Game Card */}
        <Card className="hover:border-purple-500 transition-colors cursor-pointer">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Dice1Icon className="mr-2 h-5 w-5" />
              Dice
            </CardTitle>
            <CardDescription>Roll under target, win big!</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 mb-4">
              House Edge: 1% | Max Win: 1000x
            </p>
            <Button className="w-full" asChild>
              <Link href="/games/dice">Play Now</Link>
            </Button>
          </CardContent>
        </Card>

        {/* More games coming soon */}
        <Card className="opacity-50">
          <CardHeader>
            <CardTitle>Slots</CardTitle>
            <CardDescription>Coming Soon</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled>Play Now</Button>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <CardTitle>Blackjack</CardTitle>
            <CardDescription>Coming Soon</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled>Play Now</Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <HistoryIcon className="mr-2 h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-center py-8">
            No recent activity. Start playing to see your history!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}