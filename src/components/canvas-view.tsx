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
import { MousePointer2 } from "lucide-react";
import { imageData } from "@/lib/api";
import type { DesignDocument, Layer } from "@/lib/document";
import type { Presence } from "@/lib/shared-document";
type NamedObject = FabricObject & { rangaId?: string };
export interface CanvasHandle {
  png: () => string;
  jpeg: () => string;
  svg: () => string;
  thumbnail: () => string;
  select: (id: string) => void;
}
type Props = {
  document: DesignDocument;
  selected: string | null;
  zoom: number | null;
  editable?: boolean;
  people?: Presence[];
  commentPoint?: { x: number; y: number } | null;
  onCursor?: (point: { x: number; y: number } | null) => void;
  onChange: (layers: Layer[]) => void;
  onSelect: (id: string | null) => void;
  onScale: (scale: number) => void;
  onError: (message: string) => void;
};
function common(l: Layer, editable: boolean) {
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
function textProps(l: Layer) {
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
async function makeObject(l: Layer, editable: boolean): Promise<NamedObject> {
  const props = common(l, editable);
  let o: NamedObject;
  if (l.type === "text")
    o = new Textbox(l.text ?? "", { ...props, ...textProps(l), editable });
  else if (l.type === "ellipse")
    o = new Ellipse({ ...props, rx: l.width / 2, ry: l.height / 2 });
  else if (l.type === "image") {
    o = await FabricImage.fromURL(await imageData(l.src!));
    o.set({ ...props, scaleX: l.width / o.width, scaleY: l.height / o.height });
  } else o = new Rect({ ...props, width: l.width, height: l.height });
  o.rangaId = l.id;
  return o;
}
export const CanvasView = forwardRef<CanvasHandle, Props>(function CanvasView(
  {
    document: doc,
    selected,
    zoom,
    editable = true,
    people = [],
    commentPoint,
    onCursor,
    onChange,
    onSelect,
    onScale,
    onError,
  },
  ref,
) {
  const host = useRef<HTMLDivElement>(null),
    element = useRef<HTMLCanvasElement>(null),
    canvas = useRef<Canvas | null>(null),
    docRef = useRef(doc),
    callbacks = useRef({ onChange, onSelect, onScale, onError }),
    scale = useRef(1),
    rendering = useRef(false),
    selectedId = useRef<string | null>(null),
    rendered = useRef(new Map<string, Layer>()),
    lastCursor = useRef(0);
  const [ready, setReady] = useState(false),
    [displayScale, setDisplayScale] = useState(1);
  useEffect(() => {
    docRef.current = doc;
    callbacks.current = { onChange, onSelect, onScale, onError };
  }, [doc, onChange, onSelect, onScale, onError]);
  useEffect(() => {
    selectedId.current = selected;
    const c = canvas.current;
    if (!c || rendering.current) return;
    const active = c.getActiveObject() as NamedObject | undefined;
    if (active?.rangaId === selected) return;
    if (selected) {
      const o = (c.getObjects() as NamedObject[]).find(
        (o) => o.rangaId === selected,
      );
      if (o?.selectable) c.setActiveObject(o);
    } else if (!(active instanceof ActiveSelection)) c.discardActiveObject();
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
    function commit(event: { target?: FabricObject }) {
      if (rendering.current) return;
      const target = event.target ?? c.getActiveObject();
      const changed = new Set(
        (target instanceof ActiveSelection
          ? target.getObjects()
          : target
            ? [target]
            : []
        ).map((o) => (o as NamedObject).rangaId),
      );
      const layers = docRef.current.layers.map((l) => {
        if (!changed.has(l.id)) return l;
        const o = (c.getObjects() as NamedObject[]).find(
          (o) => o.rangaId === l.id,
        );
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
            ? { text: o.text, fontSize: o.fontSize * Math.abs(sy) }
            : {}),
        };
      });
      for (const layer of layers)
        if (changed.has(layer.id)) rendered.current.set(layer.id, layer);
      callbacks.current.onChange(layers);
    }
    function selection() {
      if (rendering.current) return;
      selectedId.current =
        (c.getActiveObject() as NamedObject | undefined)?.rangaId ?? null;
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
    const c = canvas.current;
    let cancelled = false;
    rendering.current = true;
    Promise.all(
      doc.layers.map(async (layer) => {
        const existing = (c.getObjects() as NamedObject[]).find(
            (o) => o.rangaId === layer.id,
          ),
          old = rendered.current.get(layer.id);
        if (
          !existing ||
          old?.type !== layer.type ||
          (layer.type === "image" && old?.src !== layer.src)
        )
          return {
            layer,
            object: await makeObject(layer, editable),
            fresh: true,
          };
        return { layer, object: existing, fresh: false };
      }),
    )
      .then((items) => {
        if (cancelled) {
          for (const item of items) if (item.fresh) item.object.dispose();
          return;
        }
        const ids = new Set(items.map((i) => i.layer.id));
        for (const o of c.getObjects() as NamedObject[])
          if (!ids.has(o.rangaId!)) {
            c.remove(o);
            o.dispose();
          }
        c.backgroundColor = doc.background;
        items.forEach(({ layer: l, object: o, fresh }, index) => {
          if (fresh) {
            const old = (c.getObjects() as NamedObject[]).find(
              (x) => x.rangaId === l.id,
            );
            if (old) {
              c.remove(old);
              old.dispose();
            }
            c.add(o);
          } else if (
            JSON.stringify(rendered.current.get(l.id)) !== JSON.stringify(l)
          ) {
            o.set(common(l, editable));
            if (o instanceof Textbox) {
              const selection = o.selectionStart,
                previous = o.text;
              let prefix = 0;
              while (
                prefix < previous.length &&
                prefix < (l.text ?? "").length &&
                previous[prefix] === (l.text ?? "")[prefix]
              )
                prefix++;
              o.set(textProps(l));
              if (o.isEditing) {
                const position = Math.max(
                  0,
                  Math.min(
                    o.text.length,
                    selection +
                      (prefix < selection
                        ? o.text.length - previous.length
                        : 0),
                  ),
                );
                o.selectionStart = position;
                o.selectionEnd = position;
              }
              o.initDimensions();
            } else if (o instanceof FabricImage)
              o.set({ scaleX: l.width / o.width, scaleY: l.height / o.height });
            else if (o instanceof Ellipse)
              o.set({
                rx: l.width / 2,
                ry: l.height / 2,
                scaleX: 1,
                scaleY: 1,
              });
            else
              o.set({ width: l.width, height: l.height, scaleX: 1, scaleY: 1 });
          }
          o.set({
            selectable: !l.locked,
            evented: !l.locked,
            lockMovementX: l.locked || !editable,
            lockMovementY: l.locked || !editable,
            lockScalingX: !editable,
            lockScalingY: !editable,
            lockRotation: !editable,
            hasControls: editable,
          });
          if (o instanceof Textbox) o.editable = editable;
          o.setCoords();
          c.moveObjectTo(o, index);
        });
        rendered.current = new Map(
          doc.layers.map((l) => [l.id, structuredClone(l)]),
        );
        const active = c.getActiveObject() as NamedObject | undefined;
        if (selectedId.current && active?.rangaId !== selectedId.current) {
          const o = items.find(
            (i) => i.layer.id === selectedId.current,
          )?.object;
          if (o?.selectable) c.setActiveObject(o);
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
  }, [doc, ready, editable]);
  useEffect(() => {
    if (!ready || !host.current) return;
    function resize() {
      const c = canvas.current;
      if (!c || !host.current) return;
      const bounds = host.current.getBoundingClientRect();
      const next =
        zoom ??
        Math.max(
          0.12,
          Math.min(
            (bounds.width - 80) / doc.width,
            (bounds.height - 90) / doc.height,
            1,
          ),
        );
      scale.current = next;
      setDisplayScale(next);
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
      jpeg: () => {
        if (!canvas.current || rendering.current)
          throw new Error("Wait for the canvas to finish updating.");
        return canvas.current.toDataURL({
          format: "jpeg",
          quality: 0.95,
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
        const o = (c?.getObjects() as NamedObject[] | undefined)?.find(
          (o) => o.rangaId === id,
        );
        if (c && o && o.selectable) {
          c.setActiveObject(o);
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
      <div
        className="artboard-wrap"
        onPointerMove={(e) => {
          if (Date.now() - lastCursor.current < 70) return;
          lastCursor.current = Date.now();
          const bounds = e.currentTarget.getBoundingClientRect();
          onCursor?.({
            x: (e.clientX - bounds.left) / displayScale,
            y: (e.clientY - bounds.top) / displayScale,
          });
        }}
        onPointerLeave={() => onCursor?.(null)}
      >
        <div className="collaborative-overlays" aria-hidden="true">
          {commentPoint && (
            <span
              className="comment-marker"
              style={{
                left: commentPoint.x * displayScale,
                top: commentPoint.y * displayScale,
              }}
            >
              Comment
            </span>
          )}
          {people.map((person) => {
            const target = doc.layers.find((l) => l.id === person.selected);
            const color = ["#276c89", "#9b5134", "#62783d", "#8c4c73"][
              [...person.userId].reduce((sum, c) => sum + c.charCodeAt(0), 0) %
                4
            ];
            return (
              <div key={person.connectionId}>
                {target && (
                  <div
                    className="remote-selection"
                    style={{
                      left: target.x * displayScale,
                      top: target.y * displayScale,
                      width: target.width * displayScale,
                      height: target.height * displayScale,
                      transform: `rotate(${target.angle}deg)`,
                      borderColor: color,
                    }}
                  >
                    <span style={{ background: color }}>{person.name}</span>
                  </div>
                )}
                {person.cursor && (
                  <span
                    className="remote-cursor"
                    style={{
                      left: person.cursor.x * displayScale,
                      top: person.cursor.y * displayScale,
                      color,
                    }}
                  >
                    <MousePointer2 size={14} />
                    {person.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <span className="artboard-label">
          {doc.title}
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
