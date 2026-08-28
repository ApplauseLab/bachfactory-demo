import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4173";
const API_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const demoPacing = process.env.E2E_DEMO_PACING === "1";

async function narrationBeat(page: Page, name: string, durationMs: number) {
  if (!demoPacing) return;
  await test.step(`narration: ${name}`, async () => {
    await page.waitForTimeout(durationMs);
  });
}

async function installCursorOverlay(page: Page) {
  await page.addInitScript(() => {
    const ensureCursor = () => {
      let cursor = document.querySelector<HTMLElement>("[data-e2e-cursor]");
      if (cursor) return cursor;

      cursor = document.createElement("div");
      cursor.setAttribute("data-e2e-cursor", "true");
      cursor.style.cssText = [
        "position:fixed",
        "left:0",
        "top:0",
        "width:18px",
        "height:18px",
        "border:2px solid #111827",
        "border-radius:9999px",
        "background:rgba(255,255,255,0.85)",
        "box-shadow:0 0 0 3px rgba(14,165,233,0.35)",
        "transform:translate(-50%,-50%)",
        "pointer-events:none",
        "z-index:2147483647",
        "transition:width 120ms ease,height 120ms ease,background 120ms ease,box-shadow 120ms ease",
      ].join(";");
      document.documentElement.append(cursor);
      return cursor;
    };

    window.addEventListener("mousemove", (event) => {
      const cursor = ensureCursor();
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    });

    window.addEventListener("mousedown", () => {
      const cursor = ensureCursor();
      cursor.style.width = "32px";
      cursor.style.height = "32px";
      cursor.style.background = "rgba(14,165,233,0.45)";
      cursor.style.boxShadow = "0 0 0 8px rgba(14,165,233,0.28)";
    });

    window.addEventListener("mouseup", () => {
      const cursor = ensureCursor();
      cursor.style.width = "18px";
      cursor.style.height = "18px";
      cursor.style.background = "rgba(255,255,255,0.85)";
      cursor.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.35)";
    });
  });
}

type Locator = ReturnType<Page["locator"]>;

async function moveToLocator(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 45,
  });
  await page.waitForTimeout(650);
}

async function clickWithCursor(page: Page, locator: Locator) {
  await moveToLocator(page, locator);
  await locator.click();
  await page.waitForTimeout(500);
}

async function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_URL}${path}`, init);
}

async function seedApiTodo(title: string): Promise<string> {
  const res = await apiFetch("/todos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`seed failed: ${res.status}`);
  const todo = (await res.json()) as { id: string };
  return todo.id;
}

async function drainApiTodos(): Promise<void> {
  const res = await apiFetch("/todos");
  if (!res.ok) return;
  const todos = (await res.json()) as { id: string }[];
  for (const todo of todos) {
    await apiFetch(`/todos/${todo.id}`, { method: "DELETE" });
  }
}

function itemFor(title: string): string {
  return `.item:has-text("${title}")`;
}

test.describe("todo full stack", () => {
  test("load, add, toggle, delete against the live API", async ({ page }) => {
    test.skip(
      !BASE_URL.includes("localhost") && !BASE_URL.includes("127.0.0.1"),
      "demo spec only runs against the local stack",
    );
    test.setTimeout(180_000);

    await installCursorOverlay(page);

    const seededId = await seedApiTodo("Triage the factory queue");
    const addedTitle = "Record the demo video";
    try {
      await test.step("load the app with a seeded backlog", async () => {
        await page.goto(BASE_URL);
        await expect(page.getByRole("heading", { name: "Todos" })).toBeVisible();
        await expect(page.locator(itemFor("Triage the factory queue"))).toBeVisible();
        await expect(page.getByTestId("new-todo")).toBeVisible();
        await narrationBeat(page, "app opens with seeded backlog", 5_500);
      });

      await test.step("add a todo from the UI", async () => {
        await clickWithCursor(page, page.getByTestId("new-todo"));
        await page.keyboard.type(addedTitle, { delay: demoPacing ? 55 : 0 });
        await narrationBeat(page, "title typed", 1_800);
        await clickWithCursor(page, page.getByTestId("add-todo"));
        await expect(page.locator(itemFor(addedTitle))).toBeVisible();
        await expect(page.locator(".list .item")).toHaveCount(2);
        await narrationBeat(page, "todo appears in the list", 5_500);
      });

      await test.step("toggle the new todo done", async () => {
        await clickWithCursor(page, page.locator(`${itemFor(addedTitle)} input[type="checkbox"]`));
        const titleSpan = page.locator(`${itemFor(addedTitle)} .title.done`);
        await expect(titleSpan).toBeVisible();
        await expect(page.getByText("1 of 2 remaining")).toBeVisible();
        await narrationBeat(page, "todo marked done and counters update", 5_500);
      });

      await test.step("delete the seeded backlog item", async () => {
        await clickWithCursor(page, page.getByRole("button", { name: "Delete Triage the factory queue" }));
        await expect(page.locator(itemFor("Triage the factory queue"))).toHaveCount(0);
        await expect(page.getByText("0 of 1 remaining")).toBeVisible();
        await narrationBeat(page, "todo removed, list stays in sync", 5_500);
      });

      await test.step("the API reflects the same state", async () => {
        const res = await apiFetch("/todos");
        const todos = (await res.json()) as { title: string; done: boolean }[];
        expect(todos).toHaveLength(1);
        expect(todos[0]?.title).toBe(addedTitle);
        expect(todos[0]?.done).toBe(true);
        await narrationBeat(page, "closing summary", 5_000);
      });
    } finally {
      await drainApiTodos();
    }
    void seededId;
  });
});
