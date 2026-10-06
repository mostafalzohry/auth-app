import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { authErrorMessage } from "@/lib/auth-errors";

const message = (
  status: number,
  flow: "signin" | "signup" | "session",
  retry?: number,
) => authErrorMessage(new ApiError(status, "raw backend text", retry), flow);

describe("authErrorMessage", () => {
  it("maps each status to a clear message", () => {
    expect(message(0, "signin")).toMatch(/could not reach the server/i);
    expect(message(400, "signup")).toMatch(
      /check the information you entered/i,
    );
    expect(message(401, "signin")).toBe(
      "That email and password do not match. Please try again.",
    );
    expect(message(403, "signin")).toMatch(/could not process that request/i);
    expect(message(409, "signup")).toMatch(/already registered/i);
    expect(message(500, "signin")).toMatch(/something went wrong on our side/i);
    expect(message(503, "signup")).toMatch(/something went wrong on our side/i);
  });

  it("uses Retry-After for 429", () => {
    expect(message(429, "signin", 45)).toBe(
      "You have tried too many times. Please try again in 45 seconds.",
    );
    expect(message(429, "signin", 1)).toBe(
      "You have tried too many times. Please try again in 1 second.",
    );
    expect(message(429, "signin", 61)).toBe(
      "You have tried too many times. Please try again in 2 minutes.",
    );
    expect(message(429, "signin")).toMatch(/wait a few minutes/i);
  });

  it("never shows raw backend text or non-API errors", () => {
    expect(message(418, "signin")).not.toContain("raw backend text");
    expect(authErrorMessage(new Error("stack details"), "signin")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
