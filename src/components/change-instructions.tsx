"use client";
import type { ChangeInstructions } from "@/lib/document";
const fields = [
  ["preserve", "Elements to keep", 1500],
  ["replace", "Elements to change", 1500],
  ["text", "Text changes", 1500],
  ["logo", "Logo changes", 1000],
  ["colors", "Color changes", 1000],
  ["layout", "Layout changes", 1500],
  ["originality", "Originality requirements", 1500],
] as const;
export function ChangeInstructionFields({
  value,
  onChange,
  readOnly,
}: {
  value?: ChangeInstructions;
  onChange: (value: ChangeInstructions) => void;
  readOnly: boolean;
}) {
  const field = ([key, label, limit]: (typeof fields)[number]) => (
    <label className="field" key={key}>
      <span>{label}</span>
      <textarea
        rows={2}
        disabled={readOnly}
        maxLength={limit}
        value={value?.[key] ?? ""}
        onChange={(event) => onChange({ ...value, [key]: event.target.value })}
      />
    </label>
  );
  return (
    <section className="change-instructions" aria-label="Changes for ChatGPT">
      <h3>Changes for ChatGPT</h3>
      {fields.slice(0, 2).map(field)}
      <details>
        <summary>Text, logo, color and layout details</summary>
        {fields.slice(2).map(field)}
      </details>
    </section>
  );
}
