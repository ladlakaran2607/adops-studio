import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ChevronDown, Check, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  /** When true, the user can type a value that isn't in the list and commit it with Enter. */
  allowCustomValue?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search or type ID...',
  emptyText = 'No matches',
  className,
  disabled,
  loading,
  allowCustomValue,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const selected = options.find(o => o.value === value);
  const triggerLabel = selected?.label ?? value ?? placeholder;
  const customMatches = filtered.some(o => o.value === query.trim());
  const showCustomRow =
    allowCustomValue && query.trim().length > 0 && !customMatches;

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <span className="ml-2 flex items-center gap-1 shrink-0">
            {value && (
              <span
                role="button"
                aria-label="Clear"
                onClick={clear}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && allowCustomValue && query.trim()) {
                e.preventDefault();
                commit(query.trim());
              }
            }}
            placeholder={searchPlaceholder}
            className="h-8"
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 && !showCustomRow ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            <>
              {filtered.map(opt => {
                const checked = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => commit(opt.value)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left',
                      'hover:bg-accent hover:text-accent-foreground',
                      checked && 'bg-accent/50',
                    )}
                  >
                    <span className="truncate flex-1">
                      <span className="block">{opt.label}</span>
                      {opt.label !== opt.value && (
                        <span className="block text-[10px] text-muted-foreground font-mono">{opt.value}</span>
                      )}
                    </span>
                    {checked && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
              {showCustomRow && (
                <button
                  type="button"
                  onClick={() => commit(query.trim())}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground border-t mt-1 pt-2"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate flex-1">
                    Use <span className="font-mono">{query.trim()}</span>
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
