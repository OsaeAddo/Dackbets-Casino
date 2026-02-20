// components/common/Header.tsx
'use client';
import { useState } from 'react';
import Navigation from './Navigation';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Dice1Icon, 
  WalletIcon, 
  HistoryIcon,
  LogOutIcon,
  UserIcon,
  MenuIcon,
  CoinsIcon
} from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

export default function Header() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();

  const [isNavOpen, setIsNavOpen] = useState(false);

  // Don't show header on auth pages
  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  // Show skeleton while loading
  if (loading) {
    return (
      <header className="border-b border-gray-800 bg-gray-950/95 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Skeleton className="h-8 w-32" />
            <div className="flex items-center space-x-4">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </div>
      </header>
    );
  }

  const getInitials = () => {
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'PL';
  };

  const formatBalance = (currency: string, amount: number) => {
    if (currency === 'BTC') return `₿${amount.toFixed(6)}`;
    if (currency === 'ETH') return `Ξ${amount.toFixed(4)}`;
    return `${amount.toFixed(2)} ${currency}`;
  };

  const getPrimaryBalance = () => {
    if (!user?.balance) return '0.00';
    // Show ETH balance first, then fallback to first available
    if (user.balance.ETH) return formatBalance('ETH', user.balance.ETH);
    const firstCurrency = Object.keys(user.balance)[0];
    if (firstCurrency) return formatBalance(firstCurrency, user.balance[firstCurrency]);
    return '0.00';
  };

  return (
    <>
    <header className="border-b border-gray-800 bg-gray-950/95 sticky top-0 z-50 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <CoinsIcon className="h-6 w-6 text-purple-500" />
            <span className="font-bold text-xl">CryptoCasino</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <NavLink href="/games" active={pathname.startsWith('/games')}>
              <Dice1Icon className="h-4 w-4 mr-1" />
              Games
            </NavLink>
            <NavLink href="/wallet" active={pathname === '/wallet'}>
              <WalletIcon className="h-4 w-4 mr-1" />
              Wallet
            </NavLink>
            <NavLink href="/wallet/history" active={pathname === '/wallet/history'}>
              <HistoryIcon className="h-4 w-4 mr-1" />
              History
            </NavLink>
          </nav>

          {/* User Section */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {/* Balance Display */}
                <div className="hidden md:block px-3 py-1.5 bg-gray-900 rounded-lg border border-gray-800">
                  <span className="text-sm text-gray-400">Balance:</span>
                  <span className="ml-2 font-semibold text-green-400">
                    {getPrimaryBalance()}
                  </span>
                </div>

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-purple-600 text-white">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.username || 'Player'}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Mobile balance display */}
                    <DropdownMenuItem className="md:hidden">
                      <CoinsIcon className="mr-2 h-4 w-4" />
                      <span>Balance: {getPrimaryBalance()}</span>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer">
                        <UserIcon className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem asChild>
                      <Link href="/wallet" className="cursor-pointer">
                        <WalletIcon className="mr-2 h-4 w-4" />
                        <span>Wallet</span>
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem 
                      onClick={() => logout()} 
                      className="cursor-pointer text-red-400 focus:text-red-400"
                    >
                      <LogOutIcon className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Sign Up</Link>
                </Button>
              </div>
            )}

            {/* Mobile Menu Button - Update*/}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden" 
              onClick={() => setIsNavOpen(true)}
            >
              <MenuIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
    <Navigation isOpen={isNavOpen} onClose={() => setIsNavOpen(false)} />
    </>
  );
}

// Helper component for navigation links
function NavLink({ 
  href, 
  active, 
  children 
}: { 
  href: string; 
  active: boolean; 
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center px-3 py-2 text-sm font-medium transition-colors rounded-md ${
        active 
          ? 'text-purple-400 bg-purple-500/10' 
          : 'text-gray-300 hover:text-white hover:bg-gray-800'
      }`}
    >
      {children}
    </Link>
  );
}