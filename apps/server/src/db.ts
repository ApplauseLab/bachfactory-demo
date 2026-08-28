import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

interface TodoRow {
  id: string;
  title: string;
  done: number;
  created_at: string;
}

export interface TodoPatch {
  title?: string;
  done?: boolean;
}

function toTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    done: row.done === 1,
    createdAt: row.created_at,
  };
}

export class TodoStore {
  constructor(private readonly db: Database) {
    db.run(`
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        done INTEGER DEFAULT 0,
        created_at TEXT
      )
    `);
  }

  list(): Todo[] {
    return this.db
      .query<TodoRow, []>("SELECT * FROM todos ORDER BY id ASC")
      .all()
      .map(toTodo);
  }

  get(id: string): Todo | null {
    const row = this.db
      .query<TodoRow, [string]>("SELECT * FROM todos WHERE id = ?")
      .get(id);
    return row ? toTodo(row) : null;
  }

  create(title: string, done: boolean): Todo {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .query<never, [string, string, number, string]>(
        "INSERT INTO todos (id, title, done, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, title, done ? 1 : 0, now);
    return this.get(id)!;
  }

  update(id: string, patch: TodoPatch): Todo | null {
    const current = this.get(id);
    if (!current) return null;

    this.db
      .query<never, [string, number, string]>(
        "UPDATE todos SET title = ?, done = ? WHERE id = ?",
      )
      .run(
        patch.title ?? current.title,
        (patch.done ?? current.done) ? 1 : 0,
        id,
      );
    return this.get(id);
  }

  delete(id: string): boolean {
    return this.db.query<never, [string]>("DELETE FROM todos WHERE id = ?").run(id)
      .changes > 0;
  }
}
