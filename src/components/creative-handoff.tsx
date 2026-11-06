"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { emptyBrief } from "@/lib/design-recipe";
import type { DesignDocument, DesignBrief } from "@/lib/document";
import type { Reference } from "@/lib/reference-import";
import { ChangeInstructionFields } from "./change-instructions";
import { PromptHandoff } from "./prompt-handoff";
import { BringIntoRanga, type RecipeImportRequest } from "./bring-into-ranga";

export function CreativeHandoff({
  document: doc,
  projectKey,
  onChange,
  onImport,
  onReference,
  onCanvas,
  readOnly = false,
  initialMode = "brief",
  downloadedFile,
}: {
  document: DesignDocument;
  projectKey: string;
  onChange: (document: DesignDocument) => void;
  onImport: (request: RecipeImportRequest) => Promise<void>;
  onReference: (reference: Reference, projectKey: string) => Promise<void>;
  onCanvas: (reference: Reference, projectKey: string) => Promise<void>;
  readOnly?: boolean;
  initialMode?: "brief" | "import";
  downloadedFile?: File;
}) {
  const [mode, setMode] = useState(initialMode);
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
            onChange={(event) =>
              onChange({
                ...doc,
                brief: { ...brief, [key]: event.target.value },
              })
            }
          />
        ) : (
          <input
            disabled={readOnly}
            value={brief[key]}
            maxLength={
              key === "graphicType" ? 100 : key === "typography" ? 200 : 500
            }
            onChange={(event) =>
              onChange({
                ...doc,
                brief: { ...brief, [key]: event.target.value },
              })
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
          Bring into Ranga
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
          <ChangeInstructionFields
            value={doc.changeInstructions}
            readOnly={readOnly}
            onChange={(changeInstructions) =>
              onChange({ ...doc, changeInstructions })
            }
          />
          <PromptHandoff document={doc} />
        </>
      ) : (
        <BringIntoRanga
          document={doc}
          projectKey={projectKey}
          readOnly={readOnly}
          onImport={onImport}
          onReference={onReference}
          onCanvas={onCanvas}
          downloadedFile={downloadedFile}
        />
      )}
    </>
  );
}
