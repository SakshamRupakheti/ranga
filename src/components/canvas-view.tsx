"use client";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Canvas,
  Rect,
  Ellipse,
  Textbox,
  FabricImage,
  FabricObject,
  ActiveSelection,
  util,
} from "fabric";
import type { DesignDocument, Layer } from "@/lib/document";
type NamedObject = FabricObject & { rangaId?: string };
export interface CanvasHandle {
  png: () => string;
  svg: () => string;
  thumbnail: () => string;
  select: (id: string) => void;
}
type Props = {
  document: DesignDocument;
  selected: string | null;
  zoom: number | null;
  onChange: (layers: Layer[]) => void;
  onSelect: (id: string | null) => void;
  onScale: (scale: number) => void;
  onError: (message: string) => void;
};
async function makeObject(l: Layer): Promise<NamedObject> {
  const props = {
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
    lockMovementX: l.locked,
    lockMovementY: l.locked,
    flipX: l.flipX ?? false,
    flipY: l.flipY ?? false,
    strokeWidth: 0,
    cornerColor: "#bd442d",
    borderColor: "#bd442d",
    cornerStyle: "rect" as const,
    cornerSize: 9,
    transparentCorners: false,
  };
  let obj: NamedObject;
  if (l.type === "text")
    obj = new Textbox(l.text ?? "", {
      ...props,
      width: l.width,
      fontSize: l.fontSize ?? 40,
      fontFamily: l.fontFamily ?? "Arial",
      fontWeight: l.fontWeight ?? "normal",
      textAlign: l.textAlign ?? "left",
      charSpacing: l.charSpacing ?? 0,
      lineHeight: 1.04,
    });
  else if (l.type === "ellipse")
    obj = new Ellipse({ ...props, rx: l.width / 2, ry: l.height / 2 });
  else if (l.type === "image") {
    obj = await FabricImage.fromURL(l.src!);
    obj.set({
      ...props,
      scaleX: l.width / obj.width,
      scaleY: l.height / obj.height,
    });
  } else obj = new Rect({ ...props, width: l.width, height: l.height });
  obj.rangaId = l.id;
  return obj;
}
export const CanvasView = forwardRef<CanvasHandle, Props>(function CanvasView(
  { document: doc, selected, zoom, onChange, onSelect, onScale, onError },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const element = useRef<HTMLCanvasElement>(null);
  const canvas = useRef<Canvas | null>(null);
  const docRef = useRef(doc);
  const callbacks = useRef({ onChange, onSelect, onScale, onError });
  const scale = useRef(1);
  const rendering = useRef(false);
  const nativeUpdate = useRef(false);
  const selectedId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    callbacks.current = { onChange, onSelect, onScale, onError };
    docRef.current = doc;
  }, [doc, onChange, onSelect, onScale, onError]);
  useEffect(() => {
    selectedId.current = selected;
    const c = canvas.current;
    if (!c || rendering.current) return;
    const active = c.getActiveObject() as NamedObject | undefined;
    if (active?.rangaId === selected) return;
    if (selected) {
      const object = (c.getObjects() as NamedObject[]).find(
        (o) => o.rangaId === selected,
      );
      if (object?.selectable) c.setActiveObject(object);
    } else if (!(active instanceof ActiveSelection)) {
      c.discardActiveObject();
    }
    c.requestRenderAll();
  }, [selected]);
  useEffect(() => {
    const c = new Canvas(element.current!, {
      preserveObjectStacking: true,
      selection: true,
      backgroundColor: "#eee9dc",
      enableRetinaScaling: true,
    });
    canvas.current = c;
    function commit() {
      if (rendering.current) return;
      const previous = docRef.current;
      const objects = c.getObjects() as NamedObject[];
      const layers = previous.layers.map((l) => {
        const o = objects.find((o) => o.rangaId === l.id);
        if (!o) return l;
        let x = o.left,
          y = o.top,
          angle = o.angle,
          sx = o.scaleX,
          sy = o.scaleY;
        if (o.group instanceof ActiveSelection) {
          const matrix = util.qrDecompose(o.calcTransformMatrix());
          const point = o
            .getPointByOrigin("left", "top")
            .transform(o.group.calcTransformMatrix());
          x = point.x;
          y = point.y;
          angle = matrix.angle;
          sx = matrix.scaleX;
          sy = matrix.scaleY;
        }
        return {
          ...l,
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
          width: Math.max(1, o.width * Math.abs(sx)),
          height: Math.max(1, o.height * Math.abs(sy)),
          angle,
          flipX: o.flipX,
          flipY: o.flipY,
          ...(o instanceof Textbox
            ? { text: o.text, fontSize: (o.fontSize ?? 40) * Math.abs(sy) }
            : {}),
        };
      });
      nativeUpdate.current = true;
      callbacks.current.onChange(layers);
    }
    function selection() {
      if (rendering.current) return;
      const active = c.getActiveObject() as NamedObject | undefined;
      selectedId.current = active?.rangaId ?? null;
      callbacks.current.onSelect(selectedId.current);
    }
    c.on("object:modified", commit);
    c.on("text:changed", commit);
    c.on("text:editing:exited", commit);
    c.on("selection:created", selection);
    c.on("selection:updated", selection);
    c.on("selection:cleared", selection);
    setReady(true);
    return () => {
      canvas.current = null;
      void c.dispose();
    };
  }, []);
  useEffect(() => {
    if (!ready || !canvas.current) return;
    if (nativeUpdate.current) {
      nativeUpdate.current = false;
      return;
    }
    const c = canvas.current;
    let cancelled = false;
    rendering.current = true;
    Promise.all(doc.layers.map(makeObject))
      .then((objects) => {
        if (cancelled) return;
        const selected = selectedId.current;
        c.discardActiveObject();
        c.remove(...c.getObjects());
        c.backgroundColor = doc.background;
        c.add(...objects);
        if (selected) {
          const object = objects.find((o) => o.rangaId === selected);
          if (object && object.selectable) {
            c.setActiveObject(object);
            callbacks.current.onSelect(selected);
          }
        }
        c.requestRenderAll();
        rendering.current = false;
      })
      .catch(() => {
        if (!cancelled) {
          rendering.current = false;
          callbacks.current.onError(
            "A canvas asset could not be loaded. Your project data is preserved.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [doc, ready]);
  useEffect(() => {
    if (!ready || !host.current) return;
    function resize() {
      const c = canvas.current;
      if (!c || !host.current) return;
      const available = host.current.getBoundingClientRect();
      const fitted = Math.min(
        (available.width - 80) / doc.width,
        (available.height - 90) / doc.height,
        1,
      );
      const next = zoom ?? Math.max(0.12, fitted);
      scale.current = next;
      c.setDimensions({ width: doc.width * next, height: doc.height * next });
      c.setViewportTransform([next, 0, 0, next, 0, 0]);
      c.requestRenderAll();
      callbacks.current.onScale(next);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);
    resize();
    return () => observer.disconnect();
  }, [doc.width, doc.height, zoom, ready]);
  useImperativeHandle(
    ref,
    () => ({
      png: () => {
        if (!canvas.current || rendering.current)
          throw new Error("Wait for the canvas to finish updating.");
        return canvas.current.toDataURL({
          format: "png",
          multiplier: 1 / scale.current,
          enableRetinaScaling: false,
        });
      },
      thumbnail: () =>
        canvas.current?.toDataURL({
          format: "png",
          multiplier: 0.2 / scale.current,
          enableRetinaScaling: false,
        }) ?? "",
      svg: () => {
        if (!canvas.current || rendering.current)
          throw new Error("Wait for the canvas to finish updating.");
        canvas.current.svgViewportTransformation = false;
        return canvas.current.toSVG({
          width: String(doc.width),
          height: String(doc.height),
          viewBox: { x: 0, y: 0, width: doc.width, height: doc.height },
        });
      },
      select: (id) => {
        const c = canvas.current;
        const obj = (c?.getObjects() as NamedObject[] | undefined)?.find(
          (o) => o.rangaId === id,
        );
        if (c && obj && obj.selectable) {
          c.setActiveObject(obj);
          c.requestRenderAll();
          selectedId.current = id;
          callbacks.current.onSelect(id);
        }
      },
    }),
    [doc.width, doc.height],
  );
  return (
    <div className="canvas-stage" ref={host}>
      <div className="artboard-wrap">
        <span className="artboard-label">
          {doc.title}{" "}
          <span>
            {doc.width} × {doc.height}
          </span>
        </span>
        <canvas
          ref={element}
          aria-label="Editable graphic canvas. Select a layer in the Layers panel for keyboard-accessible editing."
        />
        <span className="artboard-bottom">RANGA / YOUR WORK IN PROGRESS</span>
      </div>
    </div>
  );
});
