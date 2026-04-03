import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { CampaignTemplateForm } from '@/components/templates/CampaignTemplateForm';
import { AdsetTemplateForm } from '@/components/templates/AdsetTemplateForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Megaphone, Layers, LayoutTemplate, Zap, Brain, ArrowLeft, Save, Image, Video, GalleryHorizontal, ShoppingBag } from 'lucide-react';
import { useTemplateStore, createEmptyCampaignTemplate, createEmptyAdsetTemplate, createEmptyAdTemplate, createEmptyAdvantageCreativeTemplate, createEmptyAIRule } from '@/store/templateStore';
import { useAdAccounts } from '@/hooks/useAdAccounts';
import type { CampaignTemplate, AdsetTemplate, AdTemplate, AdvantageCreativeTemplate, AIEnhancementRule, ImageEnhancements, VideoEnhancements, CarouselEnhancements, CatalogEnhancements } from '@/types/templates';

// --- Ad Template Form (inline) ---
const creativeTypes = ['SINGLE_IMAGE', 'SINGLE_VIDEO', 'CAROUSEL'];
const ctaOptions = [
  'SHOP_NOW', 'LEARN_MORE', 'SIGN_UP', 'BOOK_NOW', 'CONTACT_US', 'DOWNLOAD',
  'GET_OFFER', 'ORDER_NOW', 'SUBSCRIBE', 'GET_QUOTE', 'APPLY_NOW', 'BUY_NOW',
  'WATCH_MORE', 'SEND_MESSAGE', 'CALL_NOW', 'GET_DIRECTIONS', 'REQUEST_TIME',
  'SEE_MENU', 'WHATSAPP_MESSAGE',
];

function AdTemplateForm({ template, onSave, onCancel }: { template: AdTemplate; onSave: (t: AdTemplate) => void; onCancel: () => void }) {
  const [form, setForm] = useState(template);
  const set = <K extends keyof AdTemplate>(key: K, val: AdTemplate[K]) => setForm(f => ({ ...f, [key]: val }));
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft className="w-4 h-4" /></Button>
        <div><h2 className="text-xl font-bold">Ad Template</h2><p className="text-sm text-muted-foreground">Creative type and call-to-action settings</p></div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Template Name</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="E.g. Single Image - Shop Now" className="mt-1.5" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Creative Type</Label><Select value={form.creativeType} onValueChange={v => set('creativeType', v)}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{creativeTypes.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Call to Action</Label><Select value={form.callToAction} onValueChange={v => set('callToAction', v)}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{ctaOptions.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div><Label>URL Parameters</Label><Input value={form.urlParameters} onChange={e => set('urlParameters', e.target.value)} placeholder="utm_source=facebook&utm_medium=paid" className="mt-1.5" /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Tracking</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Conversion Domain</Label><Input value={form.conversionDomain} onChange={e => set('conversionDomain', e.target.value)} placeholder="example.com (first and second level domain only)" className="mt-1.5" /></div>
          <div><Label>Tracking Pixel ID</Label><Input value={form.trackingPixelId} onChange={e => set('trackingPixelId', e.target.value)} placeholder="Meta Pixel ID for tracking" className="mt-1.5" /></div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} className="gap-2"><Save className="w-4 h-4" />Save</Button>
      </div>
    </div>
  );
}

// --- Advantage Creative Form (inline) ---
type ToggleField<T> = { key: keyof T; label: string };

const imageFields: ToggleField<ImageEnhancements>[] = [
  { key: 'advantageCreative', label: 'Advantage+ Creative' },
  { key: 'visualTouchups', label: 'Visual Touch-ups' },
  { key: 'adjustBrightnessContrast', label: 'Adjust Brightness & Contrast' },
  { key: 'textTranslation', label: 'Text Translation' },
  { key: 'imageAnimation', label: 'Image Animation (3D)' },
  { key: 'music', label: 'Music' },
  { key: 'flexibleMedia', label: 'Flexible Media' },
  { key: 'enhanceCta', label: 'Enhance CTA' },
  { key: 'addOverlays', label: 'Add Overlays' },
  { key: 'expandImage', label: 'Expand Image' },
  { key: 'textImprovements', label: 'Text Improvements' },
  { key: 'relevantComments', label: 'Relevant Comments' },
  { key: 'addProductTags', label: 'Add Product Tags' },
  { key: 'addCatalogItems', label: 'Add Catalog Items' },
];

