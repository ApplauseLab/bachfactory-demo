import { afterEach, describe, expect, test } from "bun:test";
import { AUTH_BASE, createTodoAuthClient } from "./auth";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("auth client", () => {
  test("posts email sign-in to the API auth base with credentials", async () => {
    let call: { url: string; init?: RequestInit } | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      call = { url: String(input), init };
      return new Response(JSON.stringify({
        redirect: false,
        token: "test-token",
        user: { id: "user-1", name: "Alex", email: "alex@example.com" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    await createTodoAuthClient().signIn.email({
      email: "alex@example.com",
      password: "correct-horse-123",
    });

    expect(AUTH_BASE).toBe("http://localhost:3000/api/auth");
    expect(call?.url).toBe(`${AUTH_BASE}/sign-in/email`);
    expect(call?.init?.method).toBe("POST");
    expect(call?.init?.credentials).toBe("include");
  });
});
