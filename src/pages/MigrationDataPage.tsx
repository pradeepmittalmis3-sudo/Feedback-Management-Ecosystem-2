import { useMemo } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Database,
  FileSearch,
  PackageX,
  RefreshCcw,
  Star,
  Store,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useReportRecords } from '@/hooks/useReportRecords';
import { isResolvedStatus } from '@/lib/feedbackFlow';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const STATUS_ORDER = ['Pending', 'Solved', 'Complaint', 'Feedback', 'Fake'] as const;
const PIE_COLORS = [
  'hsl(35, 95%, 55%)',
  'hsl(145, 65%, 42%)',
  'hsl(0, 84%, 60%)',
  'hsl(210, 80%, 55%)',
  'hsl(220, 10%, 55%)',
];

function normalizeValue(value: unknown) {
  return String(value || '').trim();
}

function normalizeKey(value: unknown) {
  return normalizeValue(value).toLowerCase();
}

function isYes(value: unknown) {
  const v = normalizeKey(value);
  return v === 'yes' || v === 'y' || v === 'true' || v === '1';
}

function isNo(value: unknown) {
  const v = normalizeKey(value);
  return v === 'no' || v === 'n' || v === 'false' || v === '0';
}

function formatDateLabel(dateIso: string) {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function titleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function isPendingStatus(value: unknown) {
  const key = normalizeKey(value);
  return ['pending', 'new', 'active', 'in process', 'in progress'].includes(key);
}

function MigrationDataContent() {
  const { combinedRecords, sourceCounts, isLoading, isFetching, refetch } = useReportRecords();
  const reportData = combinedRecords;
  const combinedBeforeDedupe = sourceCounts.combinedBeforeDedupe;

  const topSummary = useMemo(() => {
    const totalRecords = reportData.length;
    const totalSolved = reportData.filter(f => isResolvedStatus(f.status)).length;
    const totalPending = reportData.filter(f => isPendingStatus(f.status)).length;
    const totalFeedback = reportData.filter(f => normalizeKey(f.status) === 'feedback').length;
    const totalComplaints = reportData.filter(
      f => normalizeKey(f.status) === 'complaint' || Boolean(normalizeValue(f.complaint))
    ).length;
    const fakeEntries = reportData.filter(
      f => normalizeKey(f.status) === 'fake' || normalizeKey(f.complaintType) === 'fake'
    ).length;

    return {
      totalRecords,
      totalComplaints,
      totalFeedback,
      totalSolved,
      totalPending,
      fakeEntries,
    };
  }, [reportData]);

  const statusReport = useMemo(() => {
    const counts = {
      Pending: 0,
      Solved: 0,
      Complaint: 0,
      Feedback: 0,
      Fake: 0,
    };

    for (const fb of reportData) {
      if (isResolvedStatus(fb.status)) {
        counts.Solved += 1;
        continue;
      }

      const statusKey = normalizeKey(fb.status);
      if (statusKey === 'complaint') {
        counts.Complaint += 1;
      } else if (statusKey === 'feedback') {
        counts.Feedback += 1;
      } else if (statusKey === 'fake') {
        counts.Fake += 1;
      } else if (isPendingStatus(statusKey)) {
        counts.Pending += 1;
      }
    }

    return STATUS_ORDER.map(status => ({
      name: status,
      value: counts[status],
    }));
  }, [reportData]);

  const storeReport = useMemo(() => {
    const map = new Map<string, { count: number; ratingSum: number; ratingCount: number }>();

    for (const fb of reportData) {
      const key = normalizeValue(fb.store) || 'Unknown';
      const prev = map.get(key) || { count: 0, ratingSum: 0, ratingCount: 0 };
      const validRatings = [fb.staffBehavior, fb.staffService].filter(v => v > 0);
      const avgRating = validRatings.length
        ? validRatings.reduce((sum, v) => sum + v, 0) / validRatings.length
        : 0;

      map.set(key, {
        count: prev.count + 1,
        ratingSum: prev.ratingSum + avgRating,
        ratingCount: prev.ratingCount + (avgRating > 0 ? 1 : 0),
      });
    }

    const entries = Array.from(map.entries()).map(([store, data]) => ({
      store: store.length > 16 ? `${store.slice(0, 16)}...` : store,
      fullStore: store,
      count: data.count,
      avgRating: data.ratingCount ? Number((data.ratingSum / data.ratingCount).toFixed(2)) : 0,
    }));

    const topStores = [...entries].sort((a, b) => b.count - a.count).slice(0, 8);
    const lowPerformanceStores = [...entries]
      .filter(e => e.count > 0)
      .sort((a, b) => a.avgRating - b.avgRating || b.count - a.count)
      .slice(0, 8);

    return { topStores, lowPerformanceStores };
  }, [reportData]);

  const assignedReport = useMemo(() => {
    const assignmentMap = new Map<string, number>();
    for (const fb of reportData) {
      const assignee = normalizeValue(fb.assignedTo) || 'Unassigned';
      assignmentMap.set(assignee, (assignmentMap.get(assignee) || 0) + 1);
    }

    const assignedData = Array.from(assignmentMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const teamHo = reportData.filter(fb => normalizeKey(fb.assignedTo).includes('team ho')).length;
    const storeManager = reportData.filter(fb => normalizeKey(fb.assignedTo).includes('store manager')).length;

    return { assignedData, teamHo, storeManager };
  }, [reportData]);

  const ratingReport = useMemo(() => {
    const ratings: number[] = [];
    const stars = [0, 0, 0, 0, 0];

    for (const fb of reportData) {
      const valid = [fb.staffBehavior, fb.staffService].filter(v => v > 0);
      if (valid.length === 0) continue;
      const avg = valid.reduce((sum, v) => sum + v, 0) / valid.length;
      ratings.push(avg);
      const starBucket = Math.max(1, Math.min(5, Math.round(avg)));
      stars[starBucket - 1] += 1;
    }

    return {
      avgRating: ratings.length ? Number((ratings.reduce((sum, v) => sum + v, 0) / ratings.length).toFixed(2)) : 0,
      distribution: stars.map((value, i) => ({ star: `${i + 1} Star`, value })),
    };
  }, [reportData]);

  const complaintReport = useMemo(() => {
    const complaintRows = reportData.filter(
      fb => normalizeKey(fb.status) === 'complaint' || Boolean(normalizeValue(fb.complaint))
    );

    const typeMap = new Map<string, number>();
    const complaintTextMap = new Map<string, number>();

    for (const fb of complaintRows) {
      const type = normalizeValue(fb.complaintType) || 'Unspecified';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);

      const complaintText = normalizeValue(fb.complaint);
      if (complaintText) {
        complaintTextMap.set(complaintText, (complaintTextMap.get(complaintText) || 0) + 1);
      }
    }

    const typeData = Array.from(typeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const commonComplaints = Array.from(complaintTextMap.entries())
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return { complaintRows, typeData, commonComplaints };
  }, [reportData]);

  const productReport = useMemo(() => {
    const productRows = reportData.filter(fb => Boolean(normalizeValue(fb.productUnavailable)));
    const itemMap = new Map<string, number>();

    for (const fb of productRows) {
      const raw = normalizeValue(fb.productUnavailable);
      const parts = raw
        .split(/[,;\n|/]+/)
        .map(item => normalizeValue(item))
        .filter(Boolean);

      for (const item of parts) {
        const key = titleCase(item);
        itemMap.set(key, (itemMap.get(key) || 0) + 1);
      }
    }

    const missingItems = Array.from(itemMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return { productRows, missingItems };
  }, [reportData]);

  const billReport = useMemo(() => {
    let yes = 0;
    let no = 0;
    let other = 0;

    for (const fb of reportData) {
      if (isYes(fb.billReceived)) yes += 1;
      else if (isNo(fb.billReceived)) no += 1;
      else other += 1;
    }

    const totalMarked = yes + no;
    const compliancePercent = totalMarked ? Number(((yes / totalMarked) * 100).toFixed(1)) : 0;

    return {
      yes,
      no,
      other,
      compliancePercent,
      chartData: [
        { name: 'Yes', value: yes },
        { name: 'No', value: no },
        { name: 'Unclear', value: other },
      ],
    };
  }, [reportData]);

  const trendReport = useMemo(() => {
    const dailyMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();

    for (const fb of reportData) {
      const d = new Date(fb.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const dayKey = d.toISOString().slice(0, 10);
      const monthKey = dayKey.slice(0, 7);

      dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + 1);
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
    }

    const dailyData = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, label: formatDateLabel(date), count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const monthlyData = Array.from(monthlyMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const recentDaily = dailyData.slice(-30);
    const recentMonthly = monthlyData.slice(-12);
    const peakDay = dailyData.reduce<{ date: string; count: number } | null>((best, row) => {
      if (!best || row.count > best.count) {
        return { date: row.date, count: row.count };
      }
      return best;
    }, null);

    return {
      dailyData: recentDaily,
      monthlyData: recentMonthly,
      peakDay,
    };
  }, [reportData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
            <Database className="w-5 h-5 text-info" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Analytics</h2>
            <p className="text-sm text-muted-foreground">
              Combined reporting source from migration_data plus Resolved/Closed entries from working_data.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="w-fit bg-info/10 text-info border border-info/20">
            Read-only reporting section
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <Card className="glass-card border-border/50">
        <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
          <p>migration_data rows: historical report records.</p>
          <p>Resolved/Closed source rows: all non-working-queue entries from working_data.</p>
          <p>Charts below are built from the combined reporting source.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card border-border/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">migration_data rows</p><p className="text-2xl font-display font-bold">{sourceCounts.migrationRows.toLocaleString('en-IN')}</p></CardContent></Card>
        <Card className="glass-card border-border/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Resolved/Closed source rows from working_data</p><p className="text-2xl font-display font-bold">{sourceCounts.resolvedClosedWorkingRows.toLocaleString('en-IN')}</p></CardContent></Card>
        <Card className="glass-card border-border/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Combined before dedupe</p><p className="text-2xl font-display font-bold">{combinedBeforeDedupe.toLocaleString('en-IN')}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="glass-card border-border/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Combined Total</p><p className="text-2xl font-display font-bold">{topSummary.totalRecords.toLocaleString('en-IN')}</p></CardContent></Card>
        <Card className="glass-card border-border/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Complaints</p><p className="text-2xl font-display font-bold">{topSummary.totalComplaints.toLocaleString('en-IN')}</p></CardContent></Card>
        <Card className="glass-card border-border/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Feedback</p><p className="text-2xl font-display font-bold">{topSummary.totalFeedback.toLocaleString('en-IN')}</p></CardContent></Card>
        <Card className="glass-card border-border/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Solved</p><p className="text-2xl font-display font-bold">{topSummary.totalSolved.toLocaleString('en-IN')}</p></CardContent></Card>
        <Card className="glass-card border-border/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Pending</p><p className="text-2xl font-display font-bold">{topSummary.totalPending.toLocaleString('en-IN')}</p></CardContent></Card>
        <Card className="glass-card border-border/50"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fake Entries</p><p className="text-2xl font-display font-bold">{topSummary.fakeEntries.toLocaleString('en-IN')}</p></CardContent></Card>
      </div>

      {isLoading && (
        <Card className="glass-card border-border/50">
          <CardContent className="p-4 text-sm text-muted-foreground">Loading reporting source...</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Status Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-2 text-center">
              {statusReport.map(row => (
                <div key={row.name} className="rounded-lg border border-border/50 bg-muted/20 p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">{row.name}</p>
                  <p className="text-base font-bold">{row.value}</p>
                </div>
              ))}
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <PieChart>
                  <Pie
                    data={statusReport}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    label={({ name, value }) => (value ? `${name}: ${value}` : '')}
                    labelLine={false}
                  >
                    {statusReport.map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2"><Store className="w-4 h-4" /> Store-wise Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Top Stores (most feedback)</p>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                  <BarChart data={storeReport.topStores} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="store" fontSize={11} width={120} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(210, 80%, 55%)" radius={[0, 5, 5, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Low performance stores (avg rating)</p>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                  <BarChart data={storeReport.lowPerformanceStores} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" domain={[0, 5]} fontSize={11} />
                    <YAxis type="category" dataKey="store" fontSize={11} width={120} />
                    <Tooltip />
                    <Bar dataKey="avgRating" fill="hsl(0, 84%, 60%)" radius={[0, 5, 5, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2"><UserCheck className="w-4 h-4" /> Assigned To Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Team HO Cases</p>
                <p className="text-xl font-bold">{assignedReport.teamHo}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Store Manager Cases</p>
                <p className="text-xl font-bold">{assignedReport.storeManager}</p>
              </div>
            </div>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <BarChart data={assignedReport.assignedData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(145, 65%, 42%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2"><Star className="w-4 h-4" /> Rating / Satisfaction Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Average Rating</p>
              <p className="text-2xl font-bold">{ratingReport.avgRating} / 5</p>
            </div>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <BarChart data={ratingReport.distribution}>
                  <XAxis dataKey="star" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {ratingReport.distribution.map((row, idx) => (
                      <Cell key={row.star} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Complaint Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Complaint Cases</p>
              <p className="text-xl font-bold">{complaintReport.complaintRows.length}</p>
            </div>
            <div className="h-[230px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <BarChart data={complaintReport.typeData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={55} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Most common complaints</p>
              {complaintReport.commonComplaints.length === 0 && (
                <p className="text-xs text-muted-foreground">No complaint text available in current reporting source.</p>
              )}
              {complaintReport.commonComplaints.map(item => (
                <div key={item.text} className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-muted/10 p-2">
                  <p className="text-xs line-clamp-2">{item.text}</p>
                  <Badge variant="outline">{item.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2"><PackageX className="w-4 h-4" /> Product Issues Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Product Unavailable Cases</p>
              <p className="text-xl font-bold">{productReport.productRows.length}</p>
            </div>
            <div className="h-[230px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <BarChart data={productReport.missingItems.slice(0, 8)}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(35, 95%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Most missing items</p>
              {productReport.missingItems.length === 0 && (
                <p className="text-xs text-muted-foreground">No product issue entries found in current reporting source.</p>
              )}
              {productReport.missingItems.slice(0, 6).map(item => (
                <div key={item.name} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 p-2">
                  <p className="text-xs">{item.name}</p>
                  <Badge variant="outline">{item.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2"><Wallet className="w-4 h-4" /> Bill Compliance Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">Yes</p>
                <p className="text-lg font-bold">{billReport.yes}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">No</p>
                <p className="text-lg font-bold">{billReport.no}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">Compliance %</p>
                <p className="text-lg font-bold">{billReport.compliancePercent}%</p>
              </div>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <PieChart>
                  <Pie data={billReport.chartData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50}>
                    {billReport.chartData.map(row => (
                      <Cell
                        key={row.name}
                        fill={
                          row.name === 'Yes'
                            ? 'hsl(145, 65%, 42%)'
                            : row.name === 'No'
                              ? 'hsl(0, 84%, 60%)'
                              : 'hsl(220, 10%, 60%)'
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Date-wise Trend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Peak feedback day</p>
              <p className="text-sm font-semibold">
                {trendReport.peakDay ? `${formatDateLabel(trendReport.peakDay.date)} (${trendReport.peakDay.count})` : 'N/A'}
              </p>
            </div>
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <LineChart data={trendReport.dailyData}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(210, 80%, 55%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
                <BarChart data={trendReport.monthlyData}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(35, 95%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2"><FileSearch className="w-4 h-4" /> Storage Scope</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Analytics reporting source includes migration_data + Resolved/Closed source rows from working_data.
          </p>
          <p className="text-xs text-muted-foreground">
            Raw row rendering is intentionally disabled here to keep UI fast at large scale.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MigrationDataPage() {
  return <MigrationDataContent />;
}
