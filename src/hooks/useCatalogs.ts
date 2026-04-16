import { useQuery } from '@tanstack/react-query';
import { metaGet } from '@/lib/metaApi';

export interface Catalog {
  id: string;
  name: string;
}

interface CatalogsResponse {
  data?: Array<{ id: string; name?: string }>;
  error?: { message?: string };
}

/**
 * Fetches all product catalogs assigned to an ad account via meta-proxy.
 * Only runs when `enabled` is true — callers gate with a user toggle so we
 * don't fire an extra Meta call on every render.
 */
export function useCatalogs(accountId: string | undefined, enabled: boolean) {
  return useQuery<Catalog[]>({
    queryKey: ['catalogs', accountId],
    enabled: !!accountId && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!accountId) return [];
      // Catalogs live under Business Manager, not directly on the ad account.
      // Step 1: resolve the owning business for this ad account.
      const acct = (await metaGet(
        accountId,
        `act_${accountId}?fields=business{id,name}`,
      )) as { business?: { id?: string }; error?: { message?: string } };
      if (acct.error) throw new Error(acct.error.message || 'Failed to resolve account business');
      const businessId = acct.business?.id;
      if (!businessId) {
        throw new Error('This ad account is not linked to a Business Manager — no catalogs to list. Set a Catalog ID on the campaign template instead.');
      }

      // Step 2: list owned + client catalogs under that business, then merge.
      const [owned, client] = await Promise.all([
        metaGet(accountId, `${businessId}/owned_product_catalogs?fields=id,name&limit=200`) as Promise<CatalogsResponse>,
        metaGet(accountId, `${businessId}/client_product_catalogs?fields=id,name&limit=200`) as Promise<CatalogsResponse>,
      ]);
      if (owned.error) throw new Error(owned.error.message || 'Failed to load owned catalogs');

      const merged = new Map<string, string>();
      (owned.data || []).forEach(c => merged.set(c.id, c.name || c.id));
      // client_product_catalogs may 403 for accounts without permission — ignore silently
      if (!client.error) (client.data || []).forEach(c => { if (!merged.has(c.id)) merged.set(c.id, c.name || c.id); });

      return Array.from(merged, ([id, name]) => ({ id, name }));
    },
  });
}
