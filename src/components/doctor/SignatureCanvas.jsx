import { useEffect, useRef } from 'react';
import { Eraser } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { trimCanvasToDataUrl } from '@/utils/signatureTrim';

const CANVAS_HEIGHT = 144;
const STROKE_COLOR = '#111827';
const STROKE_WIDTH = 2;

function getPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

function paintBackground(ctx, width, height) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
}

function loadSignatureOntoCanvas(canvas, ctx, dataUrl, width, height) {
  return new Promise((resolve) => {
    if (!dataUrl) {
      paintBackground(ctx, width, height);
      resolve(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      paintBackground(ctx, width, height);
      const scale = Math.min(width / img.width, height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (width - w) / 2;
      const y = (height - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      resolve(true);
    };
    img.onerror = () => {
      paintBackground(ctx, width, height);
      resolve(false);
    };
    img.src = dataUrl;
  });
}

/**
 * Draw-and-save signature pad. Emits a PNG data URL via `onChange`.
 */
export function SignatureCanvas({ value, onChange, className }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const hasInkRef = useRef(false);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const setup = async () => {
      const parent = canvas.parentElement;
      const cssWidth = parent?.clientWidth || 400;
      canvas.width = cssWidth;
      canvas.height = CANVAS_HEIGHT;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${CANVAS_HEIGHT}px`;

      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = STROKE_COLOR;
      ctx.lineWidth = STROKE_WIDTH;

      hasInkRef.current = await loadSignatureOntoCanvas(
        canvas,
        ctx,
        valueRef.current,
        cssWidth,
        CANVAS_HEIGHT,
      );
    };

    setup();

    const parent = canvas.parentElement;
    if (!parent) return undefined;

    const observer = new ResizeObserver(() => {
      setup();
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const exportValue = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasInkRef.current) {
      onChange('');
      return;
    }
    onChange(trimCanvasToDataUrl(canvas) || canvas.toDataURL('image/png'));
  };

  const startDraw = (event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawingRef.current = true;
    hasInkRef.current = true;
    lastPointRef.current = getPoint(canvas, event);
  };

  const draw = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !lastPointRef.current) return;
    const ctx = canvas.getContext('2d');
    const point = getPoint(canvas, event);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
  };

  const endDraw = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawingRef.current = false;
    lastPointRef.current = null;
    exportValue();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    paintBackground(ctx, canvas.width, canvas.height);
    hasInkRef.current = false;
    onChange('');
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className="relative overflow-hidden rounded-md border bg-white"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!value ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Sign here with mouse or finger
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Saved with profile when you click Save profile.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={handleClear}>
          <Eraser className="size-3.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}
