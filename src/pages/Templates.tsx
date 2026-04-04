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
import { Plus, Megaphone, Layers, LayoutTemplate, Zap, Brain, ArrowLeft, Save, Image, Video, GalleryHorizontal, ShoppingBag, Sparkles, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
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

export function AdTemplateForm({ template, onSave, onCancel }: { template: AdTemplate; onSave: (t: AdTemplate) => void; onCancel: () => void }) {
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

export function AdvantageCreativeForm({ template, onSave, onCancel }: { template: AdvantageCreativeTemplate; onSave: (t: AdvantageCreativeTemplate) => void; onCancel: () => void }) {
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
  { value: 'adsets', label: 'Ad Sets', icon: Layers },
  { value: 'ads', label: 'Ads', icon: LayoutTemplate },
  { value: 'advantage', label: 'Advantage+', icon: Sparkles },
  { value: 'rules', label: 'Rules', icon: Brain },
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
    ads: ads.items.length,
    advantage: advantage.items.length,
    rules: aiRules.items.length,
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
      case 'advantage':
        setEditing({ type: 'advantage', template: { ...createEmptyAdvantageCreativeTemplate(), id: crypto.randomUUID(), createdAt: new Date().toISOString() } as AdvantageCreativeTemplate, isNew: true });
        break;
      case 'rules':
        setEditing({ type: 'ai', template: { ...createEmptyAIRule(), id: crypto.randomUUID(), createdAt: new Date().toISOString() } as AIEnhancementRule, isNew: true });
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

  // --- Slide-over edit panel (Sheet) ---
  const editingTitle = editing?.type === 'campaign' ? 'Campaign Template'
    : editing?.type === 'adset' ? 'Ad Set Template'
    : editing?.type === 'ad' ? 'Ad Template'
    : editing?.type === 'advantage' ? 'Advantage+ Creative Template'
    : editing?.type === 'ai' ? 'AI Enhancement Rule'
    : '';

  const renderEditSheet = () => (
    <Sheet open={editing !== null} onOpenChange={(open) => { if (!open) cancelEdit(); }}>
      <SheetContent side="right" className="!w-[50vw] !max-w-[50vw] overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b border-border/30">
          <SheetTitle className="text-xl font-bold tracking-tight">
            {editing?.isNew ? 'New' : 'Edit'} {editingTitle}
          </SheetTitle>
          <SheetDescription className="text-[10px] font-bold text-primary tracking-widest uppercase">
            {editing?.isNew ? 'Create a new template' : `ID: ${editing?.template?.id?.substring(0, 8).toUpperCase()}`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {editing?.type === 'campaign' && <CampaignTemplateForm template={editing.template} onSave={saveCampaign} onCancel={cancelEdit} />}
          {editing?.type === 'adset' && <AdsetTemplateForm template={editing.template} onSave={saveAdset} onCancel={cancelEdit} accountId={firstAccountId} />}
          {editing?.type === 'ad' && <AdTemplateForm template={editing.template} onSave={saveAd} onCancel={cancelEdit} />}
          {editing?.type === 'advantage' && <AdvantageCreativeForm template={editing.template} onSave={saveAdvantage} onCancel={cancelEdit} />}
          {editing?.type === 'ai' && <AIRuleForm template={editing.template} onSave={saveAI} onCancel={cancelEdit} />}
        </div>
      </SheetContent>
    </Sheet>
  );

  // --- Empty state (matching Stitch mockup) ---
  const EmptyState = ({ label, onAction }: { label: string; onAction?: () => void }) => (
    <div className="lg:col-span-2 border-2 border-dashed border-primary/20 rounded-xl flex flex-col items-center justify-center p-12 bg-accent/20 animate-fade-in">
      <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center mb-4 shadow-sm">
        <Sparkles className="w-7 h-7 text-primary" />
      </div>
      <h3 className="font-bold text-foreground text-lg mb-2">Build more frameworks</h3>
      <p className="text-muted-foreground text-center max-w-sm mb-6 text-sm">
        Start by creating a reusable {label} framework to launch your Meta Ads faster.
      </p>
      {onAction && (
        <Button
          variant="outline"
          onClick={onAction}
          className="border-primary/20 text-primary bg-accent hover:bg-primary hover:text-primary-foreground transition-all duration-200 rounded-full px-6"
        >
          Create your first template
        </Button>
      )}
    </div>
  );

  return (
    <AppLayout>
      {/* Sticky header area */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-8 py-8">
        {/* Page title + Create button inline */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage reusable presets for campaigns, ad sets, and ads
            </p>
          </div>
          <Button
            onClick={handleAdd}
            className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold px-6 py-3 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>

        {/* Tab bar — golden underline style matching Stitch */}
        <div className="flex items-center gap-8 border-b border-border/30">
          {tabConfig.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`relative pb-4 flex items-center gap-2 font-semibold transition-all duration-200 ${
                activeTab === value
                  ? 'text-primary border-b-2 border-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{label}</span>
              {counts[value] > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  activeTab === value
                    ? 'bg-primary/10 text-primary'
                    : 'bg-accent text-primary'
                }`}>
                  {counts[value]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 pb-12">
        {/* Tab contents rendered manually (not using Tabs component for custom tab bar) */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Hidden TabsList for accessibility — visual tabs are above */}
          <TabsList className="hidden">
            {tabConfig.map(({ value, label }) => (
              <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
            ))}
          </TabsList>

          {/* Campaign Templates */}
          <TabsContent value="campaigns">
            {campaigns.items.length === 0 ? <EmptyState label="campaign templates" onAction={handleAdd} /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            {adsets.items.length === 0 ? <EmptyState label="adset templates" onAction={handleAdd} /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

          {/* Ad Templates */}
          <TabsContent value="ads">
            {ads.items.length === 0 ? <EmptyState label="ad templates" onAction={handleAdd} /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ads.items.map(t => (
                  <TemplateCard key={t.id} name={t.name} subtitle={t.creativeType.replace(/_/g, ' ')}
                    details={[
                      { label: 'CTA', value: t.callToAction.replace(/_/g, ' ') },
                      { label: 'URL Params', value: t.urlParameters || 'None' },
                      { label: 'Domain', value: t.conversionDomain || '---' },
                      { label: 'Pixel', value: t.trackingPixelId || '---' },
                    ]}
                    onEdit={() => setEditing({ type: 'ad', template: t, isNew: false })}
                    onDelete={() => ads.remove(t.id)}
                    onDuplicate={() => ads.add({ ...t, id: crypto.randomUUID(), name: `${t.name} (copy)`, createdAt: new Date().toISOString() })}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Advantage+ Creative Templates */}
          <TabsContent value="advantage">
            {advantage.items.length === 0 ? <EmptyState label="Advantage+ creative templates" onAction={handleAdd} /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          </TabsContent>

          {/* AI Enhancement Rules */}
          <TabsContent value="rules">
            {aiRules.items.length === 0 ? <EmptyState label="AI enhancement rules" onAction={handleAdd} /> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Slide-over edit panel */}
      {renderEditSheet()}
    </AppLayout>
  );
}


