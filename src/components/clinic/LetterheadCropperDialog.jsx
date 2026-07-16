import { useEffect, useRef, useState } from 'react';
import {
  FlipHorizontal2,
  Loader2,
  Save,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// A4 width at 96 DPI = 794 px; the header / footer strip is 107 px tall.
// This is the exact size we render into the final PNG so the PDF at
// 72 pt/in scales it back down to full A4 width with no distortion.
const OUTPUT_WIDTH = 794;
const OUTPUT_HEIGHT = 107;
// Preview is scaled down 1:1 so what the user sees is exactly what the
// PDF will render — just smaller. 500 / 794 ≈ 0.63 scale.
const PREVIEW_WIDTH = 500;
const PREVIEW_HEIGHT = Math.round((OUTPUT_HEIGHT / OUTPUT_WIDTH) * PREVIEW_WIDTH);

/**
 * Wide letterhead cropper — locked to the A4-width aspect (7.42:1) so the
 * header / footer strip drops cleanly into the fixed slot at the top /
 * bottom of every PDF page.
 *
 * Controls:
 *   - Zoom (1×–4×) so the user can crop into a specific area of the source
 *   - Two flip toggles (0° / 180°) instead of free rotation — a wide strip
 *     doesn't tolerate arbitrary angles without cropping the artwork.
 *
 * Confirming hands back a PNG Blob at OUTPUT_WIDTH × OUTPUT_HEIGHT.
 */
export function LetterheadCropperDialog({
  open,
  file,
  part = 'header',
  onCancel,
  onConfirm,
  saving = false,
}) {
  const canvasRef = useRef(null);
  const [imgEl, setImgEl] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!file) {
      setImgEl(null);
      setLoadError(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setImgEl(img);
    img.onerror = () => setLoadError('Could not decode the image file.');
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    // Reset zoom / flip whenever a fresh file is loaded so a previous
    // adjustment doesn't carry over into the next attempt.
    setZoom(1);
    setFlipped(false);
  }, [file]);

  useEffect(() => {
    if (!imgEl || !canvasRef.current) return;
    drawToCanvas(
      canvasRef.current,
      PREVIEW_WIDTH,
      PREVIEW_HEIGHT,
      imgEl,
      zoom,
      flipped ? 180 : 0,
    );
  }, [imgEl, zoom, flipped]);

  async function handleConfirm() {
    if (!imgEl) return;
    const out = document.createElement('canvas');
    drawToCanvas(
      out,
      OUTPUT_WIDTH,
      OUTPUT_HEIGHT,
      imgEl,
      zoom,
      flipped ? 180 : 0,
    );
    const blob = await new Promise((resolve) =>
      out.toBlob((b) => resolve(b), 'image/png', 0.92),
    );
    if (blob) {
      onConfirm(blob, { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT });
    }
  }

  const title =
    part === 'footer' ? 'Adjust letterhead footer' : 'Adjust letterhead header';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onCancel?.()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            The crop area matches the exact A4-width strip that gets printed
            on every prescription, bill and consent form. We save it as a{' '}
            {OUTPUT_WIDTH}×{OUTPUT_HEIGHT} PNG.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative overflow-hidden rounded-md border bg-muted/30"
            style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
          >
            <canvas
              ref={canvasRef}
              width={PREVIEW_WIDTH}
              height={PREVIEW_HEIGHT}
              className="block"
            />
            {loadError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-center text-sm text-destructive">
                {loadError}
              </div>
            ) : !imgEl ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                Loading image…
              </div>
            ) : null}
          </div>

          <div className="w-full space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ZoomIn className="size-3.5" /> Zoom
                </Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {zoom.toFixed(2)}×
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setZoom((z) => clamp(z - 0.1, 1, 4))}
                  aria-label="Zoom out"
                  disabled={!imgEl}
                >
                  <ZoomOut className="size-3.5" />
                </Button>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                  disabled={!imgEl}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setZoom((z) => clamp(z + 0.1, 1, 4))}
                  aria-label="Zoom in"
                  disabled={!imgEl}
                >
                  <ZoomIn className="size-3.5" />
                </Button>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <FlipHorizontal2 className="size-3.5" /> Orientation
                </Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {flipped ? '180°' : '0°'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={flipped ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => setFlipped(false)}
                  disabled={!imgEl}
                  className="flex-1"
                >
                  Normal
                </Button>
                <Button
                  type="button"
                  variant={flipped ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFlipped(true)}
                  disabled={!imgEl}
                  className="flex-1"
                >
                  Flip 180°
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>The rectangle outline is what gets saved.</span>
              <button
                type="button"
                className="font-medium text-primary hover:underline disabled:opacity-50"
                onClick={() => {
                  setZoom(1);
                  setFlipped(false);
                }}
                disabled={!imgEl || (zoom === 1 && !flipped)}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!imgEl || saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saving ? 'Uploading…' : `Save ${part}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Cover-fit the source image into a `width × height` rectangle at the
 * requested zoom / rotation, then flatten onto the canvas. The rotation
 * padding trick (|cos θ| + |sin θ|) keeps the strip fully covered even
 * at 180° when the image aspect differs from the target aspect.
 */
function drawToCanvas(canvas, width, height, img, zoom, rotation) {
  const ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const theta = (rotation * Math.PI) / 180;
  const rotPad = Math.abs(Math.cos(theta)) + Math.abs(Math.sin(theta));
  const base = Math.max(width / img.width, height / img.height) * rotPad;
  const scale = base * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(width / 2, height / 2);
  ctx.rotate(theta);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
