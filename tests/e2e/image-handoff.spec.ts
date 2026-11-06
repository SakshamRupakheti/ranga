import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { createDocument } from "../../src/lib/document";
import type { SavedProject } from "../../src/lib/storage";
import type { DiscoveryEvent } from "../../src/lib/desktop-bridge";

async function saved(page: Page): Promise<SavedProject> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("ranga-local-v1");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result,
            request = db
              .transaction("projects")
              .objectStore("projects")
              .get(new URL(location.href).searchParams.get("id")!);
          request.onsuccess = () => {
            resolve(request.result);
            db.close();
          };
          request.onerror = () => {
            reject(request.error);
            db.close();
          };
        };
      }),
  );
}
async function ready(page: Page, shared = false) {
  await expect(page.locator(".save-status")).toHaveText(
    shared ? "Saved to local server" : "Saved on this device",
  );
}
async function openReturn(page: Page) {
  await page
    .getByRole("button", { name: "Creative tools", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Bring into Ranga", exact: true })
    .click();
}
async function chooseImage(page: Page, buffer: Buffer, name = "generated.png") {
  await page
    .getByLabel("Choose result file")
    .setInputFiles({ name, mimeType: "image/png", buffer });
  await expect(page.getByAltText("Reference import preview")).toBeVisible();
}
async function exportPng(page: Page) {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const wait = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG image Full resolution" }).click();
  return readFile((await (await wait).path())!);
}
const makeImage = () =>
  sharp({
    create: { width: 2000, height: 1000, channels: 3, background: "#bd442d" },
  })
    .png()
    .toBuffer();

test("confirmed image import checkpoints, fits the canvas, preserves attribution and survives Undo, export and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/editor?new=blank");
  await ready(page);
  await openReturn(page);
  await chooseImage(page, await makeImage());
  const apply = page.getByRole("button", {
    name: "Add image layer",
    exact: true,
  });
  await expect(apply).toBeDisabled();
  await page
    .getByLabel("Source URL / attribution")
    .fill("https://example.test/illustration");
  await page
    .getByLabel("Reference description")
    .fill("Original red illustration");
  await page.getByLabel("I have permission to import this image.").check();
  await page
    .getByRole("combobox", { name: "Reference use", exact: true })
    .selectOption("inspiration");
  await expect(apply).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Reference use", exact: true })
    .selectOption("generated");
  await apply.click();
  await ready(page);
  const result = await saved(page),
    layer = result.document.layers[0];
  expect(result.document.layers).toHaveLength(1);
  expect(result.document.references).toHaveLength(0);
  expect(layer.width).toBe(720);
  expect(layer.height).toBe(360);
  expect(layer.x).toBe(90);
  expect(layer.y).toBe(420);
  expect(layer.assetInfo).toMatchObject({
    kind: "generated",
    permissionConfirmed: true,
    note: "Original red illustration",
    sourceUrl: "https://example.test/illustration",
  });
  expect(result.versions[0].document.layers).toHaveLength(0);
  await expect(
    page.getByText("internal text and shapes are flattened", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await ready(page);
  expect((await saved(page)).document.layers).toHaveLength(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await ready(page);
  await page.reload();
  await ready(page);
  await page
    .getByRole("button", { name: "generated.png", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "View image source" }),
  ).toHaveAttribute("href", "https://example.test/illustration");
  const png = await exportPng(page);
  expect(await sharp(png).metadata()).toMatchObject({
    width: 900,
    height: 1200,
  });
  expect([
    ...(await sharp(png)
      .extract({ left: 450, top: 600, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer()),
  ]).toEqual([189, 68, 45]);
  await page.screenshot({
    path: "docs/screenshots/image-handoff.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("image checkpoint failure retains the preview, and existing permitted references can become layers", async ({
  page,
}) => {
  await page.goto("/editor?new=editorial");
  await ready(page);
  const before = await saved(page);
  await openReturn(page);
  await chooseImage(page, await makeImage());
  await page.getByLabel("I have permission to import this image.").check();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === "projects" && value.versions?.length)
        throw new DOMException("Fixture quota", "QuotaExceededError");
      return original.call(this, value, key!);
    };
  });
  await page
    .getByRole("button", { name: "Add image layer", exact: true })
    .click();
  await expect(page.locator(".reference-import [role=alert]")).toContainText(
    "checkpoint could not be saved",
  );
  await expect(page.getByAltText("Reference import preview")).toBeVisible();
  expect((await saved(page)).document.layers).toEqual(before.document.layers);
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await ready(page);
  await page.getByRole("button", { name: "References", exact: true }).click();
  await page.getByLabel("Upload reference image").setInputFiles({
    name: "owned.png",
    mimeType: "image/png",
    buffer: await makeImage(),
  });
  await page
    .getByRole("combobox", { name: "Reference use", exact: true })
    .selectOption("owned");
  await page.getByLabel("I have permission to import this image.").check();
  await page
    .getByRole("button", { name: "Add reference", exact: true })
    .click();
  await ready(page);
  await page
    .getByRole("button", { name: "Add owned.png to canvas", exact: true })
    .click();
  await ready(page);
  const result = await saved(page);
  expect(result.document.layers).toHaveLength(
    before.document.layers.length + 1,
  );
  expect(result.document.references).toHaveLength(1);
  expect(result.document.layers.at(-1)?.assetInfo?.kind).toBe("owned");
  expect(result.versions[0].document.layers).toEqual(before.document.layers);
});

test("recipe visual preview matches rendered output and stays usable on a compact keyboard workflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/editor?new=blank");
  await ready(page);
  await page.getByRole("button", { name: "Toggle tools", exact: true }).click();
  await openReturn(page);
  await expect(
    page.getByRole("heading", { name: "Bring into Ranga", exact: true }),
  ).toBeFocused();
  const recipe = {
    format: "ranga.recipe",
    version: 1,
    title: "Visual proof",
    canvas: { width: 300, height: 400, background: "#fffefa" },
    elements: [
      {
        type: "rect",
        name: "Blue block",
        x: 20,
        y: 20,
        width: 260,
        height: 100,
        fill: "#2244aa",
      },
      {
        type: "text",
        name: "Editable headline",
        text: "RANGA",
        x: 20,
        y: 180,
        width: 260,
        height: 80,
        fontSize: 48,
        fill: "#222222",
      },
    ],
  };
  await page.getByLabel("Returned text or recipe").fill(JSON.stringify(recipe));
  await page
    .getByRole("button", { name: "Preview result", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  const preview = page.getByAltText("Design preview: Visual proof");
  await expect(preview).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Recipe preview", exact: true }),
  ).toBeFocused();
  const src = await preview.getAttribute("src");
  const buffer = Buffer.from(src!.split(",")[1], "base64");
  expect([
    ...(await sharp(buffer)
      .extract({ left: 40, top: 40, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer()),
  ]).toEqual([34, 68, 170]);
  expect((await saved(page)).document.layers).toHaveLength(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "docs/screenshots/recipe-preview-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Apply validated design", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await ready(page);
  await expect(page.locator(".upper-canvas")).toBeVisible();
  const output = await exportPng(page);
  expect([
    ...(await sharp(output)
      .extract({ left: 40, top: 40, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer()),
  ]).toEqual([34, 68, 170]);
  expect((await saved(page)).document.layers[1].type).toBe("text");
});

test("download handoff remains project-bound and awaits preview and confirmation", async ({
  page,
}) => {
  type FixtureWindow = Window & {
    fixtureContext: { key: string };
    fixtureDispatch: (value: DiscoveryEvent) => void;
    fixtureCanvas: string[];
  };
  await page.addInitScript(() => {
    const w = window as unknown as FixtureWindow;
    w.fixtureCanvas = [];
    w.rangaBridge = {
      context: (value) => {
        if (value) w.fixtureContext = value;
      },
      openChatGPT: () => {},
      focusCanvas: (key) => w.fixtureCanvas.push(key),
      subscribe: (callback) => {
        w.fixtureDispatch = callback;
        return () => {};
      },
    };
  });
  await page.goto("/editor?new=blank");
  await ready(page);
  const data = (await makeImage()).toString("base64");
  const dispatch = (key?: string) =>
    page.evaluate(
      ({ data, key }) => {
        const w = window as unknown as FixtureWindow;
        w.fixtureDispatch({
          type: "download",
          key: key ?? w.fixtureContext.key,
          file: { name: "download.png", type: "image/png", data },
        });
      },
      { data, key },
    );
  await dispatch("local:stale");
  await expect(
    page.getByRole("button", { name: "Preview downloaded file" }),
  ).toHaveCount(0);
  await dispatch();
  await expect(
    page.getByRole("button", { name: "Preview downloaded file" }),
  ).toBeVisible();
  expect((await saved(page)).document.layers).toHaveLength(0);
  await page.getByRole("button", { name: "Preview downloaded file" }).click();
  await expect(
    page.getByRole("button", { name: "Add image layer", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("I have permission to import this image.").check();
  await page
    .getByRole("button", { name: "Add image layer", exact: true })
    .click();
  await ready(page);
  expect((await saved(page)).document.layers).toHaveLength(1);
  expect(
    await page.evaluate(
      () => (window as unknown as FixtureWindow).fixtureCanvas,
    ),
  ).toHaveLength(1);
});

test("shared image import merges a collaborator's edit, retries an upload failure and refuses revoked access", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const context = await browser.newContext(),
    peer = await context.newPage();
  const password = "Ranga-image-test-123",
    suffix = crypto.randomUUID();
  const headers = {
    Origin: process.env.RANGA_TEST_BASE_URL ?? "http://127.0.0.1:3001",
  };
  let release: (() => void) | undefined;
  try {
    for (const [p, name] of [
      [page, "Owner"],
      [peer, "Editor"],
    ] as const) {
      const result = await p.request.post("/api/auth/sign-up/email", {
        headers,
        data: {
          name,
          email: `${name.toLowerCase()}-${suffix}@ranga.test`,
          password,
        },
      });
      expect(result.ok()).toBe(true);
    }
    const created = await page.request.post("/api/projects", {
      headers,
      data: { document: createDocument("blank") },
    });
    const { id } = await created.json();
    const invite = await page.request.post(`/api/projects/${id}/invitations`, {
      headers,
      data: { role: "editor" },
    });
    const { url } = await invite.json();
    expect(
      (
        await peer.request.post("/api/invitations/accept", {
          headers,
          data: { token: new URL(url).hash.slice(1) },
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`/editor?shared=${id}`);
    await peer.goto(`/editor?shared=${id}`);
    await ready(page, true);
    await ready(peer, true);
    await openReturn(page);
    const png = await makeImage();
    await chooseImage(page, png);
    await page.getByLabel("I have permission to import this image.").check();
    await page.route("**/api/projects/*/assets", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Upload unavailable. Try again." }),
      }),
    );
    await page
      .getByRole("button", { name: "Add image layer", exact: true })
      .click();
    await expect(page.locator(".reference-import [role=alert]")).toContainText(
      "Upload unavailable",
    );
    await expect(page.getByAltText("Reference import preview")).toBeVisible();
    await page.unroute("**/api/projects/*/assets");
    let started!: () => void;
    const seen = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/projects/*/assets", async (route) => {
      started();
      await gate;
      await route.continue();
    });
    await page
      .getByRole("button", { name: "Add image layer", exact: true })
      .click();
    await seen;
    await peer.getByRole("button", { name: "Text", exact: true }).click();
    await peer.getByLabel("Text content").fill("A collaborator's live edit");
    await peer.getByLabel("Project title").fill("Shared illustration");
    await ready(peer, true);
    await expect(page.getByLabel("Project title")).toHaveValue(
      "Shared illustration",
    );
    await ready(page, true);
    release!();
    await expect(
      page.getByRole("button", { name: "generated.png", exact: true }),
    ).toBeVisible();
    await page.unroute("**/api/projects/*/assets");
    await ready(page, true);
    await ready(peer, true);
    const result = await (await page.request.get(`/api/projects/${id}`)).json();
    expect(result.document.layers).toHaveLength(2);
    expect(
      result.document.layers.find(
        (layer: { type: string }) => layer.type === "text",
      ).text,
    ).toBe("A collaborator's live edit");
    expect(
      result.document.layers.find(
        (layer: { type: string }) => layer.type === "image",
      ).src,
    ).toMatch(/^\/api\/assets\//);
    const versions = await (
      await page.request.get(`/api/projects/${id}/versions`)
    ).json();
    expect(versions.versions.length).toBeGreaterThan(0);
    await openReturn(peer);
    await chooseImage(peer, png, "revoked.png");
    await peer.getByLabel("I have permission to import this image.").check();
    let checkpointStarted!: () => void,
      releaseCheckpoint!: () => void,
      checkpointHandled!: () => void;
    const checkpointDone = new Promise<void>((resolve) => {
      checkpointHandled = resolve;
    });
    const checkpointSeen = new Promise<void>((resolve) => {
      checkpointStarted = resolve;
    });
    const checkpointGate = new Promise<void>((resolve) => {
      releaseCheckpoint = resolve;
      release = resolve;
    });
    await peer.route("**/api/projects/*/versions", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      checkpointStarted();
      await checkpointGate;
      await route.continue();
      checkpointHandled();
    });
    await peer
      .getByRole("button", { name: "Add image layer", exact: true })
      .click();
    await checkpointSeen;
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page
      .getByRole("button", { name: "Revoke Editor", exact: true })
      .click();
    await expect(peer.locator(".message-page [role=alert]")).toContainText(
      "shared session ended",
    );
    releaseCheckpoint();
    await checkpointDone;
    await peer.unroute("**/api/projects/*/versions");
    expect(
      (await (await page.request.get(`/api/projects/${id}`)).json()).document
        .layers,
    ).toHaveLength(2);
  } finally {
    release?.();
    for (const p of [page, peer])
      await p.request
        .post("/api/auth/delete-user", { headers, data: { password } })
        .catch(() => {});
    await context.close();
  }
});
