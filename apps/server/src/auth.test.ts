import { describe, expect, test } from "bun:test";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { openDatabase } from "./db";

const TEST_ORIGIN = "http://localhost:5173";

async function makeTestApp() {
  const db = openDatabase(":memory:");
  const auth = await createAuth(db, TEST_ORIGIN);
  return createApp({ db, auth, webOrigin: TEST_ORIGIN });
}

function call(
  app: ReturnType<typeof createApp>,
  method: string,
  path: string,
  body?: unknown,
  cookie?: string,
) {
  const headers = new Headers({ origin: TEST_ORIGIN });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  return app(new Request(`http://localhost:3000${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("auth response did not set a cookie");
  const match = setCookie.match(/better-auth\.session_token=[^;,]+/);
  if (!match) throw new Error("auth response did not set a session cookie");
  return match[0];
}

async function signUp(app: ReturnType<typeof createApp>, email = "alex@example.com") {
  const response = await call(app, "POST", "/api/auth/sign-up/email", {
    name: "Alex Factory",
    email,
    password: "correct-horse-123",
  });
  return { response, cookie: sessionCookie(response) };
}

describe("email/password authentication", () => {
  test("sign-up creates a session retrievable from get-session", async () => {
    const app = await makeTestApp();
    const { response, cookie } = await signUp(app);
    expect(response.status).toBe(200);

    const session = await call(app, "GET", "/api/auth/get-session", undefined, cookie);
    expect(session.status).toBe(200);
    expect((await session.json()).user.email).toBe("alex@example.com");
  });

  test("sign-in succeeds and sign-out invalidates the session", async () => {
    const app = await makeTestApp();
    await signUp(app);
    const signIn = await call(app, "POST", "/api/auth/sign-in/email", {
      email: "alex@example.com",
      password: "correct-horse-123",
    });
    const cookie = sessionCookie(signIn);
    expect(signIn.status).toBe(200);

    expect((await call(app, "GET", "/api/auth/get-session", undefined, cookie)).status).toBe(200);
    expect((await call(app, "POST", "/api/auth/sign-out", {}, cookie)).status).toBe(200);
    expect(await (await call(app, "GET", "/api/auth/get-session", undefined, cookie)).json()).toBeNull();
  });

  test("rejects duplicate email and invalid credentials", async () => {
    const app = await makeTestApp();
    await signUp(app);
    const duplicate = await call(app, "POST", "/api/auth/sign-up/email", {
      name: "Another Alex",
      email: "alex@example.com",
      password: "correct-horse-123",
    });
    expect(duplicate.status).toBe(422);

    const invalid = await call(app, "POST", "/api/auth/sign-in/email", {
      email: "alex@example.com",
      password: "wrong-password",
    });
    expect(invalid.status).toBe(401);
  });
});

describe("protected todo routes", () => {
  test("rejects every todo method without a session", async () => {
    const app = await makeTestApp();
    for (const [method, path, body] of [
      ["GET", "/todos", undefined],
      ["POST", "/todos", { title: "Nope" }],
      ["PATCH", "/todos/missing", { done: true }],
      ["DELETE", "/todos/missing", undefined],
    ] as const) {
      const response = await call(app, method, path, body);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "unauthorized" });
    }
  });

  test("allows full CRUD with a session cookie", async () => {
    const app = await makeTestApp();
    const { cookie } = await signUp(app);
    const createdResponse = await call(app, "POST", "/todos", { title: "Ship auth" }, cookie);
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();

    expect(await (await call(app, "GET", "/todos", undefined, cookie)).json()).toHaveLength(1);
    const updated = await call(app, "PATCH", `/todos/${created.id}`, { done: true }, cookie);
    expect((await updated.json()).done).toBe(true);
    expect((await call(app, "DELETE", `/todos/${created.id}`, undefined, cookie)).status).toBe(204);
    expect(await (await call(app, "GET", "/todos", undefined, cookie)).json()).toEqual([]);
  });

  test("keeps health public and enables credentialed CORS", async () => {
    const app = await makeTestApp();
    const response = await call(app, "GET", "/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });
});
