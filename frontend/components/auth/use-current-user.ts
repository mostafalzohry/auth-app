"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import type { PublicUser } from "@/lib/auth-api";
import { authErrorMessage } from "@/lib/auth-errors";
import {
  ensureCurrentUser,
  peekCurrentUser,
  refreshCurrentUser,
} from "@/lib/current-user";

export type CurrentUserState =
  | { status: "loading" }
  | { status: "ready"; user: PublicUser }
  | { status: "error"; message: string };

export function useCurrentUser() {
  const router = useRouter();
  const [state, setState] = useState<CurrentUserState>(() => {
    const user = peekCurrentUser();
    return user ? { status: "ready", user } : { status: "loading" };
  });
  const [attempt, setAttempt] = useState(0);

  const loadUser = useCallback(
    (signal: AbortSignal, force: boolean) => {
      (force ? refreshCurrentUser() : ensureCurrentUser())
        .then((user) => {
          if (!signal.aborted) setState({ status: "ready", user });
        })
        .catch((error: unknown) => {
          if (signal.aborted) return;
          if (error instanceof ApiError && error.status === 401) {
            router.replace("/signin");
            return;
          }
          setState({
            status: "error",
            message: authErrorMessage(error, "session"),
          });
        });
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadUser(controller.signal, attempt > 0);
    return () => controller.abort();
  }, [loadUser, attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  }

  return { state, retry };
}
