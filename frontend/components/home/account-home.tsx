"use client";

import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PublicUser } from "@/lib/auth-api";
import ApiDocsCard from "@/components/home/api-docs-card";
import HomeLayout from "@/components/home/home-layout";
import ProfileCard from "@/components/home/profile-card";
import { useSignOut } from "@/components/home/use-sign-out";
import UserMenu from "@/components/home/user-menu";

const AccountHome = ({
  user,
  onSignedOut,
}: {
  user: PublicUser;
  onSignedOut: () => void;
}) => {
  const { signOut, pending, error } = useSignOut(onSignedOut);

  return (
    <HomeLayout
      actions={
        <UserMenu name={user.name} pending={pending} onSignOut={signOut} />
      }
    >
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-5xl">
          Hi, {user.name} 👋
        </h1>
        <p className="text-lg text-muted-foreground">
          Welcome to the application.
        </p>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {error && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <ProfileCard user={user} />
        <ApiDocsCard />
      </div>
    </HomeLayout>
  );
};

export default AccountHome;
