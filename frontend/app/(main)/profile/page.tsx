// app/(main)/profile/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  UserIcon, 
  MailIcon, 
  CalendarIcon,
  ShieldIcon,
  AwardIcon,
  TrendingUpIcon,
  ClockIcon,
  Dice1Icon,
  WalletIcon,
  SettingsIcon,
  KeyIcon,
  BarChart3Icon,
  EditIcon,
  CopyIcon,
  CheckCircleIcon,
  AlertCircleIcon
} from 'lucide-react';
import { toast } from 'sonner';

interface UserStats {
  totalBets: number;
  totalWagered: Record<string, number>;
  totalWon: Record<string, number>;
  biggestWin: { amount: number; currency: string; game: string };
  winRate: number;
  level: number;
  xp: number;
  nextLevelXp: number;
  rank: string;
  joinDate: string;
}

interface Activity {
  id: string;
  type: 'bet' | 'deposit' | 'withdrawal' | 'win';
  amount: number;
  currency: string;
  timestamp: string;
  details?: string;
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [idLoaded, setIdLoaded] = useState(false);


  useEffect(() => {
    if (user) { 
      loadProfileData();
    }else {
      setLoading(false);
    }
  }, [user]); //rerun when user changes

  useEffect(() => {
    if (user?.id) {
      setIdLoaded(true);
    }
  }, [user?.id]);

