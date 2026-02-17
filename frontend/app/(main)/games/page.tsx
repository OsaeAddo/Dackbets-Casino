// app/(main)/games/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Dice1Icon, 
  SearchIcon,
  TrendingUpIcon,
  ClockIcon,
  UsersIcon,
  StarIcon
} from 'lucide-react';

// Game data
const games = [
  {
    id: 'dice',
    name: 'Dice',
    description: 'Roll under target, win big! Classic provably fair dice game.',
    icon: Dice1Icon,
    color: 'from-purple-500 to-blue-500',
    players: 1234,
    popularity: 98,
    minBet: 0.001,
    maxWin: '1000x',
    houseEdge: '1%',
    featured: true,
    href: '/games/dice'
  },
  {
    id: 'slots',
    name: 'Slots',
    description: 'Spin to win with massive multipliers. Coming soon!',
    icon: Dice1Icon,
    color: 'from-green-500 to-emerald-500',
    players: 0,
    popularity: 0,
    minBet: 0,
    maxWin: 'Soon',
    houseEdge: 'Soon',
    featured: false,
    href: '#',
    disabled: true
  },
  {
    id: 'blackjack',
    name: 'Blackjack',
    description: 'Beat the dealer in this classic card game. Coming soon!',
    icon: Dice1Icon,
    color: 'from-red-500 to-orange-500',
    players: 0,
    popularity: 0,
    minBet: 0,
    maxWin: 'Soon',
    houseEdge: 'Soon',
    featured: false,
    href: '#',
    disabled: true
  },
  {
    id: 'roulette',
    name: 'Roulette',
    description: 'Place your bets on red or black. Coming soon!',
    icon: Dice1Icon,
    color: 'from-yellow-500 to-amber-500',
    players: 0,
    popularity: 0,
    minBet: 0,
    maxWin: 'Soon',
    houseEdge: 'Soon',
    featured: false,
    href: '#',
    disabled: true
  }
];

export default function GamesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredGames = games.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         game.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || 
                           (selectedCategory === 'popular' && game.popularity > 90) ||
                           (selectedCategory === 'new' && game.featured);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Games</h1>
        <p className="text-gray-400">Choose from our selection of provably fair games</p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full md:w-auto">
          <TabsList>
            <TabsTrigger value="all">All Games</TabsTrigger>
            <TabsTrigger value="popular">Popular</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGames.map((game) => {
          const Icon = game.icon;
          return (
            <Card 
              key={game.id}
              className={`group relative overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/10 ${
                game.disabled ? 'opacity-50' : 'cursor-pointer'
              }`}
            >
              {/* Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
              
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${game.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  {game.featured && (
                    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                      <StarIcon className="h-3 w-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                </div>
                <CardTitle className="mt-4">{game.name}</CardTitle>
                <CardDescription>{game.description}</CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Min Bet</p>
                    <p className="font-medium">{game.minBet} ETH</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Max Win</p>
                    <p className="font-medium text-green-400">{game.maxWin}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">House Edge</p>
                    <p className="font-medium">{game.houseEdge}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Players</p>
                    <p className="font-medium flex items-center">
                      <UsersIcon className="h-3 w-3 mr-1 text-gray-400" />
                      {game.players.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter>
                <Button 
                  className="w-full" 
                  disabled={game.disabled}
                  asChild={!game.disabled}
                >
                  {!game.disabled ? (
                    <Link href={game.href}>Play Now</Link>
                  ) : (
                    <span>Coming Soon</span>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Stats Section */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Players</p>
                <p className="text-2xl font-bold">1,234</p>
              </div>
              <UsersIcon className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Wagered</p>
                <p className="text-2xl font-bold">Ξ 12,345</p>
              </div>
              <TrendingUpIcon className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Biggest Win</p>
                <p className="text-2xl font-bold">Ξ 1,234</p>
              </div>
              <ClockIcon className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}