import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { Plus, X, Loader2, Heart, Activity, Users, Sparkles } from 'lucide-react';
import { useDetailedTargetingSearch } from '@/hooks/useDetailedTargetingSearch';
import type { DetailedTargetingEntry, DetailedTargetingType } from '@/types/templates';

interface DetailedTargetingPickerProps {
  value: string;
  onChange: (value: string) => void;
  accountId?: string;
  label?: string;
  addButtonLabel?: string;
}

// Demographic sub-types share the Users icon and 'outline' badge styling so
// they read as a single visual group in the merged result list.
const DEMOGRAPHIC_TYPES: DetailedTargetingType[] = ['life_events', 'industries', 'income', 'family_statuses'];

const TYPE_LABELS: Record<DetailedTargetingType, string> = {
  interests: 'Interest',
  behaviors: 'Behavior',
  life_events: 'Life Event',
  industries: 'Industry',
  income: 'Income',
  family_statuses: 'Family Status',
};

function parseEntries(value: string): DetailedTargetingEntry[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function typeIcon(type: DetailedTargetingType) {
  if (type === 'interests') return <Heart className="w-3.5 h-3.5" />;
  if (type === 'behaviors') return <Activity className="w-3.5 h-3.5" />;
  return <Users className="w-3.5 h-3.5" />;
}

function badgeVariant(type: DetailedTargetingType): 'default' | 'secondary' | 'outline' {
  if (type === 'interests') return 'default';
  if (type === 'behaviors') return 'secondary';
  if (DEMOGRAPHIC_TYPES.includes(type)) return 'outline';
  return 'outline';
}

function formatAudienceSize(lower?: number, upper?: number): string | null {
  if (!lower && !upper) return null;
  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
    n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` :
    String(n);
  if (lower && upper) return `${fmt(lower)}–${fmt(upper)}`;
  return fmt(lower || upper || 0);
}

export function DetailedTargetingPicker({
  value,
  onChange,
  accountId,
  label = 'Detailed Targeting',
  addButtonLabel = 'Add Targeting',
}: DetailedTargetingPickerProps) {
  const [entries, setEntries] = useState<DetailedTargetingEntry[]>(() => parseEntries(value));
  const [searchQuery, setSearchQuery] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { results, isLoading } = useDetailedTargetingSearch(accountId, 'all', searchQuery);

  const selectedKeys = useMemo(
    () => new Set(entries.map(e => `${e.type}:${e.id}`)),
    [entries]
  );

  const filteredResults = results.filter(r => !selectedKeys.has(`${r.type}:${r.id}`));

  function persist(updated: DetailedTargetingEntry[]) {
    setEntries(updated);
    onChange(JSON.stringify(updated));
  }

  function addEntry(entry: DetailedTargetingEntry) {
    persist([...entries, entry]);
    setSearchQuery('');
  }

  function removeEntry(id: string, type: string) {
    persist(entries.filter(e => !(e.id === id && e.type === type)));
  }

  if (!accountId) {
    return (
      <div>
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground mt-1.5">
          Add an ad account in Settings to enable targeting search.
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
          <PopoverContent
            className="w-[400px] p-0"
            align="end"
            collisionPadding={12}
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Add demographics, interests or behaviors"
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList
                onWheel={(e) => e.stopPropagation()}
                style={{
                  maxHeight: 'min(480px, calc(var(--radix-popper-available-height, 480px) - 56px))',
                }}
              >
                {isLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!isLoading && searchQuery.length >= 2 && filteredResults.length === 0 && (
                  <CommandEmpty>No matches.</CommandEmpty>
                )}
                {!isLoading && searchQuery.length < 2 && (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search
                  </div>
                )}
                {filteredResults.map(r => {
                  const size = formatAudienceSize(r.audience_size_lower_bound, r.audience_size_upper_bound);
                  return (
                    <CommandItem
                      key={`${r.type}:${r.id}`}
                      value={`${r.type}:${r.id}`}
                      onSelect={() => addEntry(r)}
                    >
                      <span className="mr-2 shrink-0">{typeIcon(r.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{r.name}</span>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                            {TYPE_LABELS[r.type]}
                          </span>
                        </div>
                        {(r.path && r.path.length > 0) && (
                          <span className="text-[11px] text-muted-foreground truncate block">
                            {r.path.join(' › ')}
                          </span>
                        )}
                        {size && (
                          <span className="text-[10px] text-muted-foreground">
                            Audience: {size}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {entries.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {entries.map(entry => (
            <Badge
              key={`${entry.type}:${entry.id}`}
              variant={badgeVariant(entry.type)}
              className="gap-1 pr-1"
            >
              {typeIcon(entry.type)}
              <span className="ml-0.5">{entry.name}</span>
              <button
                onClick={() => removeEntry(entry.id, entry.type)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-background/20"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Sparkles className="w-4 h-4" />
          No targeting selected
        </div>
      )}
    </div>
  );
}
