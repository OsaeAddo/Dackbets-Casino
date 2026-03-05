// app/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { CoinsIcon, Dice1Icon, ShieldCheckIcon } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/main-bg.avif" // Replace with your actual image path
          alt="Casino background"
          fill
          className="object-cover"
          priority
        />
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/50 to-black/70" />
        
        {/* Animated pattern overlay */}
        <div className="absolute inset-0 opacity-20"
             style={{
               backgroundImage: 'radial-gradient(circle at 2px 2px, #8b5cf6 1px, transparent 0)',
               backgroundSize: '40px 40px'
             }} 
        />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-16 min-h-screen flex flex-col items-center justify-center text-white">
        {/* Logo/Brand */}
        <div className="flex items-center gap-3 mb-8 animate-fade-in">
          <div className="p-3 rounded-2xl bg-linear-to-br from-purple-600 to-blue-600 shadow-lg shadow-purple-500/30">
            <CoinsIcon className="h-8 w-8" />
          </div>
          <span className="text-3xl font-bold">CryptoCasino</span>
        </div>

        {/* Main Title */}
        <h1 className="text-5xl md:text-7xl font-bold text-center mb-6 animate-slide-up">
          <span className="bg-linear-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Welcome to
          </span>
          <br />
          <span className="bg-linear-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
            Crypto Casino
          </span>
        </h1>

        {/* Description */}
        <p className="text-xl md:text-2xl text-center mb-12 text-gray-300 max-w-3xl animate-slide-up animation-delay-200">
          Provably fair games with instant crypto payouts. 
          Play with Bitcoin, Ethereum, and more.
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl animate-slide-up animation-delay-300">
          <div className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
              <ShieldCheckIcon className="h-6 w-6 text-purple-400" />
            </div>
            <h3 className="font-semibold mb-2">Provably Fair</h3>
            <p className="text-sm text-gray-400">Verify every bet with cryptographic proof</p>
          </div>
          
          <div className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
              <CoinsIcon className="h-6 w-6 text-blue-400" />
            </div>
            <h3 className="font-semibold mb-2">Instant Payouts</h3>
            <p className="text-sm text-gray-400">Withdraw your winnings instantly</p>
          </div>
          
          <div className="text-center p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <Dice1Icon className="h-6 w-6 text-green-400" />
            </div>
            <h3 className="font-semibold mb-2">Multiple Games</h3>
            <p className="text-sm text-gray-400">Dice, Slots, Blackjack and more</p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 animation-delay-200">
          <Button asChild size="lg" className="bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 px-8 py-6 text-lg">
            <Link href="/register">
              Get Started
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5 backdrop-blur-sm hover:bg-white/10 text-white px-8 py-6 text-lg">
            <Link href="/games">
              Play Now
            </Link>
          </Button>
        </div>

        {/* Stats Bar */}
        {/* <div className="absolute bottom-8 left-0 right-0">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto text-center text-sm text-gray-400">
              <div>
                <span className="block text-white font-bold text-lg">10K+</span>
                Players
              </div>
              <div>
                <span className="block text-white font-bold text-lg">₿1.5M</span>
                Wagered
              </div>
              <div>
                <span className="block text-white font-bold text-lg">24/7</span>
                Support
              </div>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}