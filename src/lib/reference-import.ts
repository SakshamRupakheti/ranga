import {
  sourceUrlSchema,
  referenceSchema,
  type DesignDocument,
} from "./document";
import { readImage } from "./files";
export type Reference = DesignDocument["references"][number];
export type ReferencePreview = {
  src?: string;
  width?: number;
  height?: number;
  bytes?: number;
  name: string;
  sourceUrl: string;
  note: string;
  kind: NonNullable<Reference["kind"]>;
};

export async function prepareReference(
  file?: File,
  text = "",
): Promise<ReferencePreview> {
  if (file) {
    const image = await readImage(file);
    const source = sourceUrlSchema.safeParse(text.trim());
    return {
      ...image,
      bytes: file.size,
      name: file.name.slice(0, 120) || "Pasted image",
      sourceUrl: source.success ? source.data : "",
      note: "",
      kind: "inspiration",
    };
  }
  const parsed = referenceText(text);
  return {
    name: parsed.sourceUrl
      ? new URL(parsed.sourceUrl).hostname
      : "Written reference",
    sourceUrl: parsed.sourceUrl ?? "",
    note: parsed.note ?? "",
    kind: "inspiration",
  };
}

export function referenceText(raw: string): {
  sourceUrl?: string;
  note?: string;
} {
  if (raw.length > 2000)
    throw new Error(
      "Keep a reference link or description under 2,000 characters.",
    );
  const text = raw.trim();
  if (!text)
    throw new Error("Paste a source link or write a reference description.");
  const looksLikeUrl =
    /^(?:https?|javascript|data|file|vbscript|blob|ftp|mailto):/i.test(text) ||
    /^[a-z][a-z0-9+.-]*:\S/i.test(text);
  if (looksLikeUrl) {
    const url = sourceUrlSchema.safeParse(text);
    if (!url.success)
      throw new Error("Use an http or https source link without credentials.");
    return { sourceUrl: url.data };
  }
  if (text.startsWith("{") || text.startsWith("```"))
    throw new Error(
      "Use Creative tools → Bring into Ranga for a design recipe.",
    );
  return { note: text };
}

// Read only browser-provided plain text/URI-list data. Never parse drag HTML,
// fetch a URL, inspect the source website, or infer permission from its host.
export function transferText(
  data: Pick<DataTransfer, "getData">,
  maxTextLength = 2000,
): string {
  const list = data.getData("text/uri-list");
  if (list.length > 8000)
    throw new Error("The dropped link data is too large.");
  const urls = list
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (urls.length > 1) throw new Error("Preview one reference at a time.");
  const text = urls[0] || data.getData("text/plain");
  if (text.length > maxTextLength)
    throw new Error(
      `Keep the pasted text under ${maxTextLength.toLocaleString("en-US")} characters.`,
    );
  return text;
}

export function validateReferenceImport(value: unknown): Reference {
  const parsed = referenceSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "Review the reference title, description and source link. Source links must use http or https without credentials.",
    );
  const ref = parsed.data;
  if (ref.src && !ref.permissionConfirmed)
    throw new Error("Confirm that you have permission to import this image.");
  return ref;
}
