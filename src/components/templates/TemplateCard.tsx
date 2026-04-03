import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Copy } from 'lucide-react';

interface Props {
  name: string;
  subtitle: string;
  details: { label: string; value: string }[];
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function TemplateCard({ name, subtitle, details, onEdit, onDelete, onDuplicate }: Props) {
  return (
    <Card className="group hover:border-primary/30 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">{name || 'Untitled'}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {details.map(({ label, value }) => (
            <div key={label} className="text-xs">
              <span className="text-muted-foreground">{label}: </span>
              <span className="text-foreground font-medium">{value || '—'}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
