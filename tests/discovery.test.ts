import { test } from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { createDocument, documentSchema } from "../src/lib/document";
import { buildPrompt } from "../src/lib/design-recipe";
import {
  createShared,
  readShared,
  writeShared,
} from "../src/lib/shared-document";

test("project discovery queries survive backups and shared synchronization without replacing layers", () => {
  const initial = createDocument("editorial");
  const a = createShared(initial),
    b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  const next = {
    ...initial,
    discoveryQuery: "Mathematics poster, orange and black",
  };
  writeShared(a, next, initial);
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  assert.deepEqual(readShared(b), next);
  assert.deepEqual(
    documentSchema.parse(JSON.parse(JSON.stringify(next))),
    next,
  );
  assert.match(buildPrompt(next), /Mathematics poster, orange and black/);
  assert.deepEqual(readShared(b).layers, initial.layers);
  assert.equal(
    documentSchema.safeParse({ ...initial, discoveryQuery: "x".repeat(501) })
      .success,
    false,
  );
  assert.equal(
    documentSchema.safeParse({ ...initial, discoveryQuery: "hidden\u0000text" })
      .success,
    false,
  );
  a.destroy();
  b.destroy();
});
