import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Crown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      if (isForgotPassword) {
        await resetPassword(email);
        toast({ title: 'Email Sent', description: 'Check your inbox for the reset link' });
        setIsForgotPassword(false);
      } else if (isSignUp) {
        if (!password || !fullName || !department) {
          toast({ title: 'Missing Info', description: 'Please fill all signup fields', variant: 'destructive' });
          return;
        }
        await signUp(email, password, fullName, department);
        toast({ 
          title: 'Registration Submitted!', 
          description: 'Signup received. Super Admin must approve and assign your role before login is allowed.',
        });
        setIsSignUp(false);
      } else {
        if (!password) return;
        await signIn(email, password);
        toast({ title: 'Welcome back!', description: 'Login successful' });
      }
    } catch (err: any) {
      toast({ 
        title: isForgotPassword ? 'Request Failed' : (isSignUp ? 'Sign Up Failed' : 'Login Failed'), 
        description: err.message || 'Something went wrong', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 text-left">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-xl shadow-primary/20">
            <Crown className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">Rajmandir</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium italic">Feedback Management Ecosystem</p>
        </div>
        <Card className="glass-card border-border/40 shadow-2xl overflow-hidden">
          <CardHeader className="pb-4 bg-muted/20">
            <CardTitle className="text-xl font-display font-bold">
              {isForgotPassword ? 'Reset Access' : (isSignUp ? 'Apply for Access' : 'Secure Admin Login')}
            </CardTitle>
            <CardDescription className="text-xs font-medium">
              {isForgotPassword 
                ? 'Enter your email to receive a secure reset link' 
                : (isSignUp ? 'Signup -> Pending -> Super Admin approval -> Role assignment -> Login' : 'Authorized personnel only')}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider">Full Name</Label>
                    <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dept" className="text-xs font-bold uppercase tracking-wider">Dept</Label>
                    <Input id="dept" value={department} onChange={e => setDepartment(e.target.value)} placeholder="Sales/IT" required />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider">Corporate Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@rajmandir.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              {!isForgotPassword && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider">Password</Label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => setIsForgotPassword(true)}
                        className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors italic"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              )}
              <Button type="submit" className="w-full h-11 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01]" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : (isForgotPassword ? 'Send Link' : (isSignUp ? 'Submit Request' : 'Access Dashboard'))}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  if (isForgotPassword) {
                    setIsForgotPassword(false);
                  } else {
                    setIsSignUp(!isSignUp);
                  }
                }}
                className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors border-b border-transparent hover:border-primary pb-0.5"
              >
                {isForgotPassword 
                  ? 'Back to Login' 
                  : (isSignUp ? 'Already have an account? Sign In' : "New User? Request Approval")}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
