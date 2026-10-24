import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LandingPage } from "../src/features/landing/LandingPage";

const scroll = vi.fn();
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  writable: true,
  value: () => undefined,
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

test("presents the welcome content and a clearly labeled noninteractive sample preview", () => {
  render(<LandingPage configured error="" onSignIn={vi.fn()} />);
  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "Less chaos. More progress.",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("navigation", { name: "Welcome navigation" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Illustrative preview · Sample data only"),
  ).toBeInTheDocument();
  const preview = screen.getByRole("region", {
    name: "An illustrative student dashboard",
  });
  expect(within(preview).queryByRole("button")).not.toBeInTheDocument();
  expect(within(preview).queryByRole("link")).not.toBeInTheDocument();
  expect(
    screen.getByText(/homeworks, exams, finals, projects, and presentations/),
  ).toBeInTheDocument();
  expect(screen.getByText(/dashboard and calendar/)).toBeInTheDocument();
});

test("section navigation and the skip link focus targets without changing callback or deep-link URLs", () => {
  window.history.replaceState(null, "", "/?code=example-test-code#/calendar");
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(scroll);
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  render(<LandingPage configured error="" onSignIn={vi.fn()} />);
  const original = window.location.href;
  fireEvent.click(screen.getByRole("button", { name: "Features" }));
  expect(document.activeElement).toHaveAttribute("id", "welcome-features");
  fireEvent.click(screen.getByRole("button", { name: "Your workspace" }));
  expect(document.activeElement).toHaveAttribute("id", "welcome-preview");
  fireEvent.click(screen.getByRole("link", { name: "Skip to content" }));
  expect(document.activeElement).toHaveAttribute("id", "welcome-main");
  expect(window.location.href).toBe(original);
  expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
});

test("navigation respects reduced-motion preference", () => {
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(scroll);
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
  render(<LandingPage configured error="" onSignIn={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Features" }));
  expect(scroll).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
});

test.each(["Sign in", "Get started", "Start planning"])(
  "%s invokes the existing authentication action",
  async (label) => {
    const signIn = vi.fn().mockResolvedValue(undefined);
    render(<LandingPage configured error="" onSignIn={signIn} />);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: label })),
    );
    expect(signIn).toHaveBeenCalledTimes(1);
  },
);

test("pending OAuth disables all start actions and prevents duplicate requests", async () => {
  let finish: () => void = () => undefined;
  const signIn = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  render(<LandingPage configured error="" onSignIn={signIn} />);
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "Get started" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  });
  expect(signIn).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status")).toHaveTextContent("Connecting to Google");
  expect(screen.getByRole("button", { name: "Get started" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  await act(async () => finish());
  expect(screen.getByRole("button", { name: "Get started" })).toBeEnabled();
});

test("failed or unavailable authentication leaves a usable public page and accessible errors", async () => {
  const view = render(
    <LandingPage
      configured
      error=""
      onSignIn={vi.fn().mockRejectedValue(new Error("test-only failure"))}
    />,
  );
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Get started" })),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Unable to open Google sign-in",
  );
  expect(screen.getByRole("button", { name: "Get started" })).toBeEnabled();
  view.rerender(
    <LandingPage
      configured={false}
      error="Internal implementation details"
      onSignIn={vi.fn()}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Sign-in is unavailable in this environment",
  );
  expect(
    screen.queryByText("Internal implementation details"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Get started" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Features" })).toBeEnabled();
});
