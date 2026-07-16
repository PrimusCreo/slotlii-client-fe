import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  RotateCcw,
  RotateCw,
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

const PREVIEW_SIZE = 320;
const OUTPUT_SIZE = 512;

/**
 * Square logo cropper dialog with zoom + rotate controls.
 *
 * - The selected file is decoded into an `Image` and continuously
 *   re-rendered to a 320px square preview canvas as the user moves
 *   the zoom / rotate sliders.
 * - On confirm, the same transform is re-rendered into an offscreen
 *   512px canvas which is converted to a PNG `Blob` and handed back
 *   via `onConfirm(blob, { width, height })`.
 *
 * Cover-fit at any rotation: the base scale is multiplied by
 * `|cos θ| + |sin θ|` so the rotated image always fills the square
 * without leaving blank corners — the user can zoom further if they
 * want a closer crop.
 */
export function LogoCropperDialog({
  open,
  file,
  onCancel,
  onConfirm,
  saving = false,
}) {
  const canvasRef = useRef(null);
  const [imgEl, setImgEl] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Decode the file → HTMLImageElement.
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

  // Reset transforms whenever a fresh file is loaded.
  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [file]);

  // Live preview.
  useEffect(() => {
    if (!imgEl || !canvasRef.current) return;
    drawToCanvas(canvasRef.current, PREVIEW_SIZE, imgEl, zoom, rotation);
  }, [imgEl, zoom, rotation]);

  async function handleConfirm() {
    if (!imgEl) return;
    const out = document.createElement('canvas');
    drawToCanvas(out, OUTPUT_SIZE, imgEl, zoom, rotation);
    const blob = await new Promise((resolve) =>
      out.toBlob((b) => resolve(b), 'image/png', 0.92),
    );
    if (blob) {
      onConfirm(blob, { width: OUTPUT_SIZE, height: OUTPUT_SIZE });
    }
  }

  function nudgeRotate(delta) {
    setRotation((r) => normalizeAngle(r + delta));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onCancel?.()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust logo</DialogTitle>
          <DialogDescription>
            Use zoom and rotate to position the logo inside the square.
            We&apos;ll save a 512×512 PNG.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative overflow-hidden rounded-md border bg-muted/30"
            style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
          >
            <canvas
              ref={canvasRef}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
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
                  <RotateCw className="size-3.5" /> Rotate
                </Label>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(rotation)}°
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => nudgeRotate(-90)}
                  aria-label="Rotate left 90°"
                  disabled={!imgEl}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                  disabled={!imgEl}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => nudgeRotate(90)}
                  aria-label="Rotate right 90°"
                  disabled={!imgEl}
                >
                  <RotateCw className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>The square outline is what gets saved.</span>
              <button
                type="button"
                className="font-medium text-primary hover:underline disabled:opacity-50"
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                }}
                disabled={!imgEl || (zoom === 1 && rotation === 0)}
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
            {saving ? 'Uploading…' : 'Save logo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function drawToCanvas(canvas, size, img, zoom, rotation) {
  const ctx = canvas.getContext('2d');
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const theta = (rotation * Math.PI) / 180;
  // Multiplier that grows the cover-fit base scale to absorb the rotated
  // bounding box — keeps the square fully covered at any angle.
  const rotPad = Math.abs(Math.cos(theta)) + Math.abs(Math.sin(theta));
  const base = Math.max(size / img.width, size / img.height) * rotPad;
  const scale = base * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(size / 2, size / 2);
  ctx.rotate(theta);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeAngle(deg) {
  let d = deg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}
