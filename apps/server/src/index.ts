import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createApp } from "./app";

const databasePath = resolve(import.meta.dir, "../data/todos.db");
mkdirSync(dirname(databasePath), { recursive: true });

const db = new Database(databasePath, { create: true });
const fetch = createApp({ db, webOrigin: process.env.WEB_ORIGIN });
const port = Number(process.env.PORT ?? 3000);

const server = Bun.serve({ port, fetch });
console.log(`Todo API listening on http://localhost:${server.port}`);
