'use client';
import { useState } from 'react';
import Navigation from './Navigation';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dice1Icon,
  WalletIcon,
  HistoryIcon,
  LogOutIcon,
  UserIcon,
  MenuIcon,
  CoinsIcon,
  ChevronDownIcon,
  CheckIcon
} from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

export default function Header() {
  const { user, logout, loading } = useAuth();
  const { selectedCurrency, setSelectedCurrency, currencyConfig } = useCurrency();
  const pathname = usePathname();
  const [isNavOpen, setIsNavOpen] = useState(false);

  // Don't show header on auth pages
  if (pathname === '/login' || pathname === '/register') {
    return null;
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

  // Get all balances with icons
  const getAllBalances = () => {
    return Object.values(currencyConfig).map(config => ({
      ...config,
      balance: user?.balance?.[config.value] || 0
    }));
  };

  // Get the currently selected currency's full config
  const currentCurrency = currencyConfig[selectedCurrency];
  const currentBalance = user?.balance?.[selectedCurrency] || 0;
  
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
                  {/* Balance Dropdown - Now shows selected currency as primary */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-gray-900 border-gray-800 hover:bg-gray-800"
                      >
                        <currentCurrency.icon
                          className="h-4 w-4"
                          style={{ color: currentCurrency.color }}
                        />
                        <span className="font-semibold text-green-400">
                          {currentCurrency.format(currentBalance)}
                        </span>
                        <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64" align="end">
                      <DropdownMenuLabel>Select Currency</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        {getAllBalances().map((currency) => (
                          <DropdownMenuItem
                            key={currency.value}
                            className={`cursor-pointer ${selectedCurrency === currency.value ? 'bg-purple-500/10' : ''}`}
                            onClick={() => setSelectedCurrency(currency.value)}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center space-x-2">
                                <currency.icon
                                  className="h-5 w-5"
                                  style={{ color: currency.color }}
                                />
                                <span>{currency.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`font-mono ${currency.balance > 0 ? 'text-green-400' : 'text-gray-500'
                                  }`}>
                                  {currency.format(currency.balance)}
                                </span>
                                {selectedCurrency === currency.value && (
                                  <CheckIcon className="h-4 w-4 text-purple-400" />
                                )}
                              </div>
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/wallet" className="cursor-pointer w-full">
                          <WalletIcon className="mr-2 h-4 w-4" />
                          <span>Manage Wallet</span>
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

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

                      {/* Mobile balance display - shows all currencies */}
                      <div className="md:hidden">
                        <DropdownMenuLabel className="text-xs text-gray-400">
                          Balances
                        </DropdownMenuLabel>
                        {getAllBalances().map((currency) => (
                          <DropdownMenuItem
                            key={currency.value}
                            className="cursor-default"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center space-x-2">
                                <currency.icon
                                  className="h-4 w-4"
                                  style={{ color: currency.color }}
                                />
                                <span className="text-sm">{currency.value}</span>
                              </div>
                              <span className={`text-sm font-mono ${currency.balance > 0 ? 'text-green-400' : 'text-gray-500'
                                }`}>
                                {currency.balance > 0 ? currency.format(currency.balance) : '0'}
                              </span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                      </div>

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

              {/* Mobile Menu Button */}
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
      className={`flex items-center px-3 py-2 text-sm font-medium transition-colors rounded-md ${active
          ? 'text-purple-400 bg-purple-500/10'
          : 'text-gray-300 hover:text-white hover:bg-gray-800'
        }`}
    >
      {children}
    </Link>
  );
}