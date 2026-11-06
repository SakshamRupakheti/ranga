const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm, readFile, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { _electron, expect } = require("@playwright/test");

test(
  "completed remote downloads require an explicit project-bound handoff and never expose file paths",
  { timeout: 90000 },
  async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "ranga-download-workspace-"),
    );
    const target = path.join(root, "result.json");
    const server = http.createServer((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(`<!doctype html><title>Download fixture</title><button id="open">Open project</button><a id="leave" href="/projects">Leave</a><script>
      window.downloads = [];
      document.querySelector('#open').onclick = () => window.rangaBridge.context({ key:'local:download-test', name:'Download project', query:'', prompt:'A project prompt', editable:true });
      window.rangaBridge?.subscribe(event => { if (event.type === 'download') window.downloads.push(event); });
    </script>`);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const local = `http://127.0.0.1:${server.address().port}`;
    const env = {
      ...process.env,
      RANGA_DESKTOP_PROFILE: path.join(root, "profile"),
      RANGA_DESKTOP_TEST: "1",
      RANGA_DESKTOP_URL: `${local}/editor?id=download-test`,
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
          toolbar = desktop
            .windows()
            .find((page) => page.url().startsWith("file:"));
          ranga = desktop
            .windows()
            .find((page) => page.url().startsWith(local));
          return Boolean(toolbar && ranga);
        })
        .toBe(true);
      await desktop.evaluate(({ session }) => {
        session
          .fromPartition("persist:ranga-workspace-chatgpt")
          .protocol.handle(
            "https",
            () =>
              new Response(
                `<!doctype html><title>Controlled ChatGPT fixture</title><button id="download">Download recipe</button><script>document.querySelector('#download').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['{"format":"ranga.recipe"}'], {type:'application/json'})); a.download='result.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };</script>`,
                { headers: { "content-type": "text/html" } },
              ),
          );
      });
      await ranga.locator("#open").click();
      await expect(toolbar.locator("#project")).toHaveText("Download project");
      await toolbar
        .getByRole("button", { name: "Design", exact: true })
        .click();
      let chat;
      await expect
        .poll(() => {
          chat = desktop
            .windows()
            .find((page) => page.url().startsWith("https://chatgpt.com"));
          return Boolean(chat);
        })
        .toBe(true);
      assert.equal(
        await chat.evaluate(() => typeof window.rangaBridge),
        "undefined",
      );
      assert.equal(
        await chat.evaluate(() => typeof window.rangaWorkspace),
        "undefined",
      );
      async function download() {
        // Only this test supplies a temporary save path, avoiding an OS dialog.
        // The product always leaves Chromium's Save dialog enabled.
        await desktop.evaluate(({ session }, target) => {
          session
            .fromPartition("persist:ranga-workspace-chatgpt")
            .once("will-download", (_event, item) => item.setSavePath(target));
        }, target);
        await chat
          .getByRole("button", { name: "Download recipe", exact: true })
          .click();
        await expect(toolbar.locator("#import-download")).toBeVisible();
      }
      await download();
      assert.deepEqual(await ranga.evaluate(() => window.downloads), []);
      assert.equal(await readFile(target, "utf8"), '{"format":"ranga.recipe"}');
      await desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].setContentSize(960, 650),
      );
      assert.equal(
        await toolbar.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await toolbar.locator("#import-download").click();
      await expect
        .poll(() => ranga.evaluate(() => window.downloads.length))
        .toBe(1);
      const event = await ranga.evaluate(() => window.downloads[0]);
      assert.equal(event.key, "local:download-test");
      assert.deepEqual(Object.keys(event.file).sort(), [
        "data",
        "name",
        "type",
      ]);
      assert.equal(
        Buffer.from(event.file.data, "base64").toString(),
        '{"format":"ranga.recipe"}',
      );
      await expect(toolbar.locator("#import-download")).toBeHidden();
      // A stale first-party action must not switch the active mode.
      await ranga.evaluate(() => window.rangaBridge.focusCanvas("local:stale"));
      await expect(toolbar.locator('[data-mode="design"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await ranga.evaluate(() =>
        window.rangaBridge.focusCanvas("local:download-test"),
      );
      await expect(toolbar.locator('[data-mode="focus"]')).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await toolbar
        .getByRole("button", { name: "Design", exact: true })
        .click();
      await download();
      await toolbar.locator("#dismiss-download").click();
      await expect(toolbar.locator("#import-download")).toBeHidden();
      assert.equal(await readFile(target, "utf8"), '{"format":"ranga.recipe"}');
      await download();
      await writeFile(target, "changed after download");
      await toolbar.locator("#import-download").click();
      await expect(toolbar.locator("#message")).toContainText(
        "unavailable or changed",
      );
      assert.equal(await ranga.evaluate(() => window.downloads.length), 1);
      await download();
      await ranga.locator("#leave").click();
      await expect(toolbar.locator("#project")).toHaveText("No project open");
      await expect(toolbar.locator("#import-download")).toBeHidden();
      const shortcut = await desktop.evaluate(
        ({ Menu }) =>
          Menu.getApplicationMenu()
            .items.find((item) => item.label === "Workspace")
            .submenu.items.find((item) => item.label === "Bring into Ranga")
            .accelerator,
      );
      assert.equal(shortcut, "CmdOrCtrl+Alt+B");
    } finally {
      if (desktop) await desktop.close();
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
      assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
      assert.ok(path.basename(root).startsWith("ranga-download-workspace-"));
      await rm(root, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 250,
      });
    }
  },
);
