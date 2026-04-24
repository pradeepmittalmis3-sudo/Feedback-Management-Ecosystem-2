import { useEffect } from 'react';
import { useFeedback } from '@/contexts/FeedbackContext';
import StatsCards from '@/components/dashboard/StatsCards';
import FeedbackFilters from '@/components/dashboard/FeedbackFilters';
import FeedbackTable from '@/components/dashboard/FeedbackTable';
import FeedbackCharts from '@/components/dashboard/FeedbackCharts';
import { LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  const { setFilters } = useFeedback();
  
  useEffect(() => {
    setFilters({ status: 'All' });
  }, [setFilters]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Working Data</h2>
              <p className="text-sm text-muted-foreground">Live Supabase operations for daily pending and active feedback updates.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Supabase Live
            </div>
          </div>
        </div>
        <StatsCards />
        <FeedbackCharts />
        <div className="space-y-6">
          <FeedbackFilters />
          <FeedbackTable />
      </div>
    </div>
  );
}
