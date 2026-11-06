import { z } from "zod";

export const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
export const embeddedImageSchema = z
  .string()
  .max(8_000_000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/);
export const imageSchema = z.union([
  embeddedImageSchema,
  z.string().regex(/^\/api\/assets\/[a-f0-9-]{36}$/),
]);
export const sourceUrlSchema = z
  .string()
  .max(2000)
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Use an http or https source link.");
export const referenceSchema = z
  .object({
    id: z.string().max(100),
    name: z.string().max(120),
    src: imageSchema.optional(),
    sourceUrl: sourceUrlSchema.optional(),
    note: z.string().max(2000).optional(),
    collection: z.string().max(80).optional(),
    selected: z.boolean(),
    kind: z.enum(["inspiration", "owned", "generated"]).optional(),
    permissionConfirmed: z.literal(true).optional(),
    addedAt: z.string().datetime().optional(),
  })
  .refine(
    (r) => !!r.src || !!r.sourceUrl || !!r.note?.trim(),
    "Add an image, source link, or written description.",
  );
export const briefSchema = z.object({
  graphicType: z.string().max(100),
  headline: z.string().max(500),
  supportingText: z.string().max(3000),
  audience: z.string().max(500),
  style: z.string().max(1000),
  typography: z.string().max(200),
  instructions: z.string().max(3000),
});
export const changeInstructionsSchema = z
  .object({
    preserve: z.string().max(1500).optional(),
    replace: z.string().max(1500).optional(),
    text: z.string().max(1500).optional(),
    logo: z.string().max(1000).optional(),
    colors: z.string().max(1000).optional(),
    layout: z.string().max(1500).optional(),
    originality: z.string().max(1500).optional(),
  })
  .strict();
export type ChangeInstructions = z.infer<typeof changeInstructionsSchema>;
export type DesignBrief = z.infer<typeof briefSchema>;
export const discoveryQuerySchema = z
  .string()
  .max(500)
  .regex(/^[^\p{Cc}\p{Cf}]*$/u);
export const layerSchema = z
  .object({
    id: z.string().min(1).max(100),
    type: z.enum(["text", "rect", "ellipse", "image"]),
    name: z.string().max(120),
    x: z.number().finite().min(-20000).max(20000),
    y: z.number().finite().min(-20000).max(20000),
    width: z.number().positive().max(20000),
    height: z.number().positive().max(20000),
    angle: z.number().finite().min(-3600).max(3600),
    fill: colorSchema,
    opacity: z.number().min(0).max(1),
    visible: z.boolean(),
    locked: z.boolean(),
    text: z.string().max(20000).optional(),
    fontSize: z.number().min(6).max(1000).optional(),
    fontFamily: z
      .enum(["Arial", "Georgia", "Courier New", "Impact"])
      .optional(),
    fontWeight: z.enum(["normal", "bold"]).optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(),
    charSpacing: z.number().min(-200).max(2000).optional(),
    lineHeight: z.number().min(0.5).max(4).optional(),
    src: imageSchema.optional(),
    flipX: z.boolean().optional(),
    flipY: z.boolean().optional(),
    assetInfo: z
      .object({
        kind: z.enum(["owned", "generated"]),
        permissionConfirmed: z.literal(true),
        sourceUrl: sourceUrlSchema.optional(),
        note: z.string().max(2000).optional(),
        addedAt: z.string().datetime(),
      })
      .strict()
      .optional(),
  })
  .refine((l) => l.type !== "image" || !!l.src, {
    message: "Image layers must include a supported raster image.",
  });
export const documentSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(100),
    title: z.string().trim().min(1).max(120),
    width: z.number().int().min(100).max(4096),
    height: z.number().int().min(100).max(4096),
    background: colorSchema,
    layers: z.array(layerSchema).max(200),
    references: z.array(referenceSchema).max(12),
    brief: briefSchema.optional(),
    changeInstructions: changeInstructionsSchema.optional(),
    discoveryQuery: discoveryQuerySchema.optional(),
    direction: z.string().max(5000),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .refine((d) => new Set(d.layers.map((l) => l.id)).size === d.layers.length, {
    message: "Layer IDs must be unique.",
  });
