'use client';

/** Largest size each kind of artwork is ever shown at (2× for sharp screens). */
export const ART_SIZE = {
  poster: { w: 600, h: 900 },
  wide: { w: 1280, h: 720 },
  round: { w: 256, h: 256 },
} as const;

async function decode(blob: Blob): Promise<{ draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; w: number; h: number }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(blob);
    return { draw: (c, w, h) => c.drawImage(bmp, 0, 0, w, h), w: bmp.width, h: bmp.height };
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Could not read this image.'));
      i.src = url;
    });
    return { draw: (c, w, h) => c.drawImage(img, 0, 0, w, h), w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Shrinks an image to the size it's actually shown at and saves it as a
 * JPEG (works on every phone and TV browser). A 3 MB poster becomes about
 * 60–150 KB and looks the same on screen.
 */
export async function shrinkImage(blob: Blob, max: { w: number; h: number }, quality = 0.82): Promise<Blob> {
  const src = await decode(blob);
  const scale = Math.min(1, max.w / src.w, max.h / src.h);
  const w = Math.max(1, Math.round(src.w * scale));
  const h = Math.max(1, Math.round(src.h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  src.draw(ctx, w, h);
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
  // Keep the original if shrinking didn't actually help.
  return out && out.size < blob.size ? out : blob;
}
