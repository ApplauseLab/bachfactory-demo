import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";

export const DEFAULT_DB_PATH = join(import.meta.dir, "..", "data", "todos.db");

export interface TodoRow {
  id: string;
  title: string;
  done: number;
  created_at: string;
}

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  created_at: string;
}

export function openDatabase(path: string): Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

export function defaultDatabase(): Database {
  return openDatabase(process.env.TODO_DB_PATH ?? DEFAULT_DB_PATH);
}

export function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    done: row.done === 1,
    created_at: row.created_at,
  };
}
