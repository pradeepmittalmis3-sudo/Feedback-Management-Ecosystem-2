import { Card, CardContent } from '@/components/ui/card';
import { useFeedback } from '@/contexts/FeedbackContext';
import { MessageSquareWarning, Clock, CheckCircle2, Star, Store, FileText } from 'lucide-react';

const statCards = [
  { key: 'total', label: 'Total Feedbacks', icon: FileText, color: 'text-info' },
  { key: 'avgRating', label: 'Avg Rating', icon: Star, color: 'text-warning' },
  { key: 'complaints', label: 'Complaints', icon: MessageSquareWarning, color: 'text-destructive' },
  { key: 'pending', label: 'Pending', icon: Clock, color: 'text-accent' },
  { key: 'solved', label: 'Solved', icon: CheckCircle2, color: 'text-success' },
  { key: 'stores', label: 'Active Stores', icon: Store, color: 'text-primary' },
] as const;

export default function StatsCards() {
  const { stats } = useFeedback();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statCards.map(({ key, label, icon: Icon, color }, i) => (
        <Card 
          key={key} 
          className="glass-card animate-fade-in hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 border-border/40 hover:border-primary/30 group relative overflow-hidden" 
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity blur-3xl rounded-full translate-x-8 -translate-y-8" />
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] text-muted-foreground font-bold tracking-wider uppercase">{label}</span>
              <div className={`w-8 h-8 rounded-full bg-background/80 shadow-sm border border-border/50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-display font-bold text-foreground tracking-tight">
              {key === 'avgRating' ? `${stats[key]}/5` : stats[key]}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
