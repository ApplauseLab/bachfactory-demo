export type Todo = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

export type TodoUpdate = {
  title?: string;
  done?: boolean;
};

type Fetch = typeof fetch;

const DEFAULT_API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

function decodeTodo(value: unknown): Todo {
  if (typeof value !== "object" || value === null) {
    throw new Error("The API returned an invalid todo");
  }

  const todo = value as Record<string, unknown>;
  if (
    typeof todo.id !== "string" ||
    typeof todo.title !== "string" ||
    typeof todo.done !== "boolean" ||
    typeof todo.createdAt !== "string"
  ) {
    throw new Error("The API returned an invalid todo");
  }

  return {
    id: todo.id,
    title: todo.title,
    done: todo.done,
    createdAt: todo.createdAt,
  };
}

async function failureMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown; message?: unknown };
    if (typeof body.error === "string") return body.error;
    if (typeof body.message === "string") return body.message;
  } catch {
    // Fall back to the status when an error response has no JSON body.
  }

  return `Request failed (${response.status})`;
}

export function createTodosApi(
  fetcher: Fetch = fetch,
  baseUrl = DEFAULT_API_URL,
) {
  const root = baseUrl.replace(/\/$/, "");

  async function request(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetcher(`${root}${path}`, init);
    if (!response.ok) throw new Error(await failureMessage(response));
    return response;
  }

  return {
    async list(): Promise<Todo[]> {
      const response = await request("/todos");
      const body: unknown = await response.json();
      if (!Array.isArray(body)) {
        throw new Error("The API returned an invalid todo list");
      }
      return body.map(decodeTodo);
    },

    async create(title: string): Promise<Todo> {
      const response = await request("/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      return decodeTodo(await response.json());
    },

    async update(id: string, update: TodoUpdate): Promise<Todo> {
      const response = await request(`/todos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      return decodeTodo(await response.json());
    },

    async delete(id: string): Promise<void> {
      await request(`/todos/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}

export const todosApi = createTodosApi();
