"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/components/auth/use-current-user";
import SessionError from "@/components/auth/session-error";
import AccountHome from "@/components/home/account-home";
import AccountHomeSkeleton from "@/components/home/account-home-skeleton";

const WelcomeGate = () => {
  const router = useRouter();
  const { state, retry } = useCurrentUser();
  const [signedOut, setSignedOut] = useState(false);

  if (signedOut) return null;

  if (state.status === "ready") {
    return (
      <AccountHome
        user={state.user}
        onSignedOut={() => {
          setSignedOut(true);
          router.replace("/signin");
        }}
      />
    );
  }

  if (state.status === "error") {
    return <SessionError message={state.message} onRetry={retry} />;
  }

  return <AccountHomeSkeleton />;
};

export default WelcomeGate;
