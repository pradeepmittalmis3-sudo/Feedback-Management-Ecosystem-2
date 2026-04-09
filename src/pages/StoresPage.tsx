import { useFeedback } from '@/contexts/FeedbackContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Store, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { STORE_LOCATIONS } from '@/types/feedback';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface StoreStats {
  name: string;
  total: number;
  avgRating: number;
  complaints: number;
  solved: number;
  pending: number;
  billReceived: number; 
  staffSatisfied: number;
}

function StoresContent() {
  const { feedbacks } = useFeedback();
  const [search, setSearch] = useState('');

  const storeStats: StoreStats[] = STORE_LOCATIONS.map(loc => {
    const storeFb = feedbacks.filter(f => f.storeLocation === loc);
    const total = storeFb.length;
    const ratings = storeFb.map(f => (f.staffBehavior + f.staffService) / 2);
    const avgRating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;
    return {
      name: loc,
      total,
      avgRating,
      complaints: storeFb.filter(f => f.status === 'Complaint').length,
      solved: storeFb.filter(f => f.status === 'Solved').length,
      pending: storeFb.filter(f => f.status === 'Pending').length,
      billReceived: total ? Math.round((storeFb.filter(f => f.billReceived.toUpperCase() === 'YES').length / total) * 100) : 0,
      staffSatisfied: total ? Math.round((storeFb.filter(f => f.staffSatisfied.toUpperCase() === 'YES').length / total) * 100) : 0,
    };
  }).filter(s => s.total > 0)
    .sort((a, b) => b.total - a.total);

  const filtered = storeStats.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const getRatingColor = (r: number) => {
    if (r >= 4) return 'text-green-500';
    if (r >= 3) return 'text-yellow-500';
    if (r >= 2) return 'text-orange-500';
    return 'text-red-500';
  };

  const getRatingIcon = (r: number) => {
    if (r >= 4) return TrendingUp;
    if (r >= 3) return Minus;
    return TrendingDown;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Store className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Stores</h2>
            <p className="text-sm text-muted-foreground">{storeStats.length} active stores with feedback</p>
          </div>
        </div>
        <Input
          placeholder="Search stores..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64 h-9 text-sm"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Stores</p>
            <p className="text-2xl font-display font-bold text-foreground">{storeStats.length}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Best Rated</p>
            <p className="text-sm font-bold text-green-500 truncate">
              {storeStats.length > 0 ? [...storeStats].sort((a, b) => b.avgRating - a.avgRating)[0].name : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Most Complaints</p>
            <p className="text-sm font-bold text-red-500 truncate">
              {storeStats.length > 0 ? [...storeStats].sort((a, b) => b.complaints - a.complaints)[0].name : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Most Feedbacks</p>
            <p className="text-sm font-bold text-primary truncate">
              {storeStats.length > 0 ? storeStats[0].name : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Store Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((store, i) => {
          const RatingIcon = getRatingIcon(store.avgRating);
          return (
            <Card key={store.name} className="glass-card hover:shadow-lg transition-shadow duration-300 animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Store className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground leading-tight">{store.name}</h3>
                      <p className="text-xs text-muted-foreground">{store.total} feedbacks</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 ${getRatingColor(store.avgRating)}`}>
                    <RatingIcon className="w-3.5 h-3.5" />
                    <span className="text-sm font-bold">{store.avgRating}</span>
                    <Star className="w-3 h-3 fill-current" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center px-2 py-1.5 rounded-lg bg-destructive/5">
                    <p className="text-xs text-muted-foreground">Complaints</p>
                    <p className="text-sm font-bold text-destructive">{store.complaints}</p>
                  </div>
                  <div className="text-center px-2 py-1.5 rounded-lg bg-warning/5">
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="text-sm font-bold text-accent">{store.pending}</p>
                  </div>
                  <div className="text-center px-2 py-1.5 rounded-lg bg-success/5">
                    <p className="text-xs text-muted-foreground">Solved</p>
                    <p className="text-sm font-bold text-success">{store.solved}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Staff Satisfied</span>
                    <span className={`font-medium ${store.staffSatisfied >= 70 ? 'text-green-500' : 'text-red-500'}`}>{store.staffSatisfied}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${store.staffSatisfied >= 70 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${store.staffSatisfied}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Bill Received</span>
                    <span className={`font-medium ${store.billReceived >= 80 ? 'text-green-500' : 'text-red-500'}`}>{store.billReceived}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${store.billReceived >= 80 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${store.billReceived}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No stores found matching "{search}"</p>
        </div>
      )}
    </div>
  );
}

export default function StoresPage() {
  return <StoresContent />;
}
