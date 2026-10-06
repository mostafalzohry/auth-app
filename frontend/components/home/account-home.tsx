"use client";

import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PublicUser } from "@/lib/auth-api";
import { setCurrentUser } from "@/lib/current-user";
import ApiDocsCard from "@/components/home/api-docs-card";
import HomeLayout from "@/components/home/home-layout";
import ProfileBanner from "@/components/home/profile-banner";
import ProfileCard from "@/components/home/profile-card";
import { useSignOut } from "@/components/home/use-sign-out";
import UserMenu from "@/components/home/user-menu";

const AccountHome = ({
  user: initialUser,
  onSignedOut,
}: {
  user: PublicUser;
  onSignedOut: () => void;
}) => {
  const [user, setUser] = useState(initialUser);
  const { signOut, pending, error } = useSignOut(onSignedOut);

  return (
    <HomeLayout
      actions={
        <UserMenu
          name={user.name}
          avatarUrl={user.avatarUrl}
          pending={pending}
          onSignOut={signOut}
        />
      }
    >
      <p className="text-lg text-muted-foreground">
        Welcome to the application.
      </p>

      <div aria-live="polite" aria-atomic="true">
        {error && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <ProfileBanner
        user={user}
        onUserUpdated={(updated) => {
          setUser(updated);
          setCurrentUser(updated);
        }}
      />
      <ProfileCard user={user} />
      <ApiDocsCard />
    </HomeLayout>
  );
};

export default AccountHome;
