import type { PublicUser } from "@/lib/auth-api";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isDateString(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

export function isPublicUser(value: unknown): value is PublicUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    isNonEmptyString(user.id) &&
    isNonEmptyString(user.name) &&
    isNonEmptyString(user.email) &&
    isDateString(user.createdAt) &&
    isDateString(user.updatedAt)
  );
}
