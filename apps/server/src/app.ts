import { randomUUID } from "node:crypto";
import type { Database } from "bun:sqlite";
import { rowToTodo, type TodoRow } from "./db";
import type { Auth } from "./auth";

export const DEFAULT_WEB_ORIGIN = "http://localhost:5173";

const JSON_HEADERS = { "content-type": "application/json" } as const;

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...cors },
  });
}

function noContent(cors: Record<string, string>): Response {
  return new Response(null, { status: 204, headers: cors });
}

interface CreateBody {
  id: string;
  title: string;
  done: number;
  created_at: string;
}

export interface AppOptions {
  db: Database;
  auth: Auth;
  webOrigin?: string;
}

export function createApp({ db, auth, webOrigin = DEFAULT_WEB_ORIGIN }: AppOptions) {
  const corsHeaders: Record<string, string> = {
    "access-control-allow-origin": webOrigin,
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-allow-credentials": "true",
    vary: "Origin",
  };
  const listStmt = db.query<TodoRow, []>("SELECT id, title, done, created_at FROM todos ORDER BY created_at, id");
  const getStmt = db.query<TodoRow, [string]>("SELECT id, title, done, created_at FROM todos WHERE id = ?");
  const insertStmt = db.prepare(
    "INSERT INTO todos (id, title, done, created_at) VALUES (?, ?, ?, ?)",
  );
  const updateStmt = db.prepare(
    "UPDATE todos SET title = COALESCE(?, title), done = COALESCE(?, done) WHERE id = ?",
  );
  const deleteStmt = db.prepare("DELETE FROM todos WHERE id = ?");

  function todoOr404(id: string, cors: Record<string, string>): Response {
    const row = getStmt.get(id);
    if (!row) return json({ error: "not_found" }, 404, cors);
    return json(rowToTodo(row), 200, cors);
  }

  async function handleTodos(
    method: string,
    id: string | null,
    req: Request,
    cors: Record<string, string>,
  ): Promise<Response> {
    if (method === "GET" && id === null) {
      return json(listStmt.all().map(rowToTodo), 200, cors);
    }
    if (method === "POST" && id === null) {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ error: "invalid_json" }, 400, cors);
      }
      const payload = body as Record<string, unknown> | null;
      const title = typeof payload?.title === "string" ? payload.title.trim() : "";
      if (!title) return json({ error: "invalid_title" }, 400, cors);
      const record: CreateBody = {
        id: randomUUID(),
        title,
        done: 0,
        created_at: new Date().toISOString(),
      };
      insertStmt.run([record.id, record.title, record.done, record.created_at]);
      return json(rowToTodo(record), 201, cors);
    }
    if (method === "GET" && id) {
      return todoOr404(id, cors);
    }
    if (method === "PATCH" && id) {
      const existing = getStmt.get(id);
      if (!existing) return json({ error: "not_found" }, 404, cors);
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ error: "invalid_json" }, 400, cors);
      }
      const payload = (body ?? {}) as Record<string, unknown>;
      const hasTitle = typeof payload.title === "string";
      const hasDone = typeof payload.done === "boolean";
      if (!hasTitle && !hasDone) return json({ error: "no_fields" }, 400, cors);
      const title = hasTitle ? (payload.title as string).trim() : null;
      if (hasTitle && title === "") return json({ error: "invalid_title" }, 400, cors);
      const done = hasDone ? Number(payload.done as boolean) : null;
      updateStmt.run([title, done, id]);
      return todoOr404(id, cors);
    }
    if (method === "DELETE" && id) {
      const result = deleteStmt.run(id);
      if (result.changes === 0) return json({ error: "not_found" }, 404, cors);
      return noContent(cors);
    }
    return json({ error: "not_found" }, 404, cors);
  }

  return async function fetchHandler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const cors = corsHeaders;

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (path === "/health") {
      return json({ status: "ok" }, 200, cors);
    }
    if (path.startsWith("/api/auth/")) {
      const response = await auth.handler(req);
      const headers = new Headers(response.headers);
      for (const [name, value] of Object.entries(cors)) headers.set(name, value);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    if (path === "/todos" || path.startsWith("/todos/")) {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) return json({ error: "unauthorized" }, 401, cors);
    }
    if (path === "/todos") {
      return handleTodos(req.method, null, req, cors);
    }
    if (path.startsWith("/todos/")) {
      const id = decodeURIComponent(path.slice("/todos/".length));
      if (id && !id.includes("/")) {
        return handleTodos(req.method, id, req, cors);
      }
    }
    return json({ error: "not_found" }, 404, cors);
  };
}
