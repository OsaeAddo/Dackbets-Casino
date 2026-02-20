'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeftIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  Dice1Icon,
  AwardIcon,
  SearchIcon,
  FilterIcon,
  ExternalLinkIcon
} from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  transaction_type: 'deposit' | 'withdrawal' | 'bet' | 'win';
  currency: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  created_at: string;
  metadata?: any;
}

export default function TransactionHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    loadTransactions();
  }, [page]);

  useEffect(() => {
    filterTransactions();
  }, [transactions, search, typeFilter, statusFilter]);

  const loadTransactions = async () => {
    try {
      const response = await apiClient.get(`/wallet/transactions?limit=${pageSize}&offset=${(page - 1) * pageSize}`);
      const newTransactions = response.data;
      
      if (newTransactions.length < pageSize) {
        setHasMore(false);
      }
      
      setTransactions(prev => [...prev, ...newTransactions]);
    } catch (error) {
      console.error('Failed to load transactions:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  const filterTransactions = () => {
    let filtered = transactions;

    // Search filter
    if (search) {
      filtered = filtered.filter(tx => 
        tx.id.toLowerCase().includes(search.toLowerCase()) ||
        tx.currency.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(tx => tx.transaction_type === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(tx => tx.status === statusFilter);
    }

    setFilteredTransactions(filtered);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownIcon className="h-4 w-4 text-green-400" />;
      case 'withdrawal': return <ArrowUpIcon className="h-4 w-4 text-red-400" />;
      case 'bet': return <Dice1Icon className="h-4 w-4 text-purple-400" />;
      case 'win': return <AwardIcon className="h-4 w-4 text-yellow-400" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500/10 text-green-500';
      case 'pending': return 'bg-yellow-500/10 text-yellow-500';
      case 'failed': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const loadMore = () => {
    if (hasMore) {
      setPage(prev => prev + 1);
    }
  };

  if (loading && page === 1) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/wallet">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Transaction History</h1>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by ID or currency"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Transaction Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposits</SelectItem>
                <SelectItem value="withdrawal">Withdrawals</SelectItem>
                <SelectItem value="bet">Bets</SelectItem>
                <SelectItem value="win">Wins</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            <Button 
              variant="outline" 
              onClick={() => {
                setSearch('');
                setTypeFilter('all');
                setStatusFilter('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardContent className="pt-6">
          {filteredTransactions.length > 0 ? (
            <div className="space-y-4">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                      {getIcon(tx.transaction_type)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium capitalize">{tx.transaction_type}</span>
                        <Badge className={getStatusColor(tx.status)}>
                          {tx.status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                        <span>{formatDate(tx.created_at)}</span>
                        <code className="text-xs font-mono">{tx.id.slice(0, 16)}...</code>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${
                      tx.transaction_type === 'deposit' || tx.transaction_type === 'win'
                        ? 'text-green-400'
                        : tx.transaction_type === 'withdrawal'
                        ? 'text-red-400'
                        : 'text-purple-400'
                    }`}>
                      {tx.transaction_type === 'deposit' || tx.transaction_type === 'win' ? '+' : '-'}
                      {tx.amount.toFixed(4)} {tx.currency}
                    </p>
                    {tx.metadata?.tx_hash && (
                      <p className="text-xs text-gray-500 mt-1 font-mono">
                        TX: {tx.metadata.tx_hash.slice(0, 10)}...
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400">No transactions found</p>
              <Button asChild variant="link" className="mt-2">
                <Link href="/wallet/deposit">Make your first deposit</Link>
              </Button>
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <Button
              variant="outline"
              onClick={loadMore}
              className="w-full mt-6"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load More'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}