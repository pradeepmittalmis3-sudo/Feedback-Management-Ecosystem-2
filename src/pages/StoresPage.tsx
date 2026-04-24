import { Card, CardContent } from '@/components/ui/card';
import { Star, Store, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useReportRecords } from '@/hooks/useReportRecords';
import { normalizeKey } from '@/lib/reportRecords';

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

type StoreFilters = {
  startDate: string;
  endDate: string;
  store: string;
  status: string;
  assignedTo: string;
  updatedBy: string;
};

const ALL_OPTION = 'All';
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

const DEFAULT_FILTERS: StoreFilters = {
  startDate: '',
  endDate: '',
  store: ALL_OPTION,
  status: ALL_OPTION,
  assignedTo: ALL_OPTION,
  updatedBy: ALL_OPTION,
};

function getOrderedStatusOptions(statuses: string[]) {
  const uniqueStatuses = new Set(statuses.map(status => String(status || '').trim()).filter(Boolean));
  const ordered = STATUS_FILTER_ORDER.filter(status => uniqueStatuses.has(status));
  const remaining = Array.from(uniqueStatuses)
    .filter(status => !STATUS_FILTER_ORDER.includes(status))
    .sort((a, b) => a.localeCompare(b));
  return [...ordered, ...remaining];
}

function StoresContent() {
  const { combinedRecords } = useReportRecords();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<StoreFilters>(DEFAULT_FILTERS);

  const isSatisfied = (value: string) => {
    const key = normalizeKey(value);
    const rating = Number(key);
    return key === 'yes' || (!Number.isNaN(rating) && rating >= 4);
  };

  const storeOptions = useMemo(
    () => Array.from(new Set(combinedRecords.map(record => record.store).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [combinedRecords]
  );

  const statusOptions = useMemo(
    () => getOrderedStatusOptions(combinedRecords.map(record => record.status)),
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

  const storeStats: StoreStats[] = useMemo(() => {
    const grouped = new Map<string, {
      name: string;
      total: number;
      ratingSum: number;
      ratingCount: number;
      complaints: number;
      solved: number;
      pending: number;
      billReceivedYes: number;
      staffSatisfiedYes: number;
    }>();

    filteredRecords.forEach(record => {
      const storeName = String(record.store || '').trim() || 'Unknown';
      const storeKey = normalizeKey(storeName);
      const row = grouped.get(storeKey) || {
        name: storeName,
        total: 0,
        ratingSum: 0,
        ratingCount: 0,
        complaints: 0,
        solved: 0,
        pending: 0,
        billReceivedYes: 0,
        staffSatisfiedYes: 0,
      };

      row.total += 1;

      const validRatings = [record.staffBehavior, record.staffService].filter(score => score > 0);
      if (validRatings.length > 0) {
        row.ratingSum += validRatings.reduce((sum, score) => sum + score, 0) / validRatings.length;
        row.ratingCount += 1;
      }

      const statusKey = normalizeKey(record.status);
      if (statusKey === 'complaint' || Boolean(record.complaint)) row.complaints += 1;
      if (['solved', 'resolved', 'closed', 'archived'].includes(statusKey)) row.solved += 1;
      if (['pending', 'new', 'active', 'in progress', 'in process'].includes(statusKey)) row.pending += 1;

      const billKey = normalizeKey(record.billReceived);
      if (['yes', 'true', 'y', '1'].includes(billKey)) row.billReceivedYes += 1;
      if (isSatisfied(record.staffSatisfied)) row.staffSatisfiedYes += 1;

      grouped.set(storeKey, row);
    });

    return Array.from(grouped.values())
      .map(row => ({
        name: row.name,
        total: row.total,
        avgRating: row.ratingCount ? Math.round((row.ratingSum / row.ratingCount) * 10) / 10 : 0,
        complaints: row.complaints,
        solved: row.solved,
        pending: row.pending,
        billReceived: row.total ? Math.round((row.billReceivedYes / row.total) * 100) : 0,
        staffSatisfied: row.total ? Math.round((row.staffSatisfiedYes / row.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredRecords]);

  const filtered = useMemo(
    () => storeStats.filter(s => s.name.toLowerCase().includes(search.toLowerCase())),
    [search, storeStats]
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
              {storeStats.length > 0 ? [...storeStats].sort((a, b) => b.avgRating - a.avgRating)[0].name : '-'}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Most Complaints</p>
            <p className="text-sm font-bold text-red-500 truncate">
              {storeStats.length > 0 ? [...storeStats].sort((a, b) => b.complaints - a.complaints)[0].name : '-'}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Most Feedbacks</p>
            <p className="text-sm font-bold text-primary truncate">
              {storeStats.length > 0 ? storeStats[0].name : '-'}
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
