import {
  Rect,
  Ellipse,
  Textbox,
  FabricImage,
  FabricObject,
  StaticCanvas,
} from "fabric";
import { imageData } from "./api";
import type { DesignDocument, Layer } from "./document";
export type NamedObject = FabricObject & { rangaId?: string };
export function common(l: Layer, editable: boolean) {
  return {
    left: l.x,
    top: l.y,
    originX: "left" as const,
    originY: "top" as const,
    angle: l.angle,
    fill: l.fill,
    opacity: l.opacity,
    visible: l.visible,
    selectable: !l.locked,
    evented: !l.locked,
    lockMovementX: l.locked || !editable,
    lockMovementY: l.locked || !editable,
    lockScalingX: !editable,
    lockScalingY: !editable,
    lockRotation: !editable,
    hasControls: editable,
    flipX: l.flipX ?? false,
    flipY: l.flipY ?? false,
    strokeWidth: 0,
    cornerColor: "#bd442d",
    borderColor: "#bd442d",
    cornerStyle: "rect" as const,
    cornerSize: 9,
    transparentCorners: false,
  };
}
export function textProps(l: Layer) {
  return {
    text: l.text ?? "",
    width: l.width,
    fontSize: l.fontSize ?? 40,
    fontFamily: l.fontFamily ?? "Arial",
    fontWeight: l.fontWeight ?? "normal",
    textAlign: l.textAlign ?? "left",
    charSpacing: l.charSpacing ?? 0,
    lineHeight: l.lineHeight ?? 1.04,
    scaleX: 1,
    scaleY: 1,
  };
}
export async function makeObject(
  l: Layer,
  editable: boolean,
  signal?: AbortSignal,
): Promise<NamedObject> {
  const props = common(l, editable);
  let o: NamedObject;
  if (l.type === "text")
    o = new Textbox(l.text ?? "", { ...props, ...textProps(l), editable });
  else if (l.type === "ellipse")
    o = new Ellipse({ ...props, rx: l.width / 2, ry: l.height / 2 });
  else if (l.type === "image") {
    o = await FabricImage.fromURL(await imageData(l.src!), { signal });
    o.set({ ...props, scaleX: l.width / o.width, scaleY: l.height / o.height });
  } else o = new Rect({ ...props, width: l.width, height: l.height });
  o.rangaId = l.id;
  return o;
}

// A disposable rendering of the same layer objects as the editor. It owns no
// document state, history, events or collaboration connection.
export async function renderDesignPreview(
  doc: DesignDocument,
  signal?: AbortSignal,
): Promise<string> {
  const scale = Math.min(480 / doc.width, 480 / doc.height, 1);
  const canvas = new StaticCanvas(undefined, {
    width: Math.round(doc.width * scale),
    height: Math.round(doc.height * scale),
    backgroundColor: doc.background,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  });
  try {
    signal?.throwIfAborted();
    const results = await Promise.allSettled(
      doc.layers.map((layer) => makeObject(layer, false, signal)),
    );
    const objects = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const failed = results.find((result) => result.status === "rejected");
    if (failed || signal?.aborted) {
      objects.forEach((object) => object.dispose());
      signal?.throwIfAborted();
      throw new Error(
        "A preview image could not be loaded. Check your access and preview again.",
      );
    }
    canvas.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    canvas.add(...objects);
    canvas.renderAll();
    return canvas.toDataURL({
      format: "png",
      multiplier: 1,
      enableRetinaScaling: false,
    });
  } finally {
    await canvas.dispose();
  }
}
