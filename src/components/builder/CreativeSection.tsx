import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Upload, Trash2, Plus, Image, Wand2, Crop, Link, Images, Loader2, Video, CopyPlus, Pencil, Eye } from 'lucide-react';
import { CREATIVE_URL_INPUT_ENABLED } from '@/lib/featureFlags';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { ImageCropDialog } from './ImageCropDialog';

export interface StoryVariant {
  id: string;
  url: string;
  type: 'generative_fill' | 'crop' | 'manual';
}

export interface CreativeImage {
  id: string;
  squareUrl: string;
  /** Raw Cloudinary URL before any transforms — used to derive AI Fill & crop variants */
  originalCloudinaryUrl: string;
  /** Persisted custom crop URL — survives switching between Original / AI Fill */
  customCropUrl: string;
  storyVariants: StoryVariant[];
  selectedStoryId: string;
}

export interface CreativeVideo {
  id: string;
  url: string;
  thumbnailUrl: string;
  /** Original filename from the user's upload (e.g. "Outfit video.mp4").
   *  Used as the video name in Meta's media library instead of a generic label. */
  fileName?: string;
  // Optional 9:16 story/reels variant. When set alongside `url`, the launch
  // flow uploads BOTH videos to Meta and routes the story clip to story/reels
  // placements via asset_customization_rules.
  storyUrl?: string;
  storyThumbnailUrl?: string;
  storyFileName?: string;
}

export interface CarouselCard {
  id: string;
  title: string;
  url: string;
  image: CreativeImage;
}

export interface CreativeData {
  type: 'SINGLE_IMAGE' | 'SINGLE_VIDEO' | 'CAROUSEL';
  multiVariant: boolean;
  singleImage: CreativeImage | null;
  singleVideo: CreativeVideo | null;
  carouselCards: CarouselCard[];
}

function createEmptyImage(): CreativeImage {
  return {
    id: crypto.randomUUID(),
    squareUrl: '',
    originalCloudinaryUrl: '',
    customCropUrl: '',
    storyVariants: [],
    selectedStoryId: '',
  };
}

function createCarouselCard(index: number): CarouselCard {
  return {
    id: crypto.randomUUID(),
    title: `Card ${index}`,
    url: '',
    image: createEmptyImage(),
  };
}

function createEmptyVideo(): CreativeVideo {
  return { id: crypto.randomUUID(), url: '', thumbnailUrl: '' };
}

export function createEmptyCreativeData(): CreativeData {
  return {
    type: 'SINGLE_IMAGE',
    multiVariant: false,
    singleImage: null,
    singleVideo: null,
    carouselCards: [createCarouselCard(1), createCarouselCard(2)],
  };
}

// Build real 9:16 story variants via Cloudinary URL transformations
// Reference: two processing types — AI Gen Fill (two-step chained) and Face Crop
function buildCloudinaryStoryVariants(cloudinaryUrl: string): StoryVariant[] {
  if (!cloudinaryUrl.includes('res.cloudinary.com')) return [];
  // AI Gen Fill (two chained steps separated by /):
  //   Step 1: b_gen_fill,c_pad,w_1080,h_1920 — pad to 9:16 with AI-generated background
  //   Step 2: c_fill,g_auto — auto-gravity fill to ensure subject is well-positioned
  // Requires Cloudinary AI add-on (paid plan)
  const genFillUrl = cloudinaryUrl.replace('/upload/', '/upload/b_gen_fill,c_pad,w_1080,h_1920/c_fill,g_auto/');
  // Face Crop: fills to 9:16 keeping detected face centered (falls back to center crop if no face)
  const faceCropUrl = cloudinaryUrl.replace('/upload/', '/upload/c_fill,g_face,w_1080,h_1920/');
  return [
    { id: crypto.randomUUID(), url: genFillUrl, type: 'generative_fill' },
    { id: crypto.randomUUID(), url: faceCropUrl, type: 'crop' },
  ];
}

// Build 1080x1080 AI Fill variant — pads any image to perfect square with AI-generated background
function buildSquare1080AiFillUrl(cloudinaryUrl: string): string {
  if (!cloudinaryUrl.includes('res.cloudinary.com')) return '';
  return cloudinaryUrl.replace('/upload/', '/upload/b_gen_fill,c_pad,w_1080,h_1080/c_fill,g_auto/');
}

