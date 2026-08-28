import { describe, expect, test } from "bun:test";
import { openDatabase } from "./db";
import { createApp, DEFAULT_WEB_ORIGIN } from "./app";
import type { Auth } from "./auth";

const authenticatedAuth = {
  handler: () => new Response(null, { status: 404 }),
  api: { getSession: async () => ({ session: {}, user: {} }) },
} as unknown as Auth;

function makeTestApp() {
  const db = openDatabase(":memory:");
  return createApp({ db, auth: authenticatedAuth, webOrigin: DEFAULT_WEB_ORIGIN });
}

async function call(
  fetchHandler: ReturnType<typeof createApp>,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    init.headers = { "content-type": "application/json" };
  }
  return fetchHandler(new Request(`http://server.test${path}`, init));
}

describe("health", () => {
  test("GET /health returns ok", async () => {
    const res = await call(makeTestApp(), "GET", "/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("create + list", () => {
  test("POST /todos creates a todo with uuid id, boolean done, ISO created_at", async () => {
    const app = makeTestApp();
    const res = await call(app, "POST", "/todos", { title: "Buy oat milk" });
    expect(res.status).toBe(201);
    const todo = await res.json();
    expect(todo.title).toBe("Buy oat milk");
    expect(todo.done).toBe(false);
    expect(todo.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(Date.parse(todo.created_at)).not.toBeNaN();

    const list = await call(app, "GET", "/todos");
    expect(list.status).toBe(200);
    const items = await list.json();
    expect(items.length).toBe(1);
    expect(items[0].id).toBe(todo.id);
  });

  test("GET /todos on empty database returns []", async () => {
    const res = await call(makeTestApp(), "GET", "/todos");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe("get by id", () => {
  test("GET /todos/:id returns the todo", async () => {
    const app = makeTestApp();
    const created = await (await call(app, "POST", "/todos", { title: "A" })).json();
    const res = await call(app, "GET", `/todos/${created.id}`);
    expect(res.status).toBe(200);
    const fetched = await res.json();
    expect(fetched.id).toBe(created.id);
    expect(fetched.title).toBe("A");
  });

  test("GET /todos/:id returns 404 for unknown id", async () => {
    const res = await call(makeTestApp(), "GET", "/todos/missing-id");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});

describe("validation errors on create", () => {
  test("malformed JSON body returns 400", async () => {
    const res = await call(makeTestApp(), "POST", "/todos", "{not json");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
  });

  test("missing title returns 400", async () => {
    const res = await call(makeTestApp(), "POST", "/todos", {});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_title" });
  });

  test("blank title returns 400", async () => {
    const res = await call(makeTestApp(), "POST", "/todos", { title: "   " });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_title" });
  });

  test("non-string title returns 400", async () => {
    const res = await call(makeTestApp(), "POST", "/todos", { title: 42 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_title" });
  });
});

describe("update (PATCH)", () => {
  test("updates the title", async () => {
    const app = makeTestApp();
    const created = await (await call(app, "POST", "/todos", { title: "Old" })).json();
    const res = await call(app, "PATCH", `/todos/${created.id}`, { title: "New" });
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.title).toBe("New");
    expect(updated.done).toBe(false);
  });

  test("toggles done to true and back", async () => {
    const app = makeTestApp();
    const created = await (await call(app, "POST", "/todos", { title: "Toggle me" })).json();
    const first = await (await call(app, "PATCH", `/todos/${created.id}`, { done: true })).json();
    expect(first.done).toBe(true);
    const second = await (await call(app, "PATCH", `/todos/${created.id}`, { done: false })).json();
    expect(second.done).toBe(false);
  });

  test("updates title and done together", async () => {
    const app = makeTestApp();
    const created = await (await call(app, "POST", "/todos", { title: "Both" })).json();
    const res = await call(app, "PATCH", `/todos/${created.id}`, { title: "Renamed", done: true });
    const updated = await res.json();
    expect(updated.title).toBe("Renamed");
    expect(updated.done).toBe(true);
  });

  test("empty body returns 400", async () => {
    const app = makeTestApp();
    const created = await (await call(app, "POST", "/todos", { title: "X" })).json();
    const res = await call(app, "PATCH", `/todos/${created.id}`, {});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "no_fields" });
  });

  test("blank title returns 400", async () => {
    const app = makeTestApp();
    const created = await (await call(app, "POST", "/todos", { title: "X" })).json();
    const res = await call(app, "PATCH", `/todos/${created.id}`, { title: "  " });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_title" });
  });

  test("malformed JSON returns 400", async () => {
    const app = makeTestApp();
    const created = await (await call(app, "POST", "/todos", { title: "X" })).json();
    const res = await call(app, "PATCH", `/todos/${created.id}`, "nope{");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
  });

  test("unknown id returns 404", async () => {
    const res = await call(makeTestApp(), "PATCH", "/todos/ghost", { title: "hi" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});

describe("delete", () => {
  test("removes the todo and persists through re-list", async () => {
    const app = makeTestApp();
    const created = await (await call(app, "POST", "/todos", { title: "Doomed" })).json();
    const res = await call(app, "DELETE", `/todos/${created.id}`);
    expect(res.status).toBe(204);
    const list = await (await call(app, "GET", "/todos")).json();
    expect(list).toEqual([]);
  });

  test("unknown id returns 404", async () => {
    const res = await call(makeTestApp(), "DELETE", "/todos/ghost");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});

describe("CORS", () => {
  test("OPTIONS preflight returns 204 with allow headers for configured origin", async () => {
    const res = await call(makeTestApp(), "OPTIONS", "/todos");
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(DEFAULT_WEB_ORIGIN);
    expect(res.headers.get("access-control-allow-methods")).toInclude("PATCH");
    expect(res.headers.get("access-control-allow-headers")).toInclude("content-type");
  });

  test("responses carry the configured web origin", async () => {
    const res = await call(makeTestApp(), "GET", "/todos");
    expect(res.headers.get("access-control-allow-origin")).toBe(DEFAULT_WEB_ORIGIN);
  });

  test("honors custom WEB_ORIGIN", async () => {
    const db = openDatabase(":memory:");
    const app = createApp({ db, auth: authenticatedAuth, webOrigin: "https://app.example" });
    const res = await call(app, "GET", "/todos");
    expect(res.headers.get("access-control-allow-origin")).toBe("https://app.example");
  });
});

describe("unknown routes", () => {
  test("GET /nope returns 404", async () => {
    const res = await call(makeTestApp(), "GET", "/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  test("nested id path returns 404", async () => {
    const res = await call(makeTestApp(), "GET", "/todos/a/b");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});
