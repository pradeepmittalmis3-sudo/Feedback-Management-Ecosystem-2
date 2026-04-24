const DEFAULT_AUTO_REFRESH_MS = 30_000;
const DEFAULT_WORKING_AUTO_REFRESH_MS = 1_000;
const MIN_AUTO_REFRESH_MS = 1_000;

function parseAutoRefreshMs(raw: unknown, defaultMs: number) {
  const text = String(raw ?? '').trim();
  if (!text) return defaultMs;

  const value = Number(text);
  if (!Number.isFinite(value)) return defaultMs;
  if (value <= 0) return 0;

  return Math.max(Math.round(value), MIN_AUTO_REFRESH_MS);
}

export const AUTO_REFRESH_MS = parseAutoRefreshMs(import.meta.env.VITE_AUTO_REFRESH_MS, DEFAULT_AUTO_REFRESH_MS);
export const WORKING_AUTO_REFRESH_MS = parseAutoRefreshMs(
  import.meta.env.VITE_WORKING_AUTO_REFRESH_MS,
  DEFAULT_WORKING_AUTO_REFRESH_MS
);

export const getAutoRefreshQueryOptions = (intervalMs: number) =>
  intervalMs > 0
    ? {
        refetchInterval: intervalMs,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true as const,
        refetchOnReconnect: true as const,
      }
    : {
        refetchOnWindowFocus: true as const,
        refetchOnReconnect: true as const,
      };

export const AUTO_REFRESH_QUERY_OPTIONS = getAutoRefreshQueryOptions(AUTO_REFRESH_MS);
export const WORKING_AUTO_REFRESH_QUERY_OPTIONS = getAutoRefreshQueryOptions(WORKING_AUTO_REFRESH_MS);
