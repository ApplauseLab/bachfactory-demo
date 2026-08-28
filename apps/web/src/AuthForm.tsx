import { useState } from "react";
import { authClient } from "./auth";

type Mode = "sign-in" | "sign-up";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (mode === "sign-up" && !name.trim()) {
      setError("Enter your name to create an account.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = mode === "sign-up"
      ? await authClient.signUp.email({ name: name.trim(), email: trimmedEmail, password })
      : await authClient.signIn.email({ email: trimmedEmail, password });
    setSubmitting(false);
    if (result.error) setError(result.error.message ?? "Authentication failed.");
  }

  function switchMode() {
    setMode((current) => current === "sign-in" ? "sign-up" : "sign-in");
    setError(null);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark" aria-hidden="true">DF</div>
        <p className="eyebrow">Dark Factory</p>
        <h1>{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-copy">
          {mode === "sign-in"
            ? "Sign in to continue where you left off."
            : "Your todo workspace is one step away."}
        </p>

        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          {mode === "sign-up" && (
            <label>
              Name
              <input
                autoComplete="name"
                name="name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Alex Factory"
                value={name}
              />
            </label>
          )}
          <label>
            Email
            <input
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              type="password"
              value={password}
            />
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="auth-submit" disabled={submitting} type="submit">
            {submitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button className="mode-toggle" onClick={switchMode} type="button">
          {mode === "sign-in" ? "New here? Create an account" : "Already registered? Sign in"}
        </button>
      </section>
    </main>
  );
}
