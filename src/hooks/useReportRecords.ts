import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchReportingSourceRows,
  toMigrationRecord,
  toResolvedClosedWorkingRecord,
} from '@/lib/reportRecords';
import { AUTO_REFRESH_QUERY_OPTIONS } from '@/lib/autoRefresh';

type ReportRecord = ReturnType<typeof toMigrationRecord>;

export function useReportRecords() {
  const { role, allowedStores } = useAuth();
  const normalizedAllowedStores = useMemo(
    () => new Set((allowedStores || []).map(store => store.trim().toLowerCase()).filter(Boolean)),
    [allowedStores]
  );
  const enforceStoreScope = role !== 'superadmin' && normalizedAllowedStores.size > 0;

  const {
    data: sourceRows,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['reports', 'sources'],
    queryFn: fetchReportingSourceRows,
    staleTime: 1000 * 60 * 5,
    ...AUTO_REFRESH_QUERY_OPTIONS,
  });

  const migrationRows = sourceRows?.migrationRows || [];
  const resolvedClosedWorkingRows = sourceRows?.resolvedClosedWorkingRows || [];

  const rawWorkingRecords = useMemo(
    () => resolvedClosedWorkingRows.map(toResolvedClosedWorkingRecord).filter(record => Boolean(record.recordId)),
    [resolvedClosedWorkingRows]
  );

  const rawMigrationRecords = useMemo(
    () => migrationRows.map(toMigrationRecord).filter(record => Boolean(record.recordId)),
    [migrationRows]
  );

  const workingRecords = useMemo(() => {
    if (!enforceStoreScope) return rawWorkingRecords;
    return rawWorkingRecords.filter(record => normalizedAllowedStores.has(record.store.trim().toLowerCase()));
  }, [enforceStoreScope, normalizedAllowedStores, rawWorkingRecords]);

  const migrationRecords = useMemo(() => {
    if (!enforceStoreScope) return rawMigrationRecords;
    return rawMigrationRecords.filter(record => normalizedAllowedStores.has(record.store.trim().toLowerCase()));
  }, [enforceStoreScope, rawMigrationRecords, normalizedAllowedStores]);

  const combinedRecords = useMemo(() => {
    const map = new Map<string, ReportRecord>();
    migrationRecords.forEach(record => map.set(record.recordId, record));
    workingRecords.forEach(record => map.set(record.recordId, record));
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [migrationRecords, workingRecords]);

  const sourceCounts = useMemo(() => ({
    migrationRows: rawMigrationRecords.length,
    resolvedClosedWorkingRows: rawWorkingRecords.length,
    combinedBeforeDedupe: rawMigrationRecords.length + rawWorkingRecords.length,
  }), [rawMigrationRecords.length, rawWorkingRecords.length]);

  return {
    workingRecords,
    migrationRecords,
    combinedRecords,
    sourceCounts,
    isLoading,
    isFetching,
    refetch,
  };
}
