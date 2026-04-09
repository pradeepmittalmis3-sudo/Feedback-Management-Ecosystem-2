import { useFeedback } from '@/contexts/FeedbackContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Calendar, AlertTriangle, Star, TrendingUp, Store } from 'lucide-react';
import { STORE_LOCATIONS, STATUS_OPTIONS } from '@/types/feedback';

function ReportsContent() {
  const { feedbacks } = useFeedback();

  const generateReport = (type: string) => {
    let csv = '';
    const today = new Date().toISOString().slice(0, 10);

    switch (type) {
      case 'full': {
        const headers = ['Date', 'Name', 'Mobile Number', 'Store Location', 'Staff Behaviour', 'Staff Service', 'Staff Satisfied', 'Price challenge', 'Bill Received', 'Feedback', 'Suggestions', 'Product Unavailable', 'No purchase without bill', 'Complaint', 'Type', 'Status', 'Status Notes'];
        const rows = feedbacks.map(fb => [
          new Date(fb.createdAt).toLocaleDateString('en-IN'), fb.name, fb.mobile, fb.storeLocation,
          fb.staffBehavior, fb.staffService, fb.staffSatisfied, fb.priceChallenge, fb.billReceived,
          fb.feedback || '', fb.suggestions || '', fb.productUnavailable || '', fb.billCompliance || '',
          fb.complaint || '', fb.type || '', fb.status, fb.statusNotes || '',
        ]);
        csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        break;
      }
      case 'complaints': {
        const complaints = feedbacks.filter(f => f.complaint && f.complaint.trim());
        const headers = ['Date', 'Name', 'Mobile', 'Store', 'Complaint', 'Status'];
        const rows = complaints.map(fb => [
          new Date(fb.createdAt).toLocaleDateString('en-IN'), fb.name, fb.mobile,
          fb.storeLocation, fb.complaint || '', fb.status,
        ]);
        csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        break;
      }
      case 'store-summary': {
        const headers = ['Store Location', 'Total Feedbacks', 'Avg Rating', 'Complaints', 'Pending', 'Solved', 'Bill Received %', 'Staff Satisfied %'];
        const storeData = STORE_LOCATIONS.map(loc => {
          const storeFb = feedbacks.filter(f => f.storeLocation === loc);
          const total = storeFb.length;
          if (total === 0) return null;
          const ratings = storeFb.map(f => (f.staffBehavior + f.staffService) / 2);
          const avgRating = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
          return [
            loc, total, avgRating,
            storeFb.filter(f => f.status === 'Complaint').length,
            storeFb.filter(f => f.status === 'Pending').length,
            storeFb.filter(f => f.status === 'Solved').length,
            Math.round((storeFb.filter(f => String(f.billReceived || '').toUpperCase() === 'YES').length / total) * 100),
            Math.round((storeFb.filter(f => String(f.staffSatisfied || '').toUpperCase() === 'YES').length / total) * 100),
          ];
        }).filter(Boolean);
        csv = [headers.join(','), ...storeData.map(r => r!.map(c => `"${c}"`).join(','))].join('\n');
        break;
      }
      case 'ratings': {
        const headers = ['Store Location', 'Avg Staff Behaviour', 'Avg Staff Service', 'Overall Avg'];
        const ratingData = STORE_LOCATIONS.map(loc => {
          const storeFb = feedbacks.filter(f => f.storeLocation === loc);
          if (storeFb.length === 0) return null;
          const avgB = Math.round((storeFb.reduce((s, f) => s + f.staffBehavior, 0) / storeFb.length) * 10) / 10;
          const avgS = Math.round((storeFb.reduce((s, f) => s + f.staffService, 0) / storeFb.length) * 10) / 10;
          const overall = Math.round(((avgB + avgS) / 2) * 10) / 10;
          return [loc, avgB, avgS, overall];
        }).filter(Boolean);
        csv = [headers.join(','), ...ratingData.map(r => r!.map(c => `"${c}"`).join(','))].join('\n');
        break;
      }
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rajmandir-${type}-report-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reports = [
    {
      id: 'full',
      title: 'Full Feedback Report',
      description: 'Complete export of all feedback data including ratings, comments, and status',
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      count: feedbacks.length,
      countLabel: 'records',
    },
    {
      id: 'complaints',
      title: 'Complaints Report',
      description: 'All feedbacks containing complaints, sorted by date',
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      count: feedbacks.filter(f => f.complaint && f.complaint.trim()).length,
      countLabel: 'complaints',
    },
    {
      id: 'store-summary',
      title: 'Store Summary Report',
      description: 'Per-store summary with totals, average ratings, and satisfaction percentages',
      icon: Store,
      color: 'text-info',
      bgColor: 'bg-info/10',
      count: new Set(feedbacks.map(f => f.storeLocation)).size,
      countLabel: 'stores',
    },
    {
      id: 'ratings',
      title: 'Ratings Analysis Report',
      description: 'Detailed rating breakdown by store for behavior, service, and store satisfaction',
      icon: Star,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      count: feedbacks.length,
      countLabel: 'ratings',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Reports</h2>
          <p className="text-sm text-muted-foreground">Download CSV reports for analysis</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((report, i) => (
          <Card key={report.id} className="glass-card hover:shadow-lg transition-all duration-300 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl ${report.bgColor} flex items-center justify-center shrink-0`}>
                  <report.icon className={`w-6 h-6 ${report.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-display font-bold text-foreground mb-1">{report.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{report.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {report.count} {report.countLabel}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => generateReport(report.id)} className="gap-2">
                      <Download className="w-3.5 h-3.5" /> Download
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return <ReportsContent />;
}