const videoFields: ToggleField<VideoEnhancements>[] = [
  { key: 'advantageCreative', label: 'Advantage+ Creative' },
  { key: 'visualTouchups', label: 'Visual Touch-ups' },
  { key: 'videoEffects', label: 'Video Effects' },
  { key: 'textTranslation', label: 'Text Translation' },
  { key: 'videoToImage', label: 'Video to Image' },
  { key: 'flexibleMedia', label: 'Flexible Media' },
  { key: 'enhanceCta', label: 'Enhance CTA' },
  { key: 'textImprovements', label: 'Text Improvements' },
  { key: 'relevantComments', label: 'Relevant Comments' },
  { key: 'music', label: 'Music' },
  { key: 'addProductTags', label: 'Add Product Tags' },
  { key: 'addCatalogItems', label: 'Add Catalog Items' },
];

const carouselFields: ToggleField<CarouselEnhancements>[] = [
  { key: 'advantageCreative', label: 'Advantage+ Creative' },
  { key: 'formatAutomation', label: 'Format Automation' },
  { key: 'photosToVideo', label: 'Photos to Video' },
  { key: 'highlightCard', label: 'Highlight Card' },
  { key: 'dynamicDescription', label: 'Dynamic Description' },
  { key: 'profileEndCard', label: 'Profile End Card' },
  { key: 'expandImage', label: 'Expand Image' },
  { key: 'addOverlays', label: 'Add Overlays' },
  { key: 'enhanceCta', label: 'Enhance CTA' },
  { key: 'textImprovements', label: 'Text Improvements' },
  { key: 'relevantComments', label: 'Relevant Comments' },
];

