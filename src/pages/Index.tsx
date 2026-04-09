import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import DashboardPage from './DashboardPage';
import AnalyticsPage from './AnalyticsPage';
import StoresPage from './StoresPage';
import ReportsPage from './ReportsPage';
import DoneFeedbacksPage from './DoneFeedbacksPage';
import SettingsPage from './SettingsPage';
import PermissionsPage from './PermissionsPage';
import PendingFeedbacksPage from './PendingFeedbacksPage';
import LoginPage from './LoginPage';
import { Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const routeMap: Record<string, React.ComponentType> = {
  '/': DashboardPage,
  '/analytics': AnalyticsPage,
  '/stores': StoresPage,
  '/reports': ReportsPage,
  '/pending': PendingFeedbacksPage,
  '/done': DoneFeedbacksPage,
  '/settings': SettingsPage,
  '/permissions': PermissionsPage,
};

const Index = () => {
  const { user, loading, role, status, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Strict Approval Gate: Block if pending/rejected OR role is not yet assigned
  if (status?.toLowerCase() !== 'approved' || !role) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center isolate">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-600 mb-6 shadow-2xl relative border border-amber-500/20">
          <Clock className="w-10 h-10 animate-pulse" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full animate-ping opacity-75" />
        </div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-3">Approval Required</h1>
        <p className="max-w-md text-muted-foreground mb-8 text-sm font-medium leading-relaxed">
          Your account request has been submitted. The **Super Admin** must approve your ID and assign a role before login is enabled.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
           <Button variant="outline" className="w-full h-11 border-border font-bold shadow-sm hover:bg-muted" onClick={() => window.location.reload()}>
             Check Status
           </Button>
           <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 font-bold" onClick={() => signOut()}>
             Sign Out & Exit
           </Button>
        </div>
        <div className="mt-12 text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-30">
          Rajmandir Security Protocol v2.0
        </div>
      </div>
    );
  }

  const PageComponent = routeMap[location.pathname] || DashboardPage;

  // Protect Super Admin routes
  if (location.pathname === '/permissions' && role !== 'superadmin') {
    return <DashboardLayout><DashboardPage /></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <PageComponent />
    </DashboardLayout>
  );
};

export default Index;
