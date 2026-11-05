import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { createDocument } from "../../src/lib/document";

test("two accounts share a real canvas, recover offline edits, discuss a design, and use manual creative handoff", async ({
  browser,
  page,
}) => {
  test.setTimeout(120000);
  const second = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    b = await second.newPage();
  const password = "Ranga-browser-test-123",
    suffix = crypto.randomUUID();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  b.on("pageerror", (e) => errors.push(e.message));
  async function register(p: Page, name: string) {
    await p.goto("/register");
    await p.getByLabel("Your name").fill(name);
    await p
      .getByLabel("Email", { exact: true })
      .fill(`${name.toLowerCase()}-${suffix}@ranga.test`);
    await p.getByLabel("Password", { exact: true }).fill(password);
    await p
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(p).toHaveURL(/\/projects$/);
    await expect(
      p.getByRole("button", { name: "New shared design" }),
    ).toBeVisible();
  }
  async function synced(p: Page) {
    await expect(p.locator(".save-status")).toHaveText("Saved to local server");
  }
  async function backup(p: Page) {
    await p.getByRole("button", { name: "Export", exact: true }).click();
    const downloaded = p.waitForEvent("download");
    await p
      .getByRole("button", { name: "Ranga project Editable backup" })
      .click();
    return JSON.parse(
      await readFile((await (await downloaded).path())!, "utf8"),
    );
  }
  try {
    await register(page, "Amrita");
    await register(b, "Biren");
    await page.goto("/editor?new=blank");
    await expect(page.locator(".upper-canvas")).toBeVisible();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByLabel("Text content").fill("College design night");
    await page.getByRole("button", { name: "Rectangle", exact: true }).click();
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByRole("button", { name: "Create shared copy" }).click();
    await expect(page).toHaveURL(/shared=/);
    await synced(page);
    const sharedUrl = page.url();
    const png = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#bd442d" },
    })
      .png()
      .toBuffer();
    await page.locator("input[type=file]").setInputFiles({
      name: "original-background.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(
      page.getByRole("button", {
        name: "original-background.png",
        exact: true,
      }),
    ).toBeVisible();
    await synced(page);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByRole("button", { name: "sharing", exact: true }).click();
    await page.getByRole("button", { name: "Create invitation link" }).click();
    const invite = await page
      .getByLabel("Invitation link", { exact: true })
      .inputValue();
    await b.goto(invite);
    await b.getByRole("button", { name: "Accept invitation" }).click();
    await expect(b).toHaveURL(sharedUrl);
    await synced(b);
    await expect(page.locator(".presence-avatars span")).toHaveCount(2);
    await b
      .getByRole("button", { name: "Rectangle", exact: true })
      .last()
      .click();
    await expect(page.locator(".remote-selection")).toContainText("Biren");
    await b.getByLabel("X position").fill("420");
    await synced(b);
    await page.getByRole("button", { name: "Elements", exact: true }).click();
    await page
      .getByRole("button", { name: "Rectangle", exact: true })
      .last()
      .click();
    await expect(page.getByLabel("X position")).toHaveValue("420");
    await page.getByRole("button", { name: "New text", exact: true }).click();
    await page.getByLabel("Text content").fill("College design night 2026");
    await synced(page);
    await b.getByRole("button", { name: "New text", exact: true }).click();
    await expect(b.getByLabel("Text content")).toHaveValue(
      "College design night 2026",
    );
    // A disconnected editor queues a real edit and catches up after reconnection.
    await second.setOffline(true);
    await expect(b.locator(".save-status")).toContainText("Offline");
    await b.getByLabel("X position").fill("240");
    await second.setOffline(false);
    await synced(b);
    await expect(page.getByLabel("X position")).toHaveValue("240");
    await page.getByRole("button", { name: "Team", exact: true }).click();
    await page.getByLabel("Leave a note").fill("Keep the title readable.");
    await page.getByRole("button", { name: "Post comment" }).click();
    await b.getByRole("button", { name: "Team", exact: true }).click();
    await expect(
      b.getByText("Keep the title readable.", { exact: true }),
    ).toBeVisible();
    await b.getByRole("button", { name: "Reply", exact: true }).click();
    await b.getByLabel("Reply to thread").fill("Agreed, spacing updated.");
    await b.getByRole("button", { name: "Post reply" }).click();
    await expect(
      page.getByText("Agreed, spacing updated.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Resolve", exact: true }).click();
    await expect(b.getByText("Resolved", { exact: true })).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/collaboration-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "References", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Open Pinterest" }),
    ).toHaveAttribute("target", "_blank");
    await page
      .getByLabel("Source link or written reference", { exact: true })
      .fill("https://www.pinterest.com/pin/123456789/");
    await page.getByRole("button", { name: "Preview reference" }).click();
    await page.getByLabel("Reference title").fill("Editorial reference");
    await page
      .getByRole("button", { name: "Add reference", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Select reference Editorial reference" })
      .click();
    await page
      .getByLabel("Notes", { exact: true })
      .fill("Quiet color, bold type");
    await page
      .getByLabel("Collection", { exact: true })
      .fill("Poster direction");
    // Hold this upload while the other editor contributes a reference.
    let releaseUpload!: () => void;
    let uploadStarted!: () => void;
    const uploadGate = new Promise<void>((resolve) => {
      releaseUpload = resolve;
    });
    const uploadSeen = new Promise<void>((resolve) => {
      uploadStarted = resolve;
    });
    await page.route("**/api/projects/*/assets", async (route) => {
      uploadStarted();
      await uploadGate;
      await route.continue();
    });
    await page.getByLabel("Upload reference image").setInputFiles({
      name: "permitted-reference.png",
      mimeType: "image/png",
      buffer: png,
    });
    await page.getByLabel("I have permission to import this image.").check();
    await page
      .getByRole("button", { name: "Add reference", exact: true })
      .click();
    await uploadSeen;
    try {
      await expect(page.getByLabel("Destination project")).toBeDisabled();
      await b.getByRole("button", { name: "References", exact: true }).click();
      await b
        .getByLabel("Source link or written reference")
        .fill("A collaborator's typography direction");
      await b.getByRole("button", { name: "Preview reference" }).click();
      await b
        .getByRole("button", { name: "Add reference", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Select reference Written reference",
        }),
      ).toBeVisible();
    } finally {
      releaseUpload();
    }
    await expect(
      page.getByRole("button", {
        name: "Select reference permitted-reference.png",
      }),
    ).toBeVisible();
    await page.unroute("**/api/projects/*/assets");
    await page.getByRole("button", { name: "Creative tools" }).click();
    await expect(
      page.getByRole("link", { name: "Open ChatGPT" }),
    ).toHaveAttribute("target", "_blank");
    await page.getByLabel("Main headline").fill("College design night");
    await page
      .getByLabel("Discovery query")
      .fill("University poster discovery");
    await page.getByRole("button", { name: "Review generated prompt" }).click();
    await expect(page.getByLabel("Generated prompt")).toContainText(
      "Quiet color, bold type",
    );
    await page
      .getByRole("button", { name: "Import result", exact: true })
      .click();
    await page.getByLabel("Design recipe JSON").fill('{"script":"alert(1)"}');
    await page.getByRole("button", { name: "Validate recipe" }).click();
    await expect(
      page.locator(".left-panel-content [role=alert]"),
    ).toBeVisible();
    const recipe = {
      format: "ranga.recipe",
      version: 1,
      title: "Campus poster",
      canvas: { width: 900, height: 1200, background: "#eee9dc" },
      elements: [
        {
          type: "text",
          name: "Headline",
          text: "College design night",
          x: 60,
          y: 120,
          width: 700,
          height: 180,
          fill: "#20241f",
          fontSize: 72,
        },
        {
          type: "ellipse",
          name: "Accent",
          x: 200,
          y: 500,
          width: 320,
          height: 320,
          fill: "#bd442d",
        },
      ],
    };
    await page.getByLabel("Design recipe JSON").fill(JSON.stringify(recipe));
    await page.getByRole("button", { name: "Validate recipe" }).click();
    await synced(page);
    await page.getByRole("button", { name: "Apply validated design" }).click();
    await expect(page.getByLabel("Project title")).toHaveValue("Campus poster");
    await synced(page);
    const exported = await backup(page);
    expect(exported.layers).toHaveLength(2);
    expect(exported.references).toHaveLength(3);
    expect(
      exported.references.some(
        (reference: { note?: string }) =>
          reference.note === "A collaborator's typography direction",
      ),
    ).toBe(true);
    expect(exported.discoveryQuery).toBe("University poster discovery");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const jpg = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "JPEG image Full resolution" })
      .click();
    expect(
      (await sharp(await readFile((await (await jpg).path())!)).metadata())
        .width,
    ).toBe(900);
    await page.getByRole("button", { name: "Use dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({
      path: "docs/screenshots/creative-handoff-dark.png",
      fullPage: true,
    });
    await page.reload();
    await synced(page);
    expect((await backup(page)).layers).toHaveLength(2);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByRole("button", { name: "sharing", exact: true }).click();
    await page
      .getByRole("button", { name: "Revoke Biren", exact: true })
      .click();
    await expect(b.locator(".message-page [role=alert]")).toContainText(
      "shared session ended",
    );
    await page.getByRole("link", { name: "Back to projects" }).click();
    await expect(
      page.getByRole("img", { name: "Preview of Campus poster" }),
    ).toBeVisible();
    page.once("dialog", (d) => d.accept("Campus invitation"));
    await page
      .getByRole("button", { name: "Rename shared Campus poster" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Campus invitation", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Duplicate shared Campus invitation",
        exact: true,
      })
      .click();
    await expect(page.locator(".shared-project-card")).toHaveCount(2);
    await page.getByLabel("Search shared projects").fill("copy");
    await expect(page.locator(".shared-project-card")).toHaveCount(1);
    await page.getByLabel("Sort shared projects").selectOption("name");
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", {
        name: "Delete shared Campus invitation copy",
        exact: true,
      })
      .click();
    await expect(page.locator(".shared-project-card")).toHaveCount(0);
    await page.getByLabel("Search shared projects").fill("");
    await expect(page.locator(".shared-project-card")).toHaveCount(1);
    await page.screenshot({
      path: "docs/screenshots/shared-projects-dark.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    expect(errors).toEqual([]);
  } finally {
    await second.setOffline(false);
    for (const p of [page, b])
      await p.request
        .post("/api/auth/delete-user", {
          data: { password },
          headers: {
            Origin: process.env.RANGA_TEST_BASE_URL ?? "http://127.0.0.1:3001",
          },
        })
        .catch(() => {});
    await second.close();
  }
});

