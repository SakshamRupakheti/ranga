import { test, expect } from "@playwright/test";
import type { DiscoveryEvent } from "../../src/lib/desktop-bridge";
type TestWindow = Window & {
  fixtureContext: Parameters<NonNullable<Window["rangaBridge"]>["context"]>[0];
  fixtureDispatch: (value: DiscoveryEvent) => void;
  fixtureFocus: number;
};

test("desktop query handoff uses the active project, persists locally, and includes the existing brief", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as TestWindow;
    w.fixtureFocus = 0;
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
  });
  await page.goto("/editor?new=editorial");
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  const projectUrl = page.url();
  await page.getByRole("button", { name: "Creative tools" }).click();
  await page
    .getByLabel("Main headline")
    .fill("University mathematics hackathon");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as TestWindow).fixtureContext?.prompt,
      ),
    )
    .toContain("University mathematics hackathon");
  await page.evaluate(() => {
    const w = window as unknown as TestWindow;
    w.fixtureDispatch({
      type: "query",
      key: "local:stale-project",
      query: "Wrong project",
    });
  });
  await expect(page.getByLabel("Discovery query")).toHaveValue("");
  await page.evaluate(() => {
    const w = window as unknown as TestWindow;
    w.fixtureDispatch({
      type: "query",
      key: w.fixtureContext!.key,
      query: "Mathematics poster with orange and black",
    });
  });
  await expect(page.getByLabel("Discovery query")).toHaveValue(
    "Mathematics poster with orange and black",
  );
  await page.getByRole("button", { name: "Review generated prompt" }).click();
  await expect(page.getByLabel("Generated prompt")).toContainText(
    "Mathematics poster with orange and black",
  );
  await expect(page.getByLabel("Generated prompt")).toContainText(
    "JSON SCHEMA",
  );
  await page
    .getByRole("button", { name: "Copy instructions & open ChatGPT" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as TestWindow).fixtureFocus),
    )
    .toBe(1);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await page.reload();
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as TestWindow).fixtureContext?.query,
      ),
    )
    .toBe("Mathematics poster with orange and black");
  await page.evaluate(() => {
    const w = window as unknown as TestWindow;
    w.fixtureDispatch({ type: "references", key: w.fixtureContext!.key });
  });
  await expect(
    page.getByRole("heading", { name: "Reference board" }),
  ).toBeVisible();
  await page.goto("/editor?new=blank");
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as TestWindow).fixtureContext?.query,
      ),
    )
    .toBe("");
  await page.goto(projectUrl);
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as TestWindow).fixtureContext?.query,
      ),
    )
    .toBe("Mathematics poster with orange and black");
});
