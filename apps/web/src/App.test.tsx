import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";

const window = new Window();
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  MutationObserver: window.MutationObserver,
});

const { cleanup, fireEvent, render, screen } = await import("@testing-library/react");
const { AccountHeader, SessionGate } = await import("./App");

afterEach(cleanup);
afterAll(() => window.close());

describe("authentication UI gating", () => {
  test("hides todos and shows sign-in while signed out", () => {
    render(<SessionGate isPending={false} />);
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Todos" })).toBeNull();
  });

  test("shows the account email and invokes logout", () => {
    const onSignOut = mock(() => {});
    render(<AccountHeader email="alex@example.com" onSignOut={onSignOut} />);
    expect(screen.getByText("alex@example.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
