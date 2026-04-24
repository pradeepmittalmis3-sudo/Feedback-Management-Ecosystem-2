import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { BarChart3, TrendingUp, Star, Users } from 'lucide-react';
import { useReportRecords } from '@/hooks/useReportRecords';

const PIE_COLORS = ['hsl(0,84%,60%)', 'hsl(210,80%,55%)', 'hsl(220,10%,65%)', 'hsl(35,95%,55%)', 'hsl(145,65%,42%)', 'hsl(350,80%,45%)'];
const RATING_COLORS = { behavior: 'hsl(350,80%,45%)', service: 'hsl(210,80%,55%)' };
const ALL_OPTION = 'All';

type AnalyticsFilters = {
  startDate: string;
  endDate: string;
  store: string;
  status: string;
  assignedTo: string;
  updatedBy: string;
};

const DEFAULT_FILTERS: AnalyticsFilters = {
  startDate: '',
  endDate: '',
  store: ALL_OPTION,
  status: ALL_OPTION,
  assignedTo: ALL_OPTION,
  updatedBy: ALL_OPTION,
};

function normalizeValue(value: unknown) {
  return String(value || '').trim();
}

function normalizeKey(value: unknown) {
  return normalizeValue(value).toLowerCase();
}

function isYes(value: unknown) {
  const key = normalizeKey(value);
  return key === 'yes' || key === 'true' || key === 'y' || key === '1';
}

function truncateLabel(value: string, max = 14) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function prettifyLabel(value: string) {
  const raw = normalizeValue(value);
  if (!raw) return '-';

  const normalized = raw
    .replace(/[_|]+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.includes(' ')) return normalized;

  const tokens = ['NAGAR', 'GARDEN', 'PURI', 'MOR', 'SECTOR', 'SEC', 'EXTENSION', 'ENCLAVE', 'STATION', 'JHEEL', 'BAGH', 'RAYA', 'NEW'];
  let spaced = normalized.toUpperCase();
  tokens.forEach(token => {
    spaced = spaced.replace(new RegExp(token, 'g'), ` ${token}`);
  });

  return spaced.replace(/\s+/g, ' ').trim();
}

function formatTickLabel(value: string, max = 18) {
  return truncateLabel(prettifyLabel(value), max);
}

