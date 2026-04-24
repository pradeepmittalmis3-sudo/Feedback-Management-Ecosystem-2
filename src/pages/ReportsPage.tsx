import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  MessageSquare,
  RefreshCcw,
  Star,
  Store,
  UserCheck,
  Wallet,
  FileText,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useReportRecords } from '@/hooks/useReportRecords';
import { isResolvedStatus } from '@/lib/feedbackFlow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ReportRecord = {
  recordId: string;
  source: 'working' | 'migration';
  name: string;
  mobile: string;
  status: string;
  store: string;
  assignedTo: string;
  updatedBy: string;
  mode: string;
  complaint: string;
  feedback: string;
  complaintType: string;
  productUnavailable: string;
  billReceived: string;
  staffBehavior: number;
  staffService: number;
  createdAt: string;
  updatedAt: string;
};

type ReportFilters = {
  startDate: string;
  endDate: string;
  store: string;
  status: string;
  assignedTo: string;
  updatedBy: string;
};

type LimitKey =
  | 'status'
  | 'store'
  | 'complaint'
  | 'assigned'
  | 'updatedBy'
  | 'mode'
  | 'rating'
  | 'lowRatings'
  | 'latestRemarks'
  | 'topComplaintStores'
  | 'storeStatusMatrix';

const ALL_OPTION = 'All';
const DEFAULT_LIMIT = 10;
const PIE_COLORS = [
  'hsl(210, 80%, 55%)',
  'hsl(145, 65%, 42%)',
  'hsl(35, 95%, 55%)',
  'hsl(0, 84%, 60%)',
  'hsl(24, 85%, 57%)',
  'hsl(264, 70%, 58%)',
];
const STATUS_FILTER_ORDER = [
  'New',
  'Active',
  'In Progress',
  'Pending',
  'Complaint',
  'Feedback',
  'Solved',
  'Resolved',
  'Closed',
  'Archived',
  'Fake',
  'Channel Partner Store',
  'Channel Partner',
];

const DEFAULT_FILTERS: ReportFilters = {
  startDate: '',
  endDate: '',
  store: ALL_OPTION,
  status: ALL_OPTION,
  assignedTo: ALL_OPTION,
  updatedBy: ALL_OPTION,
};

const DEFAULT_LIMITS: Record<LimitKey, number> = {
  status: DEFAULT_LIMIT,
  store: DEFAULT_LIMIT,
  complaint: DEFAULT_LIMIT,
  assigned: DEFAULT_LIMIT,
  updatedBy: DEFAULT_LIMIT,
  mode: DEFAULT_LIMIT,
  rating: DEFAULT_LIMIT,
  lowRatings: DEFAULT_LIMIT,
  latestRemarks: DEFAULT_LIMIT,
  topComplaintStores: DEFAULT_LIMIT,
  storeStatusMatrix: DEFAULT_LIMIT,
};

function normalizeValue(value: unknown) {
  return String(value || '').trim();
}

function normalizeKey(value: unknown) {
  return normalizeValue(value).toLowerCase();
}

function isPendingStatus(value: string) {
  return ['pending', 'new', 'active', 'in process', 'in progress', 'complaint'].includes(normalizeKey(value));
}

