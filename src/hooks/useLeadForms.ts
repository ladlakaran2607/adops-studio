import { useQuery } from '@tanstack/react-query';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

export interface LeadForm {
  id: string;
  name: string;
  status: string;
}

interface LeadFormsResponse {
  forms: LeadForm[];
}

/**
 * Fetches lead gen forms for a Facebook page via meta-fetch-leadforms edge function.
 * The edge function resolves the page access token server-side via /me/accounts.
 * Only runs when both accountId and pageId are provided.
 */
export function useLeadForms(accountId: string | undefined, pageId: string | undefined | null) {
  return useQuery<LeadForm[]>({
    queryKey: ['lead_forms', accountId, pageId],
    enabled: !!accountId && !!pageId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!accountId || !pageId) return [];
      const res = await invokeEdgeFunction<LeadFormsResponse>('meta-fetch-leadforms', {
        account_id: accountId,
        page_id: pageId,
      });
      return res.forms || [];
    },
  });
}
