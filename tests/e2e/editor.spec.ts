import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function openEditor(page: Page, template = "blank") {
  await page.goto(`/editor?new=${template}`);
  await expect(page.locator(".upper-canvas")).toBeVisible();
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
}
async function exportBackup(page: Page) {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const wait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Ranga project Editable backup" })
    .click();
  const download = await wait;
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}
test("landing and dashboard show real empty state, with no runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good ideas deserve form." }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/landing-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Open workspace" }).click();
  await expect(page.getByText("A fresh page.")).toBeVisible();
  expect(errors).toEqual([]);
});
test("text editing, undo, redo, autosave, reopen, and full resolution exports", async ({
  page,
}) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByLabel("Text content").fill("Ranga canvas test");
  await page.getByLabel("Font size", { exact: true }).fill("72");
  await expect(page.getByLabel("Font size", { exact: true })).toHaveValue("72");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByLabel("Font size", { exact: true })).toHaveValue("54");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByLabel("Font size", { exact: true })).toHaveValue("72");
  await page.getByLabel("X position").fill("180");
  await page.getByLabel("Rotation").fill("12");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  const id = page.url();
  await page.reload();
  await expect(page.locator(".upper-canvas")).toBeVisible();
  await page.getByRole("button", { name: "New text", exact: true }).click();
  await expect(page.getByLabel("Text content")).toHaveValue(
    "Ranga canvas test",
  );
  await expect(page.getByLabel("X position")).toHaveValue("180");
  await expect(page.getByLabel("Rotation")).toHaveValue("12");
  expect(page.url()).toBe(id);
  const backup = await exportBackup(page);
  expect(backup.layers[0].text).toBe("Ranga canvas test");
  expect(backup.layers[0].fontSize).toBe(72);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const pngWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG image Full resolution" }).click();
  const png = await readFile((await (await pngWait).path())!);
  expect(png.readUInt32BE(16)).toBe(900);
  expect(png.readUInt32BE(20)).toBe(1200);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const svgWait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "SVG graphic Text, shapes & images" })
    .click();
  const svg = await readFile((await (await svgWait).path())!, "utf8");
  expect(svg.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).toContain(
    "Ranga canvas test",
  );
  expect(svg).toContain('viewBox="0 0 900 1200"');
});
test("dragging a native canvas shape changes saved coordinates", async ({
  page,
}) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  const before = await exportBackup(page);
  const box = (await page.locator(".upper-canvas").boundingBox())!;
  const scale = box.width / 900;
  const center = {
    x: box.x + (before.layers[0].x + 110) * scale,
    y: box.y + (before.layers[0].y + 110) * scale,
  };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 65, center.y + 45, { steps: 12 });
  await page.mouse.up();
  const after = await exportBackup(page);
  expect(after.layers[0].x).toBeGreaterThan(before.layers[0].x + 50);
  expect(after.layers[0].y).toBeGreaterThan(before.layers[0].y + 30);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.locator(".upper-canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Rectangle", exact: true })
    .last()
    .click();
  await expect(page.getByLabel("X position")).toHaveValue(
    String(after.layers[0].x),
  );
});
test("layer visibility, lock, duplication, order, and deletion work", async ({
  page,
}) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rectangle copy", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Hide Rectangle copy", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Show Rectangle copy", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Lock Rectangle copy", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Rectangle copy", exact: true })
    .click();
  await expect(page.getByLabel("Width", { exact: true })).toBeDisabled();
  await page
    .getByRole("button", { name: "Unlock Rectangle copy", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Rectangle copy", exact: true })
    .click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  const backup = await exportBackup(page);
  expect(backup.layers[0].name).toBe("Rectangle copy");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  expect((await exportBackup(page)).layers).toHaveLength(1);
});
test("snapshots restore an earlier composition", async ({ page }) => {
  await openEditor(page, "editorial");
  await page.getByRole("button", { name: "Save version", exact: true }).click();
  await page.getByRole("button", { name: "Headline", exact: true }).click();
  await page.getByLabel("Text content").fill("CHANGED");
  await page.getByRole("button", { name: "History", exact: true }).click();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  expect(
    (await exportBackup(page)).layers.find(
      (l: { name: string }) => l.name === "Headline",
    ).text,
  ).toBe("FORM");
});
test("local raster upload and references persist separately", async ({
  page,
}) => {
  await openEditor(page);
  const png = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 40;
      canvas.height = 40;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#bd442d";
      context.fillRect(0, 0, 40, 40);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  await page.locator("input[type=file]").first().setInputFiles({
    name: "test-logo.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(
    page.getByRole("button", { name: "test-logo.png", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "References", exact: true }).click();
  await page.getByLabel("Upload reference image").setInputFiles({
    name: "reference.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByLabel("I have permission to import this image.").check();
  await page
    .getByRole("button", { name: "Add reference", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select reference reference.png" })
    .click();
  await page
    .getByLabel("Creative direction")
    .fill("Warm tones and editorial type.");
  const data = await exportBackup(page);
  expect(data.layers).toHaveLength(1);
  expect(data.layers[0].type).toBe("image");
  expect(data.references[0].selected).toBe(true);
  expect(data.direction).toContain("editorial");
});
test("tablet and mobile layouts fit and expose editing controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await openEditor(page, "editorial");
  await page.screenshot({
    path: "docs/screenshots/editor-tablet.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator(".upper-canvas")).toBeVisible();
  await expect(page.locator(".editor-left")).toBeHidden();
  await expect(page.locator(".editor-right")).toBeHidden();
  await expect(page.locator(".mobile-save-status")).toHaveText("Saved locally");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "docs/screenshots/editor-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle tools", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Text", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .getByRole("button", { name: "Toggle properties", exact: true })
    .click();
  await expect(page.getByLabel("Text content")).toBeVisible();
  await page.getByLabel("Text content").fill("Mobile edit");
  await page
    .getByRole("button", { name: "Toggle properties", exact: true })
    .click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "PNG image Full resolution" }),
  ).toBeVisible();
});
test("editorial canvas renders and stays free of runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openEditor(page, "editorial");
  await page.screenshot({
    path: "docs/screenshots/editor-desktop.png",
    fullPage: true,
  });
  expect((await exportBackup(page)).layers).toHaveLength(10);
  expect(errors).toEqual([]);
});

test("project backups import as separate projects; rename, duplicate, delete remain local", async ({
  page,
}) => {
  await openEditor(page, "social");
  const backup = await exportBackup(page);
  await page.getByRole("link", { name: "Back to projects" }).click();
  await expect(page.locator(".project-card")).toHaveCount(1);
  await page.locator("input[type=file]").setInputFiles({
    name: "backup.ranga.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.locator(".project-card")).toHaveCount(2);
  page.once("dialog", (d) => d.accept("Renamed study"));
  await page
    .getByRole("button", { name: "Rename A fresh perspective" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Renamed study" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Duplicate Renamed study" }).click();
  await expect(page.locator(".project-card")).toHaveCount(3);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete Renamed study copy" }).click();
  await expect(page.locator(".project-card")).toHaveCount(2);
  const invalid = {
    ...backup,
    layers: [
      {
        ...backup.layers[0],
        type: "image",
        src: "https://untrusted.example/image.png",
      },
    ],
  };
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(invalid)),
  });
  await expect(page.locator(".error-banner")).toBeVisible();
  await expect(page.locator(".project-card")).toHaveCount(2);
});

test("brand kit persists and applies actual typography and palette changes", async ({
  page,
}) => {
  await page.goto("/brand");
  await page.getByLabel("Brand name", { exact: true }).fill("Studio Ranga");
  await page.getByLabel("Primary color", { exact: true }).fill("#124c3d");
  await page.getByLabel("Background color", { exact: true }).fill("#f9e8c4");
  await page
    .getByLabel("Preferred typeface", { exact: true })
    .selectOption("Georgia");
  await page.getByRole("button", { name: "Save brand kit" }).click();
  await expect(page.getByText("Brand kit saved on this device.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Brand name", { exact: true })).toHaveValue(
    "Studio Ranga",
  );
  await openEditor(page, "editorial");
  await page.getByRole("button", { name: "Brand", exact: true }).click();
  await page.getByRole("button", { name: "Apply brand to design" }).click();
  const data = await exportBackup(page);
  expect(data.background).toBe("#f9e8c4");
  expect(
    data.layers
      .filter((l: { type: string }) => l.type === "text")
      .every((l: { fontFamily: string }) => l.fontFamily === "Georgia"),
  ).toBe(true);
  expect(
    data.layers.find((l: { type: string }) => l.type === "ellipse").fill,
  ).toBe("#124c3d");
});

test("native corner resizing and direct canvas text editing survive save and reload", async ({
  page,
}) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  const before = await exportBackup(page);
  const box = (await page.locator(".upper-canvas").boundingBox())!;
  const scale = box.width / 900;
  const corner = {
    x: box.x + (before.layers[0].x + 220) * scale,
    y: box.y + (before.layers[0].y + 220) * scale,
  };
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x + 45, corner.y + 45, { steps: 10 });
  await page.mouse.up();
  expect((await exportBackup(page)).layers[0].width).toBeGreaterThan(250);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  const textDoc = await exportBackup(page);
  const text = textDoc.layers.find((l: { type: string }) => l.type === "text");
  await page.mouse.dblclick(
    box.x + (text.x + 70) * scale,
    box.y + (text.y + 30) * scale,
  );
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Typed on the canvas");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const after = await exportBackup(page);
  expect(
    after.layers.find((l: { type: string }) => l.type === "text").text,
  ).toBe("Typed on the canvas");
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.reload();
  await page.getByRole("button", { name: "New text", exact: true }).click();
  await expect(page.getByLabel("Text content")).toHaveValue(
    "Typed on the canvas",
  );
});

test("public and project screens fit a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/projects", "/brand", "/settings"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  }
  await page.goto("/");
  const posterBox = (await page.locator(".poster-preview").boundingBox())!;
  const posterFooter = (await page.locator(".poster-foot").boundingBox())!;
  expect(posterFooter.y + posterFooter.height).toBeLessThanOrEqual(
    posterBox.y + posterBox.height,
  );
  await page.screenshot({
    path: "docs/screenshots/landing-mobile.png",
    fullPage: true,
  });
});

