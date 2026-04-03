import { useState, useEffect } from 'react';
import { metaGet } from '@/lib/metaApi';
import type { GeoLocationEntry } from '@/types/templates';

/**
 * Debounced search for Meta geo locations (cities, countries, regions).
 * Uses the Meta Graph API /search endpoint via meta-proxy edge function.
 */
export function useGeoSearch(
  accountId: string | undefined,
  locationType: 'city' | 'country' | 'region',
  query: string
) {
  const [results, setResults] = useState<GeoLocationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!accountId || !query || query.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const locationTypes = JSON.stringify([locationType]);
        const path = `search?type=adgeolocation&location_types=${encodeURIComponent(locationTypes)}&q=${encodeURIComponent(query)}&limit=8`;
        const res = await metaGet(accountId, path);

        const entries: GeoLocationEntry[] = (res.data || []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item: any) => {
            const entry: GeoLocationEntry = {
              key: String(item.key),
              name: item.name,
              type: locationType,
              country_code: item.country_code || undefined,
              region_name: item.region || undefined,
            };
            if (locationType === 'city') {
              entry.radius = 25;
              entry.distance_unit = 'kilometer';
            }
            return entry;
          }
        );

        setResults(entries);
      } catch (err) {
        console.warn('[GeoSearch] Error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [accountId, locationType, query]);

  return { results, isLoading };
}
