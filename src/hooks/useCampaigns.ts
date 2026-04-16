import { useQuery } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

export interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
}

interface CampaignsResponse {
  campaigns: Campaign[];
}

/**
 * Fetches all campaigns for an ad account via meta-fetch-campaigns edge function.
 * Cached for 5 minutes — campaigns don't change often during a single session.
 */
export function useCampaigns(accountId: string | undefined, enabled: boolean = true) {
  return useQuery<Campaign[]>({
    queryKey: ['campaigns', accountId],
    enabled: !!accountId && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!accountId) return [];
      const res = await invokeEdgeFunction<CampaignsResponse>('meta-fetch-campaigns', {
        account_id: accountId,
      });
      return res.campaigns || [];
    },
  });
}
