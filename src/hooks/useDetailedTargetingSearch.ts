import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { metaGet } from '@/lib/metaApi';
import type { DetailedTargetingEntry, DetailedTargetingType } from '@/types/templates';

/**
 * Detailed targeting picker data source. Splits by tab because Meta's API
 * is asymmetric:
 *   - Interests have a dedicated text-search endpoint (`adinterest`).
 *   - Behaviors / demographics only support BROWSE via `adTargetingCategory`,
 *     so we fetch the full paginated list once per (account, class) and
 *     filter client-side by name.
 *
 * "Demographics" is a UI bucket that maps to four Meta classes:
 *   life_events, industries, income, family_statuses.
 */

export type TargetingTab = 'all' | 'interests' | 'behaviors' | 'demographics';

const DEMOGRAPHIC_CLASSES = ['life_events', 'industries', 'income', 'family_statuses'] as const;

function normalizeType(rawType: string): DetailedTargetingType | null {
  const t = rawType.toLowerCase();
  if (t === 'interests') return 'interests';
  if (t === 'behaviors') return 'behaviors';
  if (t === 'life_events') return 'life_events';
  if (t === 'industries') return 'industries';
  if (t === 'income') return 'income';
  if (t === 'family_statuses') return 'family_statuses';
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapResult(item: any, fallbackType?: DetailedTargetingType): DetailedTargetingEntry | null {
  const type = normalizeType(String(item.type || '')) || fallbackType;
  if (!type) return null;
  return {
    id: String(item.id),
    name: item.name,
    type,
    path: Array.isArray(item.path) ? item.path : undefined,
    audience_size_lower_bound: item.audience_size_lower_bound,
    audience_size_upper_bound: item.audience_size_upper_bound,
  };
}

/** Paginates through `adTargetingCategory&class=<cls>` to get all leaves. */
async function fetchAllForClass(accountId: string, cls: string): Promise<DetailedTargetingEntry[]> {
  const all: DetailedTargetingEntry[] = [];
  let after: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fallback: DetailedTargetingType | undefined = (DEMOGRAPHIC_CLASSES as readonly string[]).includes(cls)
    ? (cls as DetailedTargetingType)
    : (cls === 'behaviors' ? 'behaviors' : undefined);

  // Safety cap: 20 pages × 250 = 5000 leaves. Behaviors is ~600, demographic
  // sub-classes are smaller. Interests browse can be larger but we don't
  // browse interests here — we use adinterest search instead.
  for (let i = 0; i < 20; i++) {
    const params = new URLSearchParams({
      type: 'adTargetingCategory',
      class: cls,
      limit: '250',
    });
    if (after) params.set('after', after);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await metaGet(accountId, `search?${params.toString()}`);
    const page = (res?.data || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => mapResult(item, fallback))
      .filter((e: DetailedTargetingEntry | null): e is DetailedTargetingEntry => e !== null);
    all.push(...page);
    after = res?.paging?.cursors?.after;
    if (!after || page.length === 0) break;
  }
  return all;
}

function useBrowseClass(accountId: string | undefined, cls: string, enabled: boolean) {
  return useQuery<DetailedTargetingEntry[]>({
    queryKey: ['detailed-targeting-browse', accountId, cls],
    enabled: !!accountId && enabled,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: () => fetchAllForClass(accountId!, cls),
  });
}

export function useDetailedTargetingSearch(
  accountId: string | undefined,
  filterType: TargetingTab,
  query: string,
) {
  // ── 1. Interest search via dedicated `adinterest` endpoint ──
  const needsInterests = filterType === 'all' || filterType === 'interests';
  const [interestResults, setInterestResults] = useState<DetailedTargetingEntry[]>([]);
  const [interestLoading, setInterestLoading] = useState(false);

  useEffect(() => {
    if (!accountId || !needsInterests || query.length < 2) {
      setInterestResults([]);
      setInterestLoading(false);
      return;
    }
    setInterestLoading(true);
    const timer = setTimeout(async () => {
      try {
        const path = `search?type=adinterest&q=${encodeURIComponent(query)}&limit=50`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res: any = await metaGet(accountId, path);
        const entries = (res?.data || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => mapResult(item, 'interests'))
          .filter((e: DetailedTargetingEntry | null): e is DetailedTargetingEntry => e !== null);
        setInterestResults(entries);
      } catch (err) {
        console.warn('[InterestSearch] Error:', err);
        setInterestResults([]);
      } finally {
        setInterestLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [accountId, needsInterests, query]);

  // ── 2. Browse fetches (paginated, cached 10 min) ──
  const needsBehaviors = filterType === 'all' || filterType === 'behaviors';
  const needsDemographics = filterType === 'all' || filterType === 'demographics';

  const behaviorsBrowse = useBrowseClass(accountId, 'behaviors', needsBehaviors);
  const lifeEventsBrowse = useBrowseClass(accountId, 'life_events', needsDemographics);
  const industriesBrowse = useBrowseClass(accountId, 'industries', needsDemographics);
  const incomeBrowse = useBrowseClass(accountId, 'income', needsDemographics);
  const familyStatusesBrowse = useBrowseClass(accountId, 'family_statuses', needsDemographics);

  const results = useMemo<DetailedTargetingEntry[]>(() => {
    const out: DetailedTargetingEntry[] = [];
    const lc = query.trim().toLowerCase();

    if (needsInterests) out.push(...interestResults);

    const filterByName = (list: DetailedTargetingEntry[] | undefined): DetailedTargetingEntry[] => {
      if (!list) return [];
      if (lc.length < 2) return [];
      return list.filter(e => e.name.toLowerCase().includes(lc));
    };

    if (needsBehaviors) out.push(...filterByName(behaviorsBrowse.data));

    if (needsDemographics) {
      out.push(...filterByName(lifeEventsBrowse.data));
      out.push(...filterByName(industriesBrowse.data));
      out.push(...filterByName(incomeBrowse.data));
      out.push(...filterByName(familyStatusesBrowse.data));
    }

    // Cap to keep popover render fast. CommandList is scrollable past
    // its visible height, so the user can browse the full set.
    return out.slice(0, 100);
  }, [
    needsInterests, needsBehaviors, needsDemographics,
    interestResults,
    behaviorsBrowse.data, lifeEventsBrowse.data,
    industriesBrowse.data, incomeBrowse.data, familyStatusesBrowse.data,
    query,
  ]);

  const isLoading =
    interestLoading ||
    (needsBehaviors && behaviorsBrowse.isLoading) ||
    (needsDemographics && (
      lifeEventsBrowse.isLoading ||
      industriesBrowse.isLoading ||
      incomeBrowse.isLoading ||
      familyStatusesBrowse.isLoading
    ));

  return { results, isLoading };
}
