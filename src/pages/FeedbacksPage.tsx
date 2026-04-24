import { FeedbackProvider, useFeedback } from '@/contexts/FeedbackContext';
import FeedbackFilters from '@/components/dashboard/FeedbackFilters';
import FeedbackTable from '@/components/dashboard/FeedbackTable';
import { MessageSquare, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

function FeedbacksContent() {
  const { filteredFeedbacks } = useFeedback();

  const exportCSV = () => {
    const headers = [
      'Timestamp',
      'Name',
      'Mobile Number',
      'Store Location',
      'Staff Behavior',
      'Staff Service',
      'Satisfaction Level',
      'Price Challenge',
      'Bill Received',
      'Your Feedback',
      'Improvement Feedback',
      'Product Unavailable',
      'Receipt Compliance',
      'Your Complaint',
      'Type of Complaint',
      'Status',
      'Assigned To',
      'Mode',
      'Remarks',
      'Updated By',
    ];
    const rows = filteredFeedbacks.map(fb => [
      new Date(fb.createdAt).toLocaleString('en-IN'),
      fb.name || '',
      fb.mobile || '',
      fb.storeLocation || '',
      fb.staffBehavior ?? '',
      fb.staffService ?? '',
      fb.staffSatisfied || '',
      fb.priceChallenge || '',
      fb.billReceived || '',
      fb.feedback || '',
      fb.improvementFeedback || fb.suggestions || '',
      fb.productUnavailable || '',
      fb.billCompliance || '',
      fb.complaint || '',
      fb.type || '',
      fb.status || '',
      fb.assignedTo || fb.userName || '',
      fb.mode || '',
      fb.remarks || fb.statusNotes || '',
      fb.updatedBy || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rajmandir-feedbacks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-info" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">All Feedbacks</h2>
            <p className="text-sm text-muted-foreground">{filteredFeedbacks.length} results found</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>
      <FeedbackFilters />
      <FeedbackTable />
    </div>
  );
}

export default function FeedbacksPage() {
  return (
    <FeedbackProvider>
      <FeedbacksContent />
    </FeedbackProvider>
  );
}
