export async function readImage(
  file: File,
): Promise<{ src: string; width: number; height: number }> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error(
      "Choose a PNG, JPG, or WebP image. SVG uploads are not supported yet.",
    );
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Choose an image smaller than 5 MB.");
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const signatureMatches =
    file.type === "image/png"
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => header[i] === byte)
      : file.type === "image/jpeg"
        ? header[0] === 255 && header[1] === 216 && header[2] === 255
        : String.fromCharCode(...header.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...header.slice(8, 12)) === "WEBP";
  if (!signatureMatches)
    throw new Error(
      "The image contents do not match its PNG, JPG, or WebP type.",
    );
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

export function embeddedImageFile(src: string, name: string): File {
  if (src.length > 7_000_000)
    throw new Error("Choose an image smaller than 5 MB.");
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(src);
  if (!match) throw new Error("Choose a PNG, JPG, or WebP image.");
  const bytes = Uint8Array.from(atob(match[2]), (character) =>
    character.charCodeAt(0),
  );
  return new File([bytes], name, { type: match[1] });
}
export function safeFilename(name: string) {
  return (
    name
      .replace(/[^a-z0-9 _-]/gi, "")
      .trim()
      .slice(0, 100) || "ranga-design"
  );
}
