import { getCurrentUser, type PublicUser } from "@/lib/auth-api";

const FRESH_MS = 30_000;

let current: { user: PublicUser; verifiedAt: number } | null = null;
let inflight: Promise<PublicUser> | null = null;
let generation = 0;

export function peekCurrentUser(): PublicUser | null {
  return current && Date.now() - current.verifiedAt < FRESH_MS
    ? current.user
    : null;
}

export function setCurrentUser(user: PublicUser): void {
  current = { user, verifiedAt: Date.now() };
}

export function clearCurrentUser(): void {
  generation++;
  current = null;
  inflight = null;
}

export function refreshCurrentUser(): Promise<PublicUser> {
  if (inflight) return inflight;
  const started = generation;
  const request: Promise<PublicUser> = getCurrentUser()
    .then(({ user }) => {
      if (started === generation) setCurrentUser(user);
      return user;
    })
    .catch((error: unknown) => {
      if (started === generation) current = null;
      throw error;
    })
    .finally(() => {
      if (inflight === request) inflight = null;
    });
  inflight = request;
  return request;
}

export function ensureCurrentUser(): Promise<PublicUser> {
  const fresh = peekCurrentUser();
  return fresh ? Promise.resolve(fresh) : refreshCurrentUser();
}
