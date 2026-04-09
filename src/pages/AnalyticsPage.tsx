import { useFeedback } from '@/contexts/FeedbackContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area, Legend } from 'recharts';
import { STATUS_OPTIONS } from '@/types/feedback';
import { BarChart3, TrendingUp, Star, Users } from 'lucide-react';

const PIE_COLORS = ['hsl(0,84%,60%)', 'hsl(210,80%,55%)', 'hsl(220,10%,65%)', 'hsl(35,95%,55%)', 'hsl(145,65%,42%)', 'hsl(350,80%,45%)'];
const RATING_COLORS = { behavior: 'hsl(350,80%,45%)', service: 'hsl(210,80%,55%)' };

function AnalyticsContent() {
  const { feedbacks } = useFeedback();

  // Status distribution
  const statusData = STATUS_OPTIONS.map(s => ({
    name: s,
    value: feedbacks.filter(f => f.status === s).length,
  }));

  // Top stores by volume
  const storeMap = new Map<string, { total: number; avg: number }>();
  feedbacks.forEach(fb => {
    const avg = (fb.staffBehavior + fb.staffService) / 2;
    const prev = storeMap.get(fb.storeLocation) || { total: 0, avg: 0 };
    storeMap.set(fb.storeLocation, {
      total: prev.total + 1,
      avg: (prev.avg * prev.total + avg) / (prev.total + 1),
    });
  });
  const topStores = Array.from(storeMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([name, data]) => ({
      name: name.length > 14 ? name.slice(0, 14) + '…' : name,
      count: data.total,
      avg: Math.round(data.avg * 10) / 10,
    }));

  // Rating distribution
  const ratingDist = [1, 2, 3, 4, 5].map(r => ({
    rating: `${r} Star`,
    behavior: feedbacks.filter(f => f.staffBehavior === r).length,
    service: feedbacks.filter(f => f.staffService === r).length,
  }));

  // Daily trend (last 30 days)
  const today = new Date();
  const dailyTrend = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (29 - i));
    const dateStr = date.toISOString().slice(0, 10);
    const dayFeedbacks = feedbacks.filter(f => f.createdAt.slice(0, 10) === dateStr);
    return {
      date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      count: dayFeedbacks.length,
      complaints: dayFeedbacks.filter(f => f.status === 'Complaint').length,
    };
  });

  // Satisfaction Overview
  const billYes = feedbacks.filter(f => String(f.billReceived || '').toUpperCase() === 'YES').length;
  const staffSatYes = feedbacks.filter(f => String(f.staffSatisfied || '').toUpperCase() === 'YES').length;
  const satisfactionData = [
    { name: 'Bill Received', yes: billYes, no: feedbacks.length - billYes },
    { name: 'Staff Satisfied', yes: staffSatYes, no: feedbacks.length - staffSatYes },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Analytics</h2>
          <p className="text-sm text-muted-foreground">Detailed insights from {feedbacks.length} feedbacks</p>
        </div>
      </div>

      {/* Trend Chart */}
      <Card className="glass-card animate-fade-in">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Feedback Trend (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(350,80%,45%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(350,80%,45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                <XAxis dataKey="date" fontSize={10} tickLine={false} />
                <YAxis fontSize={10} tickLine={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="count" name="Total" stroke="hsl(350,80%,45%)" fillOpacity={1} fill="url(#colorCount)" />
                <Area type="monotone" dataKey="complaints" name="Complaints" stroke="hsl(0,84%,60%)" fill="hsl(0,84%,60%)" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''} labelLine={false} fontSize={10}>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Rating Distribution */}
        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Star className="w-4 h-4 text-warning" /> Rating Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                  <XAxis dataKey="rating" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="behavior" name="Staff Behaviour" fill={RATING_COLORS.behavior} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="service" name="Staff Service" fill={RATING_COLORS.service} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Stores */}
        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Users className="w-4 h-4 text-info" /> Top Stores by Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topStores} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,90%)" />
                  <XAxis type="number" fontSize={10} />
                  <YAxis type="category" dataKey="name" fontSize={10} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" name="Feedbacks" fill="hsl(350,80%,45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Satisfaction Overview */}
        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Key Satisfaction Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 pt-4">
              {satisfactionData.map(item => {
                const total = item.yes + item.no;
                const pct = total > 0 ? Math.round((item.yes / total) * 100) : 0;
                return (
                  <div key={item.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{item.name}</span>
                      <span className={`font-bold ${pct >= 70 ? 'text-green-500' : pct >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>{pct}%</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Yes: {item.yes}</span>
                      <span>No: {item.no}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return <AnalyticsContent />;
}
