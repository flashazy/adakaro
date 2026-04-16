/** Constants and canvas helpers for student profile photos (square output). */

export const STUDENT_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const STUDENT_AVATAR_OUTPUT_SIZE = 200;

export const STUDENT_AVATAR_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type StudentAvatarMime = (typeof STUDENT_AVATAR_ALLOWED_MIME)[number];

export function validateStudentAvatarFile(file: File): string | null {
  if (
    !STUDENT_AVATAR_ALLOWED_MIME.includes(file.type as StudentAvatarMime)
  ) {
    return "Please choose a JPG, PNG, or WebP image.";
  }
  if (file.size > STUDENT_AVATAR_MAX_BYTES) {
    return "Image must be 2MB or smaller.";
  }
  return null;
}

/**
 * Draw a centered square crop from the image into a square canvas.
 * `zoom` ≥ 1: larger values use a smaller source square (zoom in on the centre).
 */
export function drawStudentAvatarPreview(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  outSize: number,
  zoom: number
): void {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (nw < 1 || nh < 1) return;

  const minSide = Math.min(nw, nh);
  const z = Math.max(1, zoom);
  const cropSize = Math.min(minSide, minSide / z);
  const sx = (nw - cropSize) / 2;
  const sy = (nh - cropSize) / 2;

  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, outSize, outSize);
  ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, outSize, outSize);
}

export function canvasToWebpBlob(
  canvas: HTMLCanvasElement,
  quality = 0.92
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/webp", quality);
  });
}
