"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Upload, ClipboardPaste } from "lucide-react";
import { readImage } from "@/lib/files";
import { sourceUrlSchema } from "@/lib/document";
import {
  referenceText,
  transferText,
  validateReferenceImport,
  type Reference,
} from "@/lib/reference-import";

type Preview = {
  src?: string;
  width?: number;
  height?: number;
  bytes?: number;
  name: string;
  sourceUrl: string;
  note: string;
  kind: NonNullable<Reference["kind"]>;
};
export function ReferenceImport({
  projectKey,
  readOnly,
  onAdd,
}: {
  projectKey: string;
  readOnly: boolean;
  onAdd: (reference: Reference, projectKey: string) => Promise<void>;
}) {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [permission, setPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("Checking image…");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const pending = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  function report(error: unknown) {
    setError(
      error instanceof Error
        ? error.message
        : "This reference could not be prepared.",
    );
  }
  function reset() {
    sequence.current++;
    setPreview(null);
    setPermission(false);
    setRaw("");
    setError("");
    setMessage("");
  }
  async function prepare(file?: File, text = raw) {
    if (readOnly || pending.current) return;
    const version = ++sequence.current;
    setPreview(null);
    setPermission(false);
    setError("");
    setMessage("");
    setBusy(true);
    setPhase("Checking image…");
    try {
      let next: Preview;
      if (file) {
        const image = await readImage(file);
        const source = sourceUrlSchema.safeParse(text.trim());
        next = {
          ...image,
          bytes: file.size,
          name: file.name.slice(0, 120) || "Pasted image",
          sourceUrl: source.success ? source.data : "",
          note: "",
          kind: "inspiration",
        };
      } else {
        const parsed = referenceText(text);
        next = {
          name: parsed.sourceUrl
            ? new URL(parsed.sourceUrl).hostname
            : "Written reference",
          sourceUrl: parsed.sourceUrl ?? "",
          note: parsed.note ?? "",
          kind: "inspiration",
        };
      }
      if (sequence.current === version) {
        setPreview(next);
        setMessage("Reference ready to review. Nothing has been added yet.");
      }
    } catch (error) {
      if (sequence.current === version) report(error);
    } finally {
      if (sequence.current === version) setBusy(false);
    }
  }
  function receive(data: DataTransfer) {
    if (readOnly || pending.current) return;
    try {
      if (data.files.length > 1)
        throw new Error("Preview one image at a time.");
      const file = data.files[0];
      const text = transferText(data);
      if (!file && !text)
        throw new Error(
          "No supported image or plain text was available. Paste a source link or choose a file.",
        );
      void prepare(file, text);
    } catch (error) {
      report(error);
    }
  }
  async function clipboardImage() {
    if (readOnly || pending.current) return;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const mime = item.types.find((type) =>
          ["image/png", "image/jpeg", "image/webp"].includes(type),
        );
        if (mime) {
          const blob = await item.getType(mime);
          await prepare(
            new File([blob], "Clipboard image", { type: mime }),
            "",
          );
          return;
        }
      }
      setError(
        "No supported image is on the clipboard. Paste a source link into the text field instead.",
      );
    } catch {
      setError(
        "Clipboard image access is unavailable. Focus the paste area and press Ctrl/Cmd+V, or choose a file.",
      );
    }
  }
  async function confirm() {
    if (!preview || readOnly || pending.current) return;
    pending.current = true;
    setBusy(true);
    setPhase("Adding reference…");
    setError("");
    const version = sequence.current;
    try {
      const ref = validateReferenceImport({
        id: crypto.randomUUID(),
        name: preview.name.trim() || "Reference",
        selected: false,
        ...(preview.src ? { src: preview.src } : {}),
        ...(preview.sourceUrl.trim()
          ? { sourceUrl: preview.sourceUrl.trim() }
          : {}),
        note: preview.note,
        kind: preview.kind,
        ...(preview.src && permission ? { permissionConfirmed: true } : {}),
        addedAt: new Date().toISOString(),
      });
      await onAdd(ref, projectKey);
      if (sequence.current === version) {
        reset();
        setMessage("Reference added. Your project saves automatically.");
      }
    } catch (error) {
      if (sequence.current === version) report(error);
    } finally {
      pending.current = false;
      if (sequence.current === version || sequence.current === version + 1)
        setBusy(false);
    }
  }
  return (
    <section className="reference-import" aria-label="Add a reference">
      {readOnly && (
        <p className="quiet-note">
          This project is read-only. Choose a project you can edit to add
          references.
        </p>
      )}
      {!preview ? (
        <fieldset disabled={readOnly || busy}>
          <div className="two-buttons">
            <button
              className="button button-outline"
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={13} /> Image
            </button>
            <button
              className="button button-outline"
              onClick={() => void clipboardImage()}
            >
              <ClipboardPaste size={13} /> Clipboard
            </button>
          </div>
          <div
            className="paste-zone reference-drop-zone"
            tabIndex={readOnly ? -1 : 0}
            role="textbox"
            aria-label="Drop or paste reference"
            aria-disabled={readOnly || busy}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect =
                readOnly || busy ? "none" : "copy";
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!busy) receive(event.dataTransfer);
            }}
            onPaste={(event) => {
              event.preventDefault();
              if (!busy) receive(event.clipboardData);
            }}
          >
            Drop a supported image or link here. Or focus here and paste with
            Ctrl/Cmd+V.
          </div>
          <label className="field">
            <span>Source link or written reference</span>
            <textarea
              rows={3}
              maxLength={2000}
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              placeholder="https://… or describe the typography, color, or layout"
            />
          </label>
          <button
            className="button button-dark full-width"
            onClick={() => void prepare()}
            disabled={readOnly || busy || !raw.trim()}
          >
            Preview reference
          </button>
          <p className="quiet-note">
            Links, including image links, stay links. No image is downloaded
            from a source URL.
          </p>
        </fieldset>
      ) : (
        <fieldset disabled={readOnly || busy} className="reference-preview">
          {preview.src ? (
            <>
              <Image
                className="reference-preview-image"
                src={preview.src}
                width={preview.width!}
                height={preview.height!}
                alt="Reference import preview"
                unoptimized
              />
              <p className="quiet-note">
                {preview.width} × {preview.height} ·{" "}
                {Math.ceil(preview.bytes! / 1024)} KB · Raster image
              </p>
            </>
          ) : (
            <p className="quiet-note">
              {preview.sourceUrl
                ? "Source link only. No image will be fetched."
                : "Written reference. No image will be imported."}
            </p>
          )}
          <label className="field">
            <span>Reference title</span>
            <input
              maxLength={120}
              value={preview.name}
              onChange={(event) =>
                setPreview({ ...preview, name: event.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Source URL / attribution</span>
            <input
              type="url"
              maxLength={2000}
              value={preview.sourceUrl}
              onChange={(event) =>
                setPreview({ ...preview, sourceUrl: event.target.value })
              }
              placeholder="Optional http(s) source link"
            />
          </label>
          <label className="field">
            <span>Reference description</span>
            <textarea
              maxLength={2000}
              rows={2}
              value={preview.note}
              onChange={(event) =>
                setPreview({ ...preview, note: event.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Reference use</span>
            <select
              value={preview.kind}
              onChange={(event) =>
                setPreview({
                  ...preview,
                  kind: event.target.value as Preview["kind"],
                })
              }
            >
              <option value="inspiration">Inspiration only</option>
              <option value="owned">Owned or licensed image</option>
              <option value="generated">Generated asset</option>
            </select>
          </label>
          {preview.src && (
            <label className="reference-permission">
              <input
                type="checkbox"
                checked={permission}
                onChange={(event) => setPermission(event.target.checked)}
              />{" "}
              I have permission to import this image.
            </label>
          )}
          <p className="quiet-note">
            Inspiration does not grant reproduction rights. Generated images
            remain raster images.
          </p>
          <div className="two-buttons">
            <button
              className="button button-accent"
              disabled={busy || readOnly || (!!preview.src && !permission)}
              onClick={() => void confirm()}
            >
              Add reference
            </button>
            <button className="button button-outline" onClick={reset}>
              Cancel preview
            </button>
          </div>
        </fieldset>
      )}
      <input
        hidden
        aria-label="Upload reference image"
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={readOnly || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void prepare(file, "");
        }}
      />
      {busy && (
        <p role="status" className="quiet-note">
          {phase}
        </p>
      )}
      {message && (
        <p role="status" className="quiet-note">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
    </section>
  );
}