test("moving a native multi-selection persists each layer in document coordinates", async ({
  page,
}) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.getByLabel("Width", { exact: true }).fill("150");
  await page.getByLabel("Height", { exact: true }).fill("150");
  await page.getByRole("button", { name: "Ellipse", exact: true }).click();
  await page.getByLabel("X position").fill("450");
  await page.getByLabel("Y position").fill("450");
  const before = await exportBackup(page);
  const box = (await page.locator(".upper-canvas").boundingBox())!;
  const scale = box.width / 900;
  const point = (i: number) => ({
    x: box.x + (before.layers[i].x + before.layers[i].width / 2) * scale,
    y: box.y + (before.layers[i].y + before.layers[i].height / 2) * scale,
  });
  const a = point(0),
    b = point(1);
  await page.mouse.click(a.x, a.y);
  await page.keyboard.down("Shift");
  await page.mouse.click(b.x, b.y);
  await page.keyboard.up("Shift");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 45, a.y + 35, { steps: 10 });
  await page.mouse.up();
  const after = await exportBackup(page);
  for (let i = 0; i < 2; i++) {
    expect(after.layers[i].x - before.layers[i].x).toBeCloseTo(45 / scale, 0);
    expect(after.layers[i].y - before.layers[i].y).toBeCloseTo(35 / scale, 0);
  }
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.locator(".upper-canvas")).toBeVisible();
  expect(
    (await exportBackup(page)).layers.map((l: { x: number; y: number }) => [
      l.x,
      l.y,
    ]),
  ).toEqual(after.layers.map((l: { x: number; y: number }) => [l.x, l.y]));
});
