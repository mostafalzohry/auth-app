import { describe, expect, it, vi } from "vitest";
import {
  clearCurrentUser,
  ensureCurrentUser,
  peekCurrentUser,
  refreshCurrentUser,
  setCurrentUser,
} from "@/lib/current-user";
import { jsonResponse, mockFetch, user } from "@/test-utils/fetch-mock";

describe("current user store", () => {
  it("deduplicates concurrent requests into one /me call", async () => {
    const fetchMock = mockFetch(jsonResponse(200, { user }));

    const results = await Promise.all([
      ensureCurrentUser(),
      ensureCurrentUser(),
      refreshCurrentUser(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result.id === user.id)).toBe(true);
  });

  it("reuses a fresh user and refetches once it is stale", async () => {
    const fetchMock = mockFetch(
      jsonResponse(200, { user }),
      jsonResponse(200, { user }),
    );
    vi.useFakeTimers();
    try {
      await ensureCurrentUser();
      await ensureCurrentUser();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(31_000);
      expect(peekCurrentUser()).toBeNull();
      await ensureCurrentUser();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("always requests on refresh and does not cache failures", async () => {
    const fetchMock = mockFetch(
      jsonResponse(200, { user }),
      jsonResponse(401, { message: "Unauthorized" }),
    );
    await refreshCurrentUser();

    await expect(refreshCurrentUser()).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(peekCurrentUser()).toBeNull();
  });

  it("drops a response that arrives after clear", async () => {
    let resolve!: (response: Response) => void;
    mockFetch(
      new Promise<Response>((r) => {
        resolve = r;
      }),
    );
    const pending = refreshCurrentUser();

    clearCurrentUser();
    resolve(jsonResponse(200, { user }));
    await pending;

    expect(peekCurrentUser()).toBeNull();
  });

  it("keeps the user only in memory, never in browser storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    mockFetch(jsonResponse(200, { user }));

    await refreshCurrentUser();
    setCurrentUser({ ...user, name: "Other" });

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });
});
