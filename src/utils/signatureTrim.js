const TRIM_PADDING = 12;
const INK_THRESHOLD = 248;

/**
 * Find bounding box of non-white pixels in canvas image data.
 */
function findInkBounds(imageData, width, height) {
  const { data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 0 && (r < INK_THRESHOLD || g < INK_THRESHOLD || b < INK_THRESHOLD)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;

  minX = Math.max(0, minX - TRIM_PADDING);
  minY = Math.max(0, minY - TRIM_PADDING);
  maxX = Math.min(width - 1, maxX + TRIM_PADDING);
  maxY = Math.min(height - 1, maxY + TRIM_PADDING);

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/** Crop a canvas to its ink bounds and return a PNG data URL. */
export function trimCanvasToDataUrl(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const bounds = findInkBounds(ctx.getImageData(0, 0, width, height), width, height);
  if (!bounds) return '';

  const cropped = document.createElement('canvas');
  cropped.width = bounds.width;
  cropped.height = bounds.height;
  cropped.getContext('2d').drawImage(
    canvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );
  return cropped.toDataURL('image/png');
}

/** Trim whitespace from a stored PNG data URL (handles legacy full-canvas saves). */
export function trimSignatureDataUrl(dataUrl) {
  if (!dataUrl) return Promise.resolve('');

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(trimCanvasToDataUrl(canvas) || dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
