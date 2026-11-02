import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDocument,
  newLayer,
  applyCommand,
  documentSchema,
  History,
} from "../src/lib/document";
test("editable templates have distinct stable IDs and survive JSON round trips", () => {
  for (const template of ["blank", "editorial", "social"]) {
    const doc = createDocument(template);
    assert.deepEqual(
      documentSchema.parse(JSON.parse(JSON.stringify(doc))),
      doc,
    );
    assert.equal(new Set(doc.layers.map((l) => l.id)).size, doc.layers.length);
  }
});
test("commands update one layer while preserving its identity and all other layers", () => {
  const doc = createDocument("editorial");
  const changed = applyCommand(doc, {
    type: "updateElement",
    id: doc.layers[0].id,
    changes: { text: "RANGA", fontSize: 90, id: "untrusted" },
  });
  assert.equal(changed.layers[0].text, "RANGA");
  assert.equal(changed.layers[0].id, doc.layers[0].id);
  assert.deepEqual(changed.layers.slice(1), doc.layers.slice(1));
  assert.notEqual(doc.layers[0].text, "RANGA");
});
test("add, reorder, remove, and resize commands maintain a valid document", () => {
  let doc = createDocument();
  const rect = newLayer("rect");
  const text = newLayer("text");
  doc = applyCommand(doc, { type: "addElement", layer: rect });
  doc = applyCommand(doc, { type: "addElement", layer: text });
  doc = applyCommand(doc, { type: "reorderLayer", id: rect.id, index: 1 });
  assert.equal(doc.layers[1].id, rect.id);
  doc = applyCommand(doc, { type: "removeElement", id: rect.id });
  assert.equal(doc.layers.length, 1);
  doc = applyCommand(doc, {
    type: "updateCanvasSize",
    width: 1080,
    height: 1080,
  });
  assert.equal(doc.width, 1080);
  assert.throws(() =>
    applyCommand(doc, { type: "updateCanvasSize", width: 99999, height: 1080 }),
  );
});
test("imports reject external asset URLs, SVG payloads, duplicate IDs, and invalid geometry", () => {
  const doc = createDocument();
  for (const src of [
    "https://example.com/private.png",
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz4=",
  ])
    assert.equal(
      documentSchema.safeParse({ ...doc, layers: [newLayer("image", { src })] })
        .success,
      false,
    );
  const layer = newLayer("rect");
  assert.equal(
    documentSchema.safeParse({ ...doc, layers: [layer, layer] }).success,
    false,
  );
  assert.equal(
    documentSchema.safeParse({ ...doc, layers: [{ ...layer, x: Infinity }] })
      .success,
    false,
  );
});
test("undo/redo preserves prior designs and a new edit invalidates the redo branch", () => {
  const initial = { text: "First", color: "red" };
  const history = new History(initial);
  history.push({ text: "Second", color: "blue" });
  history.push({ text: "Third", color: "green" });
  assert.deepEqual(history.undo(), { text: "Second", color: "blue" });
  assert.deepEqual(history.redo(), { text: "Third", color: "green" });
  history.undo();
  history.push({ text: "Different", color: "black" });
  assert.equal(history.redo(), null);
  assert.deepEqual(history.undo(), { text: "Second", color: "blue" });
  assert.deepEqual(history.undo(), initial);
  assert.equal(history.undo(), null);
});
test("history is bounded without breaking the latest undo", () => {
  const history = new History(0, 3);
  for (let i = 1; i <= 6; i++) history.push(i);
  assert.equal(history.undo(), 5);
  assert.equal(history.undo(), 4);
  assert.equal(history.undo(), 3);
  assert.equal(history.undo(), null);
});
