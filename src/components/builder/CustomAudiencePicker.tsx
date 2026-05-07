import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { Plus, X, Loader2, Users, AlertCircle } from 'lucide-react';
import { useCustomAudiences } from '@/hooks/useCustomAudiences';

export interface PickedAudience {
  id: string;
  name: string;
}

interface CustomAudiencePickerProps {
  value: PickedAudience[];
  onChange: (value: PickedAudience[]) => void;
  accountId?: string;
  label?: string;
  addButtonLabel?: string;
}

function formatCount(lower?: number, upper?: number): string | null {
  if (!lower && !upper) return null;
  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
    n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` :
    String(n);
  if (lower && upper && lower !== upper) return `${fmt(lower)}–${fmt(upper)}`;
  return fmt(lower || upper || 0);
}

export function CustomAudiencePicker({
  value,
  onChange,
  accountId,
  label = 'Custom Audiences',
  addButtonLabel = 'Add Audience',
}: CustomAudiencePickerProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data: audiences, isLoading, error } = useCustomAudiences(accountId, popoverOpen);

  const selectedIds = useMemo(() => new Set(value.map(v => v.id)), [value]);

  const filtered = useMemo(() => {
    if (!audiences) return [];
    const q = query.trim().toLowerCase();
    return audiences
      .filter(a => !selectedIds.has(a.id))
      .filter(a => !q || a.name.toLowerCase().includes(q) || a.id.includes(q));
  }, [audiences, query, selectedIds]);

  function add(audience: { id: string; name: string }) {
    onChange([...value, { id: audience.id, name: audience.name }]);
    setQuery('');
  }

  function remove(id: string) {
    onChange(value.filter(v => v.id !== id));
  }

  if (!accountId) {
    return (
      <div>
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground mt-1.5">
          Select an ad account to load audiences.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {addButtonLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[380px] p-0" align="end">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search audiences..."
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                {isLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!isLoading && error && (
                  <div className="px-3 py-3 text-xs text-destructive flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{(error as Error).message || 'Failed to load audiences'}</span>
                  </div>
                )}
                {!isLoading && !error && filtered.length === 0 && (
                  <CommandEmpty>
                    {audiences && audiences.length === 0
                      ? 'No custom audiences in this account.'
                      : 'No matches.'}
                  </CommandEmpty>
                )}
                {filtered.map(a => {
                  const count = formatCount(a.approximate_count_lower_bound, a.approximate_count_upper_bound);
                  return (
                    <CommandItem
                      key={a.id}
                      value={a.id}
                      onSelect={() => add(a)}
                    >
                      <Users className="w-3.5 h-3.5 mr-2 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{a.name}</span>
                          {a.subtype && (
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                              {a.subtype}
                            </span>
                          )}
                        </div>
                        {count && (
                          <span className="text-[11px] text-muted-foreground">Size: {count}</span>
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

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map(v => (
            <Badge key={v.id} variant="secondary" className="gap-1 pr-1">
              <Users className="w-3 h-3" />
              <span className="ml-0.5 truncate max-w-[180px]">{v.name}</span>
              <button
                onClick={() => remove(v.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-background/40"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No audiences selected</p>
      )}
    </div>
  );
}
