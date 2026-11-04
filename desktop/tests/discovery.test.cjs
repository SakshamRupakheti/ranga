const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { _electron, expect } = require("@playwright/test");

test(
  "Discover coordinates real views, a bounded first-party context and explicit clipboard handoff",
  { timeout: 90000 },
  async () => {
    const profile = await mkdtemp(path.join(tmpdir(), "ranga-discover-test-"));
    const server = http.createServer((_req, res) => {
      res.setHeader("content-type", "text/html; charset=utf-8");
      if (_req.url === "/child") {
        res.end("<!doctype html><p>Untrusted child frame</p>");
        return;
      }
      res.end(`<!doctype html><title>First-party fixture</title><h1>Project fixture</h1>
      <button id="publish">Open project</button><button id="readonly">Read-only project</button>
      <a href="/projects" id="leave">Leave project</a><iframe src="/child"></iframe>
      <script>
        const ctx = { key: 'local:fixture', name: 'Mathematics poster', query: 'Saved query', prompt: 'DESIGN BRIEF: 1080 × 1350. JSON SCHEMA: fixture.', editable: true };
        document.querySelector('#publish').onclick = () => window.rangaBridge.context(ctx);
        document.querySelector('#readonly').onclick = () => window.rangaBridge.context({...ctx, editable: false});
        window.receivedQueries = [];
        window.rangaBridge?.subscribe(event => {
          if (event.type === 'query') { window.receivedQueries.push(event.query); ctx.query = event.query; window.rangaBridge.context(ctx); }
        });
      </script>`);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const localUrl = `http://127.0.0.1:${server.address().port}/editor?id=fixture`;
    const env = {
      ...process.env,
      RANGA_DESKTOP_PROFILE: profile,
      RANGA_DESKTOP_TEST: "1",
      RANGA_DESKTOP_URL: localUrl,
    };
    delete env.ELECTRON_RUN_AS_NODE;
    let desktop;
    try {
      desktop = await _electron.launch({
        executablePath: require("electron"),
        args: [path.resolve(__dirname, "..")],
        env,
      });
      desktop.context().setDefaultTimeout(12000);
      await desktop.firstWindow();
      let toolbar, ranga;
      await expect
        .poll(() => {
          toolbar = desktop.windows().find((p) => p.url().startsWith("file:"));
          ranga = desktop.windows().find((p) => p.url().startsWith(localUrl));
          return Boolean(toolbar && ranga);
        })
        .toBe(true);
      await desktop.evaluate(({ session, clipboard, shell }) => {
        globalThis.fixtureCopies = [];
        globalThis.fixtureExternal = [];
        // Never inspect or overwrite the user's actual OS clipboard in tests.
        clipboard.writeText = (text) => {
          globalThis.fixtureCopies.push(text);
        };
        shell.openExternal = async (url) => {
          globalThis.fixtureExternal.push(url);
        };
        for (const site of ["chatgpt", "pinterest"])
          session
            .fromPartition(`persist:ranga-workspace-${site}`)
            .protocol.handle("https", (request) => {
              if (
                globalThis.failSearch &&
                request.url.includes("/search/pins/")
              )
                return Response.error();
              return new Response(
                `<!doctype html><title>${site} controlled fixture</title><h1>${site} controlled fixture</h1><input aria-label="Manual message"><a href="/login/">Sign in</a>`,
                { headers: { "content-type": "text/html" } },
              );
            });
      });
      await ranga
        .getByRole("button", { name: "Open project", exact: true })
        .click();
      await expect(toolbar.locator("#project")).toHaveText(
        "Mathematics poster",
      );
      await expect(toolbar.locator("#query")).toHaveValue("Saved query");
      await toolbar.locator("#query").fill("  数学\t poster & black #type  ");
      await toolbar
        .getByRole("button", { name: "Search", exact: true })
        .click();
      const query = "数学 poster & black #type";
      await expect(toolbar.locator("#query")).toHaveValue(query);
      await expect(toolbar.locator('[data-mode="discover"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect
        .poll(() => ranga.evaluate(() => window.receivedQueries))
        .toEqual([query]);
      await expect
        .poll(() =>
          desktop
            .windows()
            .some((p) => p.url().startsWith("https://chatgpt.com")),
        )
        .toBe(true);
      const chat = desktop
        .windows()
        .find((p) => p.url().startsWith("https://chatgpt.com"));
      const pin = desktop
        .windows()
        .find((p) => p.url().startsWith("https://www.pinterest.com"));
      assert.equal(new URL(pin.url()).searchParams.get("q"), query);
      await expect(chat.getByLabel("Manual message")).toHaveValue("");
      assert.deepEqual(
        await desktop.evaluate(() => globalThis.fixtureCopies),
        [],
      );

      const visible = () =>
        desktop.evaluate(({ BrowserWindow }) => {
          const parent = BrowserWindow.getAllWindows().find((w) =>
            w.webContents.getURL().startsWith("file:"),
          );
          return parent.contentView.children
            .filter(
              (v) =>
                v.webContents &&
                v.webContents !== parent.webContents &&
                v.getVisible(),
            )
            .map((v) => ({
              bounds: v.getBounds(),
              url: v.webContents.getURL(),
            }))
            .sort((a, b) => a.bounds.x - b.bounds.x);
        });
      assert.deepEqual(
        (await visible()).map((v) => new URL(v.url).hostname),
        ["www.pinterest.com", "chatgpt.com"],
      );
      await toolbar
        .getByRole("button", { name: "Prompt", exact: true })
        .click();
      await expect(toolbar.locator("#prompt-panel")).toBeVisible();
      await expect(toolbar.locator("#prompt")).toHaveValue(/1080 × 1350/);
      await toolbar.getByLabel("Left pane width").fill("65");
      await expect
        .poll(async () => {
          const [a, b] = await visible();
          return a.bounds.width > b.bounds.width;
        })
        .toBe(true);
      await toolbar.getByRole("button", { name: "Swap sides" }).click();
      assert.equal(new URL((await visible())[0].url).hostname, "chatgpt.com");
      await toolbar
        .getByRole("button", { name: "Copy & ChatGPT", exact: true })
        .click();
      await expect(toolbar.locator("#message")).toContainText("Prompt copied");
      const copies = await desktop.evaluate(() => globalThis.fixtureCopies);
      assert.equal(copies.length, 1);
      assert.match(copies[0], /JSON SCHEMA/);
      assert.ok(copies[0].includes(query));
      await expect(chat.getByLabel("Manual message")).toHaveValue("");
      assert.deepEqual(
        await chat.evaluate(() => [
          typeof window.rangaBridge,
          typeof window.rangaWorkspace,
          typeof require,
          typeof process,
        ]),
        ["undefined", "undefined", "undefined", "undefined"],
      );
      assert.equal(
        await chat.evaluate(async () => {
          try {
            await navigator.clipboard.readText();
            return "allowed";
          } catch {
            return "denied";
          }
        }),
        "denied",
      );

      // Real handler provenance: remote view, child frame, and incorrect file URL
      // must not invoke a toolbar command or claim a first-party project.
      await desktop.evaluate(({ ipcMain, webContents, BrowserWindow }) => {
        const parent = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().startsWith("file:"),
        );
        const remote = webContents
          .getAllWebContents()
          .find((w) => w.getURL().startsWith("https://chatgpt.com"));
        const local = webContents
          .getAllWebContents()
          .find((w) => w.getURL().includes("/editor?id=fixture"));
        const fake = {
          key: "local:fixture",
          name: "Spoofed",
          query: "hijacked",
          prompt: "bad",
          editable: true,
        };
        ipcMain.emit(
          "ranga:context",
          { sender: remote, senderFrame: remote.mainFrame },
          fake,
        );
        ipcMain.emit(
          "workspace:search",
          { sender: remote, senderFrame: remote.mainFrame },
          { query: "hijacked", projectKey: "local:fixture" },
        );
        ipcMain.emit(
          "ranga:context",
          { sender: local, senderFrame: local.mainFrame.frames[0] },
          fake,
        );
        ipcMain.emit(
          "workspace:mode",
          {
            sender: parent.webContents,
            senderFrame: { url: parent.webContents.getURL() },
          },
          "focus",
        );
        ipcMain.emit(
          "ranga:context",
          { sender: local, senderFrame: local.mainFrame },
          { ...fake, prompt: "x".repeat(150001) },
        );
      });
      await expect(toolbar.locator("#project")).toHaveText(
        "Mathematics poster",
      );
      await expect(toolbar.locator("#query")).toHaveValue(query);
      await expect(toolbar.locator('[data-mode="discover"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await toolbar.evaluate(() =>
        window.rangaWorkspace.search("x".repeat(501), "local:fixture"),
      );
      await expect(toolbar.locator("#message")).toContainText("500 characters");
      await toolbar.evaluate(() =>
        window.rangaWorkspace.search("Wrong project", "local:stale"),
      );
      await expect(toolbar.locator("#message")).toContainText(
        "active project changed",
      );
      await expect(toolbar.locator("#query")).toHaveValue(query);

      await toolbar
        .getByRole("button", { name: "Design", exact: true })
        .click();
      assert.ok((await visible()).some((v) => v.url.startsWith(localUrl)));
      await toolbar.getByRole("button", { name: "Focus", exact: true }).click();
      assert.equal((await visible()).length, 1);
      await expect(toolbar.locator("#prompt-panel")).toBeHidden();
      await ranga.getByRole("button", { name: "Read-only project" }).click();
      await toolbar.locator("#query").fill("Read-only direction");
      await toolbar
        .getByRole("button", { name: "Search", exact: true })
        .click();
      await expect(toolbar.locator("#message")).toContainText(
        "Read-only project",
      );
      assert.deepEqual(await ranga.evaluate(() => window.receivedQueries), [
        query,
      ]);

      await toolbar
        .getByRole("button", { name: "Prompt", exact: true })
        .click();
      await desktop.evaluate(({ clipboard }) => {
        clipboard.writeText = () => {
          throw new Error("fixture unavailable");
        };
      });
      await toolbar
        .getByRole("button", { name: "Copy & ChatGPT", exact: true })
        .click();
      await expect(toolbar.locator("#message")).toContainText(
        "Clipboard is unavailable",
      );
      await expect(toolbar.locator("#prompt")).toBeVisible();
      await desktop.evaluate(() => {
        globalThis.failSearch = true;
      });
      await toolbar.getByRole("button", { name: "Retry search" }).click();
      await expect.poll(() => pin.url()).toBe("https://www.pinterest.com/");
      await expect(toolbar.locator("#message")).toContainText(
        "Pinterest search could not load",
      );
      await desktop.evaluate(() => {
        globalThis.failSearch = false;
      });
      await toolbar.getByRole("button", { name: "Retry search" }).click();
      await expect
        .poll(() => new URL(pin.url()).searchParams.get("q"))
        .toBe("Read-only direction");
      await pin.getByRole("link", { name: "Sign in" }).click();
      await expect(toolbar.locator('[data-site="pinterest"]')).toHaveAttribute(
        "title",
        "Pinterest: Sign-in page",
      );
      await toolbar.getByRole("button", { name: "Open in browser" }).click();
      assert.deepEqual(
        await desktop.evaluate(() => globalThis.fixtureExternal),
        ["https://www.pinterest.com/"],
      );

      await desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].setContentSize(960, 650),
      );
      await expect
        .poll(() =>
          toolbar.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await expect
        .poll(() =>
          desktop.evaluate(({ BrowserWindow }) => {
            const parent = BrowserWindow.getAllWindows().find((w) =>
              w.webContents.getURL().startsWith("file:"),
            );
            const [, height] = parent.getContentSize();
            return parent.contentView.children
              .filter(
                (v) =>
                  v.webContents &&
                  v.webContents !== parent.webContents &&
                  v.getVisible(),
              )
              .every(
                (v) => v.getBounds().y + v.getBounds().height === height - 240,
              );
          }),
        )
        .toBe(true);
      await toolbar.getByRole("button", { name: "Focus", exact: true }).click();
      await ranga.getByRole("link", { name: "Leave project" }).click();
      await expect(toolbar.locator("#project")).toHaveText("No project open");
      await expect(toolbar.locator("#query")).toHaveValue("");
      await expect(toolbar.locator("#copy-prompt")).toBeDisabled();
    } finally {
      if (desktop) await desktop.close();
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
      assert.equal(path.dirname(path.resolve(profile)), path.resolve(tmpdir()));
      assert.ok(path.basename(profile).startsWith("ranga-discover-test-"));
      await rm(profile, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 250,
      });
    }
  },
);
