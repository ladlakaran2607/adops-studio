import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import type { CampaignTemplate } from '@/types/templates';

const objectives = [
  { value: 'OUTCOME_SALES', label: 'Sales' },
  { value: 'OUTCOME_LEADS', label: 'Leads' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement' },
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic' },
  { value: 'OUTCOME_AWARENESS', label: 'Awareness' },
  { value: 'OUTCOME_APP_PROMOTION', label: 'App Promotion' },
];
const buyingTypes = ['AUCTION', 'RESERVED'];
const bidStrategies = [
  { value: 'LOWEST_COST_WITHOUT_CAP', label: 'Lowest Cost' },
  { value: 'LOWEST_COST_WITH_BID_CAP', label: 'Bid Cap' },
  { value: 'COST_CAP', label: 'Cost Cap' },
  { value: 'LOWEST_COST_WITH_MIN_ROAS', label: 'Minimum ROAS' },
];
const budgetTypes = ['Daily', 'Lifetime'];
const statuses = ['PAUSED', 'ACTIVE'];
const specialAdCategoryOptions = [
  { value: 'NONE', label: 'None' },
  { value: 'EMPLOYMENT', label: 'Employment' },
  { value: 'HOUSING', label: 'Housing' },
  { value: 'CREDIT', label: 'Credit' },
  { value: 'ISSUES_ELECTIONS_POLITICS', label: 'Issues, Elections or Politics' },
  { value: 'FINANCIAL_PRODUCTS_SERVICES', label: 'Financial Products & Services' },
];

interface Props {
  template: CampaignTemplate;
  onSave: (t: CampaignTemplate) => void;
  onCancel: () => void;
}

export function CampaignTemplateForm({ template, onSave, onCancel }: Props) {
  const [form, setForm] = useState(template);
  const set = <K extends keyof CampaignTemplate>(key: K, val: CampaignTemplate[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const toggleSpecialAdCategory = (category: string) => {
    if (category === 'NONE') {
      set('specialAdCategories', []);
      return;
    }
    const current = form.specialAdCategories || [];
    if (current.includes(category)) {
      set('specialAdCategories', current.filter(c => c !== category));
    } else {
      set('specialAdCategories', [...current, category]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">Campaign Template</h2>
          <p className="text-sm text-muted-foreground">Configure your campaign presets</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Basics</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Template Name</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="E.g. Sales - Lowest Cost" className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Campaign Objective</Label>
              <Select value={form.campaignObjective} onValueChange={v => set('campaignObjective', v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select objective" /></SelectTrigger>
                <SelectContent>{objectives.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Buying Type</Label>
              <Select value={form.buyingType} onValueChange={v => set('buyingType', v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{buyingTypes.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Initial Status</Label>
              <Select value={form.campaignStatus} onValueChange={v => set('campaignStatus', v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Special Ad Categories</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Required by Meta — indicate whether your campaign falls under special categories.</p>
          <div className="grid grid-cols-2 gap-4">
            {specialAdCategoryOptions.map(({ value, label }) => (
              <div key={value} className="flex items-center gap-3 py-1">
                <Checkbox
                  checked={value === 'NONE' ? (form.specialAdCategories || []).length === 0 : (form.specialAdCategories || []).includes(value)}
                  onCheckedChange={() => toggleSpecialAdCategory(value)}
                  id={`sac-${value}`}
                  className="h-5 w-5 rounded-full border-2"
                />
                <label htmlFor={`sac-${value}`} className="text-sm cursor-pointer leading-none">{label}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Budget & Bidding</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Bid Strategy</Label>
            <Select value={form.bidStrategy} onValueChange={v => set('bidStrategy', v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>{bidStrategies.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>Advantage Campaign Budget (CBO)</Label>
            <Switch checked={form.advantageCampaignBudget} onCheckedChange={v => set('advantageCampaignBudget', v)} />
          </div>

          {form.advantageCampaignBudget && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Budget Type</Label>
                  <Select value={form.campaignBudgetType} onValueChange={v => set('campaignBudgetType', v)}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{budgetTypes.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Budget Value (€)</Label>
                  <Input type="number" value={form.campaignBudgetValue ?? ''} onChange={e => set('campaignBudgetValue', e.target.value ? Number(e.target.value) : null)} placeholder="5.00" className="mt-1.5" />
                </div>
              </div>
              {(form.bidStrategy === 'LOWEST_COST_WITH_BID_CAP' || form.bidStrategy === 'COST_CAP') && (
                <div>
                  <Label>Bid Amount (€)</Label>
                  <Input type="number" value={form.bidAmount ?? ''} onChange={e => set('bidAmount', e.target.value ? Number(e.target.value) : null)} placeholder="Maximum bid per auction" className="mt-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.bidStrategy === 'LOWEST_COST_WITH_BID_CAP'
                      ? 'Maximum amount Meta will bid in any single auction.'
                      : 'Target average cost per result. Meta may exceed this temporarily.'}
                  </p>
                </div>
              )}
            </>
          )}

          <div>
            <Label>Spend Cap (€)</Label>
            <Input type="number" value={form.spendCap ?? ''} onChange={e => set('spendCap', e.target.value ? Number(e.target.value) : null)} placeholder="Optional — maximum campaign budget" className="mt-1.5" />
            <p className="text-xs text-muted-foreground mt-1">Leave empty for no spend cap. Minimum $100 equivalent.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Advanced</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Advantage+ Catalog</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Automatically show products from your catalog</p>
            </div>
            <Switch checked={form.advantagePlusCatalog} onCheckedChange={v => set('advantagePlusCatalog', v)} />
          </div>
          {form.advantagePlusCatalog && (
            <div className="ml-6">
              <Label>Product Catalog ID</Label>
              <Input value={form.catalogId} onChange={e => set('catalogId', e.target.value)} placeholder="Enter your Meta Product Catalog ID" className="mt-1.5" />
              <p className="text-xs text-muted-foreground mt-1">Required for Advantage+ Catalog campaigns</p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <Label>Adset Budget Sharing</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Ad sets can share up to 20% of their budget</p>
            </div>
            <Switch checked={form.isAdsetBudgetSharing} onCheckedChange={v => set('isAdsetBudgetSharing', v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>A/B Test</Label>
            <Switch checked={form.abTest} onCheckedChange={v => set('abTest', v)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} className="gap-2">
          <Save className="w-4 h-4" />
          Save
        </Button>
      </div>
    </div>
  );
}
