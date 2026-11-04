const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  allowedNavigation,
  externalUrl,
  isCommand,
  isSite,
  originLabel,
  paneBounds,
  rangaUrl,
} = require("../dist/policy.js");
const local = "http://127.0.0.1:3001/projects";

test("Ranga is restricted to the configured loopback origin", () => {
  assert.equal(rangaUrl(), local);
  assert.equal(
    rangaUrl("http://localhost:3010/projects"),
    "http://localhost:3010/projects",
  );
  for (const url of [
    "https://example.com/",
    "file:///tmp/app",
    "http://a:b@localhost/",
    "invalid",
  ]) {
    assert.throws(() => rangaUrl(url));
  }
  assert.equal(
    allowedNavigation("ranga", "http://127.0.0.1:3001/editor?id=1", local),
    true,
  );
  assert.equal(
    allowedNavigation("ranga", "http://127.0.0.1:3003/", local),
    false,
  );
  assert.equal(
    allowedNavigation("ranga", "http://localhost:3001/", local),
    false,
  );
});

test("tool navigation allows official sites and sign-in, rejects spoofed hosts and privileges", () => {
  for (const url of [
    "https://chatgpt.com/",
    "https://auth.openai.com/",
    "https://accounts.google.com/",
  ]) {
    assert.equal(allowedNavigation("chatgpt", url, local), true, url);
  }
  assert.equal(
    allowedNavigation("pinterest", "https://www.pinterest.com/pin/1/", local),
    true,
  );
  for (const url of [
    "http://chatgpt.com/",
    "https://chatgpt.com.evil.test/",
    "https://notchatgpt.com/",
    "https://chatgpt.com:8888/",
    "https://user:pass@chatgpt.com/",
    "file:///C:/secret",
    "javascript:alert(1)",
    "data:text/html,hi",
    local,
    "https://www.pinterest.com/",
  ]) {
    assert.equal(allowedNavigation("chatgpt", url, local), false, url);
  }
});

test("system browser handoff rejects executable URLs and credentials", () => {
  assert.equal(
    externalUrl("https://example.com/art"),
    "https://example.com/art",
  );
  assert.equal(externalUrl(local, local), local);
  for (const url of [
    local,
    "http://example.com/",
    "file:///tmp/a",
    "javascript:alert(1)",
    "ms-settings:",
    "https://user:pass@example.com/",
  ]) {
    assert.equal(externalUrl(url), undefined, url);
  }
  assert.equal(
    originLabel("https://chatgpt.com/path?token=secret#private"),
    "chatgpt.com",
  );
});

test("IPC command and site vocabulary is closed", () => {
  assert.ok(isCommand("split"));
  assert.ok(isSite("pinterest"));
  for (const value of [
    null,
    {},
    "__proto__",
    "execute",
    "https://example.com/",
  ]) {
    assert.equal(isCommand(value), false);
    assert.equal(isSite(value), false);
  }
});

test("panes respect toolbar and exactly fill resized content without overlap", () => {
  for (const width of [960, 1201, 1480]) {
    const [left, right] = paneBounds(width, 900, true);
    assert.equal(left.y, 132);
    assert.equal(left.height, 768);
    assert.equal(right.x, left.width + 2);
    assert.equal(right.x + right.width, width);
    assert.equal(right.height, left.height);
  }
  assert.deepEqual(paneBounds(960, 650, false), [
    { x: 0, y: 132, width: 960, height: 518 },
  ]);
  assert.equal(paneBounds(960, 100, false)[0].height, 0);
});
