import { useFeedback } from '@/contexts/FeedbackContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS } from '@/types/feedback';
import { Clock, User, MessageSquare, MapPin } from 'lucide-react';

function RecentActivityContent() {
  const { feedbacks } = useFeedback();

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Clock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Recent Activity</h2>
          <p className="text-sm text-muted-foreground">A detailed feed of the latest feedback submissions</p>
        </div>
      </div>

      <Card className="glass-card shadow-xl border-border/40">
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {feedbacks.map((fb, i) => (
              <div
                key={fb._id}
                className="flex items-start gap-4 p-5 hover:bg-primary/[0.02] transition-colors duration-200"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 flex items-center justify-center shrink-0 mt-0.5 border border-primary/10">
                  <span className="text-sm font-bold text-primary">{fb.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-base font-semibold text-foreground flex items-center gap-2">
                        {fb.name}
                        <Badge variant="outline" className="text-[10px] font-mono font-normal">
                          {fb.mobile}
                        </Badge>
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5" /> {fb.storeLocation}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {new Date(fb.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <Badge className={`status-badge text-[10px] py-0 ${STATUS_COLORS[fb.status]}`}>
                        {fb.status}
                      </Badge>
                    </div>
                  </div>

                  {(fb.complaint || fb.problem || fb.suggestions) && (
                    <div className="mt-3 p-3 rounded-lg bg-card border border-border/50 text-sm">
                      {fb.complaint && <p className="text-destructive whitespace-pre-wrap"><span className="font-semibold text-xs uppercase tracking-wider block mb-0.5">Your Complaint</span> {fb.complaint}</p>}
                      {fb.problem && <p className="text-info whitespace-pre-wrap mt-2"><span className="font-semibold text-xs uppercase tracking-wider block mb-0.5">Your Problem</span>{fb.problem}</p>}
                      {fb.suggestions && <p className="text-success whitespace-pre-wrap mt-2"><span className="font-semibold text-xs uppercase tracking-wider block mb-0.5">Suggestions</span>{fb.suggestions}</p>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RecentActivityPage() {
  return <RecentActivityContent />;
}
