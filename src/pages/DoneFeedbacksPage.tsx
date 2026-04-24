import { useEffect } from 'react';
import { FeedbackProvider, useFeedback } from '@/contexts/FeedbackContext';
import FeedbackFilters from '@/components/dashboard/FeedbackFilters';
import FeedbackTable from '@/components/dashboard/FeedbackTable';
import StatsCards from '@/components/dashboard/StatsCards';
import FeedbackCharts from '@/components/dashboard/FeedbackCharts';
import { CheckCircle2 } from 'lucide-react';

function DoneFeedbacksContent() {
  const { filteredFeedbacks, setFilters } = useFeedback();

  useEffect(() => {
    setFilters({ status: 'All' });
  }, [setFilters]);

  const completedRecords = [...filteredFeedbacks]
    .sort((a, b) => {
      const aTime = new Date(a.closedAt || a.resolvedAt || a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.closedAt || b.resolvedAt || b.updatedAt || b.createdAt).getTime();
      return bTime - aTime;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-success" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Resolved / Closed Records</h2>
            <p className="text-sm text-muted-foreground">All completed records from historical data with full update history.</p>
          </div>
        </div>
      </div>

      <StatsCards hiddenKeys={['pending']} />
      <FeedbackCharts />
      <div className="space-y-6">
        <FeedbackFilters />
        <FeedbackTable
          readOnly
          records={completedRecords}
          title="Completed Records"
        />
      </div>
    </div>
  );
}

export default function DoneFeedbacksPage() {
  return (
    <FeedbackProvider source="migration" initialFilterStatus="All">
      <DoneFeedbacksContent />
    </FeedbackProvider>
  );
}
