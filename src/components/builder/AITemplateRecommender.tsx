import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { toast } from 'sonner';

interface Recommendation {
  id: string;
  name: string;
  reason: string;
}

interface Recommendations {
  campaign: Recommendation | null;
  adset: Recommendation | null;
  ad: Recommendation | null;
  explanation: string;
}

interface AITemplateRecommenderProps {
  onApplyCampaign: (id: string) => void;
  onApplyAdset: (id: string) => void;
  onApplyAd: (id: string) => void;
}

export function AITemplateRecommender({ onApplyCampaign, onApplyAdset, onApplyAd }: AITemplateRecommenderProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Recommendations | null>(null);
  const [applied, setApplied] = useState<{ campaign: boolean; adset: boolean; ad: boolean }>({ campaign: false, adset: false, ad: false });
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setResults(null);
    setApplied({ campaign: false, adset: false, ad: false });
    try {
      const data = await invokeEdgeFunction<{ recommendations: Recommendations }>('ai-template-match', {
        requirements: query.trim(),
      });
      setResults(data.recommendations);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to get recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleApply = (type: 'campaign' | 'adset' | 'ad') => {
    if (!results) return;
    const rec = results[type];
    if (!rec) return;

    if (type === 'campaign') onApplyCampaign(rec.id);
    else if (type === 'adset') onApplyAdset(rec.id);
    else onApplyAd(rec.id);

    setApplied(prev => ({ ...prev, [type]: true }));
    toast.success(`${type === 'campaign' ? 'Campaign' : type === 'adset' ? 'Ad Set' : 'Ad'} template applied`);
  };

  const handleApplyAll = () => {
    if (!results) return;
    if (results.campaign && !applied.campaign) handleApply('campaign');
    if (results.adset && !applied.adset) handleApply('adset');
    if (results.ad && !applied.ad) handleApply('ad');
  };

  const hasAnyRecommendation = results && (results.campaign || results.adset || results.ad);
  const allApplied = results && (
    (!results.campaign || applied.campaign) &&
    (!results.adset || applied.adset) &&
    (!results.ad || applied.ad)
  );

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110',
          open
            ? 'bg-muted text-muted-foreground hover:bg-muted/80'
            : 'bg-gradient-to-br from-primary to-amber-600 text-primary-foreground hover:shadow-xl hover:shadow-primary/25'
        )}
        title="AI Template Recommender"
      >
        {open ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>

      {/* Panel */}
      <div
        className={cn(
          'fixed bottom-24 right-6 z-50 w-[420px] max-h-[520px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col transition-all duration-300 origin-bottom-right',
          open ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'
        )}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">AI Template Finder</h3>
            <p className="text-[11px] text-muted-foreground">Describe your campaign — I'll find the best templates</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Results */}
          {loading && (
            <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm">Analyzing templates...</span>
            </div>
          )}

          {results && (
            <div className="space-y-3 animate-fade-in">
              {/* Explanation */}
              <p className="text-xs text-muted-foreground leading-relaxed">{results.explanation}</p>

              {/* Recommendation cards */}
              {results.campaign && (
                <RecommendationCard
                  type="Campaign"
                  rec={results.campaign}
                  applied={applied.campaign}
                  onApply={() => handleApply('campaign')}
                />
              )}
              {results.adset && (
                <RecommendationCard
                  type="Ad Set"
                  rec={results.adset}
                  applied={applied.adset}
                  onApply={() => handleApply('adset')}
                />
              )}
              {results.ad && (
                <RecommendationCard
                  type="Ad"
                  rec={results.ad}
                  applied={applied.ad}
                  onApply={() => handleApply('ad')}
                />
              )}

              {/* No matches */}
              {!hasAnyRecommendation && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No matching templates found. Try a different description or create new templates.</p>
                </div>
              )}

              {/* Apply All */}
              {hasAnyRecommendation && !allApplied && (
                <Button
                  onClick={handleApplyAll}
                  className="w-full bg-gradient-to-r from-primary to-amber-600 text-primary-foreground hover:opacity-90 gap-2"
                  size="sm"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Apply All Recommendations
                </Button>
              )}

              {allApplied && hasAnyRecommendation && (
                <div className="flex items-center justify-center gap-2 py-2 text-green-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-medium">All templates applied</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="px-5 py-3 border-t border-border/50">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='e.g. "Lead gen for real estate in Delhi, ₹500/day, ages 25-45"'
              className="flex-1 text-sm bg-muted/50 border border-border rounded-xl px-3 py-2.5 resize-none max-h-24 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
              rows={2}
              disabled={loading}
            />
            <Button
              onClick={handleSubmit}
              disabled={!query.trim() || loading}
              size="icon"
              className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-amber-600 text-primary-foreground hover:opacity-90 shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">Press Enter to send</p>
        </div>
      </div>
    </>
  );
}

function RecommendationCard({ type, rec, applied, onApply }: {
  type: string;
  rec: Recommendation;
  applied: boolean;
  onApply: () => void;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-3 transition-all duration-200',
      applied ? 'border-green-500/30 bg-green-500/5' : 'border-primary/20 bg-primary/5'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{type}</span>
            {applied && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
          </div>
          <p className="text-sm font-semibold mt-0.5 truncate">{rec.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{rec.reason}</p>
        </div>
        {!applied && (
          <Button
            onClick={onApply}
            variant="outline"
            size="sm"
            className="shrink-0 text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
          >
            Apply
          </Button>
        )}
      </div>
    </div>
  );
}
