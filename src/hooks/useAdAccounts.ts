import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdAccount {
  id: string;
  name: string;
  accountId: string;
  pageId: string | null;
  instagramId: string | null;
  pixelId: string | null;
}

/**
 * Fetches ad accounts for the current user's organization (scoped by RLS).
 * Does NOT expose access_token — that stays server-side only.
 */
export function useAdAccounts() {
  return useQuery<AdAccount[]>({
    queryKey: ['ad_accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('AdAccounts')
        .select('id, platformAccountName, platformAccountId, pageId, instagramId, pixelId')
        .order('platformAccountName', { ascending: true });
      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        name: row.platformAccountName,
        accountId: row.platformAccountId,
        pageId: row.pageId,
        instagramId: row.instagramId,
        pixelId: row.pixelId,
      }));
    },
  });
}
