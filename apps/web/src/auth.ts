import { createAuthClient } from "better-auth/react";
import { API_BASE } from "./api";

export const AUTH_BASE = `${API_BASE}/api/auth`;

export function createTodoAuthClient() {
  return createAuthClient({
    baseURL: AUTH_BASE,
    fetchOptions: { credentials: "include" },
  });
}

export const authClient = createTodoAuthClient();
