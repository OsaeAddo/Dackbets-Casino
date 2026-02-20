// app/(main)/profile/security/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeftIcon,
  KeyIcon,
  ShieldIcon,
  SmartphoneIcon,
  MailIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon
} from 'lucide-react';
import { toast } from 'sonner';

export default function SecurityPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const handlePasswordChange = async () => {
    if (passwordData.new !== passwordData.confirm) {
      toast.error('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Password changed successfully');
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (error) {
      toast.error('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setTwoFactorEnabled(!twoFactorEnabled);
      toast.success(twoFactorEnabled ? '2FA disabled' : '2FA enabled');
    } catch (error) {
      toast.error('Failed to update 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Button asChild variant="ghost" className="mb-4">
        <Link href="/profile">
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Profile
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShieldIcon className="h-5 w-5 mr-2" />
            Security Settings
          </CardTitle>
          <CardDescription>
            Manage your account security and authentication methods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Password Change */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <KeyIcon className="h-5 w-5 mr-2" />
              Change Password
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordData.current}
                    onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="h-4 w-4 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordData.new}
                  onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordData.confirm}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showConfirmPassword ? (
                      <EyeOffIcon className="h-4 w-4 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                onClick={handlePasswordChange}
                disabled={loading || !passwordData.current || !passwordData.new || !passwordData.confirm}
              >
                {loading ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Two-Factor Authentication */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <SmartphoneIcon className="h-5 w-5 mr-2" />
              Two-Factor Authentication
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Status: {
                  twoFactorEnabled ? (
                    <Badge className="bg-green-500/10 text-green-500 ml-2">Enabled</Badge>
                  ) : (
                    <Badge className="bg-yellow-500/10 text-yellow-500 ml-2">Disabled</Badge>
                  )
                }</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Button
                variant={twoFactorEnabled ? 'destructive' : 'default'}
                onClick={handleToggle2FA}
                disabled={loading}
              >
                {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Login Sessions */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <MailIcon className="h-5 w-5 mr-2" />
              Active Sessions
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <div>
                    <p className="font-medium">Current Session</p>
                    <p className="text-sm text-gray-400">Chrome on Windows • Now</p>
                  </div>
                </div>
                <Badge variant="outline">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg opacity-50">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  <div>
                    <p className="font-medium">Mobile Session</p>
                    <p className="text-sm text-gray-400">Safari on iPhone • 2 days ago</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">Revoke</Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Danger Zone */}
          <div className="border border-red-500/20 rounded-lg p-4">
            <h3 className="text-lg font-medium text-red-400 mb-2">Danger Zone</h3>
            <p className="text-sm text-gray-400 mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <Button variant="destructive">Delete Account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}