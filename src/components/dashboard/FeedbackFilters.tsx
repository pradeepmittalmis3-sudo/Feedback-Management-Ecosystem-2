import { useFeedback } from '@/contexts/FeedbackContext';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';

export default function FeedbackFilters() {
  const { filters, setFilters, feedbacks } = useFeedback();
  const { role, allowedStores } = useAuth();

  const normalizedAllowedStores = useMemo(
    () => new Set((allowedStores || []).map(store => String(store || '').trim().toLowerCase()).filter(Boolean)),
    [allowedStores]
  );

  const allStoreOptions = useMemo(
    () => Array.from(new Set(feedbacks.map(row => String(row.storeLocation || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [feedbacks]
  );

  const allStatusOptions = useMemo(
    () => Array.from(new Set(feedbacks.map(row => String(row.status || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [feedbacks]
  );

  const storeOptions = useMemo(() => {
    const scoped =
      role === 'superadmin' || normalizedAllowedStores.size === 0
        ? allStoreOptions
        : allStoreOptions.filter(store => normalizedAllowedStores.has(store.trim().toLowerCase()));

    if (filters.store !== 'All' && filters.store && !scoped.includes(filters.store)) {
      return [filters.store, ...scoped];
    }
    return scoped;
  }, [allStoreOptions, filters.store, normalizedAllowedStores, role]);

  const statusOptions = useMemo(() => {
    const alwaysInclude = ['Complaint', 'Feedback'];
    const merged = Array.from(new Set([...alwaysInclude, ...allStatusOptions]));

    if (filters.status !== 'All' && filters.status && !merged.includes(filters.status)) {
      return [filters.status, ...merged];
    }
    return merged;
  }, [allStatusOptions, filters.status]);

  const clearFilters = () => {
    setFilters({ store: 'All', status: 'All', dateFrom: '', dateTo: '', search: '', ratingMin: 0 });
  };

  const hasActive = filters.store !== 'All' || filters.status !== 'All' || filters.search || filters.dateFrom || filters.dateTo;

  return (
    <div className="glass-card rounded-lg p-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground font-display">Filters</h3>
        {hasActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground">
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name or mobile..."
            value={filters.search}
            onChange={e => setFilters({ search: e.target.value })}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={filters.store} onValueChange={v => setFilters({ store: v })}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Store" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Stores</SelectItem>
            {storeOptions.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={v => setFilters({ status: v as any })}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Status</SelectItem>
            {statusOptions.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={e => setFilters({ dateFrom: e.target.value })}
          className="h-9 text-sm"
          placeholder="From"
        />
        <Input
          type="date"
          value={filters.dateTo}
          onChange={e => setFilters({ dateTo: e.target.value })}
          className="h-9 text-sm"
          placeholder="To"
        />
      </div>
    </div>
  );
}