export type DesignDocument = z.infer<typeof documentSchema>;
export type Layer = z.infer<typeof layerSchema>;
export const brandSchema = z.object({
  name: z.string().max(100),
  primary: colorSchema,
  secondary: colorSchema,
  font: z.enum(["Arial", "Georgia", "Courier New", "Impact"]),
  logo: imageSchema.optional(),
});
export type BrandKit = z.infer<typeof brandSchema>;
export const defaultBrand: BrandKit = {
  name: "My brand",
  primary: "#bd442d",
  secondary: "#eee9dc",
  font: "Arial",
};
export function newLayer(
  type: Layer["type"],
  overrides: Partial<Layer> = {},
): Layer {
  return {
    id: crypto.randomUUID(),
    type,
    name:
      type === "text"
        ? "New text"
        : type === "rect"
          ? "Rectangle"
          : type === "ellipse"
            ? "Ellipse"
            : "Image",
    x: 70,
    y: 70,
    width: type === "text" ? 520 : 220,
    height: 180,
    angle: 0,
    fill: "#20241f",
    opacity: 1,
    visible: true,
    locked: false,
    ...(type === "text"
      ? {
          text: "Make something yours.",
          fontSize: 54,
          fontFamily: "Arial",
          fontWeight: "normal",
          textAlign: "left",
          charSpacing: 0,
        }
      : {}),
    ...overrides,
  };
}
export function createDocument(template = "blank"): DesignDocument {
  const now = new Date().toISOString();
  const doc: DesignDocument = {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title:
      template === "editorial"
        ? "Form & Field"
        : template === "social"
          ? "A fresh perspective"
          : "Untitled design",
    width: 900,
    height: 1200,
    background: "#eee9dc",
    layers: [],
    references: [],
    direction: "",
    createdAt: now,
    updatedAt: now,
  };
  if (template === "editorial")
    doc.layers = [
      newLayer("text", {
        name: "Edition",
        text: "EXPLORATIONS IN\nART & DESIGN",
        x: 60,
        y: 55,
        width: 500,
        fontSize: 19,
        fontWeight: "bold",
        charSpacing: 65,
      }),
      newLayer("text", {
        name: "Volume",
        text: "VOL. 01\n2026",
        x: 710,
        y: 55,
        width: 130,
        fontSize: 19,
        textAlign: "right",
      }),
      newLayer("text", {
        name: "Headline",
        text: "FORM",
        x: 45,
        y: 180,
        width: 820,
        fontFamily: "Arial",
        fontSize: 208,
        fontWeight: "bold",
        charSpacing: -70,
      }),
      newLayer("text", {
        name: "Subheadline",
        text: "& FIELD",
        x: 51,
        y: 390,
        width: 820,
        fontFamily: "Georgia",
        fontSize: 167,
        charSpacing: -65,
      }),
      newLayer("ellipse", {
        name: "Outer form",
        x: 190,
        y: 665,
        width: 520,
        height: 350,
        fill: "#bd442d",
        angle: -20,
      }),
      newLayer("ellipse", {
        name: "Inner form",
        x: 265,
        y: 695,
        width: 370,
        height: 250,
        fill: "#eee9dc",
        angle: -20,
      }),
      newLayer("ellipse", {
        name: "Core form",
        x: 343,
        y: 730,
        width: 205,
        height: 140,
        fill: "#bd442d",
        angle: -20,
      }),
      newLayer("rect", {
        name: "Baseline",
        x: 60,
        y: 1080,
        width: 780,
        height: 2,
      }),
      newLayer("text", {
        name: "Footer",
        text: "A STUDY IN\nSHAPE AND SPACE",
        x: 60,
        y: 1110,
        width: 650,
        fontSize: 20,
        fontWeight: "bold",
        charSpacing: 40,
      }),
      newLayer("text", {
        name: "Number",
        text: "01",
        x: 740,
        y: 1098,
        width: 100,
        fontSize: 62,
        fontFamily: "Georgia",
        textAlign: "right",
      }),
    ];
  if (template === "social") {
    doc.width = 1080;
    doc.height = 1080;
    doc.background = "#c4d2b6";
    doc.layers = [
      newLayer("text", {
        name: "Eyebrow",
        text: "A NOTE TO YOURSELF",
        x: 80,
        y: 80,
        fontSize: 22,
        charSpacing: 160,
      }),
      newLayer("ellipse", {
        name: "Sun",
        x: 580,
        y: 140,
        width: 400,
        height: 400,
        fill: "#e9efde",
      }),
      newLayer("text", {
        name: "Headline",
        text: "A fresh\nperspective.",
        x: 72,
        y: 400,
        width: 950,
        fontSize: 133,
        fontFamily: "Georgia",
      }),
      newLayer("rect", { name: "Rule", x: 80, y: 920, width: 920, height: 2 }),
      newLayer("text", {
        name: "Footer",
        text: "MAKE ROOM FOR SOMETHING NEW.",
        x: 80,
        y: 960,
        width: 900,
        fontSize: 22,
        charSpacing: 80,
      }),
    ];
  }
  return doc;
}
export type DesignCommand =
  | { type: "updateElement"; id: string; changes: Partial<Layer> }
  | { type: "addElement"; layer: Layer }
  | { type: "removeElement"; id: string }
  | { type: "reorderLayer"; id: string; index: number }
  | { type: "updateCanvasSize"; width: number; height: number };
export function applyCommand(
  doc: DesignDocument,
  command: DesignCommand,
): DesignDocument {
  let next: DesignDocument = structuredClone(doc);
  switch (command.type) {
    case "addElement":
      next.layers.push(command.layer);
      break;
    case "removeElement":
      next.layers = next.layers.filter((l) => l.id !== command.id);
      break;
    case "updateElement":
      next.layers = next.layers.map((l) =>
        l.id === command.id
          ? { ...l, ...command.changes, id: l.id, type: l.type }
          : l,
      );
      break;
    case "reorderLayer": {
      const from = next.layers.findIndex((l) => l.id === command.id);
      if (from >= 0) {
        const [layer] = next.layers.splice(from, 1);
        next.layers.splice(
          Math.max(0, Math.min(command.index, next.layers.length)),
          0,
          layer,
        );
      }
      break;
    }
    case "updateCanvasSize":
      next = { ...next, width: command.width, height: command.height };
      break;
  }
  return documentSchema.parse(next);
}
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(
    private current: T,
    private limit = 60,
  ) {}
  push(next: T) {
    if (JSON.stringify(next) === JSON.stringify(this.current)) return;
    this.past.push(this.current);
    if (this.past.length > this.limit) this.past.shift();
    this.current = structuredClone(next);
    this.future = [];
  }
  undo() {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(this.current);
    this.current = prev;
    return structuredClone(prev);
  }
  redo() {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(this.current);
    this.current = next;
    return structuredClone(next);
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
}