function AnalyticsContent() {
  const { combinedRecords } = useReportRecords();
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_FILTERS);

  const storeOptions = useMemo(
    () => Array.from(new Set(combinedRecords.map(record => record.store).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [combinedRecords]
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(combinedRecords.map(record => record.status).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [combinedRecords]
  );

  const assignedOptions = useMemo(
    () => Array.from(new Set(combinedRecords.map(record => record.assignedTo).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [combinedRecords]
  );

  const updatedByOptions = useMemo(
    () => Array.from(new Set(combinedRecords.map(record => record.updatedBy).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [combinedRecords]
  );

  const filteredRecords = useMemo(() => {
    const fromDate = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
    const toDate = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;

    return combinedRecords.filter(record => {
      if (filters.store !== ALL_OPTION && normalizeKey(record.store) !== normalizeKey(filters.store)) return false;
      if (filters.status !== ALL_OPTION && normalizeKey(record.status) !== normalizeKey(filters.status)) return false;
      if (filters.assignedTo !== ALL_OPTION && normalizeKey(record.assignedTo) !== normalizeKey(filters.assignedTo)) return false;
      if (filters.updatedBy !== ALL_OPTION && normalizeKey(record.updatedBy) !== normalizeKey(filters.updatedBy)) return false;
      if (fromDate && new Date(record.createdAt) < fromDate) return false;
      if (toDate && new Date(record.createdAt) > toDate) return false;
      return true;
    });
  }, [combinedRecords, filters]);

  const filteredSourceCounts = useMemo(() => {
    const migrationRows = filteredRecords.filter(record => record.source === 'migration').length;
    const resolvedClosedWorkingRows = filteredRecords.filter(record => record.source === 'working').length;
    return {
      migrationRows,
      resolvedClosedWorkingRows,
      combinedBeforeDedupe: filteredRecords.length,
    };
  }, [filteredRecords]);

  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach(record => {
      map.set(record.status, (map.get(record.status) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRecords]);

  const topStores = useMemo(() => {
    const storeMap = new Map<string, { total: number; avgSum: number; avgCount: number }>();

    filteredRecords.forEach(record => {
      const validRatings = [record.staffBehavior, record.staffService].filter(score => score > 0);
      const row = storeMap.get(record.store) || { total: 0, avgSum: 0, avgCount: 0 };
      row.total += 1;
      if (validRatings.length > 0) {
        row.avgSum += validRatings.reduce((sum, score) => sum + score, 0) / validRatings.length;
        row.avgCount += 1;
      }
      storeMap.set(record.store, row);
    });

    return Array.from(storeMap.entries())
      .map(([store, row]) => ({
        store,
        count: row.total,
        avg: row.avgCount ? Math.round((row.avgSum / row.avgCount) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredRecords]);

  const ratingDist = useMemo(() => {
    return [1, 2, 3, 4, 5]
      .map(star => {
        const behavior = filteredRecords.filter(record => record.staffBehavior === star).length;
        const service = filteredRecords.filter(record => record.staffService === star).length;
        return {
          rating: `${star} Star`,
          behavior,
          service,
          total: behavior + service,
        };
      })
      .sort((a, b) => b.total - a.total || b.rating.localeCompare(a.rating));
  }, [filteredRecords]);

  const dailyTrend = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (29 - i));
      const dateStr = date.toISOString().slice(0, 10);
      const rows = filteredRecords.filter(record => record.createdAt.slice(0, 10) === dateStr);
      return {
        date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        count: rows.length,
        complaints: rows.filter(record => normalizeKey(record.status) === 'complaint' || Boolean(normalizeValue(record.complaint))).length,
      };
    });
  }, [filteredRecords]);

  const satisfactionData = useMemo(() => {
    const billYes = filteredRecords.filter(record => isYes(record.billReceived)).length;
    const staffSatYes = filteredRecords.filter(record => {
      const value = normalizeValue(record.staffSatisfied).toUpperCase();
      const rating = Number(value);
      return value === 'YES' || (!Number.isNaN(rating) && rating >= 4);
    }).length;

    return [
      { name: 'Bill Received', yes: billYes, no: filteredRecords.length - billYes },
      { name: 'Staff Satisfied', yes: staffSatYes, no: filteredRecords.length - staffSatYes },
    ].sort((a, b) => b.yes - a.yes);
  }, [filteredRecords]);

  const complaintVsFeedback = useMemo(() => {
    const complaint = filteredRecords.filter(record => normalizeKey(record.status) === 'complaint' || Boolean(normalizeValue(record.complaint))).length;
    const feedback = filteredRecords.filter(record => normalizeKey(record.status) === 'feedback').length;
    return [
      { name: 'Complaint', count: complaint },
      { name: 'Feedback', count: feedback },
    ].sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  const modeData = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach(record => {
      const key = normalizeValue(record.mode) || 'Unknown';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredRecords]);

  const assignedData = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach(record => {
      const key = normalizeValue(record.assignedTo) || 'Unassigned';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredRecords]);

  const updatedByData = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach(record => {
      const key = normalizeValue(record.updatedBy) || 'Unassigned';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredRecords]);

  const complaintTypeData = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach(record => {
      if (!(normalizeKey(record.status) === 'complaint' || Boolean(normalizeValue(record.complaint)))) return;
      const key = normalizeValue(record.complaintType) || 'Unspecified';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredRecords]);

  const storeRatingCompare = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    filteredRecords.forEach(record => {
      const validRatings = [record.staffBehavior, record.staffService].filter(score => score > 0);
      if (!validRatings.length) return;
      const key = normalizeValue(record.store) || 'Unknown';
      const prev = map.get(key) || { sum: 0, count: 0 };
      map.set(key, {
        sum: prev.sum + validRatings.reduce((sum, score) => sum + score, 0) / validRatings.length,
        count: prev.count + 1,
      });
    });
    return Array.from(map.entries())
      .map(([store, row]) => ({
        store,
        avgRating: Number((row.sum / row.count).toFixed(2)),
      }))
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 10);
  }, [filteredRecords]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Analytics</h2>
          <p className="text-sm text-muted-foreground">Reports-based insights from {filteredRecords.length} feedbacks</p>
        </div>
      </div>

      <Card className="glass-card border-border/50">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <Input
              type="date"
              value={filters.startDate}
              onChange={event => setFilters(prev => ({ ...prev, startDate: event.target.value }))}
              className="h-9"
            />
            <Input
              type="date"
              value={filters.endDate}
              onChange={event => setFilters(prev => ({ ...prev, endDate: event.target.value }))}
              className="h-9"
            />

            <Select value={filters.store} onValueChange={value => setFilters(prev => ({ ...prev, store: value }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Store" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All Stores</SelectItem>
                {storeOptions.map(store => <SelectItem key={store} value={store}>{store}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={value => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All Status</SelectItem>
                {statusOptions.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.assignedTo} onValueChange={value => setFilters(prev => ({ ...prev, assignedTo: value }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Assigned To" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All Assigned</SelectItem>
                {assignedOptions.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filters.updatedBy} onValueChange={value => setFilters(prev => ({ ...prev, updatedBy: value }))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Updated By" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All Updated By</SelectItem>
                {updatedByOptions.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset Filters</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">migration_data rows (filtered)</p><p className="text-2xl font-display font-bold">{filteredSourceCounts.migrationRows.toLocaleString('en-IN')}</p></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Resolved/Closed source rows (filtered)</p><p className="text-2xl font-display font-bold">{filteredSourceCounts.resolvedClosedWorkingRows.toLocaleString('en-IN')}</p></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Combined after filters</p><p className="text-2xl font-display font-bold">{filteredSourceCounts.combinedBeforeDedupe.toLocaleString('en-IN')}</p></CardContent></Card>
      </div>

      <Card className="glass-card animate-fade-in">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Feedback Trend (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
              <AreaChart data={dailyTrend}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(350,80%,45%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(350,80%,45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Status Distribution (Desc)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''} labelLine={false} fontSize={10}>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Star className="w-4 h-4 text-warning" /> Rating Distribution (Desc)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <BarChart data={ratingDist}>
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

        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Users className="w-4 h-4 text-info" /> Top Stores by Feedback (Top 10 Desc)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <BarChart data={topStores} layout="vertical" margin={{ left: 24, right: 12, top: 6, bottom: 6 }}>
                  <XAxis type="number" fontSize={10} />
                  <YAxis
                    type="category"
                    dataKey="store"
                    fontSize={10}
                    width={170}
                    tickMargin={8}
                    tickFormatter={value => formatTickLabel(String(value), 20)}
                  />
                  <Tooltip labelFormatter={value => prettifyLabel(String(value))} />
                  <Bar dataKey="count" name="Feedbacks" fill="hsl(350,80%,45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Key Satisfaction Metrics (Desc)</CardTitle>
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Complaint vs Feedback (Desc)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <BarChart data={complaintVsFeedback}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(24,85%,57%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Mode Wise (Top 10 Desc)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <BarChart data={modeData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={55} tickFormatter={value => truncateLabel(String(value), 14)} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(210,80%,55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Assigned To Wise (Top 10 Desc)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <BarChart data={assignedData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={55} tickFormatter={value => truncateLabel(String(value), 14)} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(145,65%,42%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Updated By Wise (Top 10 Desc)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <BarChart data={updatedByData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={55} tickFormatter={value => truncateLabel(String(value), 14)} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(350,80%,45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Complaint Type (Top 10 Desc)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <BarChart data={complaintTypeData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={55} tickFormatter={value => truncateLabel(String(value), 14)} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(35,95%,55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Store Rating Comparison (Top 10 Desc)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <BarChart data={storeRatingCompare}>
                  <XAxis dataKey="store" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={55} tickFormatter={value => truncateLabel(String(value), 14)} />
                  <YAxis domain={[0, 5]} />
                  <Tooltip />
                  <Bar dataKey="avgRating" fill="hsl(264,70%,58%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
