import { describe, expect, it } from "vitest";
import { ApiError, apiRequest } from "@/lib/api";
import { jsonResponse, mockFetch, requestOf } from "@/test-utils/fetch-mock";

describe("apiRequest", () => {
  it("sends relative, credentialed, uncached JSON requests with the CSRF header", async () => {
    const fetchMock = mockFetch(jsonResponse(200, { ok: true }));

    await apiRequest("/api/auth/signin", { method: "POST", body: { a: 1 } });

    expect(requestOf(fetchMock)).toEqual({
      url: "/api/auth/signin",
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "X-Auth-Request": "1", "Content-Type": "application/json" },
      body: { a: 1 },
    });
  });

  it("sends no body or Content-Type on GET", async () => {
    const fetchMock = mockFetch(jsonResponse(200, {}));

    await apiRequest("/api/auth/me");

    const request = requestOf(fetchMock);
    expect(request.method).toBe("GET");
    expect(request.body).toBeUndefined();
    expect(request.headers).toEqual({ "X-Auth-Request": "1" });
  });

  it("returns undefined for 204", async () => {
    mockFetch(jsonResponse(204));

    await expect(
      apiRequest("/api/auth/logout", { method: "POST" }),
    ).resolves.toBeUndefined();
  });

  it("throws an ApiError with the status and Retry-After on failure", async () => {
    mockFetch(
      jsonResponse(
        429,
        { message: "Too many requests" },
        { "Retry-After": "120" },
      ),
    );

    await expect(apiRequest("/x")).rejects.toMatchObject({
      name: "ApiError",
      status: 429,
      retryAfterSeconds: 120,
    });
  });

  it("uses the first message of a validation array and survives a non-JSON error body", async () => {
    mockFetch(
      jsonResponse(400, { message: ["first", "second"] }),
      new Response("<html>bad gateway</html>", { status: 502 }),
    );

    await expect(apiRequest("/x")).rejects.toMatchObject({
      status: 400,
      message: "first",
    });
    await expect(apiRequest("/x")).rejects.toMatchObject({ status: 502 });
  });

  it("turns network failures into ApiError status 0", async () => {
    mockFetch(new TypeError("Failed to fetch"));

    const error = await apiRequest("/x").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0 });
  });

  it("does not retry a failed request", async () => {
    const fetchMock = mockFetch(jsonResponse(503, { message: "x" }));

    await apiRequest("/x", { method: "POST", body: {} }).catch(() => undefined);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("apiRequest with FormData", () => {
  it("sends the FormData as-is without JSON or a manual Content-Type", async () => {
    const fetchMock = mockFetch(jsonResponse(200, { ok: true }));
    const form = new FormData();
    form.append("file", new File(["x"], "a.png", { type: "image/png" }));

    await apiRequest("/api/auth/avatar", { method: "POST", body: form });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/avatar");
    expect(init.body).toBe(form);
    expect(init.credentials).toBe("include");
    expect(init.headers).toEqual({ "X-Auth-Request": "1" });
    expect(Object.keys(init.headers as object)).not.toContain("Content-Type");
  });
});
