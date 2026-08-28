import type { Database } from "bun:sqlite";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { DEFAULT_WEB_ORIGIN } from "./app";

const DEV_SECRET = "todo-dark-factory-local-secret-2026";

export type Auth = ReturnType<typeof betterAuth>;

export async function createAuth(
  db: Database,
  webOrigin = process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN,
): Promise<Auth> {
  const options: BetterAuthOptions = {
    database: db,
    basePath: "/api/auth",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET ?? DEV_SECRET,
    trustedOrigins: [webOrigin],
    emailAndPassword: { enabled: true },
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "none",
        secure: true,
      },
    },
  };

  await (await getMigrations(options)).runMigrations();
  return betterAuth(options);
}
