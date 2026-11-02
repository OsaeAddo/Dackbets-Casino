'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeftIcon,
  UserIcon,
  BellIcon,
  GlobeIcon,
  SaveIcon,
  Loader2Icon
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    notifications: {
      email: true,
      browser: true,
      marketing: false
    },
    preferences: {
      theme: 'dark',
      language: 'en',
      currency: 'USD'
    }
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
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
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>
            Manage your account preferences and notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Information */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <UserIcon className="h-5 w-5 mr-2" />
              Profile Information
            </h3>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Enter username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter email"
                    disabled
                  />
                  <p className="text-xs text-gray-400">Email cannot be changed</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Notification Settings */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <BellIcon className="h-5 w-5 mr-2" />
              Notification Preferences
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-gray-400">Receive updates via email</p>
                </div>
                <Switch
                  checked={formData.notifications.email}
                  onCheckedChange={(checked) => 
                    setFormData({
                      ...formData,
                      notifications: { ...formData.notifications, email: checked }
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Browser Notifications</Label>
                  <p className="text-sm text-gray-400">Receive real-time alerts</p>
                </div>
                <Switch
                  checked={formData.notifications.browser}
                  onCheckedChange={(checked) => 
                    setFormData({
                      ...formData,
                      notifications: { ...formData.notifications, browser: checked }
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Marketing Communications</Label>
                  <p className="text-sm text-gray-400">Receive promotional offers</p>
                </div>
                <Switch
                  checked={formData.notifications.marketing}
                  onCheckedChange={(checked) => 
                    setFormData({
                      ...formData,
                      notifications: { ...formData.notifications, marketing: checked }
                    })
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Preferences */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <GlobeIcon className="h-5 w-5 mr-2" />
              Preferences
            </h3>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <select
                    id="theme"
                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md"
                    value={formData.preferences.theme}
                    onChange={(e) => 
                      setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, theme: e.target.value }
                      })
                    }
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <select
                    id="language"
                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md"
                    value={formData.preferences.language}
                    onChange={(e) => 
                      setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, language: e.target.value }
                      })
                    }
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Save Button */}
          <Alert>
            <AlertDescription>
              Changes to your settings will be applied immediately.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <SaveIcon className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}