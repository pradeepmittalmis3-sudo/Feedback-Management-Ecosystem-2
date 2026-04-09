import { useFeedback } from '@/contexts/FeedbackContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { STATUS_OPTIONS } from '@/types/feedback';

const PIE_COLORS = ['hsl(0,84%,60%)', 'hsl(210,80%,55%)', 'hsl(220,10%,65%)', 'hsl(35,95%,55%)', 'hsl(145,65%,42%)', 'hsl(350,80%,45%)'];

export default function FeedbackCharts() {
  const { feedbacks } = useFeedback();

  const statusData = STATUS_OPTIONS.map(s => ({
    name: s,
    value: feedbacks.filter(f => f.status === s).length,
  }));

  const storeMap = new Map<string, { total: number; avg: number }>();
  feedbacks.forEach(fb => {
    // Only calculate average if we have valid ratings
    const scores = [fb.staffBehavior, fb.staffService].filter(s => s > 0);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    if (avg > 0) {
      const prev = storeMap.get(fb.storeLocation) || { total: 0, avg: 0 };
      storeMap.set(fb.storeLocation, {
        total: prev.total + 1,
        avg: (prev.avg * prev.total + avg) / (prev.total + 1),
      });
    }
  });

  const topStores = Array.from(storeMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([name, data]) => ({ name: name.length > 12 ? name.slice(0, 12) + '…' : name, count: data.total, avg: Math.round(data.avg * 10) / 10 }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display">Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''} labelLine={false} fontSize={10}>
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
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display">Top Stores by Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topStores} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" fontSize={10} />
                <YAxis type="category" dataKey="name" fontSize={10} width={90} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(350,80%,45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
