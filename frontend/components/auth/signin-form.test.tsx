import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SigninForm } from "@/components/auth/signin-form";
import {
  jsonResponse,
  mockFetch,
  requestOf,
  user,
} from "@/test-utils/fetch-mock";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

async function fillAndSubmit(
  email = "Mostafa@Example.com",
  password = " secret ",
) {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Email"), email);
  await u.type(screen.getByLabelText("Password"), password);
  await u.click(screen.getByRole("button", { name: "Sign in" }));
  return u;
}

describe("SigninForm", () => {
  it("validates the email and requires a password without signup rules", async () => {
    const fetchMock = mockFetch();
    render(<SigninForm />);
    const u = userEvent.setup();

    await u.type(screen.getByLabelText("Email"), "nope");
    await u.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address")).toBeTruthy();
    expect(screen.getByText("Password is required")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs in, verifies the cookie with /me, then goes to /welcome", async () => {
    const fetchMock = mockFetch(
      jsonResponse(200, { user }),
      jsonResponse(200, { user }),
    );
    render(<SigninForm />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/welcome"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestOf(fetchMock, 0)).toMatchObject({
      url: "/api/auth/signin",
      method: "POST",
      credentials: "include",
      headers: { "X-Auth-Request": "1", "Content-Type": "application/json" },
      body: { email: "mostafa@example.com", password: " secret " },
    });
    expect(requestOf(fetchMock, 1)).toMatchObject({
      url: "/api/auth/me",
      method: "GET",
      credentials: "include",
    });
    expect(requestOf(fetchMock, 1).body).toBeUndefined();
  });

  it("does not navigate when /me cannot confirm the session", async () => {
    const fetchMock = mockFetch(
      jsonResponse(200, { user }),
      jsonResponse(401, { message: "Unauthorized" }),
    );
    render(<SigninForm />);
    await fillAndSubmit();

    expect(
      await screen.findByText(/browser did not keep your session/i),
    ).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows invalid credentials, keeps the values and skips /me", async () => {
    const fetchMock = mockFetch(
      jsonResponse(401, { message: "Invalid email or password" }),
    );
    render(<SigninForm />);
    await fillAndSubmit();

    expect(
      await screen.findByText(
        "That email and password do not match. Please try again.",
      ),
    ).toBeTruthy();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "Mostafa@Example.com",
    );
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe(
      " secret ",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("uses Retry-After for 429 and does not retry", async () => {
    const fetchMock = mockFetch(
      jsonResponse(429, { message: "x" }, { "Retry-After": "45" }),
    );
    render(<SigninForm />);
    await fillAndSubmit();

    expect(
      await screen.findByText(
        "You have tried too many times. Please try again in 45 seconds.",
      ),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("disables the button while pending and ignores duplicate submissions", async () => {
    let resolve!: (response: Response) => void;
    const fetchMock = mockFetch(
      new Promise<Response>((r) => (resolve = r)),
      jsonResponse(200, { user }),
    );
    render(<SigninForm />);
    const u = await fillAndSubmit();

    const button = await screen.findByRole("button", { name: "Signing in…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await u.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolve(jsonResponse(200, { user }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  });

  it("shows the notice that signup passes through the URL", () => {
    render(<SigninForm notice="Account created. Sign in to continue." />);

    expect(
      screen.getByText("Account created. Sign in to continue."),
    ).toBeTruthy();
  });
});
