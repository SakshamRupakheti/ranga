import * as Y from "yjs";
import { documentSchema, type DesignDocument } from "./document";
export const LOCAL_EDIT = "ranga-local-edit";
const metaKeys = [
  "schemaVersion",
  "id",
  "title",
  "width",
  "height",
  "background",
  "direction",
  "createdAt",
  "updatedAt",
  "brief",
  "discoveryQuery",
] as const;
function equal(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}
export function setText(text: Y.Text, value: string) {
  const old = text.toString();
  let start = 0;
  while (
    start < old.length &&
    start < value.length &&
    old[start] === value[start]
  )
    start++;
  let end = 0;
  while (
    end < old.length - start &&
    end < value.length - start &&
    old[old.length - 1 - end] === value[value.length - 1 - end]
  )
    end++;
  if (old.length - start - end) text.delete(start, old.length - start - end);
  if (value.length - start - end)
    text.insert(start, value.slice(start, value.length - end));
}
function reconcileOrder(order: Y.Array<string>, desired: string[]) {
  const existing = order.toArray();
  if (equal(existing, desired)) return;
  for (let i = existing.length - 1; i >= 0; i--)
    if (!desired.includes(existing[i])) order.delete(i, 1);
  for (let i = 0; i < desired.length; i++) {
    const now = order.toArray();
    if (now[i] === desired[i]) continue;
    const prior = now.indexOf(desired[i]);
    if (prior >= 0) order.delete(prior, 1);
    order.insert(i, [desired[i]]);
  }
}
export function writeShared(
  doc: Y.Doc,
  next: DesignDocument,
  previous?: DesignDocument,
  origin: unknown = LOCAL_EDIT,
) {
  doc.transact(() => {
    const meta = doc.getMap("meta");
    for (const key of metaKeys)
      if (!previous || !equal(next[key], previous[key])) {
        if (next[key] === undefined) meta.delete(key);
        else meta.set(key, next[key]);
      }
    const elements = doc.getMap<Y.Map<unknown>>("elements");
    const before = new Map(previous?.layers.map((l) => [l.id, l]) ?? []);
    if (previous)
      for (const l of previous.layers)
        if (!next.layers.some((n) => n.id === l.id)) elements.delete(l.id);
    for (const layer of next.layers) {
      const old = before.get(layer.id);
      let shared = elements.get(layer.id);
      if (!shared) {
        if (old) continue;
        shared = new Y.Map();
        elements.set(layer.id, shared);
      }
      for (const [key, value] of Object.entries(layer)) {
        if (old && equal(value, old[key as keyof typeof old])) continue;
        if (key === "text") {
          let text = shared.get("text");
          if (!(text instanceof Y.Text)) {
            text = new Y.Text();
            shared.set("text", text);
          }
          setText(text as Y.Text, String(value));
        } else shared.set(key, value);
      }
      if (old)
        for (const key of Object.keys(old))
          if (!(key in layer)) shared.delete(key);
    }
    if (
      !previous ||
      !equal(
        previous.layers.map((l) => l.id),
        next.layers.map((l) => l.id),
      )
    )
      reconcileOrder(
        doc.getArray("order"),
        next.layers.map((l) => l.id),
      );
    const refs = doc.getMap<Y.Map<unknown>>("references");
    if (previous)
      for (const r of previous.references)
        if (!next.references.some((n) => n.id === r.id)) refs.delete(r.id);
    for (const r of next.references) {
      const old = previous?.references.find((p) => p.id === r.id);
      let shared = refs.get(r.id);
      if (!shared) {
        if (old) continue;
        shared = new Y.Map();
        refs.set(r.id, shared);
      }
      for (const [key, value] of Object.entries(r))
        if (!old || !equal(value, old[key as keyof typeof old]))
          shared.set(key, value);
      if (old)
        for (const key of Object.keys(old)) if (!(key in r)) shared.delete(key);
    }
    if (
      !previous ||
      !equal(
        previous.references.map((r) => r.id),
        next.references.map((r) => r.id),
      )
    )
      reconcileOrder(
        doc.getArray("referenceOrder"),
        next.references.map((r) => r.id),
      );
  }, origin);
}
export function readShared(doc: Y.Doc): DesignDocument {
  const elements = doc.getMap<Y.Map<unknown>>("elements"),
    refs = doc.getMap<Y.Map<unknown>>("references");
  const order = [
    ...new Set([
      ...doc.getArray<string>("order").toArray(),
      ...elements.keys(),
    ]),
  ];
  const refOrder = [
    ...new Set([
      ...doc.getArray<string>("referenceOrder").toArray(),
      ...refs.keys(),
    ]),
  ];
  return documentSchema.parse({
    ...doc.getMap("meta").toJSON(),
    layers: order
      .filter((id) => elements.has(id))
      .map((id) => elements.get(id)!.toJSON()),
    references: refOrder
      .filter((id) => refs.has(id))
      .map((id) => refs.get(id)!.toJSON()),
  });
}
export function createShared(scene: DesignDocument) {
  const doc = new Y.Doc();
  writeShared(doc, scene, undefined, "initial");
  return doc;
}
export type ProjectRole = "owner" | "editor" | "commenter" | "viewer";
export function canEdit(role: ProjectRole) {
  return role === "owner" || role === "editor";
}
export type Presence = {
  connectionId: string;
  userId: string;
  name: string;
  role: ProjectRole;
  selected: string | null;
  cursor?: { x: number; y: number } | null;
};