function formatNumber(value: number) {
  return value.toLocaleString('en-IN');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function maskMobile(value: string) {
  const mobile = normalizeValue(value);
  if (!mobile) return '-';
  if (mobile.length <= 4) return mobile;
  return `${'*'.repeat(Math.max(0, mobile.length - 4))}${mobile.slice(-4)}`;
}

function truncateLabel(value: string, max = 18) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function getOrderedStatusOptions(records: ReportRecord[]) {
  const uniqueStatuses = new Set(records.map(record => normalizeValue(record.status)).filter(Boolean));
  const ordered = STATUS_FILTER_ORDER.filter(status => uniqueStatuses.has(status));
  const remaining = Array.from(uniqueStatuses)
    .filter(status => !STATUS_FILTER_ORDER.includes(status))
    .sort((a, b) => a.localeCompare(b));
  return [...ordered, ...remaining];
}

export default function ReportsPage() {
  const { combinedRecords, isLoading, isFetching, refetch } = useReportRecords();
  const records = combinedRecords as ReportRecord[];

  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [limits, setLimits] = useState<Record<LimitKey, number>>(DEFAULT_LIMITS);

  useEffect(() => {
    setLimits(DEFAULT_LIMITS);
  }, [filters]);

  const showMore = (key: LimitKey) => {
    setLimits(prev => ({ ...prev, [key]: prev[key] + 10 }));
  };

  const storeOptions = useMemo(() =>
    Array.from(new Set(records.map(record => record.store).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
  [records]);

  const statusOptions = useMemo(() => getOrderedStatusOptions(records), [records]);

  const assignedOptions = useMemo(() =>
    Array.from(new Set(records.map(record => record.assignedTo).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
  [records]);

  const updatedByOptions = useMemo(() =>
    Array.from(new Set(records.map(record => record.updatedBy).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
  [records]);

  const filteredRecords = useMemo(() => {
    const fromDate = filters.startDate ? new Date(`${filters.startDate}T00:00:00`) : null;
    const toDate = filters.endDate ? new Date(`${filters.endDate}T23:59:59`) : null;

    return records.filter(record => {
      if (filters.store !== ALL_OPTION && normalizeKey(record.store) !== normalizeKey(filters.store)) return false;
      if (filters.status !== ALL_OPTION && normalizeKey(record.status) !== normalizeKey(filters.status)) return false;
      if (filters.assignedTo !== ALL_OPTION && normalizeKey(record.assignedTo) !== normalizeKey(filters.assignedTo)) return false;
      if (filters.updatedBy !== ALL_OPTION && normalizeKey(record.updatedBy) !== normalizeKey(filters.updatedBy)) return false;
      if (fromDate && new Date(record.createdAt) < fromDate) return false;
      if (toDate && new Date(record.createdAt) > toDate) return false;
      return true;
    });
  }, [records, filters]);

  const summary = useMemo(() => {
    const totalEntries = filteredRecords.length;
    const feedback = filteredRecords.filter(record => normalizeKey(record.status) === 'feedback').length;
    const complaints = filteredRecords.filter(record => normalizeKey(record.status) === 'complaint' || Boolean(record.complaint)).length;
    const resolved = filteredRecords.filter(record => isResolvedStatus(record.status)).length;
    const pending = filteredRecords.filter(record => isPendingStatus(record.status)).length;
    const lowRatings = filteredRecords.filter(record => record.staffBehavior <= 2 || record.staffService <= 2).length;
    const priceChallenge = filteredRecords.filter(record => normalizeKey(record.complaintType).includes('price')).length;
    const billReceived = filteredRecords.filter(record => ['yes', 'y', 'true', '1'].includes(normalizeKey(record.billReceived))).length;

    return { totalEntries, feedback, complaints, resolved, pending, lowRatings, priceChallenge, billReceived };
  }, [filteredRecords]);

  const statusReport = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach(record => map.set(record.status, (map.get(record.status) || 0) + 1));
    return Array.from(map.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  const storeReport = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach(record => map.set(record.store, (map.get(record.store) || 0) + 1));
    return Array.from(map.entries())
      .map(([store, count]) => ({ store, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  const complaintReport = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach(record => {
      if (!record.complaint && normalizeKey(record.status) !== 'complaint') return;
      const key = record.complaintType || 'Unspecified';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  const assignedReport = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach(record => map.set(record.assignedTo || 'Unassigned', (map.get(record.assignedTo || 'Unassigned') || 0) + 1));
    return Array.from(map.entries())
      .map(([assignedTo, count]) => ({ assignedTo, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  const updatedByReport = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach(record => map.set(record.updatedBy || 'Unassigned', (map.get(record.updatedBy || 'Unassigned') || 0) + 1));
    return Array.from(map.entries())
      .map(([updatedBy, count]) => ({ updatedBy, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  const modeReport = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach(record => map.set(record.mode || 'Unknown', (map.get(record.mode || 'Unknown') || 0) + 1));
    return Array.from(map.entries())
      .map(([mode, count]) => ({ mode, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  const ratingReport = useMemo(() => {
    const map = new Map<string, { ratingSum: number; ratingCount: number }>();

    filteredRecords.forEach(record => {
      const key = record.store || 'Unknown';
      const valid = [record.staffBehavior, record.staffService].filter(score => score > 0);
      if (!valid.length) return;
      const avg = valid.reduce((sum, score) => sum + score, 0) / valid.length;
      const prev = map.get(key) || { ratingSum: 0, ratingCount: 0 };
      map.set(key, {
        ratingSum: prev.ratingSum + avg,
        ratingCount: prev.ratingCount + 1,
      });
    });

    return Array.from(map.entries())
      .map(([store, row]) => ({
        store,
        avgRating: Number((row.ratingSum / row.ratingCount).toFixed(2)),
      }))
      .sort((a, b) => b.avgRating - a.avgRating);
  }, [filteredRecords]);

  const lowRatingRecords = useMemo(() =>
    filteredRecords
      .filter(record => record.staffBehavior <= 2 || record.staffService <= 2)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  [filteredRecords]);

  const latestRemarks = useMemo(() =>
    filteredRecords
      .filter(record => Boolean(normalizeValue(record.complaint) || normalizeValue(record.feedback)))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()),
  [filteredRecords]);

  const topComplaintStores = useMemo(() => {
    const map = new Map<string, { totalComplaints: number; pending: number; resolved: number }>();

    filteredRecords.forEach(record => {
      if (!record.complaint && normalizeKey(record.status) !== 'complaint') return;
      const key = record.store || 'Unknown';
      const prev = map.get(key) || { totalComplaints: 0, pending: 0, resolved: 0 };
      map.set(key, {
        totalComplaints: prev.totalComplaints + 1,
        pending: prev.pending + (isPendingStatus(record.status) ? 1 : 0),
        resolved: prev.resolved + (isResolvedStatus(record.status) ? 1 : 0),
      });
    });

    return Array.from(map.entries())
      .map(([store, row]) => ({ store, ...row }))
      .sort((a, b) => b.totalComplaints - a.totalComplaints);
  }, [filteredRecords]);

  const storeStatusMatrix = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach(record => {
      const key = `${record.store}|||${record.status}`;
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([key, total]) => {
        const [store, status] = key.split('|||');
        return { store, status, total };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredRecords]);

  const limitedStatus = statusReport.slice(0, limits.status);
  const limitedStore = storeReport.slice(0, limits.store);
  const limitedComplaint = complaintReport.slice(0, limits.complaint);
  const limitedAssigned = assignedReport.slice(0, limits.assigned);
  const limitedUpdatedBy = updatedByReport.slice(0, limits.updatedBy);
  const limitedMode = modeReport.slice(0, limits.mode);
  const limitedRating = ratingReport.slice(0, limits.rating);
  const limitedLowRatings = lowRatingRecords.slice(0, limits.lowRatings);
  const limitedLatestRemarks = latestRemarks.slice(0, limits.latestRemarks);
  const limitedTopComplaintStores = topComplaintStores.slice(0, limits.topComplaintStores);
  const limitedStoreStatusMatrix = storeStatusMatrix.slice(0, limits.storeStatusMatrix);

  const topCards = [
    { label: 'Total Entries', value: summary.totalEntries, icon: Database },
    { label: 'Feedback', value: summary.feedback, icon: MessageSquare },
    { label: 'Complaints', value: summary.complaints, icon: AlertTriangle },
    { label: 'Resolved', value: summary.resolved, icon: CheckCircle2 },
    { label: 'Pending', value: summary.pending, icon: Clock3 },
    { label: 'Low Ratings', value: summary.lowRatings, icon: Star },
    { label: 'Price Challenge', value: summary.priceChallenge, icon: Wallet },
    { label: 'Bill Received', value: summary.billReceived, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Reports Dashboard</h2>
            <p className="text-sm text-muted-foreground">Analytics-style data fetching (Supabase DB), descending order, Top 10 + Show More.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCcw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card className="glass-card border-border/50">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <Input type="date" value={filters.startDate} onChange={event => setFilters(prev => ({ ...prev, startDate: event.target.value }))} className="h-9" />
            <Input type="date" value={filters.endDate} onChange={event => setFilters(prev => ({ ...prev, endDate: event.target.value }))} className="h-9" />

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
          {isLoading && <Badge variant="outline">Loading reports...</Badge>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        {topCards.map(card => (
          <Card key={card.label} className="glass-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <card.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-display font-bold">{formatNumber(card.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Status Report</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
              <PieChart>
                <Pie data={limitedStatus.map(row => ({ name: row.status, value: row.count }))} dataKey="value" nameKey="name" outerRadius={95} innerRadius={50}>
                  {limitedStatus.map((row, index) => <Cell key={row.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
          {statusReport.length > limits.status && (
            <CardContent className="pt-0"><Button variant="outline" size="sm" onClick={() => showMore('status')}>Show More</Button></CardContent>
          )}
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Store Report</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
              <BarChart data={limitedStore} layout="vertical">
                <XAxis type="number" />
                <YAxis type="category" dataKey="store" width={130} tick={{ fontSize: 11 }} tickFormatter={value => truncateLabel(String(value), 18)} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(210, 80%, 55%)" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          {storeReport.length > limits.store && (
            <CardContent className="pt-0"><Button variant="outline" size="sm" onClick={() => showMore('store')}>Show More</Button></CardContent>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Complaint Report</CardTitle></CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
              <BarChart data={limitedComplaint.map(row => ({ type: row.type, count: row.count }))}>
                <XAxis dataKey="type" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={55} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          {complaintReport.length > limits.complaint && (
            <CardContent className="pt-0"><Button variant="outline" size="sm" onClick={() => showMore('complaint')}>Show More</Button></CardContent>
          )}
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Assigned To Report</CardTitle></CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
              <BarChart data={limitedAssigned.map(row => ({ assigned: row.assignedTo, count: row.count }))}>
                <XAxis dataKey="assigned" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={55} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(145, 65%, 42%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          {assignedReport.length > limits.assigned && (
            <CardContent className="pt-0"><Button variant="outline" size="sm" onClick={() => showMore('assigned')}>Show More</Button></CardContent>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Updated By Report</CardTitle></CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
              <BarChart data={limitedUpdatedBy.map(row => ({ updatedBy: row.updatedBy, count: row.count }))}>
                <XAxis dataKey="updatedBy" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={55} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(24, 85%, 57%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          {updatedByReport.length > limits.updatedBy && (
            <CardContent className="pt-0"><Button variant="outline" size="sm" onClick={() => showMore('updatedBy')}>Show More</Button></CardContent>
          )}
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Mode Report</CardTitle></CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
              <BarChart data={limitedMode.map(row => ({ mode: row.mode, count: row.count }))}>
                <XAxis dataKey="mode" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={55} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          {modeReport.length > limits.mode && (
            <CardContent className="pt-0"><Button variant="outline" size="sm" onClick={() => showMore('mode')}>Show More</Button></CardContent>
          )}
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Rating Report</CardTitle></CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} debounce={100}>
              <BarChart data={limitedRating.map(row => ({ store: row.store, rating: row.avgRating }))}>
                <XAxis dataKey="store" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={55} tickFormatter={value => truncateLabel(String(value), 14)} />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Bar dataKey="rating" fill="hsl(264, 70%, 58%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          {ratingReport.length > limits.rating && (
            <CardContent className="pt-0"><Button variant="outline" size="sm" onClick={() => showMore('rating')}>Show More</Button></CardContent>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Low Rating Records</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Record ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Behavior</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Mobile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {limitedLowRatings.map(row => (
                  <TableRow key={`low-${row.recordId}`}>
                    <TableCell className="font-mono text-xs">{row.recordId}</TableCell>
                    <TableCell>{formatDateTime(row.createdAt)}</TableCell>
                    <TableCell>{row.store}</TableCell>
                    <TableCell>{row.staffBehavior || '-'}</TableCell>
                    <TableCell>{row.staffService || '-'}</TableCell>
                    <TableCell>{maskMobile(row.mobile)}</TableCell>
                  </TableRow>
                ))}
                {!limitedLowRatings.length && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No low rating records</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          {lowRatingRecords.length > limits.lowRatings && (
            <CardContent className="pt-3"><Button variant="outline" size="sm" onClick={() => showMore('lowRatings')}>Show More</Button></CardContent>
          )}
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Latest Remarks</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Record ID</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated By</TableHead>
                  <TableHead>Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {limitedLatestRemarks.map(row => (
                  <TableRow key={`remark-${row.recordId}-${row.updatedAt}`}>
                    <TableCell className="font-mono text-xs">{row.recordId}</TableCell>
                    <TableCell>{formatDateTime(row.updatedAt || row.createdAt)}</TableCell>
                    <TableCell>{row.store}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.updatedBy || '-'}</TableCell>
                    <TableCell>{normalizeValue(row.complaint) || normalizeValue(row.feedback) || '-'}</TableCell>
                  </TableRow>
                ))}
                {!limitedLatestRemarks.length && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No remarks found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          {latestRemarks.length > limits.latestRemarks && (
            <CardContent className="pt-3"><Button variant="outline" size="sm" onClick={() => showMore('latestRemarks')}>Show More</Button></CardContent>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Top Complaint Stores</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Total Complaints</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Resolved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {limitedTopComplaintStores.map(row => (
                  <TableRow key={`cs-${row.store}`}>
                    <TableCell>{row.store}</TableCell>
                    <TableCell>{formatNumber(row.totalComplaints)}</TableCell>
                    <TableCell>{formatNumber(row.pending)}</TableCell>
                    <TableCell>{formatNumber(row.resolved)}</TableCell>
                  </TableRow>
                ))}
                {!limitedTopComplaintStores.length && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No complaint stores found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          {topComplaintStores.length > limits.topComplaintStores && (
            <CardContent className="pt-3"><Button variant="outline" size="sm" onClick={() => showMore('topComplaintStores')}>Show More</Button></CardContent>
          )}
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display">Store Status Matrix</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {limitedStoreStatusMatrix.map(row => (
                  <TableRow key={`ssm-${row.store}-${row.status}`}>
                    <TableCell>{row.store}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{formatNumber(row.total)}</TableCell>
                  </TableRow>
                ))}
                {!limitedStoreStatusMatrix.length && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No matrix rows found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          {storeStatusMatrix.length > limits.storeStatusMatrix && (
            <CardContent className="pt-3"><Button variant="outline" size="sm" onClick={() => showMore('storeStatusMatrix')}>Show More</Button></CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
