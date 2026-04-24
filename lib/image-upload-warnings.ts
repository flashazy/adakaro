/** Soft validation only — callers show toasts; uploads are never blocked by these rules. */

const MIN_DIMENSION_PX = 200;
const MAX_ASPECT_RATIO = 3;

export const IMAGE_SMALL_WARNING =
  "Image is small (less than 200x200px). May appear blurry on report cards. Recommend uploading a larger image.";

export const IMAGE_EXTREME_ASPECT_WARNING =
  "Image is very wide or tall. It may look small on report cards. Consider cropping to a more balanced shape.";

export function getImageSoftUploadWarningsForDimensions(
  width: number,
  height: number
): string[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return [];
  }
  const messages: string[] = [];
  if (width < MIN_DIMENSION_PX || height < MIN_DIMENSION_PX) {
    messages.push(IMAGE_SMALL_WARNING);
  }
  const ratio = width / height;
  if (ratio > MAX_ASPECT_RATIO || height / width > MAX_ASPECT_RATIO) {
    messages.push(IMAGE_EXTREME_ASPECT_WARNING);
  }
  return messages;
}

export function measureImageFileDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

/** Returns 0–2 user-facing warning strings. Fails open (empty array) if the file cannot be decoded. */
export async function getImageSoftUploadWarningsFromFile(
  file: File
): Promise<string[]> {
  try {
    const { width, height } = await measureImageFileDimensions(file);
    return getImageSoftUploadWarningsForDimensions(width, height);
  } catch {
    return [];
  }
}
