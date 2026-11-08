'use client';

import { useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EyeIcon, EyeOffIcon, Loader2Icon, CheckCircleIcon, XCircleIcon } from 'lucide-react';
import Link from 'next/link';

type RegisterField = 'email' | 'username' | 'password' | 'confirmPassword';

// Hydration probe: the server snapshot is false, the client snapshot is true,
// so the submit button stays disabled until React has attached the handler.
const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function RegisterForm() {
  const [formData, setFormData] = useState<Record<RegisterField, string>>({
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });

  // The submit button stays disabled until React has hydrated the form.
  // Before that point there is no `onSubmit` handler, so a click or Enter would
  // fall back to the browser's native form submission.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    getClientSnapshot,
    getServerSnapshot,
  );

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });
  
  const { register } = useAuth();

  // Password validation
  const validatePassword = (password: string) => {
    setPasswordStrength({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*]/.test(password)
    });
  };

  const handleChange = (field: RegisterField, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (field === 'password') {
      validatePassword(value);
    }
  };

  const getPasswordStrengthScore = () => {
    return Object.values(passwordStrength).filter(Boolean).length;
  };

  const getPasswordStrengthColor = () => {
    const score = getPasswordStrengthScore();
    if (score <= 2) return 'bg-red-500';
    if (score <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (getPasswordStrengthScore() < 3) {
      setError('Password is too weak');
      return;
    }
    
    setIsLoading(true);
    
    const result = await register(
      formData.email, 
      formData.password, 
      formData.username || undefined
    );
    
    if (!result.success) {
      setError(result.error || 'Registration failed');
    }
    
    setIsLoading(false);
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Create Account</CardTitle>
        <CardDescription className="text-center">
          Join the provably fair crypto casino
        </CardDescription>
      </CardHeader>
      
      {/* No `name` attributes: credentials must never be serialised into a
          native form submission. `method="post"` keeps a fallback submission
          out of the URL and browser history even if a name is added later. */}
      <form onSubmit={handleSubmit} method="post">
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="player@example.com"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="username">Username (Optional)</Label>
            <Input
              id="username"
              type="text"
              placeholder="Player123"
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              disabled={isLoading}
              autoComplete="username"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
                disabled={isLoading}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
            
            {/* Password strength meter */}
            {formData.password && (
              <div className="mt-2 space-y-2">
                <div className="h-1 w-full bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getPasswordStrengthColor()} transition-all`}
                    style={{ width: `${(getPasswordStrengthScore() / 5) * 100}%` }}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <PasswordRequirement 
                    met={passwordStrength.length} 
                    text="At least 8 characters" 
                  />
                  <PasswordRequirement 
                    met={passwordStrength.uppercase} 
                    text="Uppercase letter" 
                  />
                  <PasswordRequirement 
                    met={passwordStrength.lowercase} 
                    text="Lowercase letter" 
                  />
                  <PasswordRequirement 
                    met={passwordStrength.number} 
                    text="Number" 
                  />
                  <PasswordRequirement 
                    met={passwordStrength.special} 
                    text="Special character (!@#$%^&*)" 
                  />
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                required
                disabled={isLoading}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
            
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
            )}
          </div>
          
          <div className="text-xs text-gray-400">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="text-purple-400 hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-purple-400 hover:underline">
              Privacy Policy
            </Link>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !hydrated}
          >
            {isLoading ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Sign Up'
            )}
          </Button>
          
          <p className="text-sm text-gray-400 text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-purple-400 hover:text-purple-300 hover:underline">
              Login
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

// Helper component for password requirements
function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center space-x-1">
      {met ? (
        <CheckCircleIcon className="h-3 w-3 text-green-400" />
      ) : (
        <XCircleIcon className="h-3 w-3 text-gray-500" />
      )}
      <span className={met ? 'text-green-400' : 'text-gray-500'}>{text}</span>
    </div>
  );
}