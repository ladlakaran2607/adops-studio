import { useState, useMemo } from 'react';
import { format, parse, isValid } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DateTimePickerProps {
  /** datetime-local string, e.g. "2026-06-02T14:30". Empty = unset. */
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** When true, renders a clear ("X") button when a value is set. */
  clearable?: boolean;
}

/**
 * Reusable datetime picker built on shadcn Calendar + a time input.
 * Emits a datetime-local string ("YYYY-MM-DDTHH:mm") so it drops in anywhere
 * a plain <Input type="datetime-local"> was used previously.
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Pick a date & time',
  disabled,
  className,
  clearable = true,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  const parsed = useMemo(() => {
    if (!value) return null;
    const d = parse(value, "yyyy-MM-dd'T'HH:mm", new Date());
    return isValid(d) ? d : null;
  }, [value]);

  const timeValue = parsed ? format(parsed, 'HH:mm') : '';
  const displayLabel = parsed ? format(parsed, 'PPp') : placeholder;

  const emit = (date: Date) => {
    onChange(format(date, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleDateSelect = (d: Date | undefined) => {
    if (!d) return;
    // Preserve existing time if set; otherwise default to 09:00.
    const base = parsed ?? new Date();
    const next = new Date(d);
    next.setHours(parsed ? base.getHours() : 9, parsed ? base.getMinutes() : 0, 0, 0);
    emit(next);
  };

  const handleTimeChange = (t: string) => {
    if (!t) return;
    const [hh, mm] = t.split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return;
    const base = parsed ?? new Date();
    const next = new Date(base);
    next.setHours(hh, mm, 0, 0);
    emit(next);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal h-10 bg-background',
            !parsed && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{displayLabel}</span>
          {clearable && parsed && (
            <span
              role="button"
              aria-label="Clear"
              onClick={clear}
              className="ml-2 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsed ?? undefined}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="border-t p-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Time</span>
          <Select
            value={timeValue ? timeValue.split(':')[0] : ''}
            onValueChange={hh => {
              const mm = timeValue ? timeValue.split(':')[1] : '00';
              handleTimeChange(`${hh}:${mm}`);
            }}
          >
            <SelectTrigger className="h-8 w-[70px] tabular-nums">
              <SelectValue placeholder="HH" />
            </SelectTrigger>
            <SelectContent className="max-h-52">
              {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground font-semibold">:</span>
          <Select
            value={timeValue ? timeValue.split(':')[1] : ''}
            onValueChange={mm => {
              const hh = timeValue ? timeValue.split(':')[0] : '09';
              handleTimeChange(`${hh}:${mm}`);
            }}
          >
            <SelectTrigger className="h-8 w-[70px] tabular-nums">
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent className="max-h-52">
              {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
