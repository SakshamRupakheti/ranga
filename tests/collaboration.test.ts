import { test } from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { createDocument, newLayer } from "../src/lib/document";
import {
  createShared,
  readShared,
  writeShared,
  LOCAL_EDIT,
} from "../src/lib/shared-document";
import { recipeToDocument, buildPrompt } from "../src/lib/design-recipe";

test("independent edits and simultaneous text inserts converge; undo keeps another user's changes", () => {
  const scene = createDocument();
  scene.layers = [newLayer("text", { text: "Hello" })];
  const a = createShared(scene),
    b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  const undo = new Y.UndoManager(a.getMap("elements"), {
    trackedOrigins: new Set([LOCAL_EDIT]),
  });
  const av = Y.encodeStateVector(a),
    bv = Y.encodeStateVector(b);
  const one = structuredClone(scene),
    two = structuredClone(scene);
  one.layers[0].x = 300;
  one.layers[0].text = "Hello A";
  two.layers[0].fill = "#abcdef";
  two.layers[0].text = "B Hello";
  writeShared(a, one, scene);
  writeShared(b, two, scene);
  const au = Y.encodeStateAsUpdate(a, av),
    bu = Y.encodeStateAsUpdate(b, bv);
  Y.applyUpdate(a, bu, "remote");
  Y.applyUpdate(b, au, "remote");
  assert.deepEqual(readShared(a), readShared(b));
  assert.equal(readShared(a).layers[0].text, "B Hello A");
  undo.undo();
  assert.equal(readShared(a).layers[0].text, "B Hello");
  assert.equal(readShared(a).layers[0].fill, "#abcdef");
  assert.equal(readShared(a).layers[0].x, scene.layers[0].x);
  a.destroy();
  b.destroy();
});

test("deletion wins over stale property changes and concurrent insertions are preserved", () => {
  const scene = createDocument();
  scene.layers = [newLayer("rect")];
  const a = createShared(scene),
    b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  const one = structuredClone(scene),
    two = structuredClone(scene);
  one.layers = [];
  two.layers[0].x = 400;
  one.layers.push(newLayer("ellipse"));
  two.layers.push(newLayer("text"));
  writeShared(a, one, scene);
  writeShared(b, two, scene);
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  assert.deepEqual(readShared(a), readShared(b));
  assert.equal(readShared(a).layers.length, 2);
  assert.ok(!readShared(a).layers.some((l) => l.id === scene.layers[0].id));
  a.destroy();
  b.destroy();
});

test("manual recipe imports editable layers and rejects scripts, URLs, invented assets and unknown fields", () => {
  const scene = createDocument();
  const recipe = {
    format: "ranga.recipe",
    version: 1,
    title: "Ranga study",
    canvas: { width: 900, height: 1200, background: "#ffffff" },
    elements: [
      {
        type: "text",
        name: "Headline",
        text: "Ranga",
        x: 40,
        y: 50,
        width: 600,
        height: 100,
        fill: "#222222",
      },
    ],
  };
  const imported = recipeToDocument(JSON.stringify(recipe), scene);
  assert.equal(imported.layers[0].text, "Ranga");
  assert.equal(imported.id, scene.id);
  assert.throws(() =>
    recipeToDocument(JSON.stringify({ ...recipe, script: "alert(1)" }), scene),
  );
  assert.throws(() =>
    recipeToDocument(
      JSON.stringify({
        ...recipe,
        elements: [
          { ...recipe.elements[0], type: "image", assetId: "invented" },
        ],
      }),
      scene,
    ),
  );
  assert.throws(() =>
    recipeToDocument(
      JSON.stringify({
        ...recipe,
        elements: [
          { ...recipe.elements[0], src: "https://example.com/image.png" },
        ],
      }),
      scene,
    ),
  );
  assert.equal(buildPrompt(scene), buildPrompt(scene));
  assert.match(buildPrompt(scene), /JSON SCHEMA/);
});
