import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAdAccounts, getMissingAccountFields } from '@/hooks/useAdAccounts';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountSelectorProps {
  value: string;
  onChange: (accountId: string) => void;
  className?: string;
}

export function AccountSelector({ value, onChange, className }: AccountSelectorProps) {
  const { data: accounts = [], isLoading, isError } = useAdAccounts();

  if (isLoading) {
    return (
      <div className={className}>
        <Label className="text-xs text-muted-foreground">Ad Account</Label>
        <div className="flex items-center gap-2 mt-1.5 h-10 px-3 border rounded-md text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading accounts...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={className}>
        <Label className="text-xs text-muted-foreground">Ad Account</Label>
        <div className="mt-1.5 h-10 px-3 border border-destructive/50 rounded-md flex items-center text-sm text-destructive">
          Failed to load accounts
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">Ad Account</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1.5">
          <SelectValue placeholder="Select an ad account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.length === 0 ? (
            <SelectItem value="_none" disabled>
              No ad accounts configured
            </SelectItem>
          ) : (
            accounts.map(acc => {
              const missing = getMissingAccountFields(acc);
              const incomplete = missing.length > 0;
              return (
                <SelectItem key={acc.id} value={acc.accountId}>
                  <span
                    className={cn(
                      'flex items-center gap-2',
                      incomplete && 'text-muted-foreground italic font-normal'
                    )}
                  >
                    <span className="truncate">
                      {acc.name} ({acc.accountId})
                    </span>
                    {incomplete && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded px-1.5 py-0.5 shrink-0">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Setup incomplete
                      </span>
                    )}
                  </span>
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
