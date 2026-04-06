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
 * Fields required on an ad account before campaigns can be launched.
 * `pageId` is spread into every creative's `object_story_spec` / `asset_feed_spec`,
 * `pixelId` is required for SALES/LEADS objectives, and `instagramId` is needed
 * for Instagram placements.
 */
export function getMissingAccountFields(account: AdAccount | undefined | null): string[] {
  if (!account) return [];
  const missing: string[] = [];
  if (!account.pageId) missing.push('Facebook Page ID');
  if (!account.pixelId) missing.push('Meta Pixel ID');
  if (!account.instagramId) missing.push('Instagram Account ID');
  return missing;
}

export function isAccountIncomplete(account: AdAccount | undefined | null): boolean {
  return getMissingAccountFields(account).length > 0;
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
