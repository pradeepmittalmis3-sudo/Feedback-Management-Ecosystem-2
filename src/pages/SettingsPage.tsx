import { FeedbackProvider } from '@/contexts/FeedbackContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, User, Bell, Shield, Key, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

function SettingsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully.",
      });
    }, 1000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="flex items-center justify-between bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">System Settings</h2>
            <p className="text-sm text-muted-foreground mt-1">Manage your account settings and preferences.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={loading} className="gap-2 shadow-md">
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Navigation */}
        <div className="space-y-2">
          <Button variant="secondary" className="w-full justify-start gap-3 h-11">
            <User className="w-4 h-4" /> Profile Details
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 h-11 text-muted-foreground hover:text-foreground">
            <Bell className="w-4 h-4" /> Notifications
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 h-11 text-muted-foreground hover:text-foreground">
            <Shield className="w-4 h-4" /> Security
          </Button>
        </div>

        {/* Right Column - Forms */}
        <div className="md:col-span-2 space-y-6">
          <Card className="glass-card border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Profile Information
              </CardTitle>
              <CardDescription>Update your personal details here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" placeholder="Admin" defaultValue="Admin" className="bg-background/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" placeholder="User" defaultValue="User" className="bg-background/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" value={user?.email || ''} readOnly className="bg-muted cursor-not-allowed" />
                <p className="text-xs text-muted-foreground">Email address cannot be changed.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Bell className="w-5 h-5 text-info" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose what updates you want to receive.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">New Feedback Alerts</Label>
                  <p className="text-sm text-muted-foreground">Receive an email when new feedback is submitted.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Negative Feedback Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified immediately for ratings below 3 stars.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Weekly Summary</Label>
                  <p className="text-sm text-muted-foreground">Receive a weekly digest of feedback metrics.</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Key className="w-5 h-5 text-warning" />
                Password Reset
              </CardTitle>
              <CardDescription>Update your password to keep your account secure.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label htmlFor="currentPass">Current Password</Label>
                <Input id="currentPass" type="password" placeholder="••••••••" className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPass">New Password</Label>
                <Input id="newPass" type="password" placeholder="••••••••" className="bg-background/50" />
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <FeedbackProvider>
      <SettingsContent />
    </FeedbackProvider>
  );
}
