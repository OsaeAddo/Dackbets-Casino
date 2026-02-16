// Home Page
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-5xl font-bold text-center mb-8">
          Welcome to Crypto Casino
        </h1>
        <p className="text-xl text-center mb-12 text-gray-300">
          Provably fair games with instant crypto payouts
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/register">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/games">Play Now</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}