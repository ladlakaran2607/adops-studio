import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

// ── Types ──

export interface OrgMember {
  id: string;
  userId: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface OrgInvite {
  id: string;
  token: string;
  email: string | null;
  role: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

// ── Organization ──

export function useOrganization() {
  const { organizationId } = useAuth();

  return useQuery<Organization | null>({
    queryKey: ['organization', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug, created_at')
        .eq('id', organizationId!)
        .single();
      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        createdAt: data.created_at,
      };
    },
  });
}

export function useUpdateOrg() {
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();

  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('organizations')
        .update({ name })
        .eq('id', organizationId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
    },
  });
}

// ── Members ──

export function useOrgMembers() {
  const { organizationId } = useAuth();

  return useQuery<OrgMember[]>({
    queryKey: ['org_members', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_members_with_email')
        .select('id, organization_id, user_id, role, created_at, email')
        .eq('organization_id', organizationId!);
      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
      }));
    },
  });
}

// ── Invites ──

export function useOrgInvites() {
  const { organizationId } = useAuth();

  return useQuery<OrgInvite[]>({
    queryKey: ['org_invites', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_invites')
        .select('id, token, email, role, expires_at, used_at, created_at')
        .eq('organization_id', organizationId!)
        .is('used_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(row => ({
        id: row.id,
        token: row.token,
        email: row.email,
        role: row.role,
        expiresAt: row.expires_at,
        usedAt: row.used_at,
        createdAt: row.created_at,
      }));
    },
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  const { organizationId, user } = useAuth();

  return useMutation({
    mutationFn: async (role: string) => {
      const { data, error } = await supabase
        .from('org_invites')
        .insert({
          organization_id: organizationId!,
          role,
          created_by: user!.id,
        })
        .select('token')
        .single();
      if (error) throw error;
      return data.token as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org_invites'] });
    },
  });
}

// ── Ad Accounts ──

export function useAddAdAccount() {
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();

  return useMutation({
    mutationFn: async (account: {
      name: string;
      accountId: string;
      pageId?: string;
      instagramId?: string;
      pixelId?: string;
      accessToken: string;
    }) => {
      // Validate token first
      const validation = await invokeEdgeFunction<{ valid: boolean; error?: string }>(
        'meta-validate-token',
        { access_token: account.accessToken }
      );

      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid access token');
      }

      // Token is valid — save the account
      const { error } = await supabase.from('ad_accounts').insert({
        organization_id: organizationId!,
        name: account.name,
        account_id: account.accountId,
        page_id: account.pageId || null,
        instagram_id: account.instagramId || null,
        pixel_id: account.pixelId || null,
        access_token: account.accessToken,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad_accounts'] });
    },
  });
}

export function useDeleteAdAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ad_accounts')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad_accounts'] });
    },
  });
}
