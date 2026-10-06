import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignupForm } from "@/components/auth/signup-form";
import {
  jsonResponse,
  mockFetch,
  requestOf,
  user,
} from "@/test-utils/fetch-mock";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const PASSWORD = " Sup3r-secret! ";

async function fillAndSubmit(
  overrides: {
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  } = {},
) {
  const u = userEvent.setup();
  const password = overrides.password ?? PASSWORD;
  await u.type(
    screen.getByLabelText("Name"),
    overrides.name ?? "  Mostafa Elzohry ",
  );
  await u.type(
    screen.getByLabelText("Email"),
    overrides.email ?? " Mostafa@Example.com ",
  );
  await u.type(screen.getByLabelText("Password"), password);
  await u.type(
    screen.getByLabelText("Repeat password"),
    overrides.confirmPassword ?? password,
  );
  await u.click(screen.getByRole("button", { name: "Create account" }));
  return u;
}

describe("SignupForm", () => {
  beforeEach(() => {
    render(<SignupForm />);
  });

  it("shows inline errors and does not call the API when the form is empty", async () => {
    const fetchMock = mockFetch();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Name is required")).toBeTruthy();
    expect(screen.getByText("Email is required")).toBeTruthy();
    expect(screen.getByText("Password is required")).toBeTruthy();
    expect(screen.getByText("Please repeat your password")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("associates errors with their fields and enforces the password rules", async () => {
    mockFetch();
    await fillAndSubmit({ password: "abcdef 1" });

    const password = screen.getByLabelText("Password");
    const error = await screen.findByText(
      "Password must contain at least one special character",
    );
    expect(password.getAttribute("aria-invalid")).toBe("true");
    expect(password.getAttribute("aria-describedby")).toContain(error.id);
  });

  it("sends the normalized name and email but the password exactly as typed", async () => {
    const fetchMock = mockFetch(jsonResponse(201, { user }));
    await fillAndSubmit();

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestOf(fetchMock)).toMatchObject({
      url: "/api/auth/signup",
      method: "POST",
      credentials: "include",
      headers: { "X-Auth-Request": "1", "Content-Type": "application/json" },
      body: {
        name: "Mostafa Elzohry",
        email: "mostafa@example.com",
        password: PASSWORD,
      },
    });
  });

  it("goes to /signin after success and does not sign the user in", async () => {
    const fetchMock = mockFetch(jsonResponse(201, { user }));
    await fillAndSubmit();

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/signin?registered=1"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(router.push.mock.calls[0][0]).not.toContain("Sup3r");
  });

  it("disables the button while pending and ignores duplicate submissions", async () => {
    let resolve!: (response: Response) => void;
    const fetchMock = mockFetch(new Promise<Response>((r) => (resolve = r)));
    const u = await fillAndSubmit();

    const button = await screen.findByRole("button", {
      name: "Creating account…",
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    await u.click(button);
    await u.keyboard("{Enter}");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolve(jsonResponse(201, { user }));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it("keeps the typed values after a 409 and marks the email field", async () => {
    mockFetch(jsonResponse(409, { message: "Email is already registered" }));
    await fillAndSubmit();

    expect(
      await screen.findByText(/already registered. Try signing in/i),
    ).toBeTruthy();
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
      "  Mostafa Elzohry ",
    );
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(
      "Mostafa@Example.com",
    );
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe(
      PASSWORD,
    );
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Create account",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each([
    [
      429,
      { message: "x" },
      { "Retry-After": "120" },
      /try again in 2 minutes/i,
    ],
    [403, { message: "Forbidden" }, {}, /could not process that request/i],
    [500, { message: "x" }, {}, /something went wrong on our side/i],
    [
      400,
      { message: ["name must be longer"] },
      {},
      /check the information you entered/i,
    ],
  ])(
    "shows a safe message for status %i",
    async (status, body, headers, expected) => {
      mockFetch(jsonResponse(status, body, headers));
      await fillAndSubmit();

      expect(await screen.findByText(expected)).toBeTruthy();
      expect(screen.queryByText(/name must be longer/)).toBeNull();
    },
  );

  it("shows a network message and does not retry automatically", async () => {
    const fetchMock = mockFetch(new TypeError("Failed to fetch"));
    await fillAndSubmit();

    expect(await screen.findByText(/could not reach the server/i)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks to repeat the password and does not call the API when they differ", async () => {
    const fetchMock = mockFetch();
    await fillAndSubmit({ confirmPassword: "Different-1!" });

    expect(await screen.findByText("Passwords do not match")).toBeTruthy();
    expect(
      screen.getByLabelText("Repeat password").getAttribute("aria-invalid"),
    ).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never sends the repeated password to the backend", async () => {
    const fetchMock = mockFetch(jsonResponse(201, { user }));
    await fillAndSubmit();

    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(Object.keys(requestOf(fetchMock).body as object).sort()).toEqual([
      "email",
      "name",
      "password",
    ]);
  });

  it("toggles each password field separately", async () => {
    const u = userEvent.setup();
    const password = screen.getByLabelText("Password");
    const repeated = screen.getByLabelText("Repeat password");

    await u.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.getAttribute("type")).toBe("text");
    expect(repeated.getAttribute("type")).toBe("password");
    await u.click(
      screen.getByRole("button", { name: "Show repeated password" }),
    );
    expect(repeated.getAttribute("type")).toBe("text");
    await u.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password.getAttribute("type")).toBe("password");
  });
});
