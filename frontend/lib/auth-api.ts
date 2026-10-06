import { ApiError, apiRequest } from "@/lib/api";
import { AVATAR_FIELD_NAME } from "@/lib/avatar-policy";
import { isPublicUser } from "@/lib/validation/public-user";
import type {
  SigninFormValues,
  SignupPayload,
} from "@/lib/validation/auth-schemas";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserResponse {
  user: PublicUser;
}

export function signup(values: SignupPayload) {
  return apiRequest<UserResponse>("/api/auth/signup", {
    method: "POST",
    body: values,
  });
}

export function signin(values: SigninFormValues) {
  return apiRequest<UserResponse>("/api/auth/signin", {
    method: "POST",
    body: values,
  });
}

export async function getCurrentUser(signal?: AbortSignal) {
  const data = await apiRequest<unknown>("/api/auth/me", { signal });
  const user = (data as { user?: unknown } | null)?.user;
  if (!isPublicUser(user)) throw new ApiError(500, "Unexpected response");
  return { user };
}

export function logout() {
  return apiRequest("/api/auth/logout", { method: "POST" });
}

export async function uploadAvatar(file: File, signal?: AbortSignal) {
  const form = new FormData();
  form.append(AVATAR_FIELD_NAME, file);
  const data = await apiRequest<unknown>("/api/auth/avatar", {
    method: "POST",
    body: form,
    signal,
  });
  const user = (data as { user?: unknown } | null)?.user;
  if (!isPublicUser(user)) throw new ApiError(500, "Unexpected response");
  return { user };
}