// Cloudinary signed upload — signature obtained from cloudinary-sign edge function
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const cloudinaryConfigured = Boolean(CLOUDINARY_CLOUD_NAME);

async function uploadToCloudinary(file: File, resourceType: 'image' | 'video' = 'image'): Promise<string> {
  // Step 1: Get signature from server (API secret never touches the browser)
  const { signature, timestamp, api_key } = await invokeEdgeFunction<{
    signature: string;
    timestamp: number;
    api_key: string;
  }>('cloudinary-sign', {});

  // Step 2: Upload to Cloudinary with signed params
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', api_key);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Cloudinary upload failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.secure_url;
}

interface ImageUploadBlockProps {
  image: CreativeImage;
  onChange: (updated: CreativeImage) => void;
  label?: string;
  multiVariant: boolean;
}

function ImageUploadBlock({ image, onChange, label, multiVariant }: ImageUploadBlockProps) {
  const squareRef = useRef<HTMLInputElement>(null);
  const storyRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [squareUrlValue, setSquareUrlValue] = useState('');
  const [storyUrlValue, setStoryUrlValue] = useState('');
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<'square' | { storyId: string }>('square');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const aiFill1080Url = image.originalCloudinaryUrl ? buildSquare1080AiFillUrl(image.originalCloudinaryUrl) : '';
  const isUsingAiFill = aiFill1080Url && image.squareUrl === aiFill1080Url;
  const isUsingOriginal = image.originalCloudinaryUrl && image.squareUrl === image.originalCloudinaryUrl;
  const hasCustomCrop = Boolean(image.customCropUrl);
  const isUsingCustomCrop = hasCustomCrop && image.squareUrl === image.customCropUrl;

  const selectSquareVariant = (url: string) => {
    onChange({ ...image, squareUrl: url });
  };

  const openCropDialog = (target: 'square' | { storyId: string }) => {
    setCropTarget(target);
    setCropDialogOpen(true);
  };

  const handleCropApply = (croppedUrl: string) => {
    if (cropTarget === 'square') {
      // Persist the custom crop and select it
      onChange({ ...image, squareUrl: croppedUrl, customCropUrl: croppedUrl });
    } else {
      const storyId = cropTarget.storyId;
      onChange({
        ...image,
        storyVariants: image.storyVariants.map(v =>
          v.id === storyId ? { ...v, url: croppedUrl } : v
        ),
      });
    }
  };

  const getCropSourceUrl = (): string => {
    if (cropTarget === 'square') {
      return image.originalCloudinaryUrl || image.squareUrl;
    }
    const variant = image.storyVariants.find(v => v.id === cropTarget.storyId);
    return variant?.url || '';
  };

  const handleSquareUrlSet = () => {
    const url = squareUrlValue.trim();
    if (!url) return;
    if (!url.startsWith('https://')) {
      toast.error('Please enter a valid HTTPS URL');
      return;
    }
    onChange({
      ...image,
      squareUrl: url,
      storyVariants: image.storyVariants,
      selectedStoryId: image.selectedStoryId,
    });
  };

  const handleStoryUrlSet = () => {
    const url = storyUrlValue.trim();
    if (!url) return;
    if (!url.startsWith('https://')) {
      toast.error('Please enter a valid HTTPS URL');
      return;
    }
    const manualVariant: StoryVariant = { id: crypto.randomUUID(), url, type: 'manual' };
    onChange({
      ...image,
      storyVariants: [...image.storyVariants.filter(v => v.type !== 'manual' || v.url !== url), manualVariant],
      selectedStoryId: manualVariant.id,
    });
    toast.success('Story image URL applied');
  };

  const handleSquareUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const blobUrl = URL.createObjectURL(file);
    onChange({
      ...image,
      squareUrl: blobUrl,
      storyVariants: [],
      selectedStoryId: '',
    });

    if (cloudinaryConfigured) {
      setIsUploading(true);
      try {
        const cloudinaryUrl = await uploadToCloudinary(file);
        const variants = buildCloudinaryStoryVariants(cloudinaryUrl);
        // Always set squareUrl to the 1080x1080 AI Fill version
        const square1080 = buildSquare1080AiFillUrl(cloudinaryUrl);
        onChange({
          ...image,
          squareUrl: square1080 || cloudinaryUrl,
          originalCloudinaryUrl: cloudinaryUrl,
          storyVariants: variants,
          selectedStoryId: variants[0]?.id || '',
        });
        toast.success('Image uploaded to Cloudinary');
      } catch (err) {
        console.error('[Cloudinary Upload Error]', err);
        toast.error(`Cloudinary upload failed: ${(err as Error).message}`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show blob preview immediately
    const blobUrl = URL.createObjectURL(file);
    const tempVariant: StoryVariant = { id: crypto.randomUUID(), url: blobUrl, type: 'manual' };
    onChange({
      ...image,
      storyVariants: [...image.storyVariants, tempVariant],
      selectedStoryId: tempVariant.id,
    });

    // Upload to Cloudinary for a real HTTPS URL
    if (cloudinaryConfigured) {
      try {
        const cloudinaryUrl = await uploadToCloudinary(file);
        const finalVariant: StoryVariant = { ...tempVariant, url: cloudinaryUrl };
        onChange({
          ...image,
          storyVariants: [...image.storyVariants.filter(v => v.id !== tempVariant.id), finalVariant],
          selectedStoryId: finalVariant.id,
        });
        toast.success('Story image uploaded to Cloudinary');
      } catch (err) {
        toast.error(`Story upload failed: ${(err as Error).message}`);
      }
    }
  };

  const removeStoryVariant = (variantId: string) => {
    const remaining = image.storyVariants.filter(v => v.id !== variantId);
    onChange({
      ...image,
      storyVariants: remaining,
      selectedStoryId: image.selectedStoryId === variantId ? (remaining[0]?.id || '') : image.selectedStoryId,
    });
  };

  const removeSquare = () => {
    onChange({ ...image, squareUrl: '', originalCloudinaryUrl: '', customCropUrl: '', storyVariants: [], selectedStoryId: '' });
    setSquareUrlValue('');
    setStoryUrlValue('');
  };

  return (
    <div className="space-y-3">
      {label && <Label className="text-xs text-muted-foreground font-medium">{label}</Label>}

      <Tabs defaultValue="upload" className="w-full">
        {CREATIVE_URL_INPUT_ENABLED && (
          <TabsList className="h-8">
            <TabsTrigger value="upload" className="text-xs px-3 h-7">
              <Upload className="w-3 h-3 mr-1.5" />Upload
            </TabsTrigger>
            <TabsTrigger value="url" className="text-xs px-3 h-7">
              <Link className="w-3 h-3 mr-1.5" />URL
            </TabsTrigger>
          </TabsList>
        )}

        {/* ── Upload Tab ── */}
        <TabsContent value="upload" className="mt-3">
          <div className="flex gap-4 items-start flex-wrap">
            {/* ── Square image + variants ── */}
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Square (1080×1080)</span>
              {image.squareUrl ? (
                <div className="flex gap-2">
                  {/* Original thumbnail — shown when AI Fill variant exists */}
                  {aiFill1080Url && image.originalCloudinaryUrl && (
                    <div className="relative group">
                      <div
                        onClick={() => selectSquareVariant(image.originalCloudinaryUrl)}
                        className={cn(
                          "w-36 h-36 rounded-lg border-2 cursor-pointer overflow-hidden transition-all relative",
                          isUsingOriginal ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                        )}
                      >
                        <img src={image.originalCloudinaryUrl} alt="Original" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[9px] text-center py-0.5 font-medium text-foreground">
                          <Image className="w-2.5 h-2.5 inline mr-0.5" />Original
                        </div>
                      </div>
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewUrl(image.originalCloudinaryUrl); }}
                          className="bg-background/80 text-foreground rounded-full p-1"
                          title="Preview"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        {!hasCustomCrop && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openCropDialog('square'); }}
                            className="bg-primary text-primary-foreground rounded-full p-1"
                            title="Crop / Resize"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeSquare(); }}
                          className="bg-destructive text-destructive-foreground rounded-full p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* AI Fill 1080×1080 thumbnail */}
                  {aiFill1080Url && (
                    <div className="relative group">
                      <div
                        onClick={() => selectSquareVariant(aiFill1080Url)}
                        className={cn(
                          "w-36 h-36 rounded-lg border-2 cursor-pointer overflow-hidden transition-all relative",
                          isUsingAiFill ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                        )}
                      >
                        <img src={aiFill1080Url} alt="AI Fill 1080" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[9px] text-center py-0.5 font-medium text-foreground">
                          <Wand2 className="w-2.5 h-2.5 inline mr-0.5" />AI Fill 1080
                        </div>
                      </div>
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewUrl(aiFill1080Url); }}
                          className="bg-background/80 text-foreground rounded-full p-1"
                          title="Preview"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Custom crop thumbnail — persisted, always shown once created */}
                  {hasCustomCrop && (
                    <div className="relative group">
                      <div
                        onClick={() => selectSquareVariant(image.customCropUrl)}
                        className={cn(
                          "w-36 h-36 rounded-lg border-2 cursor-pointer overflow-hidden transition-all relative",
                          isUsingCustomCrop ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                        )}
                      >
                        <img src={image.customCropUrl} alt="Cropped" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[9px] text-center py-0.5 font-medium text-foreground">
                          <Crop className="w-2.5 h-2.5 inline mr-0.5" />Custom
                        </div>
                      </div>
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewUrl(image.customCropUrl); }}
                          className="bg-background/80 text-foreground rounded-full p-1"
                          title="Preview"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openCropDialog('square'); }}
                          className="bg-primary text-primary-foreground rounded-full p-1"
                          title="Re-crop"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Fallback: single thumbnail when no Cloudinary (blob URL) */}
                  {!aiFill1080Url && (
                    <div className="relative group">
                      <img src={image.squareUrl} alt="Square" className="w-36 h-36 object-cover rounded-lg border border-border" />
                      {isUploading && (
                        <div className="absolute inset-0 bg-background/60 rounded-lg flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      )}
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewUrl(image.squareUrl); }}
                          className="bg-background/80 text-foreground rounded-full p-1"
                          title="Preview"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        {image.originalCloudinaryUrl && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openCropDialog('square'); }}
                            className="bg-primary text-primary-foreground rounded-full p-1"
                            title="Crop / Resize"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={removeSquare}
                          className="bg-destructive text-destructive-foreground rounded-full p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => squareRef.current?.click()}
                  className="w-36 h-36 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-primary font-medium">Upload Image</span>
                </div>
              )}
              <input ref={squareRef} type="file" accept="image/*" className="hidden" onChange={handleSquareUpload} />
            </div>

            {/* Story Variants — only shown in multi-variant mode */}
            {multiVariant && image.squareUrl && (
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground">Story variant (1080×1920)</span>
                <div className="flex gap-2">
                  {image.storyVariants.map((v) => (
                    <div
                      key={v.id}
                      className="relative group"
                    >
                      <div
                        onClick={() => onChange({ ...image, selectedStoryId: v.id })}
                        className={cn(
                          "w-[72px] h-[128px] rounded-lg border-2 cursor-pointer overflow-hidden transition-all relative",
                          v.id === image.selectedStoryId ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                        )}
                      >
                        <img src={v.url} alt="Story" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[9px] text-center py-0.5 font-medium text-foreground">
                          {v.type === 'generative_fill' && <><Wand2 className="w-2.5 h-2.5 inline mr-0.5" />AI Fill</>}
                          {v.type === 'crop' && <><Crop className="w-2.5 h-2.5 inline mr-0.5" />Crop</>}
                          {v.type === 'manual' && <><Image className="w-2.5 h-2.5 inline mr-0.5" />Manual</>}
                        </div>
                      </div>
                      <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        {/* Eye icon on all story variants */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewUrl(v.url); }}
                          className="bg-background/80 text-foreground rounded-full p-0.5"
                          title="Preview"
                        >
                          <Eye className="w-2.5 h-2.5" />
                        </button>
                        {/* Pencil/delete only on manual story variants */}
                        {v.type === 'manual' && image.originalCloudinaryUrl && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openCropDialog({ storyId: v.id }); }}
                            className="bg-primary text-primary-foreground rounded-full p-0.5"
                            title="Crop / Resize"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                        )}
                        {v.type === 'manual' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeStoryVariant(v.id); }}
                            className="bg-destructive text-destructive-foreground rounded-full p-0.5"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div
                    onClick={() => storyRef.current?.click()}
                    className="w-[72px] h-[128px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                    <span className="text-[9px] text-primary font-medium text-center leading-tight">Upload Story</span>
                  </div>
                  <input ref={storyRef} type="file" accept="image/*" className="hidden" onChange={handleStoryUpload} />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── URL Tab (dev-only; flag-gated) ── */}
        {CREATIVE_URL_INPUT_ENABLED && (
        <TabsContent value="url" className="mt-3">
          <div className="space-y-3">
            {image.squareUrl && (
              <div className="flex items-center gap-2 mb-2">
                <img src={image.squareUrl} alt="Preview" className="w-10 h-10 object-cover rounded border border-border" />
                <span className="text-xs text-muted-foreground truncate flex-1">{image.squareUrl}</span>
                <button onClick={removeSquare} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">1:1 Image URL (1080×1080)</Label>
              <Input
                value={squareUrlValue}
                onChange={e => setSquareUrlValue(e.target.value)}
                placeholder="https://res.cloudinary.com/..."
                className="h-8 text-xs mt-1"
                onKeyDown={e => e.key === 'Enter' && handleSquareUrlSet()}
                onBlur={handleSquareUrlSet}
              />
            </div>
            {multiVariant && (
              <div>
                <Label className="text-xs text-muted-foreground">9:16 Story Image URL (1080×1920) <span className="text-destructive">*</span></Label>
                <Input
                  value={storyUrlValue}
                  onChange={e => setStoryUrlValue(e.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                  className="h-8 text-xs mt-1"
                  onKeyDown={e => e.key === 'Enter' && handleStoryUrlSet()}
                  onBlur={handleStoryUrlSet}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Required for multi-variant. Enables placement-optimized delivery (feed vs story).
                </p>
              </div>
            )}
          </div>
        </TabsContent>
        )}
      </Tabs>

      {/* Crop Dialog */}
      <ImageCropDialog
        open={cropDialogOpen}
        onClose={() => setCropDialogOpen(false)}
        imageUrl={getCropSourceUrl()}
        onCropApply={handleCropApply}
      />

      {/* Image Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(v) => !v && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          {previewUrl && (
            <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-[80vh] object-contain rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Video slot (feed or story) — reusable inside VideoUploadBlock ──
interface VideoSlotProps {
  label: string;
  videoUrl: string;
  thumbnailUrl: string;
  onVideoChange: (url: string, fileName?: string) => void;
  onThumbnailChange: (url: string) => void;
  onRemove: () => void;
  placeholder: string;
}

function VideoSlot({ label, videoUrl, thumbnailUrl, onVideoChange, onThumbnailChange, onRemove, placeholder }: VideoSlotProps) {
  const videoRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [videoUrlValue, setVideoUrlValue] = useState('');
  const [thumbUrlValue, setThumbUrlValue] = useState('');

  const commitVideoUrl = () => {
    const url = videoUrlValue.trim();
    if (!url) return;
    if (!url.startsWith('https://')) { toast.error('Please enter a valid HTTPS URL'); return; }
    onVideoChange(url);
  };

  const commitThumbUrl = () => {
    const url = thumbUrlValue.trim();
    if (!url) return;
    if (!url.startsWith('https://')) { toast.error('Please enter a valid HTTPS URL'); return; }
    onThumbnailChange(url);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Strip extension to get a clean display name (e.g. "Outfit video.mp4" → "Outfit video")
    const fileName = file.name.replace(/\.[^.]+$/, '');
    const blobUrl = URL.createObjectURL(file);
    onVideoChange(blobUrl, fileName);
    if (cloudinaryConfigured) {
      setIsUploading(true);
      try {
        const cloudinaryUrl = await uploadToCloudinary(file, 'video');
        onVideoChange(cloudinaryUrl, fileName);
        toast.success(`${label} uploaded to Cloudinary`);
      } catch (err) {
        console.error('[Cloudinary Video Upload Error]', err);
        toast.error(`Video upload failed: ${(err as Error).message}`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const remove = () => {
    onRemove();
    setVideoUrlValue('');
    setThumbUrlValue('');
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      <Tabs defaultValue="upload" className="w-full">
        {CREATIVE_URL_INPUT_ENABLED && (
          <TabsList className="h-8">
            <TabsTrigger value="upload" className="text-xs px-3 h-7">
              <Upload className="w-3 h-3 mr-1.5" />Upload
            </TabsTrigger>
            <TabsTrigger value="url" className="text-xs px-3 h-7">
              <Link className="w-3 h-3 mr-1.5" />URL
            </TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="upload" className="mt-3">
          <div className="space-y-3">
            {videoUrl ? (
              <div className="relative group">
                <video src={videoUrl} controls className="w-64 max-h-48 rounded-lg border border-border object-contain bg-black" />
                {isUploading && (
                  <div className="absolute inset-0 bg-background/60 rounded-lg flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                )}
                <button
                  onClick={remove}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => videoRef.current?.click()}
                className="w-64 h-36 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Video className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-primary font-medium">Upload Video</span>
              </div>
            )}
            <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
          </div>
        </TabsContent>
        {CREATIVE_URL_INPUT_ENABLED && (
          <TabsContent value="url" className="mt-3">
            <div className="space-y-3">
              {videoUrl && (
                <div className="flex items-center gap-2 mb-2">
                  <Video className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground truncate flex-1">{videoUrl}</span>
                  <button onClick={remove} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Video URL</Label>
                <Input
                  value={videoUrlValue}
                  onChange={e => setVideoUrlValue(e.target.value)}
                  placeholder={placeholder}
                  className="h-8 text-xs mt-1"
                  onKeyDown={e => e.key === 'Enter' && commitVideoUrl()}
                  onBlur={commitVideoUrl}
                />
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Thumbnail — always visible */}
      <div>
        <Label className="text-xs text-muted-foreground">Thumbnail Image URL (Optional)</Label>
        <Input
          value={thumbUrlValue}
          onChange={e => setThumbUrlValue(e.target.value)}
          placeholder="https://res.cloudinary.com/..."
          className="h-8 text-xs mt-1"
          onKeyDown={e => e.key === 'Enter' && commitThumbUrl()}
          onBlur={commitThumbUrl}
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Leave blank and Meta will auto-generate from the video's first frame.
        </p>
        {thumbnailUrl && (
          <img src={thumbnailUrl} alt="Thumbnail" className="w-20 h-20 object-cover rounded border border-border mt-2" />
        )}
      </div>
    </div>
  );
}

// ── Video Upload Block — renders feed + optional story slot ──
interface VideoUploadBlockProps {
  video: CreativeVideo;
  onChange: (updated: CreativeVideo) => void;
  multiVariant: boolean;
}

function VideoUploadBlock({ video, onChange, multiVariant }: VideoUploadBlockProps) {
  // Ref holds the latest video so async upload callbacks don't use stale state.
  // Without this, uploading feed + story in parallel causes the second upload's
  // blob URL to be overwritten when the first upload completes.
  const videoRef = useRef(video);
  videoRef.current = video;

  const update = (partial: Partial<CreativeVideo>) => onChange({ ...videoRef.current, ...partial });

  return (
    <div className={multiVariant ? 'flex gap-6 flex-wrap' : ''}>
      <VideoSlot
        label={multiVariant ? 'Feed Video (1:1)' : 'Video'}
        videoUrl={video.url}
        thumbnailUrl={video.thumbnailUrl}
        onVideoChange={(url, fileName) => update({ url, ...(fileName ? { fileName } : {}) })}
        onThumbnailChange={url => update({ thumbnailUrl: url })}
        onRemove={() => update({ url: '', thumbnailUrl: '', fileName: undefined })}
        placeholder="https://res.cloudinary.com/..."
      />
      {multiVariant && (
        <VideoSlot
          label="Story / Reels Video (9:16)"
          videoUrl={video.storyUrl || ''}
          thumbnailUrl={video.storyThumbnailUrl || ''}
          onVideoChange={(url, fileName) => update({ storyUrl: url, ...(fileName ? { storyFileName: fileName } : {}) })}
          onThumbnailChange={url => update({ storyThumbnailUrl: url })}
          onRemove={() => update({ storyUrl: '', storyThumbnailUrl: '', storyFileName: undefined })}
          placeholder="https://res.cloudinary.com/..."
        />
      )}
    </div>
  );
}

interface CreativeSectionProps {
  data: CreativeData;
  onChange: (data: CreativeData) => void;
}

export function CreativeSection({ data, onChange }: CreativeSectionProps) {
  const bulkRef = useRef<HTMLInputElement>(null);
  const [multiVariant, setMultiVariant] = useState(data.multiVariant ?? false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  const updateMultiVariant = (mv: boolean) => {
    setMultiVariant(mv);
    if (!mv) {
      // Clear story data when multi-variant is turned OFF
      const updated = { ...data, multiVariant: mv };
      if (updated.singleImage) {
        updated.singleImage = { ...updated.singleImage, storyVariants: [], selectedStoryId: '' };
      }
      if (updated.carouselCards) {
        updated.carouselCards = updated.carouselCards.map(c => ({
          ...c,
          image: { ...c.image, storyVariants: [], selectedStoryId: '' },
        }));
      }
      onChange(updated);
    } else {
      onChange({ ...data, multiVariant: mv });
    }
  };

  const updateType = (type: 'SINGLE_IMAGE' | 'SINGLE_VIDEO' | 'CAROUSEL') => {
    onChange({ ...data, type });
  };

  const updateSingleImage = (image: CreativeImage) => {
    onChange({ ...data, singleImage: image });
  };

  const updateSingleVideo = (video: CreativeVideo) => {
    onChange({ ...data, singleVideo: video });
  };

  const updateCard = (cardId: string, updates: Partial<CarouselCard>) => {
    onChange({
      ...data,
      carouselCards: data.carouselCards.map(c => c.id === cardId ? { ...c, ...updates } : c),
    });
  };

  /**
   * Copy a single field's value from the source card to every other card in
   * the carousel. Used by the "apply to all" buttons next to Card 1's title
   * and URL inputs — saves the user from typing the same value N times when
   * all cards in a carousel share the same destination or headline.
   */
  const applyCardFieldToAll = (sourceCardId: string, field: 'title' | 'url') => {
    const source = data.carouselCards.find(c => c.id === sourceCardId);
    if (!source) return;
    const value = source[field].trim();
    if (!value) {
      toast.error(`Card 1 ${field === 'title' ? 'title' : 'URL'} is empty — nothing to apply`);
      return;
    }
    onChange({
      ...data,
      carouselCards: data.carouselCards.map(c => ({ ...c, [field]: value })),
    });
    toast.success(`Applied to all ${data.carouselCards.length} cards`);
  };

  const addCard = () => {
    onChange({
      ...data,
      carouselCards: [...data.carouselCards, createCarouselCard(data.carouselCards.length + 1)],
    });
  };

  const removeCard = (cardId: string) => {
    onChange({
      ...data,
      carouselCards: data.carouselCards.filter(c => c.id !== cardId),
    });
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';

    if (cloudinaryConfigured) {
      setIsBulkUploading(true);
      toast.success(`Uploading ${files.length} image(s) to Cloudinary...`);
      try {
        const results = await Promise.allSettled(
          files.map(file => uploadToCloudinary(file))
        );

        const newCards: CarouselCard[] = [];
        let failCount = 0;
        results.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            const cloudinaryUrl = result.value;
            const variants = buildCloudinaryStoryVariants(cloudinaryUrl);
            newCards.push({
              id: crypto.randomUUID(),
              title: files[i].name.replace(/\.[^/.]+$/, ''),
              url: '',
              image: {
                id: crypto.randomUUID(),
                squareUrl: buildSquare1080AiFillUrl(cloudinaryUrl) || cloudinaryUrl,
                originalCloudinaryUrl: cloudinaryUrl,
                customCropUrl: '',
                storyVariants: variants,
                selectedStoryId: variants[0]?.id || '',
              },
            });
          } else {
            failCount++;
          }
        });

        onChange({
          ...data,
          carouselCards: [...data.carouselCards.filter(c => c.image.squareUrl), ...newCards],
        });

        if (failCount > 0) toast.error(`${failCount} image(s) failed to upload`);
        if (newCards.length > 0) toast.success(`${newCards.length} image(s) uploaded`);
      } catch (err) {
        toast.error('Bulk upload failed');
        console.error('[Bulk Upload Error]', err);
      } finally {
        setIsBulkUploading(false);
      }
    } else {
      // Fallback: blob URLs when Cloudinary is not configured
      const newCards: CarouselCard[] = files.map((file) => ({
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^/.]+$/, ''),
        url: '',
        image: {
          id: crypto.randomUUID(),
          squareUrl: URL.createObjectURL(file),
          originalCloudinaryUrl: '',
          customCropUrl: '',
          storyVariants: [],
          selectedStoryId: '',
        },
      }));

      onChange({
        ...data,
        carouselCards: [...data.carouselCards.filter(c => c.image.squareUrl), ...newCards],
      });
    }
  };

  const typeOptions: { value: CreativeData['type']; label: string; icon: React.ReactNode }[] = [
    { value: 'SINGLE_IMAGE', label: 'Image', icon: <Image className="w-3.5 h-3.5" /> },
    { value: 'SINGLE_VIDEO', label: 'Video', icon: <Video className="w-3.5 h-3.5" /> },
    { value: 'CAROUSEL', label: 'Carousel', icon: <Images className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Image className="w-3.5 h-3.5 text-primary" />
          </div>
          <Label className="text-sm font-bold">Creative</Label>
        </div>
        <div className="flex items-center gap-3">
          {multiVariant && (
            <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">9:16 Story enabled</span>
          )}
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
            <Switch
              id="multivariant-toggle"
              checked={multiVariant}
              onCheckedChange={updateMultiVariant}
              className="scale-90"
            />
            <Label htmlFor="multivariant-toggle" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
              Multi-Variant
            </Label>
          </div>
        </div>
      </div>

      {/* Type Pill Toggle */}
      <div className="flex bg-muted rounded-xl p-1 w-fit">
        {typeOptions.map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => updateType(value)}
            className={cn(
              'flex items-center gap-1.5 py-2 px-4 rounded-lg text-xs font-medium transition-all duration-200',
              data.type === value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Single Image */}
      {data.type === 'SINGLE_IMAGE' && (
        <ImageUploadBlock
          image={data.singleImage || createEmptyImage()}
          onChange={updateSingleImage}
          multiVariant={multiVariant}
        />
      )}

      {/* Single Video */}
      {data.type === 'SINGLE_VIDEO' && (
        <VideoUploadBlock
          video={data.singleVideo || createEmptyVideo()}
          onChange={updateSingleVideo}
          multiVariant={data.multiVariant}
        />
      )}

      {/* Carousel */}
      {data.type === 'CAROUSEL' && (
        <div className="space-y-3">
          {data.carouselCards.map((card, i) => (
            <Card key={card.id} className="border-border/50 bg-muted/20">
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary">Card {i + 1}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeCard(card.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs text-muted-foreground">Card Title</Label>
                      {/* "Apply to all" only on the first card and only when
                          there are sibling cards to copy to. The first card is
                          the implicit source so users have a single, predictable
                          place to look. */}
                      {i === 0 && data.carouselCards.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10"
                          onClick={() => applyCardFieldToAll(card.id, 'title')}
                          title="Copy this title to all other cards"
                        >
                          <CopyPlus className="w-3 h-3 mr-1" />
                          Apply to all
                        </Button>
                      )}
                    </div>
                    <Input
                      value={card.title}
                      onChange={e => updateCard(card.id, { title: e.target.value })}
                      placeholder="Card title"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs text-muted-foreground">URL</Label>
                      {i === 0 && data.carouselCards.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10"
                          onClick={() => applyCardFieldToAll(card.id, 'url')}
                          title="Copy this URL to all other cards"
                        >
                          <CopyPlus className="w-3 h-3 mr-1" />
                          Apply to all
                        </Button>
                      )}
                    </div>
                    <Input
                      value={card.url}
                      onChange={e => updateCard(card.id, { url: e.target.value })}
                      placeholder="https://..."
                      className="mt-1"
                    />
                  </div>
                </div>

                <ImageUploadBlock
                  image={card.image}
                  onChange={(img) => updateCard(card.id, { image: img })}
                  multiVariant={multiVariant}
                />
              </div>
            </Card>
          ))}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addCard} className="border-primary/30 text-primary hover:bg-primary/10">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Card
            </Button>
            <Button variant="outline" size="sm" onClick={() => bulkRef.current?.click()} disabled={isBulkUploading} className="border-primary/30 text-primary hover:bg-primary/10">
              {isBulkUploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Images className="w-3.5 h-3.5 mr-1" />}
              {isBulkUploading ? 'Uploading...' : 'Bulk Upload Visuals'}
            </Button>
            <input ref={bulkRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBulkUpload} />
          </div>
        </div>
      )}
    </div>
  );
}
