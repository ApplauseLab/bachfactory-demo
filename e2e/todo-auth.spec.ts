import { expect, test, type Locator, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4173";
const API_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const demoPacing = process.env.E2E_DEMO_PACING === "1";

async function narrationBeat(page: Page, name: string, durationMs: number) {
  if (!demoPacing) return;
  await test.step(`narration: ${name}`, () => page.waitForTimeout(durationMs));
}

async function installCursorOverlay(page: Page) {
  await page.addInitScript(() => {
    const ensureCursor = () => {
      let cursor = document.querySelector<HTMLElement>("[data-e2e-cursor]");
      if (cursor) return cursor;
      cursor = document.createElement("div");
      cursor.dataset.e2eCursor = "true";
      cursor.style.cssText = "position:fixed;left:0;top:0;width:18px;height:18px;border:2px solid #111827;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 0 0 3px rgba(56,189,248,.4);transform:translate(-50%,-50%);pointer-events:none;z-index:2147483647;transition:width 120ms,height 120ms,box-shadow 120ms";
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
      cursor.style.boxShadow = "0 0 0 8px rgba(56,189,248,.3)";
    });
    window.addEventListener("mouseup", () => {
      const cursor = ensureCursor();
      cursor.style.width = "18px";
      cursor.style.height = "18px";
      cursor.style.boxShadow = "0 0 0 3px rgba(56,189,248,.4)";
    });
  });
}

async function clickWithCursor(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 40 });
  await page.waitForTimeout(500);
  await locator.click();
  await page.waitForTimeout(400);
}

test("sign up, persist a todo across sign-in, and sign out", async ({ page }) => {
  test.skip(!BASE_URL.includes("localhost") && !BASE_URL.includes("127.0.0.1"), "demo runs locally only");
  test.setTimeout(180_000);
  await installCursorOverlay(page);

  const suffix = Date.now();
  const email = `demo-${suffix}@example.com`;
  const password = "factory-demo-123";
  const todoTitle = `Publish authenticated demo ${suffix}`;

  try {
    await test.step("create an account", async () => {
      await page.goto(BASE_URL);
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
      await narrationBeat(page, "signed-out entry point", 4_500);
      await clickWithCursor(page, page.getByRole("button", { name: "New here? Create an account" }));
      await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
      await page.getByLabel("Name").fill("Factory Operator");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await narrationBeat(page, "account details ready", 4_000);
      await clickWithCursor(page, page.getByRole("button", { name: "Create account" }));
      await expect(page.getByRole("heading", { name: "Todos" })).toBeVisible();
      await expect(page.getByText(email)).toBeVisible();
      await narrationBeat(page, "authenticated workspace opens", 5_000);
    });

    await test.step("create and complete a todo", async () => {
      await page.getByTestId("new-todo").fill(todoTitle);
      await clickWithCursor(page, page.getByTestId("add-todo"));
      const item = page.locator(`.item:has-text("${todoTitle}")`);
      await expect(item).toBeVisible();
      await clickWithCursor(page, item.locator('input[type="checkbox"]'));
      await expect(item.locator(".title.done")).toBeVisible();
      await narrationBeat(page, "todo saved and completed", 5_000);
    });

    await test.step("sign out and sign back in", async () => {
      await clickWithCursor(page, page.getByRole("button", { name: "Sign out" }));
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
      await narrationBeat(page, "session closed", 4_000);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await clickWithCursor(page, page.getByRole("button", { name: "Sign in" }));
      await expect(page.locator(`.item:has-text("${todoTitle}") .title.done`)).toBeVisible();
      await narrationBeat(page, "saved work returns after sign-in", 5_500);
      await clickWithCursor(page, page.getByRole("button", { name: "Sign out" }));
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
      await narrationBeat(page, "closing summary", 4_000);
    });
  } finally {
    const signIn = await fetch(`${API_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email, password }),
    });
    const cookie = signIn.headers.get("set-cookie")?.match(/better-auth\.session_token=[^;,]+/)?.[0] ?? "";
    if (cookie) {
      const list = await fetch(`${API_URL}/todos`, { headers: { cookie } });
      if (list.ok) {
        const todos = await list.json() as { id: string; title: string }[];
        const todo = todos.find((item) => item.title === todoTitle);
        if (todo) await fetch(`${API_URL}/todos/${todo.id}`, { method: "DELETE", headers: { cookie } });
      }
    }
  }
});
