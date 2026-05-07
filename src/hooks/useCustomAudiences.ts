import { useQuery } from '@tanstack/react-query';
import { metaGet } from '@/lib/metaApi';

export interface CustomAudience {
  id: string;
  name: string;
  subtype?: string;
  approximate_count_lower_bound?: number;
  approximate_count_upper_bound?: number;
}

interface CustomAudiencesResponse {
  data?: Array<{
    id: string;
    name?: string;
    subtype?: string;
    approximate_count_lower_bound?: number;
    approximate_count_upper_bound?: number;
  }>;
  error?: { message?: string };
}

/**
 * Fetches all custom audiences (including lookalikes) for an ad account
 * via meta-proxy. Cached for 5 min — audiences change rarely during a session.
 *
 * Used by the Campaign Builder's per-ad-set audience pickers. Audiences are
 * scoped to the ad account, so the hook re-runs whenever accountId changes.
 */
export function useCustomAudiences(accountId: string | undefined, enabled: boolean = true) {
  return useQuery<CustomAudience[]>({
    queryKey: ['custom-audiences', accountId],
    enabled: !!accountId && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!accountId) return [];
      const fields = 'id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound';
      const res = (await metaGet(
        accountId,
        `act_${accountId}/customaudiences?fields=${fields}&limit=200`,
      )) as CustomAudiencesResponse;
      if (res.error) throw new Error(res.error.message || 'Failed to load custom audiences');
      return (res.data || []).map(a => ({
        id: a.id,
        name: a.name || a.id,
        subtype: a.subtype,
        approximate_count_lower_bound: a.approximate_count_lower_bound,
        approximate_count_upper_bound: a.approximate_count_upper_bound,
      }));
    },
  });
}
