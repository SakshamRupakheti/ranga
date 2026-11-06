import { test } from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { createDocument, documentSchema, newLayer } from "../src/lib/document";
import { imageResultLayer } from "../src/lib/image-handoff";
import { downloadedResultFile } from "../src/lib/incoming-result";
import { recipeToDocument } from "../src/lib/design-recipe";
import { createShared, readShared } from "../src/lib/shared-document";

const reference = {
  id: "returned",
  name: "Returned illustration",
  selected: false,
  src: "data:image/png;base64,AAAA",
  kind: "generated" as const,
  permissionConfirmed: true as const,
  sourceUrl: "https://example.test/design",
  note: "Original illustration",
};
test("image handoff preserves the composition and adds a centered, fitted raster layer with attribution", () => {
  const doc = createDocument("editorial"),
    before = structuredClone(doc);
  const layer = imageResultLayer(doc, reference, {
    src: reference.src,
    width: 4000,
    height: 2000,
  });
  assert.equal(layer.width, doc.width * 0.8);
  assert.equal(layer.height, layer.width / 2);
  assert.equal(layer.x, (doc.width - layer.width) / 2);
  assert.equal(layer.y, (doc.height - layer.height) / 2);
  assert.equal(layer.type, "image");
  assert.equal(layer.assetInfo?.sourceUrl, reference.sourceUrl);
  assert.equal(layer.assetInfo?.permissionConfirmed, true);
  assert.deepEqual(doc, before);
  const small = imageResultLayer(doc, reference, {
    src: reference.src,
    width: 20,
    height: 10,
  });
  assert.equal(small.width, 20);
  assert.equal(small.height, 10);
});
test("image handoff refuses unconfirmed inspiration, invalid dimensions and a full document", () => {
  const doc = createDocument("blank"),
    image = { src: reference.src, width: 100, height: 100 };
  for (const invalid of [
    { ...reference, permissionConfirmed: undefined },
    { ...reference, kind: "inspiration" as const },
    { ...reference, src: undefined },
  ])
    assert.throws(() => imageResultLayer(doc, invalid, image));
  for (const width of [0, -1, NaN, Infinity])
    assert.throws(() => imageResultLayer(doc, reference, { ...image, width }));
  doc.layers = Array.from({ length: 200 }, () => newLayer("rect"));
  assert.throws(() => imageResultLayer(doc, reference, image), /200 layers/);
});
test("raster provenance survives backups, shared transport and editable recipe reuse", () => {
  const doc = createDocument("blank");
  doc.layers = [
    imageResultLayer(doc, reference, {
      src: reference.src,
      width: 100,
      height: 100,
    }),
  ];
  assert.deepEqual(documentSchema.parse(JSON.parse(JSON.stringify(doc))), doc);
  const source = createShared(doc),
    peer = new Y.Doc();
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(source));
  assert.deepEqual(
    readShared(peer).layers[0].assetInfo,
    doc.layers[0].assetInfo,
  );
  const recipe = {
    format: "ranga.recipe",
    version: 1,
    title: "Reused image",
    canvas: { width: 300, height: 400, background: "#ffffff" },
    elements: [
      {
        type: "image",
        name: "Illustration",
        assetId: doc.layers[0].id,
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        fill: "#ffffff",
      },
    ],
  };
  assert.deepEqual(
    recipeToDocument(JSON.stringify(recipe), doc).layers[0].assetInfo,
    doc.layers[0].assetInfo,
  );
  assert.equal(
    documentSchema.safeParse({
      ...doc,
      layers: [
        {
          ...doc.layers[0],
          assetInfo: {
            ...doc.layers[0].assetInfo,
            sourceUrl: "javascript:alert(1)",
          },
        },
      ],
    }).success,
    false,
  );
  source.destroy();
  peer.destroy();
});
test("desktop result decoding bounds bytes and rejects paths, unsupported types and malformed payloads", async () => {
  const input = {
    name: "result.json",
    type: "application/json",
    data: Buffer.from('{"example":true}').toString("base64"),
  };
  assert.equal(await downloadedResultFile(input).text(), '{"example":true}');
  for (const value of [
    null,
    { ...input, path: "C:/private" },
    { ...input, name: "../secret.json" },
    { ...input, type: "text/html" },
    { ...input, data: "%%%" },
    { ...input, data: Buffer.alloc(2_000_001).toString("base64") },
  ])
    assert.throws(() => downloadedResultFile(value));
});
