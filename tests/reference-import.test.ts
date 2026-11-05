import { test } from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import {
  referenceText,
  transferText,
  validateReferenceImport,
} from "../src/lib/reference-import";
import {
  createDocument,
  documentSchema,
  sourceUrlSchema,
} from "../src/lib/document";
import { writeShared, readShared } from "../src/lib/shared-document";

test("reference text stays attributed data and rejects unsafe or unbounded inputs", () => {
  for (const value of ["", "https:", "https://", "bad url", "file:///private"])
    assert.equal(sourceUrlSchema.safeParse(value).success, false);
  assert.deepEqual(referenceText(" https://example.test/art.png "), {
    sourceUrl: "https://example.test/art.png",
  });
  assert.deepEqual(referenceText("  Quiet cream with large typography  "), {
    note: "Quiet cream with large typography",
  });
  for (const value of [
    "",
    "x".repeat(2001),
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "file:///private",
    "https://user:pass@example.test",
    '{"format":"ranga.recipe"}',
    "```json\n{}\n```",
  ])
    assert.throws(() => referenceText(value));
  const data = (uri: string, plain = "") => ({
    getData: (type: string) =>
      type === "text/uri-list"
        ? uri
        : type === "text/plain"
          ? plain
          : '<img src="https://private.test/image">',
  });
  assert.equal(
    transferText(data("# source\r\nhttps://example.test/art\r\n", "other")),
    "https://example.test/art",
  );
  assert.equal(transferText(data("", "description")), "description");
  assert.equal(transferText(data("")), ""); // HTML alone never becomes a fetched image.
  assert.throws(() => transferText(data("https://a.test\nhttps://b.test")));
  assert.throws(() => transferText(data("x".repeat(8001))));
  assert.throws(() => transferText(data("", "x".repeat(2001))));
});

test("confirmed images and written references round-trip through the existing document and CRDT", () => {
  const base = {
    id: "asset",
    name: "Permitted image",
    selected: true,
    src: "data:image/png;base64,AAAA",
    kind: "generated",
    addedAt: "2026-11-04T10:00:00.000Z",
  };
  assert.throws(() => validateReferenceImport(base));
  assert.throws(() =>
    validateReferenceImport({ ...base, permissionConfirmed: false }),
  );
  const image = validateReferenceImport({ ...base, permissionConfirmed: true });
  const note = validateReferenceImport({
    id: "note",
    name: "Typography",
    selected: false,
    note: "Condensed type, original composition",
    kind: "inspiration",
  });
  const doc = documentSchema.parse({
    ...createDocument(),
    references: [image, note],
  });
  assert.deepEqual(documentSchema.parse(JSON.parse(JSON.stringify(doc))), doc);
  const shared = new Y.Doc();
  writeShared(shared, doc);
  assert.deepEqual(readShared(shared).references, doc.references);
  // Existing files did not record rights metadata and remain readable.
  assert.ok(
    documentSchema.safeParse({
      ...doc,
      references: [{ ...base, kind: "owned" }],
    }).success,
  );
  shared.destroy();
});
