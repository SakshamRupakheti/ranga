"use client";
import {
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import type { Layer, DesignDocument } from "@/lib/document";
type Props = {
  layer: Layer | undefined;
  document: DesignDocument;
  onChange: (changes: Partial<Layer>) => void;
  onDocument: (changes: Partial<DesignDocument>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReorder: (direction: number) => void;
  onReplace: () => void;
};
export function NumberField({
  label,
  value,
  onChange,
  min = -20000,
  max = 20000,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={Math.round(value * 100) / 100}
        onChange={(e) => {
          if (e.target.value === "") return;
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
        }}
      />
    </label>
  );
}
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="color-field">
        <input
          aria-label={label}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span>{value.toUpperCase()}</span>
      </div>
    </label>
  );
}
export function Properties({
  layer: l,
  document: d,
  onChange,
  onDocument,
  onDuplicate,
  onDelete,
  onReorder,
  onReplace,
}: Props) {
  return (
    <section className="properties">
      <div className="panel-heading">
        <h2>{l ? "Properties" : "Canvas"}</h2>
        <span>
          {l ? (l.type === "image" ? "Raster image" : l.type) : "DOCUMENT"}
        </span>
      </div>
      {l ? (
        <>
          {l.type === "image" && (
            <div className="asset-attribution">
              <p className="quiet-note">
                Raster image. Move, resize or replace it; internal text and
                shapes are flattened.
              </p>
              {l.assetInfo && (
                <>
                  <p className="quiet-note">
                    {l.assetInfo.kind === "generated"
                      ? "Generated asset"
                      : "Owned / licensed asset"}{" "}
                    · Permission confirmed
                  </p>
                  {l.assetInfo.sourceUrl && (
                    <a
                      className="text-link"
                      href={l.assetInfo.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View image source
                    </a>
                  )}
                  {l.assetInfo.note && (
                    <p className="quiet-note">{l.assetInfo.note}</p>
                  )}
                </>
              )}
            </div>
          )}
          <label className="field">
            <span>Layer name</span>
            <input
              disabled={l.locked}
              value={l.name}
              onChange={(e) => onChange({ name: e.target.value.slice(0, 120) })}
            />
          </label>
          <fieldset disabled={l.locked}>
            <legend className="sr-only">Layer properties</legend>
            <div className="field-grid">
              <NumberField
                label="X position"
                value={l.x}
                onChange={(x) => onChange({ x })}
              />
              <NumberField
                label="Y position"
                value={l.y}
                onChange={(y) => onChange({ y })}
              />
              <NumberField
                label="Width"
                min={1}
                value={l.width}
                onChange={(width) => onChange({ width })}
              />
              {l.type !== "text" && (
                <NumberField
                  label="Height"
                  min={1}
                  value={l.height}
                  onChange={(height) => onChange({ height })}
                />
              )}
              <NumberField
                label="Rotation"
                min={-360}
                max={360}
                value={l.angle}
                onChange={(angle) => onChange({ angle })}
              />
            </div>
            {l.type === "text" && (
              <div className="property-group">
                <h3>Typography</h3>
                <label className="field">
                  <span>Text content</span>
                  <textarea
                    aria-label="Text content"
                    rows={3}
                    value={l.text}
                    onChange={(e) =>
                      onChange({ text: e.target.value.slice(0, 20000) })
                    }
                  />
                </label>
                <label className="field">
                  <span>Typeface</span>
                  <select
                    value={l.fontFamily}
                    onChange={(e) =>
                      onChange({
                        fontFamily: e.target.value as Layer["fontFamily"],
                      })
                    }
                  >
                    {["Arial", "Georgia", "Courier New", "Impact"].map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <div className="field-grid">
                  <NumberField
                    label="Font size"
                    value={l.fontSize ?? 40}
                    min={6}
                    max={1000}
                    onChange={(fontSize) => onChange({ fontSize })}
                  />
                  <NumberField
                    label="Letter spacing"
                    value={l.charSpacing ?? 0}
                    min={-200}
                    max={2000}
                    step={10}
                    onChange={(charSpacing) => onChange({ charSpacing })}
                  />
                </div>
                <NumberField
                  label="Line height"
                  value={l.lineHeight ?? 1.04}
                  min={0.5}
                  max={4}
                  step={0.05}
                  onChange={(lineHeight) => onChange({ lineHeight })}
                />
                <div className="segmented">
                  <button
                    className={l.fontWeight === "bold" ? "active" : ""}
                    aria-label="Bold text"
                    aria-pressed={l.fontWeight === "bold"}
                    onClick={() =>
                      onChange({
                        fontWeight: l.fontWeight === "bold" ? "normal" : "bold",
                      })
                    }
                  >
                    <b>B</b>
                  </button>
                  {(["left", "center", "right"] as const).map((align, i) => {
                    const Icon = [AlignLeft, AlignCenter, AlignRight][i];
                    return (
                      <button
                        key={align}
                        className={l.textAlign === align ? "active" : ""}
                        aria-label={`Align ${align}`}
                        aria-pressed={l.textAlign === align}
                        onClick={() => onChange({ textAlign: align })}
                      >
                        <Icon size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {l.type !== "image" ? (
              <ColorField
                label="Fill color"
                value={l.fill}
                onChange={(fill) => onChange({ fill })}
              />
            ) : (
              <button
                className="button button-outline full-width"
                onClick={onReplace}
              >
                Replace image
              </button>
            )}
            <NumberField
              label="Opacity (%)"
              value={l.opacity * 100}
              min={0}
              max={100}
              onChange={(v) => onChange({ opacity: v / 100 })}
            />
            <div className="property-group">
              <h3>Arrange</h3>
              <div className="two-buttons">
                <button
                  className="button button-outline"
                  onClick={() => onReorder(1)}
                >
                  <ArrowUp size={14} /> Forward
                </button>
                <button
                  className="button button-outline"
                  onClick={() => onReorder(-1)}
                >
                  <ArrowDown size={14} /> Back
                </button>
              </div>
              <div className="two-buttons">
                <button className="button button-outline" onClick={onDuplicate}>
                  <Copy size={14} /> Duplicate
                </button>
                <button
                  className="button button-outline danger"
                  onClick={onDelete}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </fieldset>
          {l.locked && (
            <p className="quiet-note">
              Unlock this layer in the Layers panel to edit it.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="panel-description">
            A space for your composition.
            <br />
            Select an element to refine it.
          </p>
          <div className="field-grid">
            <NumberField
              label="Canvas width"
              value={d.width}
              min={100}
              max={4096}
              onChange={(width) => onDocument({ width: Math.round(width) })}
            />
            <NumberField
              label="Canvas height"
              value={d.height}
              min={100}
              max={4096}
              onChange={(height) => onDocument({ height: Math.round(height) })}
            />
          </div>
          <label className="field">
            <span>Size presets</span>
            <select
              defaultValue=""
              onChange={(e) => {
                const [width, height] = e.target.value.split("x").map(Number);
                if (width && height) onDocument({ width, height });
              }}
            >
              <option value="" disabled>
                Choose a format
              </option>
              <option value="1080x1080">Social square · 1080 × 1080</option>
              <option value="1080x1920">Story · 1080 × 1920</option>
              <option value="900x1200">Poster · 900 × 1200</option>
              <option value="1920x1080">Landscape · 1920 × 1080</option>
            </select>
          </label>
          <ColorField
            label="Background"
            value={d.background}
            onChange={(background) => onDocument({ background })}
          />
          <div className="canvas-tips">
            <h3>A few useful moves</h3>
            <p>Double-click text to type directly.</p>
            <p>Drag a corner to resize. Use the top handle to rotate.</p>
            <p>Hold Shift to select multiple elements.</p>
            <p>
              Use the layer list and property fields for precise keyboard
              editing.
            </p>
            <div>
              <kbd>Ctrl</kbd> + <kbd>Z</kbd> Undo
            </div>
            <div>
              <kbd>Ctrl</kbd> + <kbd>D</kbd> Duplicate
            </div>
          </div>
        </>
      )}
    </section>
  );
}
