import { vi } from "vitest";

export function jsonResponse(
  status: number,
  body?: unknown,
  headers: Record<string, string> = {},
): Response {
  if (status === 204) return new Response(null, { status });
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function mockFetch(
  ...responses: Array<Response | Error | Promise<Response>>
) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) fetchMock.mockRejectedValueOnce(response);
    else fetchMock.mockReturnValueOnce(Promise.resolve(response));
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function requestOf(fetchMock: ReturnType<typeof vi.fn>, index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return {
    url,
    method: init.method,
    credentials: init.credentials,
    cache: init.cache,
    headers: init.headers as Record<string, string>,
    body: init.body === undefined ? undefined : JSON.parse(init.body as string),
  };
}

export const user = {
  id: "507f1f77bcf86cd799439011",
  name: "Mostafa Elzohry",
  email: "mostafa@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
