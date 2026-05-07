import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import type { AdsetTemplate, PlacementOptions } from '@/types/templates';
import { LocationPicker } from './LocationPicker';
import { DetailedTargetingPicker } from './DetailedTargetingPicker';

const optimizations = ['Conversions', 'Lead Generation', 'Landing Page Views', 'Link Clicks', 'Impressions', 'Reach', 'Value'];
const conversionLocations = ['Website', 'App', 'Messaging', 'Calls', 'Website and App', 'On Ad'];
const performanceGoals = ['Maximize number of conversions', 'Maximize value of conversions', 'Maximize number of landing page views', 'Maximize number of link clicks', 'Maximize reach of ads', 'Maximize number of impressions'];
const conversionEvents = ['Purchase', 'Add to Cart', 'Lead', 'Complete Registration', 'View Content', 'Initiate Checkout', 'Add Payment Info', 'Search', 'Contact', 'Subscribe', 'Start Trial'];
const bidStrategies = [
  { value: 'LOWEST_COST_WITHOUT_CAP', label: 'Lowest Cost' },
  { value: 'LOWEST_COST_WITH_BID_CAP', label: 'Bid Cap' },
  { value: 'COST_CAP', label: 'Cost Cap' },
  { value: 'LOWEST_COST_WITH_MIN_ROAS', label: 'Minimum ROAS' },
];
const budgetTypes = ['Daily', 'Lifetime'];
const genders = ['All', 'Male', 'Female'];
const attributionSettings = [
  { value: '7d_click_1d_view', label: '7-day click, 1-day view' },
  { value: '1d_click', label: '1-day click' },
  { value: '7d_click', label: '7-day click' },
  { value: '1d_click_1d_view', label: '1-day click, 1-day view' },
  { value: '28d_click_1d_view', label: '28-day click, 1-day view' },
];
const promotedObjectTypes = ['PIXEL', 'APPLICATION', 'PAGE', 'OFFER'];

const placementLabels: Record<keyof PlacementOptions, string> = {
  facebookFeed: 'Facebook Feed', facebookProfileFeed: 'Facebook Profile Feed',
  instagramFeed: 'Instagram Feed', instagramProfileFeed: 'Instagram Profile Feed',
  facebookMarketplace: 'Facebook Marketplace', facebookVideoFeeds: 'Facebook Video Feeds',
  facebookRightColumn: 'Facebook Right Column', instagramExplore: 'Instagram Explore',
  instagramExploreHome: 'Instagram Explore Home', facebookBusinessExplore: 'Facebook Business Explore',
  instagramStories: 'Instagram Stories', facebookStories: 'Facebook Stories',
  facebookReels: 'Facebook Reels', instagramReels: 'Instagram Reels',
  instagramProfileReels: 'Instagram Profile Reels', facebookInStreamVideos: 'Facebook In-Stream Videos',
  adsOnFacebookReels: 'Ads on Facebook Reels',
};

interface Props {
  template: AdsetTemplate;
  onSave: (t: AdsetTemplate) => void;
  onCancel: () => void;
  accountId?: string;
}

