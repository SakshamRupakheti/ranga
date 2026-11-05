"use client";
import { useState, type ReactNode } from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  Check,
  Trash2,
  FileText,
} from "lucide-react";
import { sourceUrlSchema, type DesignDocument } from "@/lib/document";
import { ReferenceImport } from "./reference-import";
type Reference = DesignDocument["references"][number];
export function ReferenceBoard({
  document: doc,
  onChange,
  onDirection,
  onAdd,
  projectKey,
  compact = false,
  destination,
  readOnly = false,
}: {
  document: DesignDocument;
  onChange: (references: Reference[]) => void;
  onDirection: (value: string) => void;
  onAdd: (reference: Reference, projectKey: string) => Promise<void>;
  projectKey: string;
  compact?: boolean;
  destination: ReactNode;
  readOnly?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [compare, setCompare] = useState(false);
  const [error, setError] = useState("");
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
    <section
      className={`reference-board ${compact ? "reference-board-compact" : ""}`}
      aria-label="Project reference board"
    >
      <div className="panel-heading">
        <h2>Reference board</h2>
        <span>{doc.references.length}/12</span>
      </div>
      <div className="reference-board-columns">
        <div className="reference-compose">
          {destination}
          {!compact && (
            <a
              className="button button-outline full-width"
              href="https://www.pinterest.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Pinterest <ArrowUpRight size={14} />
            </a>
          )}
          <ReferenceImport
            key={`${projectKey}:${compact}`}
            projectKey={projectKey}
            readOnly={readOnly}
            onAdd={onAdd}
          />
        </div>
        <div className="reference-library">
          <div className="reference-filters">
            <select
              aria-label="Reference collection"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">All collections</option>
              {[
                ...new Set(
                  doc.references.map((r) => r.collection).filter(Boolean),
                ),
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
                      {r.sourceUrl ? (
                        <ArrowUpRight size={22} />
                      ) : (
                        <FileText size={22} />
                      )}
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
                      onChange={(e) =>
                        change(r.id, { collection: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Source link / attribution</span>
                    <input
                      disabled={readOnly}
                      defaultValue={r.sourceUrl ?? ""}
                      onBlur={(e) => {
                        if (!e.target.value) return;
                        const result = sourceUrlSchema.safeParse(
                          e.target.value,
                        );
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
                        change(r.id, {
                          kind: e.target.value as Reference["kind"],
                        })
                      }
                    >
                      <option value="inspiration">Inspiration only</option>
                      <option value="owned">Owned / permitted asset</option>
                      <option value="generated">Generated asset</option>
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
          {!doc.references.length && (
            <p className="quiet-note">
              Your references will appear here after you review and add them.
            </p>
          )}
        </div>
        <div className="reference-direction">
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
        </div>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
    </section>
  );
}
