"use client";
import { useState } from "react";
import { ArrowUpRight, Copy, Upload, Check } from "lucide-react";
import { buildPrompt, emptyBrief, recipeToDocument } from "@/lib/design-recipe";
import type { DesignDocument, DesignBrief } from "@/lib/document";
import "@/lib/desktop-bridge";
export function CreativeHandoff({
  document: doc,
  onChange,
  onImport,
  onImage,
  readOnly = false,
}: {
  document: DesignDocument;
  onChange: (d: DesignDocument) => void;
  onImport: (d: DesignDocument) => Promise<boolean>;
  onImage: () => void;
  readOnly?: boolean;
}) {
  const [mode, setMode] = useState<"brief" | "import">("brief");
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<DesignDocument | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [applying, setApplying] = useState(false);
  const brief = doc.brief ?? emptyBrief;
  function field(key: keyof DesignBrief, label: string, multiline = false) {
    return (
      <label className="field" key={key}>
        <span>{label}</span>
        {multiline ? (
          <textarea
            disabled={readOnly}
            rows={3}
            value={brief[key]}
            maxLength={
              key === "supportingText" || key === "instructions" ? 3000 : 1000
            }
            onChange={(e) =>
              onChange({ ...doc, brief: { ...brief, [key]: e.target.value } })
            }
          />
        ) : (
          <input
            disabled={readOnly}
            value={brief[key]}
            maxLength={
              key === "graphicType" ? 100 : key === "typography" ? 200 : 500
            }
            onChange={(e) =>
              onChange({ ...doc, brief: { ...brief, [key]: e.target.value } })
            }
          />
        )}
      </label>
    );
  }
  return (
    <>
      <div className="panel-heading">
        <h2>Creative handoff</h2>
        <span>MANUAL</span>
      </div>
      <a
        className="button button-dark full-width"
        href="https://chatgpt.com/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open ChatGPT <ArrowUpRight size={14} />
      </a>
      <p className="quiet-note">
        Use your own account. Ranga never reads that session or sends this brief
        automatically.
      </p>
      <div className="team-tabs">
        <button
          className={mode === "brief" ? "active" : ""}
          onClick={() => setMode("brief")}
        >
          Design brief
        </button>
        <button
          className={mode === "import" ? "active" : ""}
          onClick={() => setMode("import")}
        >
          Import result
        </button>
      </div>
      {mode === "brief" ? (
        <>
          <label className="field">
            <span>Discovery query</span>
            <input
              disabled={readOnly}
              maxLength={500}
              value={doc.discoveryQuery ?? ""}
              onChange={(event) =>
                onChange({ ...doc, discoveryQuery: event.target.value })
              }
              placeholder="What do you want to design?"
            />
          </label>
          {field("graphicType", "Graphic type")}
          {field("headline", "Main headline")}
          {field("supportingText", "Supporting text", true)}
          {field("audience", "Audience")}
          {field("style", "Visual style", true)}
          {field("typography", "Typography preferences")}
          {field("instructions", "Additional instructions", true)}
          <p className="quiet-note">
            Canvas size, background, creative-direction notes, and selected
            reference descriptions are included. Attach images in ChatGPT
            yourself if you have permission.
          </p>
          <button
            className="button button-accent full-width"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(buildPrompt(doc));
                if (window.rangaBridge) window.rangaBridge.openChatGPT();
                else
                  window.open(
                    "https://chatgpt.com/",
                    "_blank",
                    "noopener,noreferrer",
                  );
                setCopied(true);
                setError("");
              } catch {
                setShowPrompt(true);
                setError(
                  "Clipboard access is unavailable. Select and copy the prompt below.",
                );
              }
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
            {copied ? "Prompt copied" : "Copy instructions & open ChatGPT"}
          </button>
          <button
            className="text-link"
            onClick={() => setShowPrompt(!showPrompt)}
          >
            {showPrompt ? "Hide prompt" : "Review generated prompt"}
          </button>
          {showPrompt && (
            <label className="field">
              <span>Generated prompt</span>
              <textarea
                readOnly
                rows={10}
                value={buildPrompt(doc)}
                onFocus={(e) => e.target.select()}
              />
            </label>
          )}
        </>
      ) : (
        <>
          <p className="panel-description">
            Paste a Ranga recipe from ChatGPT. Validation runs before anything
            changes. Import replaces the composition and keeps your references.
          </p>
          <label className="field">
            <span>Design recipe JSON</span>
            <textarea
              disabled={readOnly}
              rows={10}
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <label className="button button-outline full-width">
            <Upload size={14} /> Load JSON file
            <input
              hidden
              disabled={readOnly}
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 2_000_000) {
                    setError("Recipe exceeds 2 MB.");
                    return;
                  }
                  setRaw(await f.text());
                  setPreview(null);
                }
              }}
            />
          </label>
          <button
            disabled={readOnly}
            className="button button-dark full-width"
            onClick={() => {
              try {
                setPreview(recipeToDocument(raw, doc));
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Invalid recipe.");
              }
            }}
          >
            Validate recipe
          </button>
          {preview && (
            <div className="recipe-preview">
              <strong>{preview.title}</strong>
              <p>
                {preview.width} × {preview.height} · {preview.layers.length}{" "}
                editable layers
              </p>
              <button
                className="button button-accent full-width"
                disabled={readOnly || applying}
                onClick={async () => {
                  setApplying(true);
                  try {
                    if (await onImport(recipeToDocument(raw, doc))) {
                      setPreview(null);
                      setRaw("");
                    }
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Could not import recipe.",
                    );
                  } finally {
                    setApplying(false);
                  }
                }}
              >
                Apply validated design
              </button>
            </div>
          )}
          <button
            disabled={readOnly}
            className="button button-outline full-width"
            onClick={onImage}
          >
            Import image result
          </button>
          <p className="quiet-note">
            Image results become a single image layer. They are not
            automatically separated into text and shapes.
          </p>
          <a className="text-link" href="/ranga-recipe.schema.json" download>
            Download exact JSON schema
          </a>
        </>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
    </>
  );
}
