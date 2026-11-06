import { documentSchema, newLayer, type DesignDocument } from "./document";
import { validateReferenceImport, type Reference } from "./reference-import";

export function imageResultLayer(
  doc: DesignDocument,
  reference: Reference,
  image: { src: string; width: number; height: number },
) {
  const valid = validateReferenceImport(reference);
  if (
    !valid.src ||
    !valid.permissionConfirmed ||
    !["owned", "generated"].includes(valid.kind ?? "")
  )
    throw new Error(
      "Choose Owned or Generated use and confirm permission before adding an image layer.",
    );
  if (doc.layers.length >= 200)
    throw new Error(
      "This project already has 200 layers. Remove a layer before importing another.",
    );
  if (
    !Number.isFinite(image.width) ||
    !Number.isFinite(image.height) ||
    image.width <= 0 ||
    image.height <= 0
  )
    throw new Error("The image dimensions are invalid.");
  const ratio = Math.min(
    1,
    (doc.width * 0.8) / image.width,
    (doc.height * 0.8) / image.height,
  );
  const width = image.width * ratio,
    height = image.height * ratio;
  const layer = newLayer("image", {
    name: valid.name,
    src: image.src,
    width,
    height,
    x: (doc.width - width) / 2,
    y: (doc.height - height) / 2,
    assetInfo: {
      kind: valid.kind as "owned" | "generated",
      permissionConfirmed: true,
      sourceUrl: valid.sourceUrl,
      note: valid.note,
      addedAt: new Date().toISOString(),
    },
  });
  documentSchema.parse({ ...doc, layers: [...doc.layers, layer] });
  return layer;
}
