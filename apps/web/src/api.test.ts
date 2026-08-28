import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { API_BASE, api, type Todo } from "./api";

interface FetchCall {
  url: string;
  method: string;
  body?: string;
}

const calls: FetchCall[] = [];

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  calls.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    return jsonResponse(
      jsonResponseStatus.status,
      jsonResponseStatus.payload,
    );
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const jsonResponseStatus = { status: 200, payload: undefined as unknown };

function respondWith(status: number, payload: unknown): void {
  jsonResponseStatus.status = status;
  jsonResponseStatus.payload = payload;
}

const sample: Todo = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Write demo",
  done: false,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("api client", () => {
  test("uses the configured API base", () => {
    expect(API_BASE).toBe("http://localhost:3000");
  });

  test("listTodos GETs /todos and decodes the array", async () => {
    respondWith(200, [sample]);
    const todos = await api.listTodos();
    expect(calls).toEqual([{ url: `${API_BASE}/todos`, method: "GET" }]);
    expect(todos).toEqual([sample]);
  });

  test("getTodo GETs /todos/:id", async () => {
    respondWith(200, sample);
    const todo = await api.getTodo(sample.id);
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.url).toBe(`${API_BASE}/todos/${sample.id}`);
    expect(todo).toEqual(sample);
  });

  test("createTodo POSTs /todos with a JSON title body", async () => {
    respondWith(201, sample);
    const created = await api.createTodo("Write demo");
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toBe(`${API_BASE}/todos`);
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({ title: "Write demo" });
    expect(created).toEqual(sample);
  });

  test("updateTodo PATCHes /todos/:id with the patch body", async () => {
    respondWith(200, { ...sample, done: true });
    const updated = await api.updateTodo(sample.id, { done: true });
    expect(calls[0]?.method).toBe("PATCH");
    expect(calls[0]?.url).toBe(`${API_BASE}/todos/${sample.id}`);
    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({ done: true });
    expect(updated.done).toBe(true);
  });

  test("deleteTodo DELETEs /todos/:id and tolerates 204", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method ?? "GET" });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    await api.deleteTodo(sample.id);
    expect(calls[0]?.method).toBe("DELETE");
    expect(calls[0]?.url).toBe(`${API_BASE}/todos/${sample.id}`);
  });

  test("surfaces 400 validation failures with the API error", async () => {
    respondWith(400, { error: "invalid_title" });
    await expect(api.createTodo("   ")).rejects.toThrow("400");
    await expect(api.createTodo("   ")).rejects.toThrow("invalid_title");
  });

  test("surfaces 404 failures", async () => {
    respondWith(404, { error: "not_found" });
    await expect(api.getTodo("ghost")).rejects.toThrow("404");
  });

  test("surfaces non-JSON error responses by status", async () => {
    globalThis.fetch = (async () => new Response("boom", { status: 500 })) as typeof fetch;
    await expect(api.listTodos()).rejects.toThrow("500");
  });
});
