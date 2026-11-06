"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import type { DesignDocument } from "@/lib/document";
import { renderDesignPreview } from "@/lib/fabric-scene";

export function DesignPreview({
  document: doc,
  onRendered,
}: {
  document: DesignDocument;
  onRendered: (doc: DesignDocument | null) => void;
}) {
  const [result, setResult] = useState<{
    document: DesignDocument;
    src?: string;
    error?: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void renderDesignPreview(doc, controller.signal)
      .then((src) => {
        if (!controller.signal.aborted) {
          setResult({ document: doc, src });
          onRendered(doc);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            document: doc,
            error:
              error instanceof Error
                ? error.message
                : "The preview could not be rendered.",
          });
          onRendered(null);
        }
      });
    return () => controller.abort();
  }, [doc, attempt, onRendered]);
  const current = result?.document === doc ? result : null;
  return (
    <figure className="design-preview">
      {current?.src ? (
        <Image
          unoptimized
          src={current.src}
          width={doc.width}
          height={doc.height}
          alt={`Design preview: ${doc.title}`}
        />
      ) : current?.error ? (
        <div>
          <p role="alert">{current.error}</p>
          <button
            className="text-link"
            onClick={() => {
              setResult(null);
              setAttempt((value) => value + 1);
            }}
          >
            Retry preview
          </button>
        </div>
      ) : (
        <p role="status">Rendering design preview…</p>
      )}
      <figcaption>
        {doc.width} × {doc.height} px · {doc.layers.length} editable layer
        {doc.layers.length === 1 ? "" : "s"}
      </figcaption>
    </figure>
  );
}
