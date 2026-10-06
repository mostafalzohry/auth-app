import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SigninForm } from "@/components/auth/signin-form";
import { SignupForm } from "@/components/auth/signup-form";
import { mockFetch } from "@/test-utils/fetch-mock";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe("validation when a field is touched", () => {
  it("signup: shows an error as soon as an empty field loses focus", async () => {
    const fetchMock = mockFetch();
    render(<SignupForm />);
    const u = userEvent.setup();

    expect(screen.queryByText("Name is required")).toBeNull();
    await u.click(screen.getByLabelText("Name"));
    await u.tab();

    expect(await screen.findByText("Name is required")).toBeTruthy();
    expect(screen.queryByText("Email is required")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signup: validates each field on blur and clears the error once it is fixed", async () => {
    render(<SignupForm />);
    const u = userEvent.setup();

    await u.type(screen.getByLabelText("Email"), "nope");
    await u.tab();
    expect(await screen.findByText("Enter a valid email address")).toBeTruthy();

    await u.type(screen.getByLabelText("Email"), "@example.com");
    expect(screen.queryByText("Enter a valid email address")).toBeNull();
  });

  it("signup: rechecks the repeated password when the password changes", async () => {
    render(<SignupForm />);
    const u = userEvent.setup();

    await u.type(screen.getByLabelText("Password"), "ChangeMe-123!");
    await u.type(screen.getByLabelText("Repeat password"), "ChangeMe-123!");
    await u.tab();
    expect(screen.queryByText("Passwords do not match")).toBeNull();

    await u.type(screen.getByLabelText("Password"), "x");

    expect(await screen.findByText("Passwords do not match")).toBeTruthy();
  });

  it("signin: validates the email and password when they are touched", async () => {
    render(<SigninForm />);
    const u = userEvent.setup();

    await u.type(screen.getByLabelText("Email"), "nope");
    await u.tab();
    expect(await screen.findByText("Enter a valid email address")).toBeTruthy();

    await u.click(screen.getByLabelText("Password"));
    await u.tab();
    expect(await screen.findByText("Password is required")).toBeTruthy();
  });
});
