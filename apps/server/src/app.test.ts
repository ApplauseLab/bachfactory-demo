import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createApp } from "./app";

describe("todo API", () => {
  let db: Database;
  let request: (request: Request) => Promise<Response>;

  beforeEach(() => {
    db = new Database(":memory:");
    request = createApp({ db });
  });

  afterEach(() => db.close());

  const call = (path: string, init?: RequestInit): Promise<Response> =>
    request(new Request(`http://api.test${path}`, init));

  const createTodo = (body: unknown = { title: "Write tests" }) =>
    call("/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  test("reports health and supplies default CORS headers", async () => {
    const response = await call("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
  });

  test("handles CORS preflight with a configurable origin", async () => {
    request = createApp({ db, webOrigin: "https://todo.example" });
    const response = await call("/todos", { method: "OPTIONS" });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://todo.example",
    );
    expect(response.headers.get("access-control-allow-methods")).toContain("PATCH");
    expect(response.headers.get("access-control-allow-headers")).toBe("Content-Type");
  });

  test("creates and lists todos with text IDs", async () => {
    const createdResponse = await createTodo({ title: "  Write tests  ", done: true });
    const created = await createdResponse.json();

    expect(createdResponse.status).toBe(201);
    expect(created).toEqual({
      id: expect.any(String),
      title: "Write tests",
      done: true,
      createdAt: expect.any(String),
    });
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const listResponse = await call("/todos");
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual([created]);
  });

  test("maps persisted SQLite columns to the JSON contract", async () => {
    db.query(
      "INSERT INTO todos (id, title, done, created_at) VALUES (?, ?, ?, ?)",
    ).run("persisted_text-id", "Persisted todo", 1, "2026-08-28T10:00:00.000Z");

    const response = await call("/todos/persisted_text-id");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "persisted_text-id",
      title: "Persisted todo",
      done: true,
      createdAt: "2026-08-28T10:00:00.000Z",
    });
  });

  test("gets a todo by id", async () => {
    const created = await (await createTodo()).json();
    const response = await call(`/todos/${created.id}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(created);
  });

  test("patches title and done independently and together", async () => {
    const created = await (await createTodo()).json();

    const doneResponse = await call(`/todos/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
    expect(await doneResponse.json()).toMatchObject({
      title: "Write tests",
      done: true,
    });

    const titleResponse = await call(`/todos/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "  Ship API  " }),
    });
    expect(await titleResponse.json()).toMatchObject({ title: "Ship API", done: true });

    const combinedResponse = await call(`/todos/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Document API", done: false }),
    });
    expect(await combinedResponse.json()).toMatchObject({
      title: "Document API",
      done: false,
    });
  });

  test("deletes a todo", async () => {
    const created = await (await createTodo()).json();

    expect((await call(`/todos/${created.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await (await call("/todos")).json()).toEqual([]);
  });

  test("returns 404 for unknown safe text IDs", async () => {
    for (const [method, body] of [
      ["GET", undefined],
      ["PATCH", JSON.stringify({ done: true })],
      ["DELETE", undefined],
    ] as const) {
      const response = await call("/todos/missing_text-id", {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Todo not found" });
    }
  });

  test("rejects malformed JSON and non-object bodies", async () => {
    const malformed = await call("/todos", { method: "POST", body: "{" });
    expect(malformed.status).toBe(400);

    const array = await createTodo([]);
    expect(array.status).toBe(400);
    expect(await array.json()).toEqual({ error: "Request body must be a JSON object" });
  });

  test("strictly validates create payloads", async () => {
    const invalid = [
      {},
      { title: "" },
      { title: "   " },
      { title: 42 },
      { title: "Valid", done: "yes" },
      { title: "Valid", completed: true },
      { title: "Valid", unexpected: true },
    ];

    for (const payload of invalid) {
      expect((await createTodo(payload)).status).toBe(400);
    }
    expect(await (await call("/todos")).json()).toEqual([]);
  });

  test("strictly validates patch payloads without changing the todo", async () => {
    const created = await (await createTodo()).json();
    const invalid = [
      {},
      { title: null },
      { title: "  " },
      { done: 1 },
      { completed: true },
      { done: true, unexpected: true },
    ];

    for (const payload of invalid) {
      const response = await call(`/todos/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(response.status).toBe(400);
    }
    expect(await (await call(`/todos/${created.id}`)).json()).toMatchObject({
      title: "Write tests",
      done: false,
    });
  });

  test("rejects unsafe ID paths and unknown routes", async () => {
    expect((await call("/missing")).status).toBe(404);
    expect((await call("/todos/unsafe%2Fid")).status).toBe(404);
  });
});
