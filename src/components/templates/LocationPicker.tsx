import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Plus, X, Loader2, Building, Globe, Map } from 'lucide-react';
import { useGeoSearch } from '@/hooks/useGeoSearch';
import type { GeoLocationEntry } from '@/types/templates';

interface LocationPickerProps {
  value: string;
  onChange: (value: string) => void;
  accountId?: string;
  label?: string;
  addButtonLabel?: string;
}

type LocationType = 'city' | 'country' | 'region';

/** Parse location value: JSON array or legacy comma-separated country names */
function parseLocations(value: string): GeoLocationEntry[] {
  if (!value?.trim()) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  // Legacy: comma-separated country names — display as-is
  return trimmed
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => ({
      key: name,
      name,
      type: 'country' as const,
    }));
}

function locationLabel(entry: GeoLocationEntry): string {
  if (entry.type === 'city') {
    const unit = entry.distance_unit === 'mile' ? 'mi' : 'km';
    const parts = [entry.name];
    if (entry.region_name) parts.push(entry.region_name);
    if (entry.country_code) parts.push(entry.country_code);
    return `${parts.join(', ')} (${entry.radius || 25} ${unit})`;
  }
  if (entry.type === 'region') {
    return entry.country_code ? `${entry.name}, ${entry.country_code}` : entry.name;
  }
  return entry.country_code ? `${entry.name} (${entry.country_code})` : entry.name;
}

function typeIcon(type: LocationType) {
  if (type === 'city') return <Building className="w-3.5 h-3.5" />;
  if (type === 'region') return <Map className="w-3.5 h-3.5" />;
  return <Globe className="w-3.5 h-3.5" />;
}

export function LocationPicker({
  value,
  onChange,
  accountId,
  label = 'Locations',
  addButtonLabel = 'Add Location',
}: LocationPickerProps) {
  const [entries, setEntries] = useState<GeoLocationEntry[]>(() => parseLocations(value));
  const [searchType, setSearchType] = useState<LocationType>('country');
  const [searchQuery, setSearchQuery] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { results, isLoading } = useGeoSearch(accountId, searchType, searchQuery);

  // Filter out already-selected entries from results
  const selectedKeys = useMemo(
    () => new Set(entries.map(e => `${e.type}:${e.key}`)),
    [entries]
  );

  const filteredResults = results.filter(r => !selectedKeys.has(`${r.type}:${r.key}`));

  const cities = entries.filter(e => e.type === 'city');

  function persist(updated: GeoLocationEntry[]) {
    setEntries(updated);
    onChange(JSON.stringify(updated));
  }

  function addEntry(entry: GeoLocationEntry) {
    const updated = [...entries, entry];
    persist(updated);
    setSearchQuery('');
  }

  function removeEntry(key: string, type: string) {
    const updated = entries.filter(e => !(e.key === key && e.type === type));
    persist(updated);
  }

  function updateCityRadius(key: string, radius: number) {
    const updated = entries.map(e =>
      e.key === key && e.type === 'city' ? { ...e, radius } : e
    );
    persist(updated);
  }

  function updateCityUnit(key: string, unit: 'kilometer' | 'mile') {
    const updated = entries.map(e =>
      e.key === key && e.type === 'city' ? { ...e, distance_unit: unit } : e
    );
    persist(updated);
  }

  if (!accountId) {
    return (
      <div>
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground mt-1.5">
          Add an ad account in Settings to enable location search.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {addButtonLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[360px] p-0" align="end">
            {/* Type tabs */}
            <div className="flex border-b">
              {(['country', 'region', 'city'] as LocationType[]).map(type => (
                <button
                  key={type}
                  className={`flex-1 px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    searchType === type
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => { setSearchType(type); setSearchQuery(''); }}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Search */}
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={`Search ${searchType}...`}
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                {isLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!isLoading && searchQuery.length >= 2 && filteredResults.length === 0 && (
                  <CommandEmpty>No {searchType} found.</CommandEmpty>
                )}
                {!isLoading && searchQuery.length < 2 && (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search
                  </div>
                )}
                {filteredResults.map(r => (
                  <CommandItem
                    key={`${r.type}:${r.key}`}
                    value={`${r.type}:${r.key}`}
                    onSelect={() => { addEntry(r); }}
                  >
                    <span className="mr-2">{typeIcon(r.type)}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{r.name}</span>
                      {r.type === 'city' && r.region_name && (
                        <span className="text-muted-foreground text-xs ml-1.5">
                          {r.region_name}{r.country_code ? `, ${r.country_code}` : ''}
                        </span>
                      )}
                      {r.type === 'region' && r.country_code && (
                        <span className="text-muted-foreground text-xs ml-1.5">{r.country_code}</span>
                      )}
                      {r.type === 'country' && r.country_code && (
                        <span className="text-muted-foreground text-xs ml-1.5">{r.country_code}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected locations as badges */}
      {entries.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {entries.map(entry => (
            <Badge
              key={`${entry.type}:${entry.key}`}
              variant={entry.type === 'city' ? 'secondary' : entry.type === 'region' ? 'outline' : 'default'}
              className="gap-1 pr-1"
            >
              {typeIcon(entry.type)}
              <span className="ml-0.5">{locationLabel(entry)}</span>
              <button
                onClick={() => removeEntry(entry.key, entry.type)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-background/20"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <MapPin className="w-4 h-4" />
          No locations selected
        </div>
      )}

      {/* City radius editors */}
      {cities.length > 0 && (
        <div className="space-y-2 pt-1">
          <Label className="text-xs text-muted-foreground">City Radius</Label>
          {cities.map(city => (
            <div key={city.key} className="flex items-center gap-2">
              <span className="text-sm min-w-[120px] truncate">{city.name}</span>
              <Input
                type="number"
                value={city.radius ?? 25}
                onChange={e => updateCityRadius(city.key, Number(e.target.value) || 25)}
                className="w-20 h-8 text-sm"
                min={1}
                max={500}
              />
              <Select
                value={city.distance_unit || 'kilometer'}
                onValueChange={(v) => updateCityUnit(city.key, v as 'kilometer' | 'mile')}
              >
                <SelectTrigger className="w-[100px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kilometer">km</SelectItem>
                  <SelectItem value="mile">mile</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
