import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import WelcomeGate from "@/components/auth/welcome-gate";
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
  it("shows a skeleton and no protected content while /me is unresolved", () => {
    mockFetch(new Promise<Response>(() => undefined));
    render(<WelcomeGate />);

    expect(screen.getByRole("status").textContent).toMatch(
      /checking your session/i,
    );
    expect(screen.queryByText(WELCOME)).toBeNull();
    expect(screen.queryByText(user.email)).toBeNull();
  });

  it("shows the real user from /me", async () => {
    const fetchMock = mockFetch(jsonResponse(200, { user }));
    render(<WelcomeGate />);

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(
      "Hi, Mostafa Elzohry 👋",
    );
    expect(screen.getByText(WELCOME)).toBeTruthy();
    expect(screen.getAllByText(user.email)).toHaveLength(1);
    expect(screen.getByText("January 1, 2026")).toBeTruthy();
    expect(screen.getByText("You're signed in")).toBeTruthy();
    expect(screen.getByText("ME")).toBeTruthy();
    expect(requestOf(fetchMock)).toMatchObject({
      url: "/api/auth/me",
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  });

  it("links to the Swagger docs in a new tab safely", async () => {
    mockFetch(jsonResponse(200, { user }));
    render(<WelcomeGate />);

    const link = await screen.findByRole("link", {
      name: /api documentation/i,
    });
    expect(link.getAttribute("href")).toBe(
      "https://auth-app-ten-phi.vercel.app/swagger",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it.each([
    ["no user", {}],
    ["a null user", { user: null }],
    ["a missing email", { user: { ...user, email: undefined } }],
    ["an empty name", { user: { ...user, name: " " } }],
    ["a non-string id", { user: { ...user, id: 5 } }],
    ["an invalid createdAt", { user: { ...user, createdAt: "not a date" } }],
    ["a missing updatedAt", { user: { ...user, updatedAt: undefined } }],
  ])("rejects a 200 response with %s", async (_label, body) => {
    mockFetch(jsonResponse(200, body));
    render(<WelcomeGate />);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText(WELCOME)).toBeNull();
    expect(screen.queryByText(user.email)).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
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

  it.each([
    ["a successful", () => jsonResponse(200, { user })],
    ["a 401", () => jsonResponse(401, { message: "Unauthorized" })],
    ["a failed", () => jsonResponse(503, {})],
  ])("ignores %s result that arrives after unmount", async (_l, make) => {
    let resolve!: (response: Response) => void;
    const fetchMock = mockFetch(
      new Promise<Response>((r) => {
        resolve = r;
      }),
    );
    const { container, unmount } = render(<WelcomeGate />);
    const signal = (fetchMock.mock.calls[0][1] as RequestInit).signal;

    unmount();
    expect(signal?.aborted).toBe(true);
    resolve(make());
    await new Promise((r) => setTimeout(r, 0));

    expect(container.textContent).toBe("");
    expect(router.replace).not.toHaveBeenCalled();
  });

  describe("sign out", () => {
    async function renderReady(...responses: Array<Response | Error>) {
      const fetchMock = mockFetch(jsonResponse(200, { user }), ...responses);
      render(<WelcomeGate />);
      await screen.findByText(WELCOME);
      return fetchMock;
    }

    it("posts once with credentials, redirects and removes content on 204", async () => {
      const fetchMock = await renderReady(jsonResponse(204));
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Sign out" }));

      await waitFor(() =>
        expect(router.replace).toHaveBeenCalledWith("/signin"),
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(requestOf(fetchMock, 1)).toMatchObject({
        url: "/api/auth/logout",
        method: "POST",
        credentials: "include",
        headers: { "X-Auth-Request": "1" },
        body: undefined,
      });
      expect(screen.queryByText(WELCOME)).toBeNull();
      expect(screen.queryByText(user.email)).toBeNull();
    });

    it("keeps the page and shows an error when logout fails, then allows retry", async () => {
      const fetchMock = await renderReady(
        jsonResponse(503, {}),
        jsonResponse(204),
      );
      const u = userEvent.setup();
      await u.click(screen.getByRole("button", { name: "Sign out" }));

      expect(await screen.findByRole("alert")).toBeTruthy();
      expect(screen.getByText(WELCOME)).toBeTruthy();
      expect(router.replace).not.toHaveBeenCalled();

      await u.click(screen.getByRole("button", { name: "Sign out" }));
      await waitFor(() =>
        expect(router.replace).toHaveBeenCalledWith("/signin"),
      );
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("shows a pending state and ignores duplicate clicks", async () => {
      let resolve!: (response: Response) => void;
      const fetchMock = await renderReady();
      fetchMock.mockReturnValueOnce(
        new Promise<Response>((r) => {
          resolve = r;
        }),
      );
      const u = userEvent.setup();
      const button = screen.getByRole("button", { name: "Sign out" });
      await u.click(button);
      await u.click(button);
      fireEvent.click(button);

      const pending = screen.getByRole("button", { name: /signing out/i });
      expect((pending as HTMLButtonElement).disabled).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      resolve(jsonResponse(204));
      await waitFor(() =>
        expect(router.replace).toHaveBeenCalledWith("/signin"),
      );
      expect(router.replace).toHaveBeenCalledTimes(1);
    });
  });
});
