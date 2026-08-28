export interface Todo {
  id: string;
  title: string;
  done: boolean;
  created_at: string;
}

export interface TodoPatch {
  title?: string;
  done?: boolean;
}

export const API_BASE: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { headers, ...rest } = init;
  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    credentials: "include",
    headers: { "content-type": "application/json", ...(headers as Record<string, string>) },
  });
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: string };
      detail = body.error ? ` (${body.error})` : "";
    } catch {
      // response body was not JSON; keep status only
    }
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${response.status}${detail}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  listTodos(): Promise<Todo[]> {
    return request<Todo[]>("/todos");
  },
  getTodo(id: string): Promise<Todo> {
    return request<Todo>(`/todos/${id}`);
  },
  createTodo(title: string): Promise<Todo> {
    return request<Todo>("/todos", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },
  updateTodo(id: string, patch: TodoPatch): Promise<Todo> {
    return request<Todo>(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  deleteTodo(id: string): Promise<void> {
    return request<void>(`/todos/${id}`, { method: "DELETE" });
  },
};
