import { createApp } from "./app";
import { defaultDatabase } from "./db";

const port = Number(process.env.PORT ?? 3000);
const db = defaultDatabase();
const handler = createApp({
  db,
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
});

const server = Bun.serve({
  port,
  fetch: (req) => handler(req),
});

console.log(`todo server listening on ${server.url} (origin ${process.env.WEB_ORIGIN ?? "http://localhost:5173"})`);
