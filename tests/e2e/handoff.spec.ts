import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import type { SavedProject } from "../../src/lib/storage";
import type { DiscoveryEvent } from "../../src/lib/desktop-bridge";

type FixtureWindow = Window & {
  fixtureContext: Parameters<NonNullable<Window["rangaBridge"]>["context"]>[0];
  fixtureDispatch: (event: DiscoveryEvent) => void;
  fixtureCopies: string[];
  fixtureFocus: number;
  fixtureReads: number;
  fixtureClipboard: string;
  fixtureRelease: () => void;
  fixtureFailSave: boolean;
};
const recipe = {
  format: "ranga.recipe",
  version: 1,
  title: "Returned concept",
  canvas: { width: 1080, height: 1350, background: "#fffefa" },
  elements: [
    {
      type: "text",
      name: "Returned headline",
      text: "CREATE TOGETHER",
      x: 70,
      y: 100,
      width: 900,
      height: 180,
      fontSize: 80,
      fill: "#20241f",
    },
  ],
};
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
async function ready(page: Page) {
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
}
async function openReturn(page: Page) {
  await page
    .getByRole("button", { name: "Creative tools", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Bring into Ranga", exact: true })
    .click();
}
async function paste(page: Page, text: string) {
  await page
    .getByRole("textbox", { name: "Paste a result into Ranga", exact: true })
    .evaluate((element, text) => {
      const data = new DataTransfer();
      data.setData("text/plain", text);
      element.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, text);
}
test.beforeEach(async ({ page }) => {
  // Controlled clipboard: never touch the user's clipboard or external account.
  await page.addInitScript(() => {
    const w = window as unknown as FixtureWindow;
    w.fixtureCopies = [];
    w.fixtureFocus = 0;
    w.fixtureReads = 0;
    w.fixtureClipboard = "empty";
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
      openChatGPT: () => {
        w.fixtureFocus++;
      },
    };
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: async (text: string) => {
        w.fixtureCopies.push(text);
      },
    });
    Object.defineProperty(navigator.clipboard, "read", {
      configurable: true,
      value: async () => {
        w.fixtureReads++;
        if (w.fixtureClipboard === "denied")
          throw new DOMException("Denied", "NotAllowedError");
        if (w.fixtureClipboard === "empty") return [];
        if (w.fixtureClipboard === "delayed") {
          await new Promise<void>((resolve) => {
            w.fixtureRelease = resolve;
          });
          return [
            {
              types: ["text/plain"],
              getType: async () =>
                new Blob(["Delayed note"], { type: "text/plain" }),
            },
          ];
        }
        const type = w.fixtureClipboard === "html" ? "text/html" : "text/plain";
        return [
          {
            types: [type],
            getType: async () =>
              new Blob(
                [
                  w.fixtureClipboard === "oversized"
                    ? "x".repeat(2_000_001)
                    : "Concept: expressive type",
                ],
                { type },
              ),
          },
        ];
      },
    });
  });
});

