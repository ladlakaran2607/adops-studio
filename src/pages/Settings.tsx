import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdAccounts } from '@/hooks/useAdAccounts';
import {
  useOrganization,
  useUpdateOrg,
  useOrgMembers,
  useOrgInvites,
  useCreateInvite,
  useAddAdAccount,
  useDeleteAdAccount,
} from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Trash2, Copy, Check, Loader2, Plus, Users, Building2, CreditCard, AlertCircle } from 'lucide-react';

export default function Settings() {
  const [searchParams] = useSearchParams();
  const isOnboarding = searchParams.get('onboarding') === 'true';

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your organization, ad accounts, and team members.</p>
        </div>

        {isOnboarding && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
            <AlertCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Welcome! Add your first ad account to get started.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your Meta ad account details below. You'll need your Account ID and a long-lived access token.
              </p>
            </div>
          </div>
        )}

        <Tabs defaultValue="ad-accounts">
          <TabsList>
            <TabsTrigger value="ad-accounts" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Ad Accounts
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="w-4 h-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="w-4 h-4" />
              Organization
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ad-accounts" className="space-y-4 mt-4">
            <AdAccountsTab />
          </TabsContent>

          <TabsContent value="members" className="space-y-4 mt-4">
            <MembersTab />
          </TabsContent>

          <TabsContent value="organization" className="space-y-4 mt-4">
            <OrganizationTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ── Ad Accounts Tab ──

