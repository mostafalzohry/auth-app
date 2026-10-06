import { ApiError } from "@/lib/api";

type Flow = "signin" | "signup" | "session";

function formatWait(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function authErrorMessage(error: unknown, flow: Flow): string {
  if (!(error instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }
  switch (error.status) {
    case 0:
      return "We could not reach the server. Please check your connection and try again.";
    case 400:
      return "Please check the information you entered and try again.";
    case 401:
      return flow === "signin"
        ? "That email and password do not match. Please try again."
        : "Your session has ended. Please sign in again.";
    case 403:
      return "We could not process that request. Please reload the page and try again.";
    case 409:
      return "That email is already registered. Try signing in instead.";
    case 429:
      return error.retryAfterSeconds
        ? `You have tried too many times. Please try again in ${formatWait(error.retryAfterSeconds)}.`
        : "You have tried too many times. Please wait a few minutes and try again.";
    default:
      return error.status >= 500
        ? "Something went wrong on our side. Please try again in a moment."
        : "Something went wrong. Please try again.";
  }
}
