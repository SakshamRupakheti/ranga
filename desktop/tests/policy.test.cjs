const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  allowedNavigation,
  externalUrl,
  isCommand,
  isSite,
  originLabel,
  paneBounds,
  referenceTrayBounds,
  rangaUrl,
  normalizeQuery,
  pinterestSearchUrl,
  discoveryPrompt,
  validContext,
  projectKey,
  isMode,
} = require("../dist/policy.js");
const local = "http://127.0.0.1:3001/projects";

test("reference tray preserves two usable discovery panes at minimum and large sizes", () => {
  for (const [width, height] of [
    [960, 611],
    [960, 650],
    [1440, 900],
  ]) {
    const tray = referenceTrayBounds(width, height);
    const panes = paneBounds(width, height, true, 0.5, tray.height + 2);
    assert.equal(tray.y + tray.height, height);
    assert.equal(tray.width, width);
    assert.ok(tray.height >= 230 && tray.height <= 380);
    for (const pane of panes) {
      assert.equal(pane.y + pane.height + 2, tray.y);
      assert.ok(pane.width >= 479 && pane.height >= 230);
    }
  }
});

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

test("discovery normalizes queries, encodes one search parameter and rejects unbounded input", () => {
  assert.equal(
    normalizeQuery("  math\nposter\t orange & black  "),
    "math poster orange & black",
  );
  const query = "数学 poster & q=extra #logo? 100%";
  const url = new URL(pinterestSearchUrl(query));
  assert.equal(url.origin, "https://www.pinterest.com");
  assert.equal(url.pathname, "/search/pins/");
  assert.equal(url.searchParams.get("q"), query);
  assert.equal([...url.searchParams].length, 1);
  assert.equal(url.hash, "");
  assert.ok(allowedNavigation("pinterest", url.href, local));
  for (const invalid of [
    null,
    {},
    "",
    " \n ",
    "a".repeat(501),
    "hidden\u0000text",
    "bidi\u202etext",
  ])
    assert.throws(() => normalizeQuery(invalid));
  assert.equal(discoveryPrompt(query), discoveryPrompt(query));
  assert.match(discoveryPrompt(query), /attach permitted images myself/);
});

test("first-party context is bound to the editor project and bounded before clipboard use", () => {
  const key = "local:one";
  assert.equal(
    projectKey(`${local.replace("/projects", "/editor")}?id=one`, local),
    key,
  );
  assert.equal(projectKey("https://evil.test/editor?id=one", local), null);
  assert.equal(projectKey(local + "?id=one", local), null);
  const context = {
    key,
    name: "Poster",
    query: "Orange",
    prompt: "Existing recipe schema",
    editable: true,
  };
  assert.ok(validContext(context, key));
  for (const invalid of [
    { ...context, key: "local:other" },
    { ...context, prompt: "x".repeat(150001) },
    { ...context, query: "x".repeat(501) },
    { ...context, extra: "execute" },
    { ...context, editable: "yes" },
  ])
    assert.equal(validContext(invalid, key), false);
  assert.match(discoveryPrompt("Poster", context), /Existing recipe schema/);
  assert.equal(validContext(context, null), false);
  assert.ok(isMode("discover"));
  assert.equal(isMode("execute"), false);
});

test("adjusted panes keep the prompt panel clear at minimum and large window sizes", () => {
  for (const width of [960, 1920])
    for (const ratio of [0.35, 0.5, 0.65]) {
      const [left, right] = paneBounds(width, 650, true, ratio, 240);
      assert.equal(left.y + left.height, 410);
      assert.equal(right.x + right.width, width);
      assert.ok(left.width > 300 && right.width > 300);
    }
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
