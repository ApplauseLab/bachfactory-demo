import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Todo } from "./api";

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const items = await api.listTodos();
      items.sort((a, b) => a.created_at.localeCompare(b.created_at));
      setTodos(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remaining = useMemo(
    () => todos.filter((todo) => !todo.done).length,
    [todos],
  );

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Give the todo a title before adding it.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await api.createTodo(trimmed);
      setTitle("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(todo: Todo) {
    setError(null);
    try {
      await api.updateTodo(todo.id, { done: !todo.done });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(todo: Todo) {
    setError(null);
    try {
      await api.deleteTodo(todo.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main className="shell">
      <header className="header">
        <h1>Todos</h1>
        <p className="subtitle">
          {loading ? "Loading…" : `${remaining} of ${todos.length} remaining`}
        </p>
      </header>

      <form className="add-row" onSubmit={(event) => void handleAdd(event)}>
        <input
          aria-label="New todo title"
          className="add-input"
          data-testid="new-todo"
          placeholder="What needs doing?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button
          aria-label="Add todo"
          className="add-button"
          data-testid="add-todo"
          disabled={creating}
          type="submit"
        >
          {creating ? "Adding…" : "Add"}
        </button>
      </form>

      {error && (
        <div className="error" data-testid="error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty">Loading todos…</div>
      ) : todos.length === 0 ? (
        <div className="empty" data-testid="empty">
          Nothing to do. Add your first todo above.
        </div>
      ) : (
        <ul className="list" data-testid="todo-list">
          {todos.map((todo) => (
            <li className="item" data-testid={`todo-${todo.id}`} key={todo.id}>
              <label className="toggle">
                <input
                  aria-label={`Toggle ${todo.title}`}
                  checked={todo.done}
                  data-testid={`toggle-${todo.id}`}
                  onChange={() => void handleToggle(todo)}
                  type="checkbox"
                />
                <span className={todo.done ? "title done" : "title"}>
                  {todo.title}
                </span>
              </label>
              <button
                aria-label={`Delete ${todo.title}`}
                className="delete"
                data-testid={`delete-${todo.id}`}
                onClick={() => void handleDelete(todo)}
                type="button"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className="footer">Dark Factory · todo slice</footer>
    </main>
  );
}
