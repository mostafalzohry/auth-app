import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WelcomeGate } from "@/components/auth/welcome-gate";
import {
  jsonResponse,
  mockFetch,
  requestOf,
  user,
} from "@/test-utils/fetch-mock";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const WELCOME = "Welcome to the application.";

describe("WelcomeGate", () => {
  it("shows nothing protected while the session is being checked", async () => {
    mockFetch(new Promise<Response>(() => undefined));
    render(<WelcomeGate />);

    expect(screen.getByRole("status").textContent).toMatch(
      /checking your session/i,
    );
    expect(screen.queryByText(WELCOME)).toBeNull();
  });

  it("shows the welcome message once /me confirms the cookie", async () => {
    const fetchMock = mockFetch(jsonResponse(200, { user }));
    render(<WelcomeGate />);

    expect((await screen.findByRole("heading")).textContent).toBe(WELCOME);
    expect(requestOf(fetchMock)).toMatchObject({
      url: "/api/auth/me",
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  });

  it("redirects to /signin on 401 without ever showing the content", async () => {
    mockFetch(jsonResponse(401, { message: "Unauthorized" }));
    render(<WelcomeGate />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/signin"));
    expect(screen.queryByText(WELCOME)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["a 503", jsonResponse(503, { message: "x" })],
    ["a network error", new TypeError("Failed to fetch")],
  ])("shows an error with a retry for %s", async (_label, outcome) => {
    const fetchMock = mockFetch(outcome, jsonResponse(200, { user }));
    render(<WelcomeGate />);
    const u = userEvent.setup();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(WELCOME)).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();

    await u.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText(WELCOME)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