test("selected references and saved change instructions produce an explicit, current handoff", async ({
  page,
}) => {
  await page.goto("/editor?new=blank");
  await ready(page);
  await page.getByRole("button", { name: "References", exact: true }).click();
  for (const name of ["Selected source", "Unselected source"]) {
    await page
      .getByLabel("Source link or written reference")
      .fill(`A direction for ${name}`);
    await page.getByRole("button", { name: "Preview reference" }).click();
    await page.getByLabel("Reference title", { exact: true }).fill(name);
    await page
      .getByRole("button", { name: "Add reference", exact: true })
      .click();
  }
  await page
    .getByRole("button", {
      name: "Select reference Selected source",
      exact: true,
    })
    .click();
  const png = await sharp({
    create: { width: 80, height: 60, channels: 3, background: "#bd442d" },
  })
    .png()
    .toBuffer();
  await page.getByLabel("Upload reference image").setInputFiles({
    name: "permitted.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page
    .getByRole("combobox", { name: "Reference use", exact: true })
    .selectOption("generated");
  await page.getByLabel("I have permission to import this image.").check();
  await page
    .getByRole("button", { name: "Add reference", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Download reference image permitted.png",
      exact: true,
    })
    .click();
  expect(await readFile((await (await downloaded).path())!)).toEqual(png);
  await expect(
    page.getByRole("button", {
      name: "Download reference image Selected source",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByLabel("Elements to keep")
    .fill("Keep a strong type hierarchy");
  await page
    .getByLabel("Elements to change")
    .fill("Create an original arrangement");
  await page
    .getByText("Text, logo, color and layout details", { exact: true })
    .click();
  await page
    .getByLabel("Color changes", { exact: true })
    .fill("Use cream and red");
  await page.getByRole("button", { name: "Review generated prompt" }).click();
  const prompt = await page.getByLabel("Generated prompt").inputValue();
  expect(prompt).toContain("Keep a strong type hierarchy");
  expect(prompt).toContain("Use cream and red");
  expect(prompt).toContain("Selected source");
  expect(prompt).not.toContain("Unselected source");
  expect(prompt).not.toContain("data:image");
  expect(
    await page.evaluate(
      () => (window as unknown as FixtureWindow).fixtureCopies,
    ),
  ).toEqual([]);
  await page
    .getByRole("button", {
      name: "Copy instructions & open ChatGPT",
      exact: true,
    })
    .click();
  expect(
    await page.evaluate(
      () => (window as unknown as FixtureWindow).fixtureCopies,
    ),
  ).toEqual([prompt]);
  expect(
    await page.evaluate(
      () => (window as unknown as FixtureWindow).fixtureFocus,
    ),
  ).toBe(1);
  await expect(
    page.getByText(
      "Instructions copied. Paste and send them yourself in ChatGPT.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByLabel("Elements to keep").fill("Keep generous spacing");
  await expect(
    page.getByText(
      "Instructions copied. Paste and send them yourself in ChatGPT.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Copy instructions & open ChatGPT",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "Instructions copied. Paste and send them yourself in ChatGPT.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    }),
  );
  await page
    .getByRole("button", {
      name: "Copy instructions & open ChatGPT",
      exact: true,
    })
    .click();
  await expect(page.locator(".prompt-handoff [role=alert]")).toContainText(
    "Select and copy the prompt below",
  );
  await expect(
    page.getByText(
      "Instructions copied. Paste and send them yourself in ChatGPT.",
      { exact: true },
    ),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as FixtureWindow).fixtureFocus,
    ),
  ).toBe(2);
  await ready(page);
  await page.reload();
  await page
    .getByRole("button", { name: "Creative tools", exact: true })
    .click();
  await expect(page.getByLabel("Elements to keep")).toHaveValue(
    "Keep generous spacing",
  );
  expect((await saved(page)).document.changeInstructions?.colors).toBe(
    "Use cream and red",
  );
});

test("returned clipboard, files and pasted text require a typed preview and explicit import", async ({
  page,
}) => {
  await page.goto("/editor?new=blank");
  await ready(page);
  await openReturn(page);
  expect(
    await page.evaluate(
      () => (window as unknown as FixtureWindow).fixtureReads,
    ),
  ).toBe(0);
  const alert = page.locator(".bring-into-ranga [role=alert]");
  for (const [mode, message] of [
    ["denied", "Ctrl/Cmd+V"],
    ["empty", "clipboard is empty"],
    ["html", "no supported image"],
    ["oversized", "2 MB"],
  ]) {
    await page.evaluate((mode) => {
      (window as unknown as FixtureWindow).fixtureClipboard = mode;
    }, mode);
    await page
      .getByRole("button", { name: "Read clipboard", exact: true })
      .click();
    await expect(alert).toContainText(message);
  }
  expect(
    await page.evaluate(
      () => (window as unknown as FixtureWindow).fixtureReads,
    ),
  ).toBe(4);
  await page.evaluate(() => {
    (window as unknown as FixtureWindow).fixtureClipboard = "text";
  });
  await page
    .getByRole("button", { name: "Read clipboard", exact: true })
    .click();
  await expect(page.getByLabel("Reference description")).toHaveValue(
    "Concept: expressive type",
  );
  expect((await saved(page)).document.references).toEqual([]);
  await page
    .getByRole("button", { name: "Add reference", exact: true })
    .click();
  await paste(page, "https://example.test/result.png");
  await expect(page.getByAltText("Reference import preview")).toHaveCount(0);
  await expect(page.getByLabel("Source URL / attribution")).toHaveValue(
    "https://example.test/result.png",
  );
  await page
    .getByRole("button", { name: "Add reference", exact: true })
    .click();
  const file = page.getByLabel("Choose result file");
  await file.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"script":"alert(1)"}'),
  });
  await expect(alert).toBeVisible();
  const png = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#bd442d" },
  })
    .png()
    .toBuffer();
  await file.setInputFiles({
    name: "returned.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByAltText("Reference import preview")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Reference use", exact: true }),
  ).toHaveValue("generated");
  await expect(
    page.getByRole("button", { name: "Add reference", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("I have permission to import this image.").check();
  await page
    .getByRole("button", { name: "Add reference", exact: true })
    .click();
  await file.setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(recipe)),
  });
  await expect(
    page.getByRole("button", { name: "Apply validated design" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Cancel preview" }).click();
  await ready(page);
  const snapshot = await saved(page);
  expect(snapshot.document.references).toHaveLength(3);
  expect(snapshot.document.layers).toHaveLength(0);
  expect(snapshot.versions).toHaveLength(0);
});

test("a recipe needs a current composition and durable checkpoint; failure retains the preview and Undo recovers", async ({
  page,
}) => {
  await page.goto("/editor?new=editorial");
  await ready(page);
  const before = (await saved(page)).document;
  await page
    .getByRole("button", { name: "Creative tools", exact: true })
    .click();
  await page.getByLabel("Elements to keep").fill("Keep my saved instructions");
  await page
    .getByRole("button", { name: "Bring into Ranga", exact: true })
    .click();
  await paste(page, "```json\n" + JSON.stringify(recipe) + "\n```");
  await page.getByLabel("Project title").fill("Updated after preview");
  await expect(
    page.getByRole("button", { name: "Apply validated design" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Preview again" }).click();
  await ready(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    const w = window as unknown as FixtureWindow;
    w.fixtureFailSave = true;
    IDBObjectStore.prototype.put = function (value, key) {
      if (
        w.fixtureFailSave &&
        this.name === "projects" &&
        value.versions?.length
      )
        throw new DOMException("Fixture quota", "QuotaExceededError");
      return original.call(this, value, key!);
    };
  });
  await page.getByRole("button", { name: "Apply validated design" }).click();
  await expect(page.locator(".bring-into-ranga [role=alert]")).toContainText(
    "checkpoint could not be saved",
  );
  await expect(page.getByLabel("Project title")).toHaveValue(
    "Updated after preview",
  );
  expect((await saved(page)).document.layers).toEqual(before.layers);
  await expect(
    page.getByRole("button", { name: "Apply validated design" }),
  ).toBeEnabled();
  await page.evaluate(() => {
    (window as unknown as FixtureWindow).fixtureFailSave = false;
  });
  await page.getByRole("button", { name: "Apply validated design" }).click();
  await expect(page.getByLabel("Project title")).toHaveValue(
    "Returned concept",
  );
  await ready(page);
  const after = await saved(page);
  await expect(page.getByRole("button", { name: "Dismiss error" })).toHaveCount(
    0,
  );
  expect(after.document.layers).toHaveLength(1);
  expect(after.document.layers[0].type).toBe("text");
  expect(after.document.changeInstructions?.preserve).toBe(
    "Keep my saved instructions",
  );
  expect(after.versions[0].document.layers).toEqual(before.layers);
  expect(after.versions[0].document.title).toBe("Updated after preview");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await ready(page);
  expect((await saved(page)).document.layers).toEqual(before.layers);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await ready(page);
  await paste(page, JSON.stringify({ ...recipe, title: "A second direction" }));
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1440);
  await page.screenshot({
    path: "docs/screenshots/bring-into-ranga.png",
    fullPage: true,
  });
});

test("Bring stays bound to the current project and discards late clipboard results on exit", async ({
  page,
}) => {
  await page.goto("/editor?new=blank");
  await ready(page);
  const dispatch = async (key?: string) =>
    page.evaluate((key) => {
      const w = window as unknown as FixtureWindow;
      w.fixtureDispatch({ type: "bring", key: key ?? w.fixtureContext!.key });
    }, key);
  await dispatch("local:stale");
  await expect(
    page.getByRole("region", { name: "Bring into Ranga", exact: true }),
  ).toHaveCount(0);
  await dispatch();
  await expect(
    page.getByRole("region", { name: "Bring into Ranga", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as FixtureWindow).fixtureReads,
    ),
  ).toBe(0);
  await page.evaluate(() => {
    (window as unknown as FixtureWindow).fixtureClipboard = "delayed";
  });
  await page
    .getByRole("button", { name: "Read clipboard", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => typeof (window as unknown as FixtureWindow).fixtureRelease,
      ),
    )
    .toBe("function");
  await page.getByRole("button", { name: "Design brief", exact: true }).click();
  await page.evaluate(() => {
    (window as unknown as FixtureWindow).fixtureRelease();
  });
  await page
    .getByRole("button", { name: "Bring into Ranga", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add reference", exact: true }),
  ).toHaveCount(0);
  await paste(page, JSON.stringify(recipe));
  await expect(
    page.getByRole("button", { name: "Apply validated design" }),
  ).toBeVisible();
  await dispatch();
  await expect(
    page.getByRole("button", { name: "Apply validated design" }),
  ).toHaveCount(0);
  expect((await saved(page)).document.references).toEqual([]);
  expect((await saved(page)).document.layers).toEqual([]);
});
