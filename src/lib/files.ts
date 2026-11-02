export async function readImage(
  file: File,
): Promise<{ src: string; width: number; height: number }> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error(
      "Choose a PNG, JPG, or WebP image. SVG uploads are not supported yet.",
    );
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Choose an image smaller than 5 MB.");
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  bitmap.close();
  if (width * height > 24_000_000 || width > 10000 || height > 10000)
    throw new Error(
      "This image is too large. Use an image under 24 megapixels and 10,000 pixels per side.",
    );
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("The image could not be read."));
    r.readAsDataURL(file);
  });
  return { src, width, height };
}
export function download(data: Blob | string, filename: string) {
  const isBlob = data instanceof Blob;
  const url = isBlob ? URL.createObjectURL(data) : data;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  if (isBlob) setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function safeFilename(name: string) {
  return (
    name
      .replace(/[^a-z0-9 _-]/gi, "")
      .trim()
      .slice(0, 100) || "ranga-design"
  );
}
