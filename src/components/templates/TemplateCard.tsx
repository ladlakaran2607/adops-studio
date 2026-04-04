import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Copy, Trash2, Target } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface TemplateCardProps {
  name: string;
  subtitle?: string;
  details: { label: string; value: string }[];
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function TemplateCard({ name, subtitle, details, onEdit, onDuplicate, onDelete }: TemplateCardProps) {
  return (
    <Card className="animate-fade-in hover:shadow-md transition-all duration-200 border-border/30 shadow-sm">
      <CardContent className="p-4">
        {/* Icon row */}
        <div className="flex justify-between items-start mb-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Target className="w-4 h-4 text-primary" />
          </div>

          {/* Action buttons — always visible */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={onEdit} title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={onDuplicate} title="Duplicate">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete template?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. The template "{name}" will be permanently removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Title + subtitle */}
        <h3 className="font-bold text-foreground text-sm mb-0.5 truncate">{name}</h3>
        {subtitle && (
          <p className="text-[10px] font-bold text-primary tracking-wider mb-3">{subtitle}</p>
        )}

        {/* Detail pills with background */}
        <div className="grid grid-cols-2 gap-2">
          {details.map(d => (
            <div key={d.label} className="bg-background p-2 rounded-md">
              <p className="text-[9px] text-muted-foreground font-medium uppercase mb-0.5">{d.label}</p>
              <p className="text-[11px] font-bold text-foreground truncate">{d.value || '—'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
