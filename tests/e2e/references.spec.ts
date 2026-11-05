import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { createDocument, type DesignDocument } from "../../src/lib/document";
import type { SavedProject } from "../../src/lib/storage";
import type { DiscoveryEvent } from "../../src/lib/desktop-bridge";

type TestWindow = Window & {
  fixtureContext: Parameters<NonNullable<Window["rangaBridge"]>["context"]>[0];
  fixtureDispatch: (event: DiscoveryEvent) => void;
};
async function openBoard(page: Page) {
  await page.goto("/editor?new=blank");
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.getByRole("button", { name: "References", exact: true }).click();
}
async function saved(page: Page): Promise<SavedProject> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const id = new URL(location.href).searchParams.get("id")!;
        const open = indexedDB.open("ranga-local-v1");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db
            .transaction("projects")
            .objectStore("projects")
            .get(id);
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
async function transfer(
  page: Page,
  type: "paste" | "drop",
  data: { plain?: string; uri?: string; html?: string; image?: string },
) {
  await page
    .getByRole("textbox", { name: "Drop or paste reference", exact: true })
    .evaluate(
      (element, { type, data }) => {
        const transfer = new DataTransfer();
        if (data.plain) transfer.setData("text/plain", data.plain);
        if (data.uri) transfer.setData("text/uri-list", data.uri);
        if (data.html) transfer.setData("text/html", data.html);
        if (data.image)
          transfer.items.add(
            new File(
              [Uint8Array.from(atob(data.image), (char) => char.charCodeAt(0))],
              "pasted.png",
              { type: "image/png" },
            ),
          );
        element.dispatchEvent(
          type === "paste"
            ? new ClipboardEvent("paste", {
                clipboardData: transfer,
                bubbles: true,
                cancelable: true,
              })
            : new DragEvent("drop", {
                dataTransfer: transfer,
                bubbles: true,
                cancelable: true,
              }),
        );
      },
      { type, data },
    );
}
const add = (page: Page) =>
  page.getByRole("button", { name: "Add reference", exact: true }).click();

test("links, written references and provided drag data preview before saving, with no source fetching", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("example.test")) external.push(request.url());
  });
  await openBoard(page);
  await transfer(page, "drop", {
    html: '<img src="https://example.test/private.png">',
  });
  await expect(page.locator(".reference-import [role=alert]")).toContainText(
    "No supported image or plain text",
  );
  await transfer(page, "drop", {
    uri: "# attribution\r\nhttps://example.test/art.png\r\n",
    html: '<img src="https://example.test/private.png">',
  });
  await expect(
    page.getByLabel("Source URL / attribution", { exact: true }),
  ).toHaveValue("https://example.test/art.png");
  await expect(page.locator(".moodboard-card")).toHaveCount(0);
  await expect(page.getByAltText("Reference import preview")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel preview" }).click();
  await expect(page.locator(".moodboard-card")).toHaveCount(0);
  await page
    .getByLabel("Source link or written reference")
    .fill("https://example.test/art.png");
  await page.getByRole("button", { name: "Preview reference" }).click();
  await page
    .getByLabel("Reference title", { exact: true })
    .fill("Editorial source");
  await add(page);
  await transfer(page, "paste", {
    plain: "Cream paper, condensed typography, an original layout.",
  });
  await add(page);
  await expect(page.locator(".moodboard-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Select reference Editorial source" })
    .click();
  await page
    .getByRole("button", { name: "Move Written reference up", exact: true })
    .click();
  await expect(page.locator(".moodboard-card").first()).toContainText(
    "Written reference",
  );
  await page.getByRole("button", { name: "Compare selected" }).click();
  await expect(page.locator(".moodboard-card")).toHaveCount(1);
  await expect(page.locator(".moodboard-card")).toContainText(
    "Editorial source",
  );
  await page.getByRole("button", { name: "Show all", exact: true }).click();
  await page
    .getByLabel("Creative direction")
    .fill("Use cream and black with generous space.");
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  const snapshot = await saved(page);
  expect(snapshot.document.references.map((ref) => ref.name)).toEqual([
    "Written reference",
    "Editorial source",
  ]);
  expect(snapshot.document.references.every((ref) => !ref.src)).toBe(true);
  expect(snapshot.document.direction).toContain("generous space");
  expect(external).toEqual([]);
  await page.reload();
  await page.getByRole("button", { name: "References", exact: true }).click();
  await expect(page.locator(".moodboard-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Remove reference Written reference" })
    .click();
  await expect(page.locator(".moodboard-card")).toHaveCount(1);
});

