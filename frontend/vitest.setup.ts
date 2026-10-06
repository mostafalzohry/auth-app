import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { clearCurrentUser } from "@/lib/current-user";

afterEach(() => {
  cleanup();
  clearCurrentUser();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
