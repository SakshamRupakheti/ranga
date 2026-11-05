"use client";
import { useState } from "react";
import { Copy } from "lucide-react";
import type { DesignDocument } from "@/lib/document";
import { buildPrompt } from "@/lib/design-recipe";
import "@/lib/desktop-bridge";

export function PromptHandoff({ document: doc }: { document: DesignDocument }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copying, setCopying] = useState(false);
  const prompt = buildPrompt(doc);
  const selected = doc.references.filter((reference) => reference.selected);
  return (
    <section className="prompt-handoff" aria-label="ChatGPT handoff">
      <p className="quiet-note">
        {selected.length} selected reference{selected.length === 1 ? "" : "s"} ·{" "}
        {doc.width} × {doc.height} px. The prompt includes your brief, changes
        and reference descriptions.
      </p>
      {!!selected.length && (
        <ul className="selected-reference-names">
          {selected.map((reference) => (
            <li key={reference.id}>
              {reference.name} ·{" "}
              {reference.kind === "generated"
                ? "Generated"
                : reference.kind === "owned"
                  ? "Owned/licensed"
                  : "Inspiration"}
            </li>
          ))}
        </ul>
      )}
      <button
        className="button button-accent full-width"
        disabled={copying}
        onClick={async () => {
          setCopying(true);
          setError("");
          setCopiedPrompt(null);
          try {
            await navigator.clipboard.writeText(prompt);
            setCopiedPrompt(prompt);
            if (window.rangaBridge) window.rangaBridge.openChatGPT();
            else
              window.open(
                "https://chatgpt.com/",
                "_blank",
                "noopener,noreferrer",
              );
          } catch {
            setShowPrompt(true);
            setError(
              "Clipboard access is unavailable. Select and copy the prompt below, then open ChatGPT.",
            );
          } finally {
            setCopying(false);
          }
        }}
      >
        <Copy size={14} /> Copy instructions &amp; open ChatGPT
      </button>
      {copiedPrompt === prompt && (
        <p role="status" className="quiet-note">
          Instructions copied. Paste and send them yourself in ChatGPT.
        </p>
      )}
      <p className="quiet-note">
        Images are not attached automatically. Download permitted owned or
        generated references from their cards, then attach them in ChatGPT
        yourself.
      </p>
      <button className="text-link" onClick={() => setShowPrompt(!showPrompt)}>
        {showPrompt ? "Hide prompt" : "Review generated prompt"}
      </button>
      {showPrompt && (
        <label className="field">
          <span>Generated prompt</span>
          <textarea
            readOnly
            rows={10}
            value={prompt}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
    </section>
  );
}
