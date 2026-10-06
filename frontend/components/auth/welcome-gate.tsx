"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth-api";
import { authErrorMessage } from "@/lib/auth-errors";

type State =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function WelcomeGate() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getCurrentUser(controller.signal)
      .then(() => setState({ status: "ready" }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/signin");
          return;
        }
        setState({
          status: "error",
          message: authErrorMessage(error, "session"),
        });
      });
    return () => controller.abort();
  }, [attempt, router]);

  if (state.status === "ready") {
    return (
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome to the application.
      </h1>
    );
  }

  if (state.status === "error") {
    return (
      <div className="w-full max-w-sm space-y-4">
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
        <Button
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((current) => current + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <p role="status" className="text-sm text-muted-foreground">
      Checking your session…
    </p>
  );
}
