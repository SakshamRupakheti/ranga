import { test } from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { createDocument, documentSchema, newLayer } from "../src/lib/document";
import {
  buildPrompt,
  compositionKey,
  recipeToDocument,
} from "../src/lib/design-recipe";
import { prepareResult } from "../src/lib/incoming-result";
import {
  createShared,
  writeShared,
  readShared,
} from "../src/lib/shared-document";

const recipe = {
  format: "ranga.recipe",
  version: 1,
  title: "Returned concept",
  canvas: { width: 1080, height: 1350, background: "#fffefa" },
  elements: [
    {
      type: "text",
      name: "Headline",
      text: "Ranga",
      x: 30,
      y: 40,
      width: 800,
      height: 140,
      fill: "#222222",
    },
  ],
};
test("handoff prompt carries selected metadata and bounded changes without image bytes", () => {
  const doc = createDocument("editorial");
  doc.discoveryQuery = "University design event";
  doc.changeInstructions = {
    preserve: "Typography hierarchy",
    replace: "Original shapes",
    text: "New event details",
    logo: "Use uploaded logo",
    colors: "Green and cream",
    layout: "Leave room below",
    originality: "Create a new composition",
  };
  doc.references = [
    {
      id: "selected",
      name: "Selected source",
      selected: true,
      kind: "generated",
      permissionConfirmed: true,
      src: "data:image/png;base64,PRIVATE",
      note: "Bold type",
    },
    {
      id: "unselected",
      name: "Not in prompt",
      selected: false,
      note: "Unselected note",
    },
  ];
  doc.layers.push(
    newLayer("image", {
      id: "logo-asset",
      name: "Campus logo",
      src: "data:image/png;base64,PRIVATE",
    }),
  );
  const prompt = buildPrompt(doc);
  for (const text of [
    "University design event",
    "Typography hierarchy",
    "Green and cream",
    '"usage": "generated"',
    "selected",
    "logo-asset",
    "JSON SCHEMA",
  ])
    assert.ok(prompt.includes(text));
  for (const text of ["PRIVATE", "Not in prompt", "Unselected note"])
    assert.ok(!prompt.includes(text));
  assert.deepEqual(documentSchema.parse(JSON.parse(JSON.stringify(doc))), doc);
  const a = createShared(createDocument()),
    b = new Y.Doc();
  writeShared(a, doc);
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  assert.deepEqual(readShared(b).changeInstructions, doc.changeInstructions);
  assert.equal(
    documentSchema.safeParse({
      ...doc,
      changeInstructions: { preserve: "x".repeat(1501) },
    }).success,
    false,
  );
  assert.equal(
    documentSchema.safeParse({ ...doc, changeInstructions: { script: "x" } })
      .success,
    false,
  );
  a.destroy();
  b.destroy();
});

test("incoming results classify links, text and strict recipes without mutating the project", async () => {
  const doc = createDocument("editorial"),
    before = structuredClone(doc);
  assert.equal(
    (await prepareResult({ text: JSON.stringify(recipe) }, doc)).kind,
    "recipe",
  );
  assert.equal(
    (
      await prepareResult(
        { text: "```json\n" + JSON.stringify(recipe) + "\n```" },
        doc,
      )
    ).kind,
    "recipe",
  );
  assert.equal(
    (
      await prepareResult(
        {
          file: new File([JSON.stringify(recipe)], "result.json", {
            type: "application/json",
          }),
        },
        doc,
      )
    ).kind,
    "recipe",
  );
  const written = await prepareResult(
    { text: "Concept: cream paper and bold typography" },
    doc,
  );
  assert.equal(written.kind, "reference");
  if (written.kind === "reference")
    assert.match(written.preview.note, /Concept:/);
  const link = await prepareResult(
    { text: "https://example.test/reference.png" },
    doc,
  );
  assert.equal(link.kind, "reference");
  if (link.kind === "reference") {
    assert.equal(link.preview.src, undefined);
    assert.equal(link.preview.sourceUrl, "https://example.test/reference.png");
  }
  for (const text of [
    '{"script":"alert(1)"}',
    "{broken",
    "[1,2]",
    "javascript:alert(1)",
    JSON.stringify({
      ...recipe,
      elements: [{ ...recipe.elements[0], script: "alert(1)" }],
    }),
    "x".repeat(2_000_001),
    "क".repeat(666_667),
  ])
    await assert.rejects(prepareResult({ text }, doc));
  await assert.rejects(
    prepareResult(
      {
        file: new File(["not JSON"], "result.json", {
          type: "application/json",
        }),
      },
      doc,
    ),
  );
  assert.deepEqual(doc, before);
});

test("recipe composition identity tracks canvas edits while permitting metadata updates", () => {
  const doc = createDocument("editorial"),
    key = compositionKey(doc);
  assert.equal(
    compositionKey({
      ...doc,
      changeInstructions: { preserve: "New note" },
      direction: "New direction",
      references: [
        { id: "ref", name: "Note", note: "Metadata", selected: true },
      ],
    }),
    key,
  );
  assert.notEqual(
    compositionKey({
      ...doc,
      layers: [{ ...doc.layers[0], x: 500 }, ...doc.layers.slice(1)],
    }),
    key,
  );
  assert.notEqual(compositionKey({ ...doc, width: 200 }), key);
  const updated = recipeToDocument(JSON.stringify(recipe), {
    ...doc,
    changeInstructions: { preserve: "Keep me" },
  });
  assert.equal(updated.changeInstructions?.preserve, "Keep me");
});