test("commenter and viewer sessions expose only their permitted controls", async ({
  browser,
  page,
}) => {
  const contexts = [
    page.context(),
    await browser.newContext(),
    await browser.newContext(),
  ];
  const pages = [
    page,
    await contexts[1].newPage(),
    await contexts[2].newPage(),
  ];
  const roles = ["owner", "commenter", "viewer"],
    password = "Ranga-role-check-123",
    suffix = crypto.randomUUID();
  const headers = {
    Origin: process.env.RANGA_TEST_BASE_URL ?? "http://127.0.0.1:3001",
  };
  try {
    for (let i = 0; i < pages.length; i++) {
      const result = await pages[i].request.post("/api/auth/sign-up/email", {
        headers,
        data: {
          name: roles[i],
          email: `${roles[i]}-${suffix}@ranga.test`,
          password,
        },
      });
      expect(result.ok()).toBe(true);
    }
    const response = await page.request.post("/api/projects", {
      headers,
      data: { document: createDocument("editorial") },
    });
    expect(response.status()).toBe(201);
    const { id } = await response.json();
    for (let i = 1; i < pages.length; i++) {
      const invitation = await page.request.post(
        `/api/projects/${id}/invitations`,
        { headers, data: { role: roles[i] } },
      );
      const { url } = await invitation.json();
      const join = await pages[i].request.post("/api/invitations/accept", {
        headers,
        data: { token: new URL(url).hash.slice(1) },
      });
      expect(join.ok()).toBe(true);
      await pages[i].goto(`/editor?shared=${id}`);
      await expect(pages[i].locator(".save-status")).toHaveText(
        "Saved to local server",
      );
      await expect(pages[i].getByLabel("Project title")).toBeDisabled();
      await expect(
        pages[i].getByRole("button", { name: "Text", exact: true }),
      ).toBeDisabled();
      await pages[i]
        .getByRole("button", { name: "Headline", exact: true })
        .click();
      await expect(pages[i].getByLabel("Text content")).toBeDisabled();
      await pages[i].getByRole("button", { name: "Creative tools" }).click();
      await expect(pages[i].getByLabel("Discovery query")).toBeDisabled();
      await pages[i]
        .getByRole("button", { name: "References", exact: true })
        .click();
      await expect(
        pages[i].getByLabel("Source link or written reference"),
      ).toBeDisabled();
      await expect(
        pages[i].getByLabel("Upload reference image"),
      ).toBeDisabled();
      await expect(pages[i].getByLabel("Creative direction")).toBeDisabled();
      await pages[i].getByRole("button", { name: "Team", exact: true }).click();
    }
    const commenter = pages[1],
      viewer = pages[2];
    await commenter.getByLabel("Leave a note").fill("Review this location.");
    await commenter.getByLabel("Attach to selected layer").check();
    await commenter.getByLabel("Attach a canvas coordinate").check();
    await commenter.getByLabel("Comment X").fill("120");
    await commenter.getByLabel("Comment Y").fill("240");
    await commenter.getByRole("button", { name: "Post comment" }).click();
    await expect(
      viewer.getByText("Review this location.", { exact: true }),
    ).toBeVisible();
    await expect(
      viewer.getByRole("button", { name: "Post comment" }),
    ).toHaveCount(0);
    await viewer.getByRole("button", { name: "Show attached layer" }).click();
    await expect(viewer.locator(".comment-marker")).toBeVisible();
    await viewer.setViewportSize({ width: 390, height: 844 });
    expect(
      await viewer.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  } finally {
    for (const p of pages)
      await p.request
        .post("/api/auth/delete-user", { headers, data: { password } })
        .catch(() => {});
    await contexts[1].close();
    await contexts[2].close();
  }
});
