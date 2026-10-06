import { describe, expect, it } from "vitest";
import { formatMemberSince, getInitials } from "@/lib/user-display";

describe("getInitials", () => {
  it.each([
    ["Mostafa Elzohry", "ME"],
    ["  ada   king  lovelace ", "AL"],
    ["cher", "C"],
    ["émile zola", "ÉZ"],
    ["   ", "?"],
  ])("%j -> %s", (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });
});

describe("formatMemberSince", () => {
  it("formats the date in UTC", () => {
    expect(formatMemberSince("2026-01-01T00:00:00.000Z")).toBe(
      "January 1, 2026",
    );
  });
});
