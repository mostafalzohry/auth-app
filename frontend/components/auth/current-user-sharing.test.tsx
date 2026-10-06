import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import SigninForm from "@/components/auth/signin-form";
import WelcomeGate from "@/components/auth/welcome-gate";
import { jsonResponse, mockFetch, user } from "@/test-utils/fetch-mock";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const urls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map(([url]) => url as string);

async function signIn() {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Email"), user.email);
  await u.type(screen.getByLabelText("Password"), "Sup3r-secret!");
  await u.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/welcome"));
}

describe("shared current user", () => {
  it("reuses the post-signin /me user on /welcome, even under Strict Mode", async () => {
    const fetchMock = mockFetch(
      jsonResponse(200, { user }),
      jsonResponse(200, { user }),
    );
    const signin = render(<SigninForm />);
    await signIn();
    signin.unmount();

    render(
      <StrictMode>
        <WelcomeGate />
      </StrictMode>,
    );

    expect(await screen.findByText("Welcome to the application.")).toBeTruthy();
    expect(urls(fetchMock)).toEqual(["/api/auth/signin", "/api/auth/me"]);
  });

  it("checks /me once on a direct visit, even under Strict Mode", async () => {
    const fetchMock = mockFetch(jsonResponse(200, { user }));

    render(
      <StrictMode>
        <WelcomeGate />
      </StrictMode>,
    );

    expect(await screen.findByText("Welcome to the application.")).toBeTruthy();
    expect(urls(fetchMock)).toEqual(["/api/auth/me"]);
  });

  it("clears the shared user on logout so the next visit checks /me again", async () => {
    const fetchMock = mockFetch(
      jsonResponse(200, { user }),
      jsonResponse(204),
      jsonResponse(401, { message: "Unauthorized" }),
    );
    const first = render(<WelcomeGate />);
    await screen.findByText("Welcome to the application.");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/signin"));
    first.unmount();

    render(<WelcomeGate />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(2));
    expect(urls(fetchMock)).toEqual([
      "/api/auth/me",
      "/api/auth/logout",
      "/api/auth/me",
    ]);
    expect(screen.queryByText(user.email)).toBeNull();
  });

  it("shares an avatar upload response without refetching /me", async () => {
    const withAvatar = { ...user, avatarUrl: "/api/auth/avatar?v=1" };
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => "blob:x",
      revokeObjectURL: () => undefined,
    });
    const fetchMock = mockFetch(
      jsonResponse(200, { user }),
      jsonResponse(200, { user: withAvatar }),
    );
    const first = render(<WelcomeGate />);
    await screen.findByText("Welcome to the application.");
    const u = userEvent.setup({ applyAccept: false });
    await u.upload(
      screen.getByLabelText("Profile photo file"),
      new File([new Uint8Array(4)], "a.png", { type: "image/png" }),
    );
    await u.click(screen.getByRole("button", { name: "Save photo" }));
    await screen.findByText("Profile photo updated.");
    first.unmount();

    render(<WelcomeGate />);

    await waitFor(() =>
      expect(document.querySelector("img")?.getAttribute("src")).toBe(
        withAvatar.avatarUrl,
      ),
    );
    expect(urls(fetchMock)).toEqual(["/api/auth/me", "/api/auth/avatar"]);
  });
});
