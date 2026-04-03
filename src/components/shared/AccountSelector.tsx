import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAdAccounts } from '@/hooks/useAdAccounts';
import { Loader2 } from 'lucide-react';

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
            accounts.map(acc => (
              <SelectItem key={acc.id} value={acc.accountId}>
                {acc.name} ({acc.accountId})
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
