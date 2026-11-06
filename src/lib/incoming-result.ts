import { type DesignDocument } from "./document";
import { recipeToDocument, compositionKey } from "./design-recipe";
import { prepareReference, type ReferencePreview } from "./reference-import";

export const RESULT_TEXT_LIMIT = 2_000_000;
export function downloadedResultFile(value: unknown): File {
  if (!value || typeof value !== "object")
    throw new Error("The downloaded result is invalid. Choose the file again.");
  const { name, type, data } = value as Record<string, unknown>;
  if (
    Object.keys(value).length !== 3 ||
    typeof name !== "string" ||
    !name ||
    name.length > 120 ||
    /[\\/\p{Cc}\p{Cf}]/u.test(name) ||
    typeof type !== "string" ||
    !["image/png", "image/jpeg", "image/webp", "application/json"].includes(
      type,
    ) ||
    typeof data !== "string"
  )
    throw new Error(
      "The downloaded result is invalid. Choose a PNG, JPG, WebP or JSON file.",
    );
  const limit =
    type === "application/json" ? RESULT_TEXT_LIMIT : 5 * 1024 * 1024;
  if (
    !data ||
    data.length > Math.ceil(limit / 3) * 4 ||
    !/^[a-zA-Z0-9+/]+={0,2}$/.test(data)
  )
    throw new Error(
      "The downloaded result is too large or invalid. Choose the file again.",
    );
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  if (bytes.length > limit)
    throw new Error("The downloaded result is too large.");
  return new File([bytes], name, { type });
}
export type IncomingResult =
  | {
      kind: "recipe";
      raw: string;
      document: DesignDocument;
      composition: string;
    }
  | { kind: "reference"; preview: ReferencePreview };

export async function prepareResult(
  input: { text?: string; file?: File },
  doc: DesignDocument,
): Promise<IncomingResult> {
  let text = input.text ?? "";
  if (input.file) {
    const file = input.file;
    if (file.type === "application/json" || /\.json$/i.test(file.name)) {
      if (file.size > RESULT_TEXT_LIMIT)
        throw new Error("Recipe exceeds 2 MB.");
      text = await file.text();
      // JSON files must never fall back to written notes.
      const document = recipeToDocument(text, doc);
      return {
        kind: "recipe",
        raw: text,
        document,
        composition: compositionKey(doc),
      };
    }
    return {
      kind: "reference",
      preview: { ...(await prepareReference(file, text)), kind: "generated" },
    };
  }
  if (
    text.length > RESULT_TEXT_LIMIT ||
    new TextEncoder().encode(text).byteLength > RESULT_TEXT_LIMIT
  )
    throw new Error("Keep returned text or recipes under 2 MB.");
  const trimmed = text.trim();
  if (/^(\{|\[|```)/.test(trimmed)) {
    let document: DesignDocument;
    try {
      document = recipeToDocument(text, doc);
    } catch (error) {
      throw new Error(
        `This is not a valid Ranga recipe. ${error instanceof Error ? error.message : "Review the JSON."}`,
      );
    }
    return {
      kind: "recipe",
      raw: text,
      document,
      composition: compositionKey(doc),
    };
  }
  return {
    kind: "reference",
    preview: await prepareReference(undefined, text),
  };
}

// Only the Read clipboard button calls this. No polling or privileged fallback.
export async function readResultClipboard(): Promise<{
  text?: string;
  file?: File;
}> {
  let items: ClipboardItems;
  try {
    if (!navigator.clipboard?.read) {
      if (!navigator.clipboard?.readText) throw new Error("Unavailable");
      return { text: await navigator.clipboard.readText() };
    }
    items = await navigator.clipboard.read();
  } catch {
    throw new Error(
      "Clipboard access is unavailable. Focus the paste area and press Ctrl/Cmd+V, or choose a file.",
    );
  }
  if (!items.length) throw new Error("The clipboard is empty.");
  if (items.length > 1)
    throw new Error("Copy one result at a time, then preview it again.");
  const item = items[0];
  const mime = item.types.find((type) =>
    ["image/png", "image/jpeg", "image/webp"].includes(type),
  );
  if (mime) {
    const blob = await item.getType(mime);
    if (blob.size > 5 * 1024 * 1024)
      throw new Error("Choose an image smaller than 5 MB.");
    return { file: new File([blob], "Clipboard image", { type: mime }) };
  }
  if (item.types.includes("text/plain")) {
    const blob = await item.getType("text/plain");
    if (blob.size > RESULT_TEXT_LIMIT)
      throw new Error("Keep returned text or recipes under 2 MB.");
    const text = await blob.text();
    if (!text.trim()) throw new Error("The clipboard is empty.");
    return { text };
  }
  throw new Error(
    "The clipboard has no supported image or plain text. Choose a PNG, JPG, WebP or JSON file, or paste text.",
  );
}
