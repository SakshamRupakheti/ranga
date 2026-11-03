"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  Check,
  Trash2,
  Upload,
  ClipboardPaste,
} from "lucide-react";
import { sourceUrlSchema, type DesignDocument } from "@/lib/document";
import { readImage } from "@/lib/files";
type Reference = DesignDocument["references"][number];
export function ReferenceBoard({
  document: doc,
  onChange,
  onDirection,
  upload,
  readOnly = false,
}: {
  document: DesignDocument;
  onChange: (references: Reference[]) => void;
  onDirection: (value: string) => void;
  upload?: (src: string) => Promise<string>;
  readOnly?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState("");
  const [compare, setCompare] = useState(false);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const latest = useRef(doc.references);
  useEffect(() => {
    latest.current = doc.references;
  }, [doc.references]);
  async function addImage(image: File) {
    try {
      const data = await readImage(image);
      const src = upload ? await upload(data.src) : data.src;
      add({
        id: crypto.randomUUID(),
        name: image.name.slice(0, 120) || "Pasted image",
        src,
        selected: false,
        kind: "inspiration",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image could not be added.");
    }
  }
  function add(ref: Reference) {
    if (latest.current.length >= 12) {
      setError("Keep up to 12 references per project.");
      return;
    }
    onChange([...latest.current, ref]);
    setError("");
  }
  function change(id: string, updates: Partial<Reference>) {
    onChange(
      doc.references.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    );
  }
  function move(id: string, delta: number) {
    const refs = [...doc.references],
      index = refs.findIndex((r) => r.id === id);
    const [item] = refs.splice(index, 1);
    refs.splice(Math.max(0, Math.min(refs.length, index + delta)), 0, item);
    onChange(refs);
  }
  const shown = doc.references.filter(
    (r) => (!compare || r.selected) && (!filter || r.collection === filter),
  );
  return (
    <>
      <div className="panel-heading">
        <h2>Reference board</h2>
        <span>{doc.references.length}/12</span>
      </div>
      <a
        className="button button-outline full-width"
        href="https://www.pinterest.com/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open Pinterest <ArrowUpRight size={14} />
      </a>
      <p className="quiet-note">
        Browse in your own session. Source links are saved as links; Ranga does
        not fetch their images.
      </p>
      <fieldset disabled={readOnly}>
        <label className="field">
          <span>Source URL</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <label className="field">
          <span>Reference title</span>
          <input
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <button
          className="button button-dark full-width"
          onClick={() => {
            try {
              const sourceUrl = sourceUrlSchema.parse(url);
              add({
                id: crypto.randomUUID(),
                name: title || new URL(sourceUrl).hostname,
                sourceUrl,
                selected: false,
                kind: "inspiration",
              });
              setUrl("");
              setTitle("");
            } catch {
              setError("Enter a valid http or https source URL.");
            }
          }}
        >
          Save source link
        </button>
        <div className="two-buttons">
          <button
            className="button button-outline"
            onClick={() => file.current?.click()}
          >
            <Upload size={13} /> Image
          </button>
          <button
            className="button button-outline"
            onClick={async () => {
              try {
                const items = await navigator.clipboard.read();
                for (const item of items) {
                  const type = item.types.find((t) =>
                    ["image/png", "image/jpeg", "image/webp"].includes(t),
                  );
                  if (type) {
                    const blob = await item.getType(type);
                    await addImage(
                      new File([blob], "Clipboard image", { type }),
                    );
                    return;
                  }
                }
                setError("No supported image on the clipboard.");
              } catch {
                setError(
                  "Clipboard access was unavailable. Paste an image into the paste area below or upload a file.",
                );
              }
            }}
          >
            <ClipboardPaste size={13} /> Clipboard
          </button>
        </div>
        <div
          className="paste-zone"
          tabIndex={0}
          role="textbox"
          aria-label="Paste reference image"
          onPaste={(e) => {
            const f = [...e.clipboardData.files].find((f) =>
              f.type.startsWith("image/"),
            );
            if (f) {
              e.preventDefault();
              void addImage(f);
            }
          }}
        >
          Or focus here and paste an image
        </div>
        <input
          hidden
          aria-label="Upload reference image"
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void addImage(f);
          }}
        />
      </fieldset>
      <div className="reference-filters">
        <select
          aria-label="Reference collection"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All collections</option>
          {[
            ...new Set(doc.references.map((r) => r.collection).filter(Boolean)),
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button aria-pressed={compare} onClick={() => setCompare(!compare)}>
          {compare ? "Show all" : "Compare selected"}
        </button>
      </div>
      <div className={`moodboard ${compare ? "comparing" : ""}`}>
        {shown.map((r) => (
          <article
            className={`moodboard-card ${r.selected ? "selected" : ""}`}
            key={r.id}
          >
            <button
              disabled={readOnly}
              className="reference-visual"
              aria-label={`Select reference ${r.name}`}
              aria-pressed={r.selected}
              onClick={() => change(r.id, { selected: !r.selected })}
            >
              {r.src ? (
                <Image
                  src={r.src}
                  alt={r.name}
                  width={220}
                  height={150}
                  unoptimized
                />
              ) : (
                <span className="link-reference">
                  {r.name}
                  <ArrowUpRight size={22} />
                </span>
              )}
              {r.selected && (
                <span className="reference-check">
                  <Check size={13} />
                </span>
              )}
            </button>
            <div className="moodboard-details">
              <strong>{r.name}</strong>
              {r.sourceUrl && (
                <a
                  className="source-attribution"
                  href={r.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {new URL(r.sourceUrl).hostname} <ArrowUpRight size={11} />
                </a>
              )}
              <label className="field">
                <span>Notes</span>
                <textarea
                  disabled={readOnly}
                  rows={2}
                  value={r.note ?? ""}
                  maxLength={2000}
                  onChange={(e) => change(r.id, { note: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Collection</span>
                <input
                  disabled={readOnly}
                  value={r.collection ?? ""}
                  maxLength={80}
                  placeholder="Typography, color, layout…"
                  onChange={(e) => change(r.id, { collection: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Source link / attribution</span>
                <input
                  disabled={readOnly}
                  defaultValue={r.sourceUrl ?? ""}
                  onBlur={(e) => {
                    if (!e.target.value) return;
                    const result = sourceUrlSchema.safeParse(e.target.value);
                    if (result.success)
                      change(r.id, { sourceUrl: result.data });
                    else
                      setError(
                        "Source attribution must be an http or https URL.",
                      );
                  }}
                />
              </label>
              <label className="field">
                <span>Usage</span>
                <select
                  disabled={readOnly}
                  value={r.kind ?? "inspiration"}
                  onChange={(e) =>
                    change(r.id, { kind: e.target.value as Reference["kind"] })
                  }
                >
                  <option value="inspiration">Inspiration only</option>
                  <option value="owned">Owned / permitted asset</option>
                </select>
              </label>
              <div className="reference-actions">
                <button
                  disabled={readOnly}
                  aria-label={`Move ${r.name} up`}
                  onClick={() => move(r.id, -1)}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  disabled={readOnly}
                  aria-label={`Move ${r.name} down`}
                  onClick={() => move(r.id, 1)}
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  disabled={readOnly}
                  aria-label={`Remove reference ${r.name}`}
                  onClick={() =>
                    onChange(doc.references.filter((x) => x.id !== r.id))
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {compare && !shown.length && (
        <p className="quiet-note">
          Select references to compare their images and notes here.
        </p>
      )}
      <label className="field">
        <span>Creative direction</span>
        <textarea
          disabled={readOnly}
          rows={4}
          maxLength={5000}
          value={doc.direction}
          onChange={(e) => onDirection(e.target.value)}
          placeholder="What connects these references?"
        />
      </label>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
    </>
  );
}
