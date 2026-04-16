import { useQuery } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

export interface AdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  campaign_name: string;
}

interface AdSetsResponse {
  ad_sets: AdSet[];
}

/**
 * Fetches all ad sets for an ad account via meta-fetch-adsets edge function.
 * Cached for 5 minutes. Callers filter client-side by campaign_id.
 */
export function useAdSets(accountId: string | undefined, enabled: boolean = true) {
  return useQuery<AdSet[]>({
    queryKey: ['adsets', accountId],
    enabled: !!accountId && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!accountId) return [];
      const res = await invokeEdgeFunction<AdSetsResponse>('meta-fetch-adsets', {
        account_id: accountId,
      });
      return res.ad_sets || [];
    },
  });
}
