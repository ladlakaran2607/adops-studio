import { useQuery } from '@tanstack/react-query';
import { metaGet } from '@/lib/metaApi';

export interface ProductSet {
  id: string;
  name: string;
}

interface ProductSetsResponse {
  data?: Array<{ id: string; name?: string }>;
  error?: { message?: string };
}

/**
 * Fetches all product sets under a Meta catalog via the meta-proxy edge function.
 * Only runs when both accountId and catalogId are provided AND `enabled` is true —
 * callers gate this with a user-facing toggle so we don't fire an extra Meta call
 * on every CampaignBuilder render.
 */
export function useProductSets(
  accountId: string | undefined,
  catalogId: string | undefined | null,
  enabled: boolean,
) {
  return useQuery<ProductSet[]>({
    queryKey: ['product_sets', accountId, catalogId],
    enabled: !!accountId && !!catalogId && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!accountId || !catalogId) return [];
      const res = (await metaGet(
        accountId,
        `${catalogId}/product_sets?fields=id,name&limit=200`,
      )) as ProductSetsResponse;
      if (res.error) throw new Error(res.error.message || 'Failed to load product sets');
      return (res.data || []).map(p => ({ id: p.id, name: p.name || p.id }));
    },
  });
}
