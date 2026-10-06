import { apiRequest } from "@/lib/api";
import type {
  SigninFormValues,
  SignupPayload,
} from "@/lib/validation/auth-schemas";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
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

export function getCurrentUser(signal?: AbortSignal) {
  return apiRequest<UserResponse>("/api/auth/me", { signal });
}
