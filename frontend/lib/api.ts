export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiRequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
}

function errorMessage(body: unknown, fallback: string): string {
  const message = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message[0] ?? fallback;
  return typeof message === "string" ? message : fallback;
}

export async function apiRequest<T = void>(
  path: string,
  { method = "GET", body, signal }: ApiRequestOptions = {},
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "include",
      cache: "no-store",
      signal,
      headers: {
        "X-Auth-Request": "1",
        ...(body !== undefined &&
          !isFormData && { "Content-Type": "application/json" }),
      },
      body:
        body === undefined || isFormData
          ? (body as FormData | undefined)
          : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, "Network error");
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new ApiError(
      response.status,
      errorMessage(data, "Request failed"),
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    );
  }
  return data as T;
}
