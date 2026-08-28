import type { Database } from "bun:sqlite";
import { TodoStore, type TodoPatch } from "./db";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function error(message: string, status: number): Response {
  return json({ error: message }, status);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readPayload(request: Request): Promise<Record<string, unknown> | Response> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return error("Request body must be valid JSON", 400);
  }
  return isObject(value) ? value : error("Request body must be a JSON object", 400);
}

function hasOnlyKeys(payload: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(payload).every((key) => allowed.includes(key));
}

function validTitle(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export interface AppOptions {
  db: Database;
  webOrigin?: string;
}

export function createApp({
  db,
  webOrigin = "http://localhost:5173",
}: AppOptions): (request: Request) => Promise<Response> {
  const todos = new TodoStore(db);

  return async (request: Request): Promise<Response> => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": webOrigin,
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };

    let response: Response;
    if (request.method === "OPTIONS") {
      response = new Response(null, { status: 204 });
    } else {
      const { pathname } = new URL(request.url);
      const match = pathname.match(/^\/todos\/([A-Za-z0-9._~-]+)$/);
      const id = match?.[1] ?? null;

      if (request.method === "GET" && pathname === "/health") {
        response = json({ status: "ok" });
      } else if (request.method === "GET" && pathname === "/todos") {
        response = json(todos.list());
      } else if (request.method === "POST" && pathname === "/todos") {
        const payload = await readPayload(request);
        if (payload instanceof Response) {
          response = payload;
        } else if (
          !hasOnlyKeys(payload, ["title", "done"]) ||
          !validTitle(payload.title) ||
          (payload.done !== undefined && typeof payload.done !== "boolean")
        ) {
          response = error(
            "Payload must contain a non-empty title and optional boolean done",
            400,
          );
        } else {
          response = json(
            todos.create(payload.title.trim(), payload.done ?? false),
            201,
          );
        }
      } else if (id !== null && request.method === "GET") {
        const todo = todos.get(id);
        response = todo ? json(todo) : error("Todo not found", 404);
      } else if (id !== null && request.method === "PATCH") {
        const payload = await readPayload(request);
        if (payload instanceof Response) {
          response = payload;
        } else if (
          Object.keys(payload).length === 0 ||
          !hasOnlyKeys(payload, ["title", "done"]) ||
          (payload.title !== undefined && !validTitle(payload.title)) ||
          (payload.done !== undefined && typeof payload.done !== "boolean")
        ) {
          response = error(
            "Payload must contain a non-empty title and/or boolean done",
            400,
          );
        } else {
          const patch: TodoPatch = {
            ...(payload.title === undefined ? {} : { title: payload.title.trim() }),
            ...(payload.done === undefined
              ? {}
              : { done: payload.done }),
          };
          const todo = todos.update(id, patch);
          response = todo ? json(todo) : error("Todo not found", 404);
        }
      } else if (id !== null && request.method === "DELETE") {
        response = todos.delete(id)
          ? new Response(null, { status: 204 })
          : error("Todo not found", 404);
      } else {
        response = error("Not found", 404);
      }
    }

    for (const [name, value] of Object.entries(corsHeaders)) {
      response.headers.set(name, value);
    }
    return response;
  };
}
