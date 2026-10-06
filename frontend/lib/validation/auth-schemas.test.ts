import { describe, expect, it } from "vitest";
import { signinSchema, signupSchema } from "@/lib/validation/auth-schemas";

const valid = {
  name: "Mostafa Elzohry",
  email: "mostafa@example.com",
  password: "ChangeMe-123!",
};

function signup(overrides: Partial<Record<string, string>> = {}) {
  const password = overrides.password ?? valid.password;
  return { ...valid, confirmPassword: password, ...overrides };
}

const accepts = (
  schema: { isValid: (value: unknown) => Promise<boolean> },
  value: object,
) => schema.isValid(value);
const rejects = async (
  schema: { isValid: (value: unknown) => Promise<boolean> },
  value: object,
) => !(await schema.isValid(value));

describe("signupSchema (mirrors the backend rules)", () => {
  it("accepts valid values", async () => {
    expect(await accepts(signupSchema, signup())).toBe(true);
  });

  it("trims the name and lowercases the email, but never touches the password", async () => {
    const result = await signupSchema.validate(
      signup({
        name: "  Mostafa  ",
        email: "  MOSTAFA@Example.COM ",
        password: " ChangeMe-123! ",
      }),
    );

    expect(result).toEqual({
      name: "Mostafa",
      email: "mostafa@example.com",
      password: " ChangeMe-123! ",
      confirmPassword: " ChangeMe-123! ",
    });
  });

  it("checks name length after trimming (3-100)", async () => {
    expect(await rejects(signupSchema, signup({ name: " ab " }))).toBe(true);
    expect(await accepts(signupSchema, signup({ name: "abc" }))).toBe(true);
    expect(await accepts(signupSchema, signup({ name: "a".repeat(100) }))).toBe(
      true,
    );
    expect(await rejects(signupSchema, signup({ name: "a".repeat(101) }))).toBe(
      true,
    );
  });

  it("limits the email to 254 characters and requires a valid format", async () => {
    expect(await rejects(signupSchema, signup({ email: "nope" }))).toBe(true);
    expect(
      await rejects(signupSchema, signup({ email: `${"a".repeat(250)}@b.co` })),
    ).toBe(true);
  });

  it("applies the password length and character rules", async () => {
    for (const password of [
      "a1!",
      "abcdefg!",
      "12345678!",
      "abcdefgh",
      "abcdefg1",
    ]) {
      expect(await rejects(signupSchema, signup({ password }))).toBe(true);
    }
    expect(await accepts(signupSchema, signup({ password: "abcdef1!" }))).toBe(
      true,
    );
    expect(
      await accepts(
        signupSchema,
        signup({ password: `a1!${"x".repeat(125)}` }),
      ),
    ).toBe(true);
    expect(
      await rejects(
        signupSchema,
        signup({ password: `a1!${"x".repeat(126)}` }),
      ),
    ).toBe(true);
  });

  it("does not accept whitespace as the special character", async () => {
    expect(await rejects(signupSchema, signup({ password: "abcdef 1" }))).toBe(
      true,
    );
  });

  it("requires the repeated password to match exactly", async () => {
    expect(
      await rejects(signupSchema, signup({ confirmPassword: "ChangeMe-123" })),
    ).toBe(true);
    expect(
      await rejects(
        signupSchema,
        signup({ confirmPassword: " ChangeMe-123!" }),
      ),
    ).toBe(true);
    expect(await rejects(signupSchema, signup({ confirmPassword: "" }))).toBe(
      true,
    );
  });
});

describe("signinSchema", () => {
  it("requires a valid email and a non-empty password up to 128 characters", async () => {
    expect(await rejects(signinSchema, { email: "nope", password: "x" })).toBe(
      true,
    );
    expect(
      await rejects(signinSchema, { email: valid.email, password: "" }),
    ).toBe(true);
    expect(
      await rejects(signinSchema, {
        email: valid.email,
        password: "a".repeat(129),
      }),
    ).toBe(true);
    expect(
      await accepts(signinSchema, {
        email: valid.email,
        password: "a".repeat(128),
      }),
    ).toBe(true);
  });

  it("does not apply the signup complexity rules", async () => {
    expect(
      await accepts(signinSchema, { email: valid.email, password: "simple" }),
    ).toBe(true);
  });

  it("keeps the password exactly as typed", async () => {
    const result = await signinSchema.validate({
      email: "A@B.co",
      password: "  spaced  ",
    });

    expect(result).toEqual({ email: "a@b.co", password: "  spaced  " });
  });
});
