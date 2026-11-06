const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, writeFile, rm, truncate } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const {
  recordDownload,
  readCompletedDownload,
} = require("../dist/download-handoff");

test("completed downloads are bounded and read only through an explicit handoff", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ranga-download-test-"));
  try {
    const file = path.join(root, "result.json");
    await writeFile(file, '{"format":"ranga.recipe"}');
    const record = await recordDownload(file);
    const payload = await readCompletedDownload(record);
    assert.equal(payload.name, "result.json");
    assert.equal(payload.type, "application/json");
    assert.equal(
      Buffer.from(payload.data, "base64").toString(),
      '{"format":"ranga.recipe"}',
    );
    assert.deepEqual(Object.keys(payload).sort(), ["data", "name", "type"]);
    await writeFile(file, "changed");
    await assert.rejects(readCompletedDownload(record), /changed/);
    await truncate(file, 2_000_001);
    await assert.rejects(recordDownload(file), /too large/);
    await assert.rejects(
      recordDownload(path.join(root, "result.html")),
      /PNG, JPG, WebP or JSON/,
    );
    await rm(file);
    await assert.rejects(readCompletedDownload(record));
    await assert.rejects(
      recordDownload(file),
      (error) =>
        error.message.includes("saved download is unavailable") &&
        !error.message.includes(root),
    );
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("ranga-download-test-"));
    await rm(root, { recursive: true, force: true });
  }
});
