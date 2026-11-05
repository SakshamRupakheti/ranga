"use client";
import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, Upload } from "lucide-react";
import type { DesignDocument } from "@/lib/document";
import { compositionKey } from "@/lib/design-recipe";
import {
  prepareResult,
  readResultClipboard,
  RESULT_TEXT_LIMIT,
  type IncomingResult,
} from "@/lib/incoming-result";
import { transferText, type Reference } from "@/lib/reference-import";
import { ReferenceImport } from "./reference-import";

export type RecipeImportRequest = {
  raw: string;
  projectKey: string;
  composition: string;
};
export function BringIntoRanga({
  document: doc,
  projectKey,
  readOnly,
  onImport,
  onReference,
}: {
  document: DesignDocument;
  projectKey: string;
  readOnly: boolean;
  onImport: (request: RecipeImportRequest) => Promise<void>;
  onReference: (reference: Reference, projectKey: string) => Promise<void>;
}) {
  const [raw, setRaw] = useState("");
  const [incoming, setIncoming] = useState<IncomingResult | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const sequence = useRef(0);
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
        : "The result could not be prepared.",
    );
  }
  function cancel() {
    sequence.current++;
    setIncoming(null);
    setRaw("");
    setError("");
    setMessage("");
  }
  async function preview(input: { text?: string; file?: File } | "clipboard") {
    if (readOnly || pending.current) return;
    const version = ++sequence.current;
    pending.current = true;
    setBusy(true);
    setIncoming(null);
    setError("");
    setMessage("");
    try {
      const provided =
        input === "clipboard" ? await readResultClipboard() : input;
      const result = await prepareResult(provided, doc);
      if (version !== sequence.current) return;
      setIncoming(result);
      setRaw("");
      setMessage(
        result.kind === "recipe"
          ? "Recipe validated. Review the replacement before applying it."
          : "Reference ready to review. Nothing has been added yet.",
      );
    } catch (error) {
      if (version === sequence.current) report(error);
    } finally {
      pending.current = false;
      if (version === sequence.current) setBusy(false);
    }
  }
  function receive(data: DataTransfer) {
    if (readOnly || pending.current) return;
    try {
      if (data.files.length > 1)
        throw new Error("Preview one result at a time.");
      const file = data.files[0];
      const text = transferText(data, RESULT_TEXT_LIMIT);
      if (!file && !text)
        throw new Error(
          "No supported file or plain text was provided. Paste text or choose a file.",
        );
      void preview({ file, text });
    } catch (error) {
      report(error);
    }
  }
  const stale =
    incoming?.kind === "recipe" && incoming.composition !== compositionKey(doc);
  return (
    <section className="bring-into-ranga" aria-label="Bring into Ranga">
      <h3>Bring into Ranga</h3>
      <p className="quiet-note">
        Destination: {doc.title}
        {readOnly ? " · Read-only" : ""}
      </p>
      {readOnly && (
        <p className="quiet-note">
          Only an owner or editor can add a result to this project.
        </p>
      )}
      {!incoming ? (
        <fieldset disabled={readOnly || busy}>
          <p className="panel-description">
            Paste a returned recipe, source link or description, or choose a
            JSON or image file. Review it before anything changes.
          </p>
          <div className="two-buttons">
            <button
              className="button button-outline"
              onClick={() => void preview("clipboard")}
            >
              <ClipboardPaste size={13} /> Read clipboard
            </button>
            <button
              className="button button-outline"
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={13} /> Choose file
            </button>
          </div>
          <div
            className="paste-zone reference-drop-zone"
            role="textbox"
            tabIndex={readOnly ? -1 : 0}
            aria-label="Paste a result into Ranga"
            aria-disabled={readOnly || busy}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect =
                readOnly || busy ? "none" : "copy";
            }}
            onDrop={(event) => {
              event.preventDefault();
              receive(event.dataTransfer);
            }}
            onPaste={(event) => {
              event.preventDefault();
              receive(event.clipboardData);
            }}
          >
            Focus here and paste with Ctrl/Cmd+V, or drop one supported file or
            link.
          </div>
          <label className="field">
            <span>Returned text or recipe</span>
            <textarea
              rows={7}
              maxLength={RESULT_TEXT_LIMIT}
              value={raw}
              onChange={(event) => {
                setRaw(event.target.value);
                setError("");
              }}
            />
          </label>
          <button
            className="button button-dark full-width"
            disabled={readOnly || busy || !raw.trim()}
            onClick={() => void preview({ text: raw })}
          >
            Preview result
          </button>
          <p className="quiet-note">
            Recipes replace the composition after a checkpoint. Links,
            descriptions and images become references. Images stay raster
            images.
          </p>
        </fieldset>
      ) : incoming.kind === "reference" ? (
        <ReferenceImport
          projectKey={projectKey}
          initialPreview={incoming.preview}
          readOnly={readOnly}
          onCancel={cancel}
          onAdd={async (reference, key) => {
            await onReference(reference, key);
            cancel();
            setMessage(
              "Reference added. It is available in your reference board.",
            );
          }}
        />
      ) : (
        <div className="recipe-preview">
          <strong>{incoming.document.title}</strong>
          <p>
            {incoming.document.width} × {incoming.document.height} ·{" "}
            {incoming.document.layers.length} editable layers
          </p>
          <p className="quiet-note">
            Replaces the current {doc.layers.length} layers, canvas size,
            background and title. References, brief and change instructions
            stay. A saved version and Undo provide recovery.
          </p>
          {stale && (
            <p role="alert" className="error-banner">
              The composition changed since this preview. Preview it again
              before applying.
            </p>
          )}
          <button
            className="button button-accent full-width"
            disabled={readOnly || busy || stale}
            onClick={async () => {
              if (pending.current) return;
              pending.current = true;
              setBusy(true);
              setError("");
              const version = sequence.current;
              try {
                await onImport({
                  raw: incoming.raw,
                  projectKey,
                  composition: incoming.composition,
                });
                if (version === sequence.current) {
                  cancel();
                  setMessage(
                    "Validated design imported. Your previous version is saved in History.",
                  );
                }
              } catch (error) {
                if (version === sequence.current) report(error);
              } finally {
                pending.current = false;
                if (
                  version === sequence.current ||
                  version + 1 === sequence.current
                )
                  setBusy(false);
              }
            }}
          >
            Apply validated design
          </button>
          <div className="two-buttons">
            <button
              disabled={readOnly || busy}
              className="button button-outline"
              onClick={() => void preview({ text: incoming.raw })}
            >
              Preview again
            </button>
            <button
              disabled={busy}
              className="button button-outline"
              onClick={cancel}
            >
              Cancel preview
            </button>
          </div>
        </div>
      )}
      <input
        ref={fileInput}
        hidden
        aria-label="Choose result file"
        type="file"
        accept=".json,application/json,image/png,image/jpeg,image/webp"
        disabled={readOnly || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void preview({ file });
        }}
      />
      {busy && (
        <p role="status" className="quiet-note">
          {incoming?.kind === "recipe"
            ? "Saving a checkpoint and applying…"
            : "Preparing your preview…"}
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
      <a className="text-link" href="/ranga-recipe.schema.json" download>
        Download exact JSON schema
      </a>
    </section>
  );
}
