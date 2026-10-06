"use client";

import { useRef, useState } from "react";
import { logout } from "@/lib/auth-api";
import { authErrorMessage } from "@/lib/auth-errors";
import { clearCurrentUser } from "@/lib/current-user";

export function useSignOut(onSignedOut: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function signOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await logout();
      clearCurrentUser();
      onSignedOut();
    } catch (err) {
      setError(authErrorMessage(err, "session"));
      inFlight.current = false;
      setPending(false);
    }
  }

  return { signOut, pending, error };
}
