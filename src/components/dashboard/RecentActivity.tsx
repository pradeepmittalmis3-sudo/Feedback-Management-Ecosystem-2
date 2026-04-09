import { useFeedback } from '@/contexts/FeedbackContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { STATUS_COLORS } from '@/types/feedback';
import { Clock, User } from 'lucide-react';

export default function RecentActivity() {
  const { feedbacks } = useFeedback();
  const recent = feedbacks.slice(0, 10);

  return (
    <Card className="glass-card animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-display flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {recent.map((fb, i) => (
          <div
            key={fb._id}
            className={`flex items-start gap-3 py-3 ${i < recent.length - 1 ? 'border-b border-border/50' : ''}`}
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{fb.name}</p>
              <p className="text-xs text-muted-foreground truncate">{fb.storeLocation}</p>
              <div className="flex items-center justify-between mt-1">
                <Badge className={`status-badge text-[10px] py-0 ${STATUS_COLORS[fb.status]}`}>{fb.status}</Badge>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(fb.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