function AdAccountsTab() {
  const { data: accounts, isLoading } = useAdAccounts();
  const addAccount = useAddAdAccount();
  const deleteAccount = useDeleteAdAccount();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [pageId, setPageId] = useState('');
  const [instagramId, setInstagramId] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [accessToken, setAccessToken] = useState('');

  const resetForm = () => {
    setName('');
    setAccountId('');
    setPageId('');
    setInstagramId('');
    setPixelId('');
    setAccessToken('');
    setShowForm(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !accountId.trim() || !accessToken.trim()) {
      toast.error('Name, Account ID, and Access Token are required');
      return;
    }

    try {
      await addAccount.mutateAsync({
        name: name.trim(),
        accountId: accountId.trim(),
        pageId: pageId.trim() || undefined,
        instagramId: instagramId.trim() || undefined,
        pixelId: pixelId.trim() || undefined,
        accessToken: accessToken.trim(),
      });
      toast.success('Ad account added successfully');
      resetForm();
    } catch (err) {
      toast.error(`Failed to add account: ${(err as Error).message}`);
    }
  };

  const handleDelete = async (id: string, accountName: string) => {
    if (!confirm(`Delete ad account "${accountName}"? This cannot be undone.`)) return;
    try {
      await deleteAccount.mutateAsync(id);
      toast.success('Ad account deleted');
    } catch (err) {
      toast.error(`Failed to delete: ${(err as Error).message}`);
    }
  };

  return (
    <>
      {/* Existing accounts list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Ad Accounts</CardTitle>
            <CardDescription>Meta ad accounts connected to your organization.</CardDescription>
          </div>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Account
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts && accounts.length > 0 ? (
            <div className="divide-y">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-sm">{acc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Account ID: {acc.accountId}
                      {acc.pageId && ` · Page: ${acc.pageId}`}
                      {acc.pixelId && ` · Pixel: ${acc.pixelId}`}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Check className="w-3 h-3 text-green-500" />
                      <span className="text-xs text-green-600">Token saved</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(acc.id, acc.name)}
                    disabled={deleteAccount.isPending}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No ad accounts yet. Add one to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add account form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Ad Account</CardTitle>
            <CardDescription>
              The access token will be validated against Meta's API before saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="acc-name">Name *</Label>
                  <Input
                    id="acc-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. BrandPeak NL"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acc-id">Account ID *</Label>
                  <Input
                    id="acc-id"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    placeholder="Numeric, without act_ prefix"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="page-id">Page ID</Label>
                  <Input
                    id="page-id"
                    value={pageId}
                    onChange={(e) => setPageId(e.target.value)}
                    placeholder="Facebook Page ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ig-id">Instagram ID</Label>
                  <Input
                    id="ig-id"
                    value={instagramId}
                    onChange={(e) => setInstagramId(e.target.value)}
                    placeholder="Instagram account ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pixel-id">Pixel ID</Label>
                  <Input
                    id="pixel-id"
                    value={pixelId}
                    onChange={(e) => setPixelId(e.target.value)}
                    placeholder="Meta Pixel ID"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access-token">Access Token *</Label>
                <Input
                  id="access-token"
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Long-lived Meta access token"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={addAccount.isPending}>
                  {addAccount.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Validating & saving...
                    </>
                  ) : (
                    'Add Account'
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ── Members Tab ──

function MembersTab() {
  const { role } = useAuth();
  const { data: members, isLoading: membersLoading } = useOrgMembers();
  const { data: invites, isLoading: invitesLoading } = useOrgInvites();
  const createInvite = useCreateInvite();

  const [inviteRole, setInviteRole] = useState('member');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isAdmin = role === 'owner' || role === 'admin';

  const handleCreateInvite = async () => {
    try {
      const token = await createInvite.mutateAsync(inviteRole);
      const link = `${window.location.origin}/signup?invite=${token}`;
      setGeneratedLink(link);
      setCopied(false);
      toast.success('Invite link created');
    } catch (err) {
      toast.error(`Failed to create invite: ${(err as Error).message}`);
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <>
      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Members</CardTitle>
          <CardDescription>People in your organization.</CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : members && members.length > 0 ? (
            <div className="divide-y">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{m.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(m.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted capitalize">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No members found.</p>
          )}
        </CardContent>
      </Card>

      {/* Invite section — only for owner/admin */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invite Member</CardTitle>
            <CardDescription>Generate a link to invite someone to your organization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="space-y-2 w-40">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateInvite} disabled={createInvite.isPending}>
                {createInvite.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-1" />
                )}
                Generate Link
              </Button>
            </div>

            {generatedLink && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
                <code className="text-xs flex-1 truncate">{generatedLink}</code>
                <Button size="icon" variant="ghost" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            )}

            {/* Pending invites */}
            {!invitesLoading && invites && invites.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Pending Invites</p>
                <div className="space-y-2">
                  {invites.map((inv) => {
                    const isExpired = new Date(inv.expiresAt) < new Date();
                    return (
                      <div key={inv.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="capitalize text-muted-foreground">{inv.role}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <code className="text-xs text-muted-foreground">
                            ...{inv.token.slice(-8)}
                          </code>
                        </div>
                        <span className={`text-xs ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {isExpired ? 'Expired' : `Expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

// ── Organization Tab ──

function OrganizationTab() {
  const { role } = useAuth();
  const { data: org, isLoading } = useOrganization();
  const updateOrg = useUpdateOrg();
  const [editName, setEditName] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const isOwner = role === 'owner';

  const startEdit = () => {
    if (org) {
      setEditName(org.name);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    try {
      await updateOrg.mutateAsync(editName.trim());
      toast.success('Organization name updated');
      setIsEditing(false);
    } catch (err) {
      toast.error(`Failed to update: ${(err as Error).message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Organization Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          {isEditing ? (
            <div className="flex gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
              <Button onClick={handleSave} disabled={updateOrg.isPending} size="sm">
                {updateOrg.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm">{org?.name}</p>
              {isOwner && (
                <Button variant="ghost" size="sm" onClick={startEdit}>
                  Edit
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Slug</Label>
          <p className="text-sm text-muted-foreground">{org?.slug}</p>
        </div>

        <div className="space-y-2">
          <Label>Created</Label>
          <p className="text-sm text-muted-foreground">
            {org?.createdAt ? new Date(org.createdAt).toLocaleDateString() : '—'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
