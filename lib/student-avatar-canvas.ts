/** Constants and canvas helpers for student profile photos (square output). */

export const STUDENT_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
/** Max width/height before crop step (camera / large uploads). */
export const STUDENT_AVATAR_SOURCE_MAX_DIM = 1024;
export const STUDENT_AVATAR_SOURCE_JPEG_QUALITY_HIGH = 0.75;
export const STUDENT_AVATAR_SOURCE_JPEG_QUALITY_LOW = 0.5;
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

function loadHtmlImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

function getDrawableSize(
  source: HTMLImageElement | ImageBitmap
): { w: number; h: number } {
  if (source instanceof HTMLImageElement) {
    return { w: source.naturalWidth, h: source.naturalHeight };
  }
  return { w: source.width, h: source.height };
}

/**
 * Downscales and re-encodes a picked/captured image to JPEG so it passes
 * {@link validateStudentAvatarFile} before the crop step. Used for camera
 * captures and large gallery picks.
 */
export async function compressStudentAvatarSourceFile(
  file: File
): Promise<{ ok: true; file: File } | { ok: false; error: string }> {
  if (typeof document === "undefined") {
    return { ok: false, error: "Compression is only available in the browser." };
  }

  let source: HTMLImageElement | ImageBitmap | null = null;
  try {
    try {
      source = await createImageBitmap(file);
    } catch {
      source = await loadHtmlImageFromFile(file);
    }
  } catch {
    return { ok: false, error: "Could not read this image. Try a JPG or PNG file." };
  }

  const { w: sw, h: sh } = getDrawableSize(source);
  if (sw < 1 || sh < 1) {
    if (source instanceof ImageBitmap) source.close();
    return { ok: false, error: "This image appears to be empty." };
  }

  const scale0 = Math.min(
    1,
    STUDENT_AVATAR_SOURCE_MAX_DIM / Math.max(sw, sh)
  );
  let cw = Math.max(1, Math.round(sw * scale0));
  let ch = Math.max(1, Math.round(sh * scale0));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (source instanceof ImageBitmap) source.close();
    return { ok: false, error: "Could not process this image." };
  }

  const encodeJpeg = (quality: number) =>
    new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });

  const draw = () => {
    canvas.width = cw;
    canvas.height = ch;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(source as CanvasImageSource, 0, 0, sw, sh, 0, 0, cw, ch);
  };

  draw();

  let blob =
    (await encodeJpeg(STUDENT_AVATAR_SOURCE_JPEG_QUALITY_HIGH)) ?? null;
  if (blob && blob.size > STUDENT_AVATAR_MAX_BYTES) {
    blob = (await encodeJpeg(STUDENT_AVATAR_SOURCE_JPEG_QUALITY_LOW)) ?? null;
  }

  let guard = 0;
  while (
    blob &&
    blob.size > STUDENT_AVATAR_MAX_BYTES &&
    guard < 14 &&
    Math.max(cw, ch) > 320
  ) {
    cw = Math.max(320, Math.round(cw * 0.85));
    ch = Math.max(320, Math.round(ch * 0.85));
    draw();
    blob =
      (await encodeJpeg(STUDENT_AVATAR_SOURCE_JPEG_QUALITY_LOW)) ?? null;
    guard += 1;
  }

  if (source instanceof ImageBitmap) {
    try {
      source.close();
    } catch {
      /* ignore */
    }
  }

  if (!blob || blob.size < 1) {
    return { ok: false, error: "Could not compress this image." };
  }
  if (blob.size > STUDENT_AVATAR_MAX_BYTES) {
    return {
      ok: false,
      error: "Image is still too large after compression. Try another photo.",
    };
  }

  const out = new File([blob], "photo.jpg", { type: "image/jpeg" });
  return { ok: true, file: out };
}

export const SCHOOL_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const SCHOOL_LOGO_MAX_DIM = 500;
export const SCHOOL_LOGO_JPEG_QUALITY = 0.8;

/**
 * Resizes to fit within {@link SCHOOL_LOGO_MAX_DIM} (aspect preserved) and/or
 * re-encodes to JPEG so the file is ≤ {@link SCHOOL_LOGO_MAX_BYTES}. Returns
 * the original file when it already meets both limits.
 */
export async function compressSchoolLogoSourceFile(
  file: File
): Promise<{ ok: true; file: File } | { ok: false; error: string }> {
  if (typeof document === "undefined") {
    return { ok: false, error: "Compression is only available in the browser." };
  }

  let source: HTMLImageElement | ImageBitmap | null = null;
  try {
    try {
      source = await createImageBitmap(file);
    } catch {
      source = await loadHtmlImageFromFile(file);
    }
  } catch {
    return { ok: false, error: "Could not read this image. Try a JPG or PNG file." };
  }

  const { w: sw, h: sh } = getDrawableSize(source);
  if (sw < 1 || sh < 1) {
    if (source instanceof ImageBitmap) source.close();
    return { ok: false, error: "This image appears to be empty." };
  }

  const needsDim = Math.max(sw, sh) > SCHOOL_LOGO_MAX_DIM;
  const needsSize = file.size > SCHOOL_LOGO_MAX_BYTES;

  if (!needsDim && !needsSize) {
    if (source instanceof ImageBitmap) {
      try {
        source.close();
      } catch {
        /* ignore */
      }
    }
    return { ok: true, file };
  }

  const scale = needsDim
    ? Math.min(1, SCHOOL_LOGO_MAX_DIM / Math.max(sw, sh))
    : 1;
  let cw = Math.max(1, Math.round(sw * scale));
  let ch = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (source instanceof ImageBitmap) source.close();
    return { ok: false, error: "Could not process this image." };
  }

  const encodeJpeg = (quality: number) =>
    new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });

  const draw = () => {
    canvas.width = cw;
    canvas.height = ch;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(source as CanvasImageSource, 0, 0, sw, sh, 0, 0, cw, ch);
  };

  draw();

  let quality = SCHOOL_LOGO_JPEG_QUALITY;
  let blob = (await encodeJpeg(quality)) ?? null;

  let guard = 0;
  while (
    blob &&
    blob.size > SCHOOL_LOGO_MAX_BYTES &&
    guard < 24 &&
    Math.max(cw, ch) > 48
  ) {
    if (quality > 0.45) {
      quality = Math.max(0.45, quality - 0.06);
    } else {
      cw = Math.max(48, Math.round(cw * 0.88));
      ch = Math.max(48, Math.round(ch * 0.88));
      draw();
      quality = SCHOOL_LOGO_JPEG_QUALITY;
    }
    blob = (await encodeJpeg(quality)) ?? null;
    guard += 1;
  }

  if (source instanceof ImageBitmap) {
    try {
      source.close();
    } catch {
      /* ignore */
    }
  }

  if (!blob || blob.size < 1) {
    return { ok: false, error: "Could not compress this image." };
  }
  if (blob.size > SCHOOL_LOGO_MAX_BYTES) {
    return {
      ok: false,
      error:
        "Image is still too large after compression. Try a smaller or simpler image.",
    };
  }

  const stem = file.name.replace(/\.[^.]+$/, "").trim() || "logo";
  const safeStem = stem.replace(/[^\w\-]+/g, "_").slice(0, 40) || "logo";
  const out = new File([blob], `${safeStem}.jpg`, { type: "image/jpeg" });
  return { ok: true, file: out };
}

export function canvasToWebpBlob(
  canvas: HTMLCanvasElement,
  quality = 0.92
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/webp", quality);
  });
}
