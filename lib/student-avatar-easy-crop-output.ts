import type { Area } from "react-easy-crop";

function getRadianAngle(degreeValue: number): number {
  return (degreeValue * Math.PI) / 180;
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Image load failed")));
    image.src = src;
  });
}

/**
 * Paints the region returned by react-easy-crop as `croppedAreaPixels` (with the
 * same `rotation` passed to the Cropper) into a square canvas.
 */
export async function renderStudentAvatarEasyCropToCanvas(
  imageSrc: string,
  pixelCrop: Area,
  rotation: number,
  outputSize: number
): Promise<HTMLCanvasElement | null> {
  if (typeof document === "undefined") return null;

  let image: HTMLImageElement;
  try {
    image = await loadImage(imageSrc);
  } catch {
    return null;
  }

  const srcCanvas = document.createElement("canvas");
  const srcCtx = srcCanvas.getContext("2d");
  if (!srcCtx) return null;

  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.naturalWidth,
    image.naturalHeight,
    rotation
  );

  srcCanvas.width = Math.max(1, Math.round(bBoxWidth));
  srcCanvas.height = Math.max(1, Math.round(bBoxHeight));

  srcCtx.translate(srcCanvas.width / 2, srcCanvas.height / 2);
  srcCtx.rotate(getRadianAngle(rotation));
  srcCtx.translate(-image.naturalWidth / 2, -image.naturalHeight / 2);
  srcCtx.drawImage(image, 0, 0);

  const out = document.createElement("canvas");
  out.width = outputSize;
  out.height = outputSize;
  const octx = out.getContext("2d");
  if (!octx) return null;

  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(
    srcCanvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return out;
}
