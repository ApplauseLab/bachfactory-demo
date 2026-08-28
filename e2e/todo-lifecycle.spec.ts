import { expect, test, type Locator, type Page } from "@playwright/test";

const apiURL = process.env.API_URL ?? "http://127.0.0.1:33117";
const demoPacing = process.env.E2E_DEMO_PACING === "1";

async function narrationBeat(page: Page, name: string, durationMs: number) {
  if (!demoPacing) return;
  await test.step(`narration: ${name}`, () => page.waitForTimeout(durationMs));
}

async function installCursorOverlay(page: Page) {
  await page.addInitScript(() => {
    const cursor = document.createElement("div");
    cursor.dataset.e2eCursor = "true";
    cursor.style.cssText = "position:fixed;left:0;top:0;width:18px;height:18px;border:2px solid #111827;border-radius:50%;background:rgba(255,255,255,.9);box-shadow:0 0 0 4px rgba(213,244,93,.35);transform:translate(-50%,-50%);pointer-events:none;z-index:2147483647";
    window.addEventListener("DOMContentLoaded", () => document.documentElement.append(cursor));
    window.addEventListener("mousemove", (event) => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    });
  });
}

async function clickWithCursor(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 35 });
    await page.waitForTimeout(350);
  }
  await locator.click();
  await page.waitForTimeout(400);
}

test("add, complete, and delete a todo", async ({ page, request }) => {
  test.skip(!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(apiURL), "Demo cleanup is local-only");
  await installCursorOverlay(page);

  const existing = await request.get(`${apiURL}/todos`);
  expect(existing.ok()).toBeTruthy();
  for (const todo of (await existing.json()) as Array<{ id: string }>) {
    await request.delete(`${apiURL}/todos/${encodeURIComponent(todo.id)}`);
  }

  const title = `Review factory output ${Date.now()}`;
  try {
    await test.step("open an empty workspace", async () => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "The slate is clear." })).toBeVisible();
      await narrationBeat(page, "empty workspace", 4_500);
    });

    await test.step("add a focused task", async () => {
      const input = page.getByLabel("What needs your attention?");
      await input.fill(title);
      await narrationBeat(page, "task ready to add", 3_500);
      await clickWithCursor(page, page.getByRole("button", { name: "Add task" }));
      await expect(page.getByText(title)).toBeVisible();
      await narrationBeat(page, "task added", 4_500);
    });

    await test.step("mark the task complete", async () => {
      await clickWithCursor(page, page.getByRole("button", { name: `Mark ${title} complete` }));
      await expect(page.getByText("Complete", { exact: true })).toBeVisible();
      await expect(page.getByText("1 of 1 complete")).toBeVisible();
      await narrationBeat(page, "task completed", 4_500);
    });

    await test.step("delete the finished task", async () => {
      await clickWithCursor(page, page.getByRole("button", { name: `Delete ${title}` }));
      await expect(page.getByRole("heading", { name: "The slate is clear." })).toBeVisible();
      await narrationBeat(page, "workspace clear again", 4_500);
    });
  } finally {
    const todos = await request.get(`${apiURL}/todos`);
    if (todos.ok()) {
      for (const todo of (await todos.json()) as Array<{ id: string; title: string }>) {
        if (todo.title === title) {
          await request.delete(`${apiURL}/todos/${encodeURIComponent(todo.id)}`);
        }
      }
    }
  }
});
