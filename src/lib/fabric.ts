export type FabricCheck = { file: File; previewUrl: string; warnings: string[] };

/** Downscale to max 1024px JPEG and flag dark / blurry / tiny images. */
export async function prepareFabric(input: File): Promise<FabricCheck> {
  const url = URL.createObjectURL(input);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("This file couldn't be read as an image. Try a JPG or PNG."));
    i.src = url;
  });
  const warnings: string[] = [];
  if (Math.min(img.width, img.height) < 300) warnings.push("This photo is small. Some pattern details may be lost.");
  const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  let sum = 0;
  for (let p = 0, i = 0; i < data.length; i += 4, p++) {
    const g = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    gray[p] = g;
    sum += g;
  }
  const mean = sum / gray.length;
  if (mean < 55) warnings.push("The photo looks too dark. Try brighter, even light.");
  let lap = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y += 2)
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      const v = 4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - w]! - gray[i + w]!;
      lap += v;
      lapSq += v * v;
      n++;
    }
  const variance = lapSq / n - (lap / n) ** 2;
  if (variance < 40) warnings.push("The photo may be blurry. Hold steady and focus on the pattern.");
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9));
  const file = new File([blob], "fabric.jpg", { type: "image/jpeg" });
  return { file, previewUrl: URL.createObjectURL(file), warnings };
}

export async function dataUrlToBlob(dataUrl: string) {
  return (await fetch(dataUrl)).blob();
}
