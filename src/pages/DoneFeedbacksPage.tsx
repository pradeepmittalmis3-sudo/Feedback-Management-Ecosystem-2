import { useEffect } from 'react';
import { useFeedback } from '@/contexts/FeedbackContext';
import FeedbackFilters from '@/components/dashboard/FeedbackFilters';
import FeedbackTable from '@/components/dashboard/FeedbackTable';

export default function DoneFeedbacksPage() {
  const { setFilters } = useFeedback();

  useEffect(() => {
    setFilters({ status: 'Solved' });
  }, [setFilters]);

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-[28px] font-display font-bold text-foreground">Completed Resolutions</h1>
          <p className="text-muted-foreground mt-1 text-[15px]">Historical records of feedback that have been solved.</p>
        </div>
        
        <div className="space-y-6">
          <FeedbackFilters />
          <FeedbackTable />
        </div>
    </div>
  );
}
