// components/common/Navigation.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  Dice1Icon, 
  WalletIcon, 
  HistoryIcon,
  HomeIcon,
  XIcon,
  LogOutIcon,
  UserIcon
} from 'lucide-react';

interface NavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Navigation({ isOpen, onClose }: NavigationProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!isOpen) return null;

  const navItems = [
    { href: '/', label: 'Home', icon: HomeIcon },
    { href: '/games', label: 'Games', icon: Dice1Icon },
    { href: '/wallet', label: 'Wallet', icon: WalletIcon },
    { href: '/wallet/history', label: 'History', icon: HistoryIcon },
  ];

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />
      
      {/* Navigation Drawer */}
      <div className="fixed left-0 top-0 h-full w-64 bg-gray-950 border-r border-gray-800 z-50 md:hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <span className="font-bold text-lg">Menu</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <XIcon className="h-5 w-5" />
            </Button>
          </div>

          {/* User Info (if logged in) */}
          {user && (
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{user.username || 'Player'}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || 
                  (item.href !== '/' && pathname.startsWith(item.href));
                
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-purple-500/10 text-purple-400'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Logout Button (if logged in) */}
          {user && (
            <div className="p-4 border-t border-gray-800">
              <button
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 w-full transition-colors"
              >
                <LogOutIcon className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}