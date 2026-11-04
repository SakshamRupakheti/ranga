const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { _electron, expect } = require("@playwright/test");

test(
  "desktop switches and splits isolated sites, blocks unsafe handoffs, and recovers from offline Ranga",
  { timeout: 90000 },
  async () => {
    const profile = await mkdtemp(path.join(tmpdir(), "ranga-desktop-test-"));
    const server = http.createServer((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(
        "<!doctype html><title>Ranga test fixture</title><h1>Ranga test fixture</h1>",
      );
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const localUrl = `http://127.0.0.1:${server.address().port}/projects`;
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
        timeout: 30000,
      });
      desktop.context().setDefaultTimeout(10000);
      await desktop.firstWindow();
      let toolbar;
      await expect
        .poll(() => {
          toolbar = desktop
            .windows()
            .find((page) => page.url().startsWith("file:"));
          return Boolean(toolbar);
        })
        .toBe(true);
      await expect(
        toolbar.getByRole("button", { name: "Ranga", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      // Third-party pages are explicit fixtures. This tests the shell without
      // logging into, automating or claiming compatibility with live accounts.
      await desktop.evaluate(({ session }) => {
        for (const site of ["chatgpt", "pinterest"]) {
          session
            .fromPartition(`persist:ranga-workspace-${site}`)
            .protocol.handle(
              "https",
              () =>
                new Response(
                  `<!doctype html><title>${site} test fixture</title><h1>${site} test fixture</h1><a id="next" href="/next">Next</a><a id="outside" href="https://example.com/board">External link</a>`,
                  { headers: { "content-type": "text/html" } },
                ),
            );
        }
      });
      await expect
        .poll(() =>
          desktop.evaluate(
            ({ webContents }) =>
              webContents
                .getAllWebContents()
                .filter((w) => w.getURL().startsWith("http://127.0.0.1"))
                .length,
          ),
        )
        .toBe(1);
      await toolbar
        .getByRole("button", { name: "ChatGPT", exact: true })
        .click();
      await expect(toolbar.locator("#origin")).toHaveText("chatgpt.com");
      await toolbar
        .getByRole("button", { name: "Split workspace", exact: true })
        .click();
      await expect(toolbar.locator("#split")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const panes = await desktop.evaluate(({ BrowserWindow }) => {
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
          .map((v) => ({ bounds: v.getBounds(), url: v.webContents.getURL() }));
      });
      assert.equal(panes.length, 2);
      assert.equal(panes[0].bounds.y, 132);
      assert.equal(panes[1].bounds.x, panes[0].bounds.width + 2);
      assert.ok(panes.some((p) => p.url.startsWith(localUrl)));
      assert.ok(panes.some((p) => p.url.startsWith("https://chatgpt.com")));

      const security = await desktop.evaluate(async ({ webContents }) => {
        const remote = webContents
          .getAllWebContents()
          .find((w) => w.getURL().startsWith("https://chatgpt.com"));
        const prefs = remote.getLastWebPreferences();
        return {
          sandbox: prefs.sandbox,
          contextIsolation: prefs.contextIsolation,
          nodeIntegration: prefs.nodeIntegration,
          webSecurity: prefs.webSecurity,
          globals: await remote.executeJavaScript(
            "[typeof require, typeof process, typeof window.rangaWorkspace]",
          ),
        };
      });
      assert.deepEqual(security, {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        globals: ["undefined", "undefined", "undefined"],
      });

      const chatPage = desktop
        .windows()
        .find((page) => page.url().startsWith("https://chatgpt.com"));
      assert.ok(chatPage);
      await chatPage
        .getByRole("link", { name: "Next", exact: true })
        .click({ noWaitAfter: true });
      await expect
        .poll(() =>
          desktop.evaluate(({ webContents }) =>
            webContents
              .getAllWebContents()
              .find((w) => w.getURL().startsWith("https://chatgpt.com"))
              .getURL(),
          ),
        )
        .toBe("https://chatgpt.com/next");
      await expect(
        toolbar.getByRole("button", { name: "Back", exact: true }),
      ).toBeEnabled();
      await toolbar.getByRole("button", { name: "Back", exact: true }).click();
      await expect(
        toolbar.getByRole("button", { name: "Forward", exact: true }),
      ).toBeEnabled();

      await desktop.evaluate(({ shell }) => {
        globalThis.testOpenedUrls = [];
        shell.openExternal = async (url) => {
          globalThis.testOpenedUrls.push(url);
        };
      });
      // Electron intentionally cancels this navigation; there is no navigation
      // completion event for Playwright to wait for.
      await chatPage
        .getByRole("link", { name: "External link" })
        .click({ noWaitAfter: true });
      await expect(toolbar.locator("#open-link")).toBeVisible();
      await expect(toolbar.locator("#message")).toContainText("example.com");
      await expect(toolbar.locator("#origin")).toHaveText("chatgpt.com");
      await toolbar.getByRole("button", { name: "Open link" }).click();
      await expect(toolbar.locator("#open-link")).toBeHidden();
      await toolbar.getByRole("button", { name: "Open in browser" }).click();
      await expect
        .poll(() => desktop.evaluate(() => globalThis.testOpenedUrls))
        .toEqual(["https://example.com/board", "https://chatgpt.com/"]);

      await toolbar
        .getByRole("button", { name: "Pinterest", exact: true })
        .click();
      await expect(toolbar.locator("#origin")).toHaveText("www.pinterest.com");
      await expect(toolbar.locator("#split")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      assert.equal(
        await desktop.evaluate(async ({ session }) => {
          const chat = session.fromPartition("persist:ranga-workspace-chatgpt");
          const pin = session.fromPartition(
            "persist:ranga-workspace-pinterest",
          );
          const ranga = session.fromPartition("persist:ranga-workspace-ranga");
          await chat.cookies.set({
            url: "https://accounts.google.com",
            name: "test-isolation",
            value: "fixture",
            secure: true,
          });
          return (
            chat !== pin &&
            chat !== ranga &&
            pin !== ranga &&
            (await pin.cookies.get({ name: "test-isolation" })).length === 0 &&
            (await ranga.cookies.get({ name: "test-isolation" })).length === 0
          );
        }),
        true,
      );

      await toolbar.getByRole("button", { name: "Ranga", exact: true }).click();
      await expect(toolbar.locator("#split")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].setContentSize(1050, 720),
      );
      await expect
        .poll(() =>
          desktop.evaluate(({ BrowserWindow }) => {
            const parent = BrowserWindow.getAllWindows()[0];
            const [width, height] = parent.getContentSize();
            const visible = parent.contentView.children
              .filter(
                (v) =>
                  v.webContents &&
                  v.webContents !== parent.webContents &&
                  v.getVisible(),
              )
              .map((v) => v.getBounds());
            return (
              visible.length === 1 &&
              visible[0].x === 0 &&
              visible[0].y === 132 &&
              visible[0].width === width &&
              visible[0].height === height - 132
            );
          }),
        )
        .toBe(true);

      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
      await toolbar
        .getByRole("button", { name: "Reload", exact: true })
        .click();
      await expect(toolbar.locator("#message")).toContainText(
        "Ranga is offline",
      );
    } catch (error) {
      if (desktop)
        console.error(
          "Desktop test state:",
          await desktop.evaluate(({ webContents }) =>
            webContents.getAllWebContents().map((w) => ({
              url: w.getURL(),
              back: w.navigationHistory.canGoBack(),
              entries: w.navigationHistory.getAllEntries(),
            })),
          ),
        );
      throw error;
    } finally {
      if (desktop) await desktop.close();
      if (server.listening)
        await new Promise((resolve) => {
          server.close(resolve);
          server.closeAllConnections();
        });
      assert.equal(path.dirname(path.resolve(profile)), path.resolve(tmpdir()));
      assert.ok(path.basename(profile).startsWith("ranga-desktop-test-"));
      await rm(profile, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 250,
      });
    }
  },
);