export function AdsetTemplateForm({ template, onSave, onCancel, accountId }: Props) {
  const [form, setForm] = useState(template);
  const set = <K extends keyof AdsetTemplate>(key: K, val: AdsetTemplate[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const togglePlacement = (key: keyof PlacementOptions) => {
    setForm(f => ({ ...f, placementOptions: { ...f.placementOptions, [key]: !f.placementOptions[key] } }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h2 className="text-xl font-bold">Adset Template</h2>
          <p className="text-sm text-muted-foreground">Targeting, placements and optimization</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Basics</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Template Name</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="E.g. Sales - NL - 18-35" className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Optimization Goal</Label>
              <Select value={form.optimization} onValueChange={v => set('optimization', v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{optimizations.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conversion Location</Label>
              <Select value={form.adsetConversionLocation} onValueChange={v => set('adsetConversionLocation', v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{conversionLocations.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Performance Goal</Label>
              <Select value={form.adsetPerformanceGoals} onValueChange={v => set('adsetPerformanceGoals', v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{performanceGoals.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conversion Event</Label>
              <Select value={form.adsetConversionEvent} onValueChange={v => set('adsetConversionEvent', v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{conversionEvents.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Dynamic Creative</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Meta automatically optimizes combinations of creative elements</p>
            </div>
            <Switch checked={form.dynamicCreative} onCheckedChange={v => set('dynamicCreative', v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Budget & Bidding</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bid Strategy</Label>
              <Select value={form.bidStrategy} onValueChange={v => set('bidStrategy', v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{bidStrategies.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Budget Type</Label>
              <Select value={form.adsetBudgetType} onValueChange={v => set('adsetBudgetType', v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{budgetTypes.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Budget Value (€)</Label>
              <Input type="number" value={form.adsetBudgetValue ?? ''} onChange={e => set('adsetBudgetValue', e.target.value ? Number(e.target.value) : null)} placeholder="5.00" className="mt-1.5" />
            </div>
            {(form.bidStrategy === 'LOWEST_COST_WITH_BID_CAP' || form.bidStrategy === 'COST_CAP') && (
              <div>
                <Label>Bid Amount (€)</Label>
                <Input type="number" value={form.bidAmount ?? ''} onChange={e => set('bidAmount', e.target.value ? Number(e.target.value) : null)} placeholder="Bid cap amount" className="mt-1.5" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Attribution & Tracking</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Attribution Setting</Label>
              <Select value={form.attributionSetting} onValueChange={v => set('attributionSetting', v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{attributionSettings.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Promoted Object Type</Label>
              <Select value={form.promotedObjectType} onValueChange={v => set('promotedObjectType', v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{promotedObjectTypes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Pixel ID</Label>
            <Input value={form.pixelId} onChange={e => set('pixelId', e.target.value)} placeholder="Meta Pixel ID" className="mt-1.5" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Schedule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className="mt-1.5" />
            </div>
            <div className="flex items-center justify-between pt-6">
              <Label>Set End Date</Label>
              <Switch checked={form.setEndDate} onCheckedChange={v => set('setEndDate', v)} />
            </div>
          </div>
          {form.setEndDate && (
            <div>
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className="mt-1.5" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Targeting</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Gender</Label>
              <Select value={form.targetGender} onValueChange={v => set('targetGender', v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{genders.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Age Range</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Select value={form.targetAge?.split('-')[0]?.replace('+', '') || '18'} onValueChange={v => {
                  const max = form.targetAge?.replace('+', '').split('-')[1] || '65';
                  set('targetAge', `${v}-${max}+`);
                }}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Min" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 53 }, (_, i) => i + 13).map(age => (
                      <SelectItem key={age} value={String(age)}>{age}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground text-sm">to</span>
                <Select value={form.targetAge?.replace('+', '').split('-')[1] || '65'} onValueChange={v => {
                  const min = form.targetAge?.split('-')[0]?.replace('+', '') || '18';
                  set('targetAge', `${min}-${v}+`);
                }}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Max" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 53 }, (_, i) => i + 13).map(age => (
                      <SelectItem key={age} value={String(age)}>{age}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <LocationPicker
            value={form.location}
            onChange={(val) => set('location', val)}
            accountId={accountId}
          />
          <LocationPicker
            value={form.excludedLocation}
            onChange={(val) => set('excludedLocation', val)}
            accountId={accountId}
            label="Excluded Locations"
            addButtonLabel="Add Excluded Location"
          />
          <DetailedTargetingPicker
            value={form.detailedTargeting}
            onChange={(val) => set('detailedTargeting', val)}
            accountId={accountId}
            label="Detailed Targeting"
            addButtonLabel="Add Targeting"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Placements</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Select value={form.placements} onValueChange={v => set('placements', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Automatic">Advantage+ Placements (Automatic)</SelectItem>
                <SelectItem value="Manual">Manual Placements</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.placements === 'Manual' && (
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(placementLabels) as (keyof PlacementOptions)[]).map(key => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox checked={form.placementOptions[key]} onCheckedChange={() => togglePlacement(key)} id={key} />
                  <label htmlFor={key} className="text-sm cursor-pointer">{placementLabels[key]}</label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} className="gap-2"><Save className="w-4 h-4" />Save</Button>
      </div>
    </div>
  );
}
