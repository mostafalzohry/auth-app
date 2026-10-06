import { describe, expect, it } from "vitest";
import { isPublicUser } from "@/lib/validation/public-user";
import { user } from "@/test-utils/fetch-mock";

describe("isPublicUser avatarUrl", () => {
  it("accepts users with and without an avatarUrl", () => {
    expect(isPublicUser(user)).toBe(true);
    expect(isPublicUser({ ...user, avatarUrl: "/api/auth/avatar?v=3" })).toBe(
      true,
    );
  });

  it.each([
    ["an absolute URL", "https://evil.example/a.png"],
    ["a data URI", "data:image/png;base64,AAAA"],
    ["a javascript URL", "javascript:alert(1)"],
    ["another path", "/api/auth/me"],
    ["a protocol-relative URL", "//evil.example/api/auth/avatar"],
    ["a non-string", 5],
    ["an empty string", ""],
  ])("rejects %s", (_label, avatarUrl) => {
    expect(isPublicUser({ ...user, avatarUrl })).toBe(false);
  });
});