  const loadProfileData = async () => {
    try {
      // Load user stats
      const statsResponse = await apiClient.get('/profile/stats');
      setStats(statsResponse.data);

      // Load recent activity
      const activityResponse = await apiClient.get('/profile/activity?limit=5');
      setRecentActivity(activityResponse.data);
    } catch (error) {
      console.error('Failed to load profile data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const copyUserId = () => {
    navigator.clipboard.writeText(user?.id || '');
    setCopied(true);
    toast.success('User ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelProgress = () => {
    if (!stats) return 0;
    return (stats.xp / stats.nextLevelXp) * 100;
  };

  const getRankColor = (rank: string) => {
    const ranks: Record<string, string> = {
      'Bronze': 'text-amber-600',
      'Silver': 'text-gray-400',
      'Gold': 'text-yellow-400',
      'Platinum': 'text-blue-400',
      'Diamond': 'text-purple-400',
      'VIP': 'text-pink-400'
    };
    return ranks[rank] || 'text-gray-400';
  };

  const formatCurrency = (currency: string, amount: number) => {
    if (currency === 'BTC') return `₿${amount.toFixed(6)}`;
    if (currency === 'ETH') return `Ξ${amount.toFixed(4)}`;
    if (currency === 'USDT') return `$${amount.toFixed(2)}`;
    return `${amount.toFixed(4)} ${currency}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  console.log('Full user object:', user);
  console.log('User ID:', user?.id);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-4 mb-8">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
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
      {/* Profile Header */}
      <div className="relative mb-8">
        {/* Cover Image */}
        <div className="h-48 w-full bg-linear-to-r from-purple-600/20 to-blue-600/20 rounded-t-2xl border border-gray-800" />
        
        {/* Profile Info */}
        <div className="relative px-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-16">
            {/* Avatar */}
            <Avatar className="h-32 w-32 border-4 border-gray-900 bg-gray-800">
              <AvatarFallback className="text-4xl bg-linear-to-br from-purple-500 to-blue-500">
                {getInitials()}
              </AvatarFallback>
            </Avatar>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-3">
                    {user?.username || 'Player'}
                    {stats?.rank && (
                      <Badge className={`${getRankColor(stats.rank)} bg-opacity-10`}>
                        {stats.rank}
                      </Badge>
                    )}
                  </h1>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <MailIcon className="h-4 w-4" />
                      <span>{user?.email}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Joined {stats?.joinDate ? formatDate(stats.joinDate) : 'N/A'}</span>
                    </div>
                    <button
                      onClick={copyUserId}
                      className="flex items-center gap-1 hover:text-purple-400 transition-colors"
                    >
                      <span className="font-mono text-xs">{user?.id?.slice(0, 8)}...</span>
                      {copied ? (
                        <CheckCircleIcon className="h-3 w-3 text-green-400" />
                      ) : (
                        <CopyIcon className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href="/profile/settings">
                      <SettingsIcon className="h-4 w-4 mr-2" />
                      Settings
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/profile/security">
                      <KeyIcon className="h-4 w-4 mr-2" />
                      Security
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Level & XP Card */}
          <Card className="bg-linear-to-r from-purple-500/10 to-blue-500/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-400">Current Level</p>
                  <p className="text-3xl font-bold">{stats?.level || 1}</p>
                </div>
                <AwardIcon className="h-8 w-8 text-purple-400" />
              </div>
              <Progress value={getLevelProgress()} className="h-2" />
              <p className="text-sm text-gray-400 mt-2">
                {stats?.xp || 0} / {stats?.nextLevelXp || 1000} XP to next level
              </p>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Total Bets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalBets || 0}</div>
                <p className="text-xs text-gray-400 mt-1">Lifetime bets placed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Win Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">
                  {stats?.winRate ? `${stats.winRate.toFixed(1)}%` : '0%'}
                </div>
                <p className="text-xs text-gray-400 mt-1">Based on last 1000 bets</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Biggest Win
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">
                  {stats?.biggestWin ? formatCurrency(
                    stats.biggestWin.currency,
                    stats.biggestWin.amount
                  ) : 'Ξ0'}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {stats?.biggestWin?.game || 'No wins yet'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Balance Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <WalletIcon className="h-5 w-5 mr-2" />
                Balance Overview
              </CardTitle>
              <CardDescription>Your current wallet balances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {user?.balance && Object.entries(user.balance).map(([currency, amount]) => (
                  <div key={currency} className="p-4 bg-gray-800/30 rounded-lg">
                    <p className="text-sm text-gray-400">{currency}</p>
                    <p className="text-xl font-bold text-green-400">
                      {formatCurrency(currency, amount as number)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button asChild variant="outline" className="h-auto py-4">
                  <Link href="/wallet/deposit">
                    <div className="text-center">
                      <div className="text-lg mb-1">💰</div>
                      <div className="font-medium">Deposit</div>
                    </div>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-4">
                  <Link href="/games">
                    <div className="text-center">
                      <div className="text-lg mb-1">🎮</div>
                      <div className="font-medium">Play Games</div>
                    </div>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-4">
                  <Link href="/profile/stats">
                    <div className="text-center">
                      <div className="text-lg mb-1">📊</div>
                      <div className="font-medium">View Stats</div>
                    </div>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto py-4">
                  <Link href="/profile/settings">
                    <div className="text-center">
                      <div className="text-lg mb-1">⚙️</div>
                      <div className="font-medium">Settings</div>
                    </div>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <Card>
          <CardHeader>
            <CardTitle>Gaming Statistics</CardTitle>
            <CardDescription>Detailed breakdown of your gaming activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Total Wagered by Currency */}
            <div>
              <h3 className="font-medium mb-3">Total Wagered</h3>
              <div className="space-y-3">
                {stats?.totalWagered && Object.entries(stats.totalWagered).map(([currency, amount]) => (
                  <div key={currency} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                    <span>{currency}</span>
                    <span className="font-mono text-purple-400">
                      {formatCurrency(currency, amount as number)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Total Won by Currency */}
            <div>
              <h3 className="font-medium mb-3">Total Won</h3>
              <div className="space-y-3">
                {stats?.totalWon && Object.entries(stats.totalWon).map(([currency, amount]) => (
                  <div key={currency} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                    <span>{currency}</span>
                    <span className="font-mono text-green-400">
                      {formatCurrency(currency, amount as number)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Net Profit/Loss */}
            <div>
              <h3 className="font-medium mb-3">Net Profit/Loss</h3>
              <div className="space-y-3">
                {stats?.totalWagered && stats?.totalWon && 
                  Object.keys(stats.totalWagered).map((currency) => {
                    const wagered = stats.totalWagered[currency] || 0;
                    const won = stats.totalWon[currency] || 0;
                    const net = won - wagered;
                    return (
                      <div key={currency} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                        <span>{currency}</span>
                        <span className={`font-mono ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {net >= 0 ? '+' : ''}{formatCurrency(currency, net)}
                        </span>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest actions on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      {activity.type === 'bet' && <Dice1Icon className="h-4 w-4 text-purple-400" />}
                      {activity.type === 'win' && <AwardIcon className="h-4 w-4 text-yellow-400" />}
                      {activity.type === 'deposit' && <TrendingUpIcon className="h-4 w-4 text-green-400" />}
                      {activity.type === 'withdrawal' && <TrendingUpIcon className="h-4 w-4 text-red-400" />}
                      <div>
                        <p className="font-medium capitalize">{activity.type}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${
                        activity.type === 'win' || activity.type === 'deposit'
                          ? 'text-green-400'
                          : activity.type === 'withdrawal'
                          ? 'text-red-400'
                          : 'text-purple-400'
                      }`}>
                        {activity.type === 'win' || activity.type === 'deposit' ? '+' : '-'}
                        {activity.amount.toFixed(4)} {activity.currency}
                      </p>
                      {activity.details && (
                        <p className="text-xs text-gray-400">{activity.details}</p>
                      )}
                    </div>
                  </div>
                ))}

                <Button asChild variant="outline" className="w-full mt-4">
                  <Link href="/profile/activity">View All Activity</Link>
                </Button>
              </div>
            ) : (
              <p className="text-center text-gray-400 py-8">No recent activity</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}