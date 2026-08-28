import { useEffect, useState, type FormEvent } from "react";
import { todosApi, type Todo } from "./api";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function loadTodos() {
    setLoading(true);
    setError(null);
    try {
      setTodos(await todosApi.list());
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTodos();
  }, []);

  async function addTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const created = await todosApi.create(nextTitle);
      setTodos((current) => [...current, created]);
      setTitle("");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleTodo(todo: Todo) {
    if (pending.has(todo.id)) return;
    setPending((current) => new Set(current).add(todo.id));
    setError(null);
    try {
      const updated = await todosApi.update(todo.id, { done: !todo.done });
      setTodos((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(todo.id);
        return next;
      });
    }
  }

  async function deleteTodo(todo: Todo) {
    if (pending.has(todo.id)) return;
    setPending((current) => new Set(current).add(todo.id));
    setError(null);
    try {
      await todosApi.delete(todo.id);
      setTodos((current) => current.filter((item) => item.id !== todo.id));
    } catch (caught) {
      setError(errorText(caught));
      setPending((current) => {
        const next = new Set(current);
        next.delete(todo.id);
        return next;
      });
    }
  }

  const completeCount = todos.filter((todo) => todo.done).length;
  const remainingCount = todos.length - completeCount;

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="workspace" aria-labelledby="page-title">
        <header className="workspace-header">
          <div>
            <div className="eyebrow">
              <span className="status-dot" />
              Nightshift workspace
            </div>
            <h1 id="page-title">Make room for what matters.</h1>
            <p className="intro">
              A quiet place to capture the work, finish it, and move on.
            </p>
          </div>

          <div className="progress-card" aria-label="Task progress">
            <span className="progress-number">{remainingCount}</span>
            <span className="progress-label">left to finish</span>
            <div className="progress-track">
              <span
                style={{
                  width: todos.length
                    ? `${(completeCount / todos.length) * 100}%`
                    : "0%",
                }}
              />
            </div>
            <span className="progress-meta">
              {completeCount} of {todos.length} complete
            </span>
          </div>
        </header>

        <form className="add-form" onSubmit={addTodo}>
          <label htmlFor="new-todo">What needs your attention?</label>
          <div className="input-row">
            <input
              id="new-todo"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Add a clear, actionable task"
              autoComplete="off"
              maxLength={200}
            />
            <button type="submit" disabled={!title.trim() || submitting}>
              <span>{submitting ? "Adding" : "Add task"}</span>
              <span aria-hidden="true">+</span>
            </button>
          </div>
        </form>

        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
              Close
            </button>
          </div>
        )}

        <div className="list-heading">
          <h2>Today&apos;s list</h2>
          <span>{todos.length} {todos.length === 1 ? "task" : "tasks"}</span>
        </div>

        {loading ? (
          <div className="loading-state" aria-live="polite">
            <span className="spinner" />
            <p>Gathering your tasks...</p>
          </div>
        ) : todos.length === 0 ? (
          <div className="empty-state">
            <span aria-hidden="true">{"\u2713"}</span>
            <h2>The slate is clear.</h2>
            <p>Add a task above when something new comes into focus.</p>
          </div>
        ) : (
          <ul className="todo-list">
            {todos.map((todo, index) => {
              const isPending = pending.has(todo.id);
              return (
                <li className={todo.done ? "todo-item is-done" : "todo-item"} key={todo.id}>
                  <span className="task-index">{String(index + 1).padStart(2, "0")}</span>
                  <button
                    type="button"
                    className="check-button"
                    onClick={() => void toggleTodo(todo)}
                    disabled={isPending}
                    aria-label={todo.done ? `Mark ${todo.title} incomplete` : `Mark ${todo.title} complete`}
                    aria-pressed={todo.done}
                  >
                    <span aria-hidden="true">{todo.done ? "\u2713" : ""}</span>
                  </button>
                  <span className="todo-title">{todo.title}</span>
                  <span className="todo-status">{isPending ? "Saving" : todo.done ? "Complete" : "Open"}</span>
                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => void deleteTodo(todo)}
                    disabled={isPending}
                    aria-label={`Delete ${todo.title}`}
                  >
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && error && todos.length === 0 && (
          <button className="retry-button" type="button" onClick={() => void loadTodos()}>
            Try loading again
          </button>
        )}
      </section>
    </main>
  );
}