test("raster previews enforce file limits and explicit permission for uploads and paste", async ({
  page,
}) => {
  await openBoard(page);
  const upload = page.getByLabel("Upload reference image");
  const alert = page.locator(".reference-import [role=alert]");
  await upload.setInputFiles({
    name: "script.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg onload="alert(1)"/>'),
  });
  await expect(alert).toContainText("PNG, JPG, or WebP");
  await upload.setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("<html>not an image</html>"),
  });
  await expect(alert).toContainText("contents do not match");
  await upload.setInputFiles({
    name: "oversized.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(alert).toContainText("5 MB");
  const wide = await sharp({
    create: { width: 10001, height: 1, channels: 3, background: "#e0d8c6" },
  })
    .png()
    .toBuffer();
  await upload.setInputFiles({
    name: "wide.png",
    mimeType: "image/png",
    buffer: wide,
  });
  await expect(alert).toContainText("10,000 pixels per side");
  const png = await sharp({
    create: { width: 80, height: 60, channels: 3, background: "#bd442d" },
  })
    .png()
    .toBuffer();
  await upload.setInputFiles({
    name: "permitted.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByAltText("Reference import preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add reference", exact: true }),
  ).toBeDisabled();
  expect((await saved(page)).document.references).toEqual([]);
  await page
    .getByRole("combobox", { name: "Reference use", exact: true })
    .selectOption("generated");
  await page
    .getByLabel("Source URL / attribution", { exact: true })
    .fill("https://example.test/permitted");
  await page.getByLabel("I have permission to import this image.").check();
  await add(page);
  await transfer(page, "paste", { image: png.toString("base64") });
  await expect(
    page.getByRole("button", { name: "Add reference", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("I have permission to import this image.").check();
  await add(page);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  const snapshot = await saved(page);
  expect(snapshot.document.layers).toHaveLength(0);
  expect(snapshot.document.references).toHaveLength(2);
  expect(snapshot.document.references[0]).toMatchObject({
    kind: "generated",
    permissionConfirmed: true,
    sourceUrl: "https://example.test/permitted",
  });
  expect(snapshot.document.references[0].addedAt).toBeTruthy();
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "read", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    }),
  );
  await page.getByRole("button", { name: "Clipboard", exact: true }).click();
  await expect(alert).toContainText("Focus the paste area");
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "read", {
      configurable: true,
      value: async () => [],
    }),
  );
  await page.getByRole("button", { name: "Clipboard", exact: true }).click();
  await expect(alert).toContainText("No supported image");
});

test("tray keeps one canvas, saves references and clears previews when closing or switching destinations", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as TestWindow;
    w.rangaBridge = {
      context: (value) => {
        w.fixtureContext = value;
      },
      subscribe: (callback) => {
        w.fixtureDispatch = callback;
        return () => {
          w.fixtureDispatch = () => {};
        };
      },
      openChatGPT: () => {},
    };
  });
  await page.goto("/editor?new=editorial");
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  const firstUrl = page.url();
  const firstId = new URL(firstUrl).searchParams.get("id")!;
  await page.goto("/editor?new=blank");
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  const secondId = new URL(page.url()).searchParams.get("id")!;
  await page.goto(firstUrl);
  await expect(page.locator(".upper-canvas")).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as TestWindow;
    w.fixtureDispatch({
      type: "layout",
      key: "local:stale",
      referenceOnly: true,
    });
  });
  await expect(page.locator(".editor")).not.toHaveClass(/reference-only/);
  const toggle = async (referenceOnly: boolean) =>
    page.evaluate((referenceOnly) => {
      const w = window as unknown as TestWindow;
      w.fixtureDispatch({
        type: "layout",
        key: w.fixtureContext!.key,
        referenceOnly,
      });
    }, referenceOnly);
  await toggle(true);
  await page.setViewportSize({ width: 960, height: 259 });
  await expect(
    page.getByRole("heading", { name: "Reference board" }),
  ).toBeVisible();
  await expect(page.locator(".upper-canvas")).toHaveCount(1);
  await expect(page.locator(".upper-canvas")).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(960);
  await page
    .getByLabel("Source link or written reference")
    .fill("A written direction in the tray");
  await page.getByRole("button", { name: "Preview reference" }).click();
  await toggle(false);
  await toggle(true);
  await expect(
    page.getByRole("button", { name: "Add reference", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Source link or written reference")
    .fill("A saved direction in the tray");
  await page.getByRole("button", { name: "Preview reference" }).click();
  await add(page);
  await expect(page.locator(".reference-save-state")).toContainText(
    "Saved on this device",
  );
  const snapshot = await saved(page);
  expect(snapshot.document.references).toHaveLength(1);
  expect(snapshot.document.layers.length).toBeGreaterThan(0);
  const metadata = await sharp(
    Buffer.from(snapshot.thumbnail.split(",")[1], "base64"),
  ).stats();
  expect(metadata.channels.some((channel) => channel.stdev > 10)).toBe(true);
  await page
    .getByLabel("Source link or written reference")
    .fill("This preview must not follow to the other project");
  await page.getByRole("button", { name: "Preview reference" }).click();
  await page
    .getByLabel("Creative direction")
    .fill("Save this before switching destinations");
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.type());
    void dialog.dismiss();
  });
  await page
    .getByLabel("Destination project")
    .selectOption(`local:${secondId}`);
  await expect(page).toHaveURL(new RegExp(secondId));
  expect(dialogs).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.getByRole("button", { name: "References", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add reference", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".moodboard-card")).toHaveCount(0);
  await page.getByLabel("Destination project").selectOption(`local:${firstId}`);
  await expect(page).toHaveURL(new RegExp(firstId));
  await page.getByRole("button", { name: "References", exact: true }).click();
  await expect(page.locator(".moodboard-card")).toHaveCount(1);
  await expect(page.getByLabel("Creative direction")).toHaveValue(
    "Save this before switching destinations",
  );
});

test("reference capacity is enforced without losing the existing collection", async ({
  page,
}) => {
  await openBoard(page);
  const original = (await saved(page)).document;
  const full: DesignDocument = {
    ...createDocument(),
    id: original.id,
    references: Array.from({ length: 12 }, (_, i) => ({
      id: `fixture-${i}`,
      name: `Reference ${i}`,
      note: "Permitted written reference",
      selected: false,
    })),
  };
  await page.evaluate(
    (doc) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("ranga-local-v1");
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("projects", "readwrite");
          tx.objectStore("projects").put(
            { document: doc, thumbnail: "", versions: [] },
            doc.id,
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    full,
  );
  await page.reload();
  await page.getByRole("button", { name: "References", exact: true }).click();
  await page
    .getByLabel("Source link or written reference")
    .fill("One too many");
  await page.getByRole("button", { name: "Preview reference" }).click();
  await add(page);
  await expect(page.locator(".reference-import [role=alert]")).toContainText(
    "12 references",
  );
  expect((await saved(page)).document.references).toHaveLength(12);
});
