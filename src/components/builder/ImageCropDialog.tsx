import { useState, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const ASPECT_PRESETS = [
  { label: '1:1', value: 1, w: 1080, h: 1080 },
  { label: '4:5', value: 4 / 5, w: 1080, h: 1350 },
  { label: '9:16', value: 9 / 16, w: 1080, h: 1920 },
  { label: 'Free', value: undefined, w: 0, h: 0 },
] as const;

interface ImageCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  /** Called with the Cloudinary-transformed URL after crop is applied */
  onCropApply: (croppedUrl: string) => void;
}

/**
 * Translates react-easy-crop pixel area into a Cloudinary URL transform.
 * Inserts `c_crop,x_X,y_Y,w_W,h_H` right after `/upload/` (before any
 * existing transforms), then scales to target dimensions.
 */
function buildCloudinaryCropUrl(
  originalUrl: string,
  cropArea: Area,
  targetW?: number,
  targetH?: number,
): string {
  const { x, y, width, height } = cropArea;
  const cropT = `c_crop,x_${Math.round(x)},y_${Math.round(y)},w_${Math.round(width)},h_${Math.round(height)}`;
  const scaleT = targetW && targetH ? `/c_scale,w_${targetW},h_${targetH}` : '';

  // Strip any existing transforms by re-inserting after /upload/
  // (handles both raw uploads and URLs that already have transforms)
  const base = originalUrl.replace(/\/upload\/(?:[^/]+\/)*/, '/upload/');
  return base.replace('/upload/', `/upload/${cropT}${scaleT}/`);
}

export function ImageCropDialog({ open, onClose, imageUrl, onCropApply }: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [selectedPreset, setSelectedPreset] = useState(3); // default Free

  const aspect = ASPECT_PRESETS[selectedPreset].value;

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleApply = () => {
    if (!croppedArea) return;
    const preset = ASPECT_PRESETS[selectedPreset];
    const targetW = preset.w || undefined;
    const targetH = preset.h || undefined;
    const url = buildCloudinaryCropUrl(imageUrl, croppedArea, targetW, targetH);
    onCropApply(url);
    onClose();
  };

  const isCloudinary = imageUrl.includes('res.cloudinary.com');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Crop & Resize Image</DialogTitle>
        </DialogHeader>

        {!isCloudinary ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Crop is only available for Cloudinary-hosted images. Upload the image first.
          </div>
        ) : (
          <>
            {/* Aspect ratio presets */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Aspect:</Label>
              {ASPECT_PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  onClick={() => { setSelectedPreset(i); setZoom(1); setCrop({ x: 0, y: 0 }); }}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                    i === selectedPreset
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Crop area */}
            <div className="relative w-full h-[400px] bg-black rounded-lg overflow-hidden">
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                objectFit="contain"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom slider */}
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Zoom</Label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-xs text-muted-foreground w-10 text-right">{zoom.toFixed(1)}x</span>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          {isCloudinary && (
            <Button size="sm" onClick={handleApply} disabled={!croppedArea}>
              Apply Crop
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
