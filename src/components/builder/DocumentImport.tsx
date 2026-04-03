import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileUp, FileText, Loader2, Check, AlertCircle } from 'lucide-react';
import mammoth from 'mammoth';

export interface ParsedAd {
  name: string;
  primaryTexts: string[];
}

export interface ParsedCampaign {
  name: string;
  audience: string;
  ads: ParsedAd[];
}

export interface ParsedDocument {
  campaigns: ParsedCampaign[];
  fileName: string;
}

function parseDocumentContent(html: string): ParsedCampaign[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const campaigns: ParsedCampaign[] = [];

  // Strategy: walk top-level children of body.
  // Campaign headers are <p><strong>Campagne N – description</strong></p>
  // Ad texts are in <table> elements that follow the header.
  const children = Array.from(doc.body.children);

  let currentCampaign: ParsedCampaign | null = null;

  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    const text = el.textContent?.trim() || '';

    // Detect campaign headers
    const campMatch = text.match(/(?:Campagne|Campaign)\s+(\d+)\s*[-–—]+\s*(.+)/i);
    if (campMatch && el.tagName === 'P') {
      if (currentCampaign) campaigns.push(currentCampaign);
      currentCampaign = {
        name: `Campaign ${campMatch[1]}`,
        audience: campMatch[2].replace(/\s+$/, '').trim(),
        ads: [],
      };
      continue;
    }

    // Parse tables for ad texts
    if (el.tagName === 'TABLE' && currentCampaign) {
      const rows = Array.from(el.querySelectorAll('tr'));
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 2) continue;

        const firstCell = cells[0].textContent?.trim() || '';
        const secondCell = cells[1];

        // Skip header row ("Tekst" | "")
        if (/^(?:Tekst|Text)$/i.test(firstCell)) continue;

        // Check if first cell is a number (ad index)
        const adNum = parseInt(firstCell);
        if (!isNaN(adNum) && adNum > 0) {
          // Get the ad text, preserving line breaks from <br> and <p> elements
          const adText = getTextWithBreaks(secondCell);
          if (adText.trim()) {
            currentCampaign.ads.push({
              name: `Ad ${adNum}`,
              primaryTexts: [adText.trim()],
            });
          }
        }
      }
    }
  }

  if (currentCampaign) campaigns.push(currentCampaign);
  return campaigns;
}

function getTextWithBreaks(el: Element): string {
  let result = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName;
      if (tag === 'BR') {
        result += '\n';
      } else if (tag === 'P') {
        if (result && !result.endsWith('\n')) result += '\n';
        result += getTextWithBreaks(node as Element);
        result += '\n';
      } else {
        result += getTextWithBreaks(node as Element);
      }
    }
  }
  return result;
}

interface DocumentImportProps {
  onImport: (data: ParsedDocument) => void;
}

export function DocumentImport({ onImport }: DocumentImportProps) {
  const [status, setStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ParsedDocument | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setStatus('parsing');
    setFileName(file.name);
    setErrorMsg('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const campaigns = parseDocumentContent(result.value);

      if (campaigns.length === 0) {
        setStatus('error');
        setErrorMsg('No campaigns found in this document. Make sure the document contains "Campaign X --" headers.');
        return;
      }

      const parsed: ParsedDocument = { campaigns, fileName: file.name };
      setPreview(parsed);
      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMsg('Could not process the document. Check that it is a valid .docx file.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.docx')) {
      handleFile(file);
    }
  };

  const confirmImport = () => {
    if (preview) {
      onImport(preview);
      setStatus('idle');
      setPreview(null);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      <div className="grid grid-cols-[1fr_1fr] gap-4">
        {/* Upload zone - compact */}
        {status === 'idle' && (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-primary/30 rounded-lg p-4 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center"
          >
            <FileUp className="w-5 h-5 text-primary/60 mb-1.5" />
            <p className="text-sm font-medium text-foreground">Upload .docx</p>
            <p className="text-xs text-muted-foreground mt-0.5">Drag or click</p>
          </div>
        )}

        {status === 'parsing' && (
          <div className="border border-border rounded-lg p-4 flex flex-col items-center justify-center">
            <Loader2 className="w-5 h-5 text-primary animate-spin mb-1.5" />
            <p className="text-xs text-muted-foreground">Processing...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-destructive">Import failed</p>
                <p className="text-xs text-muted-foreground mt-0.5">{errorMsg}</p>
                <Button variant="outline" size="sm" onClick={() => setStatus('idle')} className="mt-1.5 h-7 text-xs">
                  Try again
                </Button>
              </div>
            </div>
          </div>
        )}

        {status === 'success' && preview && (
          <div className="border border-primary/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-foreground truncate">{fileName}</span>
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
            </div>
            <div className="bg-muted/50 rounded p-2 space-y-1 max-h-32 overflow-y-auto">
              {preview.campaigns.map((camp, ci) => (
                <div key={ci} className="text-xs">
                  <span className="font-medium text-foreground">{camp.name}</span>
                  <span className="text-muted-foreground"> — {camp.audience} ({camp.ads.length} ads)</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmImport} className="h-7 text-xs">Import</Button>
              <Button variant="outline" size="sm" onClick={() => { setStatus('idle'); setPreview(null); }} className="h-7 text-xs">Cancel</Button>
            </div>
          </div>
        )}

        {/* Extra context tekstvak */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Additional instructions for the system</label>
          <Textarea
            placeholder={"Provide extra context so the system can better interpret your document.\n\nFor example:\n• \"Headlines are in the first column, body texts in the second\"\n• \"Ignore the first table, it's a summary\"\n• \"Each campaign has 2 audiences: broad and retargeting\""}
            rows={6}
            className="text-xs resize-none"
          />
          <p className="text-[10px] text-muted-foreground/70">This helps the system interpret your document more accurately.</p>
        </div>
      </div>

    </div>
  );
}
