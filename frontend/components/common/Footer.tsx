// components/common/Footer.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  GithubIcon, 
  TwitterIcon, 
  MessageCircleIcon,
  ShieldIcon,
  LockIcon,
  CoinsIcon
} from 'lucide-react';

export default function Footer() {
  const pathname = usePathname();

  // Don't show footer on auth pages
  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  return (
    <footer className="border-t border-gray-800 bg-gray-950">
      <div className="container mx-auto px-4 py-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <CoinsIcon className="h-6 w-6 text-purple-500" />
              <span className="font-bold text-lg">CryptoCasino</span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Provably fair crypto gambling platform with instant payouts and anonymous play.
            </p>
            <div className="flex space-x-4">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" 
                 className="text-gray-400 hover:text-white transition-colors">
                <TwitterIcon className="h-5 w-5" />
              </a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer"
                 className="text-gray-400 hover:text-white transition-colors">
                <GithubIcon className="h-5 w-5" />
              </a>
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer"
                 className="text-gray-400 hover:text-white transition-colors">
                <MessageCircleIcon className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Games</h3>
            <ul className="space-y-2">
              <FooterLink href="/games/dice">Dice</FooterLink>
              <FooterLink href="/games/slots">Slots</FooterLink>
              <FooterLink href="/games/blackjack">Blackjack</FooterLink>
              <FooterLink href="/games/roulette">Roulette</FooterLink>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <FooterLink href="/faq">FAQ</FooterLink>
              <FooterLink href="/support">Contact Support</FooterLink>
              <FooterLink href="/responsible-gaming">Responsible Gaming</FooterLink>
              <FooterLink href="/provably-fair">Provably Fair</FooterLink>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <FooterLink href="/terms">Terms of Service</FooterLink>
              <FooterLink href="/privacy">Privacy Policy</FooterLink>
              <FooterLink href="/aml">AML Policy</FooterLink>
              <FooterLink href="/kyc">KYC Information</FooterLink>
            </ul>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex flex-wrap justify-center gap-6">
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <ShieldIcon className="h-4 w-4 text-green-400" />
              <span>Provably Fair</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <LockIcon className="h-4 w-4 text-green-400" />
              <span>SSL Encrypted</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <CoinsIcon className="h-4 w-4 text-green-400" />
              <span>Instant Payouts</span>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} CryptoCasino. All rights reserved.</p>
          <p className="mt-1">
            CryptoCasino is licensed and regulated. Please play responsibly.
          </p>
        </div>
      </div>
    </footer>
  );
}

// Helper component for footer links
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link 
        href={href} 
        className="text-sm text-gray-400 hover:text-white transition-colors"
      >
        {children}
      </Link>
    </li>
  );
}