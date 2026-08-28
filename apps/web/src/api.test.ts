import { describe, expect, test } from "bun:test";
import { createTodosApi, type Todo } from "./api";

const todo: Todo = {
  id: "todo/one",
  title: "Ship the release",
  done: false,
  createdAt: "2026-08-28T09:00:00.000Z",
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

describe("todos API", () => {
  test("lists todos from the configured base URL", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher = (async (input, init) => {
      calls.push([input, init]);
      return json([todo]);
    }) as typeof fetch;

    const result = await createTodosApi(fetcher, "https://api.example.test/").list();

    expect(result).toEqual([todo]);
    expect(calls).toEqual([["https://api.example.test/todos", undefined]]);
  });

  test("creates a todo with a JSON POST", async () => {
    let request: [RequestInfo | URL, RequestInit | undefined] | undefined;
    const fetcher = (async (input, init) => {
      request = [input, init];
      return json(todo, 201);
    }) as typeof fetch;

    await createTodosApi(fetcher, "http://localhost:3000").create(todo.title);

    expect(request?.[0]).toBe("http://localhost:3000/todos");
    expect(request?.[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: todo.title }),
    });
  });

  test("patches an encoded todo path", async () => {
    let request: [RequestInfo | URL, RequestInit | undefined] | undefined;
    const fetcher = (async (input, init) => {
      request = [input, init];
      return json({ ...todo, done: true });
    }) as typeof fetch;

    const result = await createTodosApi(fetcher, "http://localhost:3000").update(
      todo.id,
      { done: true },
    );

    expect(result.done).toBe(true);
    expect(request?.[0]).toBe("http://localhost:3000/todos/todo%2Fone");
    expect(request?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ done: true }),
    });
  });

  test("deletes a todo with DELETE without decoding an empty response", async () => {
    let request: [RequestInfo | URL, RequestInit | undefined] | undefined;
    const fetcher = (async (input, init) => {
      request = [input, init];
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    await createTodosApi(fetcher, "http://localhost:3000").delete("abc");

    expect(request).toEqual([
      "http://localhost:3000/todos/abc",
      { method: "DELETE" },
    ]);
  });

  test("rejects malformed todo responses", async () => {
    const fetcher = (async () =>
      json([{ id: "abc", title: "Missing fields" }])) as unknown as typeof fetch;

    expect(createTodosApi(fetcher).list()).rejects.toThrow(
      "The API returned an invalid todo",
    );
  });

  test("surfaces API error details", async () => {
    const fetcher = (async () =>
      json({ error: "Todo not found" }, 404)) as unknown as typeof fetch;

    expect(createTodosApi(fetcher).update("missing", { done: true })).rejects.toThrow(
      "Todo not found",
    );
  });

  test("falls back to the response status for non-JSON failures", async () => {
    const fetcher = (async () =>
      new Response("Unavailable", { status: 503 })) as unknown as typeof fetch;

    expect(createTodosApi(fetcher).list()).rejects.toThrow("Request failed (503)");
  });
});