const catalogFields: ToggleField<CatalogEnhancements>[] = [
  { key: 'adaptToPlacement', label: 'Adapt to Placement' },
  { key: 'dynamicMedia', label: 'Dynamic Media' },
  { key: 'dynamicDescription', label: 'Dynamic Description' },
  { key: 'dynamicOverlays', label: 'Dynamic Overlays' },
  { key: 'generateBackground', label: 'Generate Background' },
  { key: 'siteLinks', label: 'Site Links' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EnhancementSection({ title, icon: Icon, fields, values, onChange }: {
  title: string; icon: React.ElementType; fields: { key: string; label: string }[]; values: any; onChange: (key: string, val: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Icon className="w-4 h-4" />{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map(({ key, label }) => (
          <div key={String(key)} className="flex items-center justify-between">
            <Label className="text-sm">{label}</Label>
            <Switch checked={values[key] as boolean} onCheckedChange={v => onChange(key, v)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AdvantageCreativeForm({ template, onSave, onCancel }: { template: AdvantageCreativeTemplate; onSave: (t: AdvantageCreativeTemplate) => void; onCancel: () => void }) {
  const [form, setForm] = useState(template);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft className="w-4 h-4" /></Button>
        <div><h2 className="text-xl font-bold">Advantage+ Creative Template</h2><p className="text-sm text-muted-foreground">Configure creative enhancements per format</p></div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Template</CardTitle></CardHeader>
        <CardContent>
          <div><Label>Template Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="E.g. Safe Defaults" className="mt-1.5" /></div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <EnhancementSection title="Images" icon={Image} fields={imageFields} values={form.imageEnhancements}
          onChange={(key, val) => setForm(f => ({ ...f, imageEnhancements: { ...f.imageEnhancements, [key]: val } }))} />
        <EnhancementSection title="Videos" icon={Video} fields={videoFields} values={form.videoEnhancements}
          onChange={(key, val) => setForm(f => ({ ...f, videoEnhancements: { ...f.videoEnhancements, [key]: val } }))} />
        <EnhancementSection title="Carousel" icon={GalleryHorizontal} fields={carouselFields} values={form.carouselEnhancements}
          onChange={(key, val) => setForm(f => ({ ...f, carouselEnhancements: { ...f.carouselEnhancements, [key]: val } }))} />
        <EnhancementSection title="Catalog" icon={ShoppingBag} fields={catalogFields} values={form.catalogEnhancements}
          onChange={(key, val) => setForm(f => ({ ...f, catalogEnhancements: { ...f.catalogEnhancements, [key]: val } }))} />
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} className="gap-2"><Save className="w-4 h-4" />Save</Button>
      </div>
    </div>
  );
}

// --- AI Rules Form (inline) ---
const ruleTypes = ['Budget Rule', 'Bid Rule', 'Schedule Rule', 'Performance Rule', 'Custom Rule'];

function AIRuleForm({ template, onSave, onCancel }: { template: AIEnhancementRule; onSave: (t: AIEnhancementRule) => void; onCancel: () => void }) {
  const [form, setForm] = useState(template);
  const set = <K extends keyof AIEnhancementRule>(key: K, val: AIEnhancementRule[K]) => setForm(f => ({ ...f, [key]: val }));
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft className="w-4 h-4" /></Button>
        <div><h2 className="text-xl font-bold">AI Enhancement Rule</h2><p className="text-sm text-muted-foreground">Automatic rules for campaign optimization</p></div>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Rule Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Rule Name</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="E.g. Pause on high CPA" className="mt-1.5" /></div>
          <div><Label>Rule Type</Label><Select value={form.ruleType} onValueChange={v => set('ruleType', v)}><SelectTrigger className="mt-1.5"><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent>{ruleTypes.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Conditions</Label><Textarea value={form.conditions} onChange={e => set('conditions', e.target.value)} placeholder="E.g. CPA > €20 for 3 consecutive days" className="mt-1.5" /></div>
          <div><Label>Actions</Label><Textarea value={form.actions} onChange={e => set('actions', e.target.value)} placeholder="E.g. Pause ad set, notify via email" className="mt-1.5" /></div>
          <div className="flex items-center justify-between"><Label>Enabled</Label><Switch checked={form.enabled} onCheckedChange={v => set('enabled', v)} /></div>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} className="gap-2"><Save className="w-4 h-4" />Save</Button>
      </div>
    </div>
  );
}

// --- Main Templates Page ---
type EditingState =
  | { type: 'campaign'; template: CampaignTemplate; isNew: boolean }
  | { type: 'adset'; template: AdsetTemplate; isNew: boolean }
  | { type: 'ad'; template: AdTemplate; isNew: boolean }
  | { type: 'advantage'; template: AdvantageCreativeTemplate; isNew: boolean }
  | { type: 'ai'; template: AIEnhancementRule; isNew: boolean }
  | null;

const tabConfig = [
  { value: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { value: 'adsets', label: 'Adsets', icon: Layers },
  { value: 'ads', label: 'Ads', icon: LayoutTemplate },
];

const objectiveLabels: Record<string, string> = {
  OUTCOME_SALES: 'Sales', OUTCOME_LEADS: 'Leads', OUTCOME_ENGAGEMENT: 'Engagement',
  OUTCOME_TRAFFIC: 'Traffic', OUTCOME_AWARENESS: 'Awareness', OUTCOME_APP_PROMOTION: 'App Promotion',
};
const bidStrategyLabels: Record<string, string> = {
  LOWEST_COST_WITHOUT_CAP: 'Lowest Cost', LOWEST_COST_WITH_BID_CAP: 'Bid Cap',
  COST_CAP: 'Cost Cap', LOWEST_COST_WITH_MIN_ROAS: 'Min ROAS',
};

export default function Templates() {
  const campaigns = useTemplateStore<CampaignTemplate>('campaign-templates');
  const adsets = useTemplateStore<AdsetTemplate>('adset-templates');
  const ads = useTemplateStore<AdTemplate>('ad-templates');
  const advantage = useTemplateStore<AdvantageCreativeTemplate>('advantage-creative-templates');
  const aiRules = useTemplateStore<AIEnhancementRule>('ai-rules-templates');
  const { data: adAccounts } = useAdAccounts();
  const firstAccountId = adAccounts?.[0]?.accountId;

  const [activeTab, setActiveTab] = useState('campaigns');
  const [editing, setEditing] = useState<EditingState>(null);

  const counts: Record<string, number> = {
    campaigns: campaigns.items.length,
    adsets: adsets.items.length,
    ads: ads.items.length + advantage.items.length + aiRules.items.length,
  };

  // --- Add handlers ---
  const handleAdd = () => {
    switch (activeTab) {
      case 'campaigns':
        setEditing({ type: 'campaign', template: { ...createEmptyCampaignTemplate(), id: crypto.randomUUID(), createdAt: new Date().toISOString() } as CampaignTemplate, isNew: true });
        break;
      case 'adsets':
        setEditing({ type: 'adset', template: { ...createEmptyAdsetTemplate(), id: crypto.randomUUID(), createdAt: new Date().toISOString() } as AdsetTemplate, isNew: true });
        break;
      case 'ads':
        setEditing({ type: 'ad', template: { ...createEmptyAdTemplate(), id: crypto.randomUUID(), createdAt: new Date().toISOString() } as AdTemplate, isNew: true });
        break;
    }
  };

  const cancelEdit = () => setEditing(null);

  // --- Save handlers ---
  const saveCampaign = (t: CampaignTemplate) => { editing?.isNew ? campaigns.add(t) : campaigns.update(t.id, t); setEditing(null); };
  const saveAdset = (t: AdsetTemplate) => { editing?.isNew ? adsets.add(t) : adsets.update(t.id, t); setEditing(null); };
  const saveAd = (t: AdTemplate) => { editing?.isNew ? ads.add(t) : ads.update(t.id, t); setEditing(null); };
  const saveAdvantage = (t: AdvantageCreativeTemplate) => { editing?.isNew ? advantage.add(t) : advantage.update(t.id, t); setEditing(null); };
  const saveAI = (t: AIEnhancementRule) => { editing?.isNew ? aiRules.add(t) : aiRules.update(t.id, t); setEditing(null); };

  // --- Render editing form ---
  if (editing) {
    return (
      <AppLayout>
        <div className="p-8 max-w-4xl">
          {editing.type === 'campaign' && <CampaignTemplateForm template={editing.template} onSave={saveCampaign} onCancel={cancelEdit} />}
          {editing.type === 'adset' && <AdsetTemplateForm template={editing.template} onSave={saveAdset} onCancel={cancelEdit} accountId={firstAccountId} />}
          {editing.type === 'ad' && <AdTemplateForm template={editing.template} onSave={saveAd} onCancel={cancelEdit} />}
          {editing.type === 'advantage' && <AdvantageCreativeForm template={editing.template} onSave={saveAdvantage} onCancel={cancelEdit} />}
          {editing.type === 'ai' && <AIRuleForm template={editing.template} onSave={saveAI} onCancel={cancelEdit} />}
        </div>
      </AppLayout>
    );
  }

  // --- Empty state ---
  const EmptyState = ({ label }: { label: string }) => (
    <div className="mt-12 text-center text-muted-foreground">
      <p className="text-lg font-medium">No {label} yet</p>
      <p className="text-sm mt-1">Create your first template to get started.</p>
    </div>
  );

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage all your presets in one place — campaigns, adsets, ads, creative enhancements and AI rules.
            </p>
          </div>
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            New Template
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary/50 mb-6">
            {tabConfig.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="gap-2 data-[state=active]:bg-card data-[state=active]:text-primary">
                <Icon className="w-4 h-4" />
                {label}
                {counts[value] > 0 && (
                  <span className="ml-1 text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded-full">{counts[value]}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Campaign Templates */}
          <TabsContent value="campaigns">
            {campaigns.items.length === 0 ? <EmptyState label="campaign templates" /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campaigns.items.map(t => (
                  <TemplateCard key={t.id} name={t.name} subtitle={objectiveLabels[t.campaignObjective] || t.campaignObjective || 'No objective set'}
                    details={[
                      { label: 'Buying', value: t.buyingType },
                      { label: 'Bid', value: bidStrategyLabels[t.bidStrategy] || t.bidStrategy },
                      { label: 'Budget', value: t.campaignBudgetValue ? `${t.campaignBudgetType} €${t.campaignBudgetValue}` : 'Not set' },
                      { label: 'Status', value: t.campaignStatus || 'PAUSED' },
                    ]}
                    onEdit={() => setEditing({ type: 'campaign', template: t, isNew: false })}
                    onDelete={() => campaigns.remove(t.id)}
                    onDuplicate={() => campaigns.add({ ...t, id: crypto.randomUUID(), name: `${t.name} (copy)`, createdAt: new Date().toISOString() })}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Adset Templates */}
          <TabsContent value="adsets">
            {adsets.items.length === 0 ? <EmptyState label="adset templates" /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {adsets.items.map(t => (
                  <TemplateCard key={t.id} name={t.name} subtitle={`${t.optimization} — ${t.adsetConversionEvent}`}
                    details={[
                      { label: 'Location', value: t.location?.startsWith('[') ? (JSON.parse(t.location) as { name: string }[]).map(l => l.name).join(', ') || 'Not set' : t.location || 'Not set' },
                      { label: 'Target', value: `${t.targetGender}, ${t.targetAge}` },
                      { label: 'Budget', value: t.adsetBudgetValue ? `${t.adsetBudgetType} €${t.adsetBudgetValue}` : 'Not set' },
                      { label: 'Placements', value: t.placements },
                    ]}
                    onEdit={() => setEditing({ type: 'adset', template: t, isNew: false })}
                    onDelete={() => adsets.remove(t.id)}
                    onDuplicate={() => adsets.add({ ...t, id: crypto.randomUUID(), name: `${t.name} (copy)`, createdAt: new Date().toISOString() })}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Ads — includes Ad Templates, Advantage+ Creative, AI Rules */}
          <TabsContent value="ads">
            <div className="space-y-10">
              {/* Sub-section: Ad Templates */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><LayoutTemplate className="w-4 h-4" />Ad Templates</h2>
                  <Button variant="outline" size="sm" onClick={() => setEditing({ type: 'ad', template: { ...createEmptyAdTemplate(), id: crypto.randomUUID(), createdAt: new Date().toISOString() } as AdTemplate, isNew: true })} className="gap-1.5"><Plus className="w-3.5 h-3.5" />New</Button>
                </div>
                {ads.items.length === 0 ? <p className="text-sm text-muted-foreground">No ad templates created yet.</p> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ads.items.map(t => (
                      <TemplateCard key={t.id} name={t.name} subtitle={t.creativeType.replace(/_/g, ' ')}
                        details={[
                          { label: 'CTA', value: t.callToAction.replace(/_/g, ' ') },
                          { label: 'URL Params', value: t.urlParameters || 'None' },
                          { label: 'Domain', value: t.conversionDomain || '—' },
                          { label: 'Pixel', value: t.trackingPixelId || '—' },
                        ]}
                        onEdit={() => setEditing({ type: 'ad', template: t, isNew: false })}
                        onDelete={() => ads.remove(t.id)}
                        onDuplicate={() => ads.add({ ...t, id: crypto.randomUUID(), name: `${t.name} (copy)`, createdAt: new Date().toISOString() })}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Sub-section: Advantage+ Creative */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><Zap className="w-4 h-4" />Advantage+ Creative</h2>
                  <Button variant="outline" size="sm" onClick={() => setEditing({ type: 'advantage', template: { ...createEmptyAdvantageCreativeTemplate(), id: crypto.randomUUID(), createdAt: new Date().toISOString() } as AdvantageCreativeTemplate, isNew: true })} className="gap-1.5"><Plus className="w-3.5 h-3.5" />New</Button>
                </div>
                {advantage.items.length === 0 ? <p className="text-sm text-muted-foreground">No Advantage+ creative templates created yet.</p> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {advantage.items.map(t => (
                      <TemplateCard key={t.id} name={t.name} subtitle="Creative Enhancements"
                        details={[
                          { label: 'Images', value: t.imageEnhancements?.advantageCreative ? 'On' : 'Off' },
                          { label: 'Videos', value: t.videoEnhancements?.advantageCreative ? 'On' : 'Off' },
                          { label: 'Carousel', value: t.carouselEnhancements?.advantageCreative ? 'On' : 'Off' },
                          { label: 'Catalog', value: t.catalogEnhancements?.dynamicMedia ? 'On' : 'Off' },
                        ]}
                        onEdit={() => setEditing({ type: 'advantage', template: t, isNew: false })}
                        onDelete={() => advantage.remove(t.id)}
                        onDuplicate={() => advantage.add({ ...t, id: crypto.randomUUID(), name: `${t.name} (copy)`, createdAt: new Date().toISOString() })}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Sub-section: AI Rules */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><Brain className="w-4 h-4" />AI Enhancement Rules</h2>
                  <Button variant="outline" size="sm" onClick={() => setEditing({ type: 'ai', template: { ...createEmptyAIRule(), id: crypto.randomUUID(), createdAt: new Date().toISOString() } as AIEnhancementRule, isNew: true })} className="gap-1.5"><Plus className="w-3.5 h-3.5" />New</Button>
                </div>
                {aiRules.items.length === 0 ? <p className="text-sm text-muted-foreground">No AI rules created yet.</p> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {aiRules.items.map(t => (
                      <TemplateCard key={t.id} name={t.name} subtitle={t.ruleType || 'No type'}
                        details={[
                          { label: 'Conditions', value: t.conditions?.substring(0, 30) || 'None' },
                          { label: 'Actions', value: t.actions?.substring(0, 30) || 'None' },
                          { label: 'Status', value: t.enabled ? 'Enabled' : 'Disabled' },
                        ]}
                        onEdit={() => setEditing({ type: 'ai', template: t, isNew: false })}
                        onDelete={() => aiRules.remove(t.id)}
                        onDuplicate={() => aiRules.add({ ...t, id: crypto.randomUUID(), name: `${t.name} (copy)`, createdAt: new Date().toISOString() })}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
