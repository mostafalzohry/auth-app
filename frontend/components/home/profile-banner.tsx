"use client";

import { useRef } from "react";
import { Camera, CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/home/user-avatar";
import { useAvatarUpload } from "@/components/home/use-avatar-upload";
import type { PublicUser } from "@/lib/auth-api";
import { AVATAR_ACCEPT } from "@/lib/avatar-policy";

const ProfileBanner = ({
  user,
  onUserUpdated,
}: {
  user: PublicUser;
  onUserUpdated: (user: PublicUser) => void;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const upload = useAvatarUpload(onUserUpdated);
  const previewing = upload.file !== null;

  return (
    <section
      aria-labelledby="profile-name"
      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
    >
      <div
        aria-hidden="true"
        className="h-20 bg-gradient-to-r from-blue-700 to-blue-500 sm:h-24"
      />
      <div className="px-5 pb-5 sm:px-6">
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
          <UserAvatar
            name={user.name}
            src={upload.previewUrl ?? user.avatarUrl}
            className="size-24 shrink-0 text-3xl ring-4 ring-white sm:size-28 sm:text-4xl"
          />
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept={AVATAR_ACCEPT}
              aria-label="Profile photo file"
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.select(file);
                event.target.value = "";
              }}
            />
            {previewing ? (
              <>
                <Button
                  onClick={upload.save}
                  disabled={upload.pending}
                  aria-busy={upload.pending}
                  className="bg-blue-700 text-white hover:bg-blue-800"
                >
                  {upload.pending && (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  )}
                  {upload.pending ? "Saving…" : "Save photo"}
                </Button>
                <Button
                  variant="outline"
                  onClick={upload.cancel}
                  disabled={upload.pending}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => input.current?.click()}>
                <Camera aria-hidden="true" />
                {user.avatarUrl ? "Change photo" : "Choose photo"}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 min-w-0">
          <h1
            id="profile-name"
            className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl"
          >
            {user.name}
          </h1>
          <p className="text-muted-foreground [overflow-wrap:anywhere]">
            {user.email}
          </p>
        </div>

        <div
          aria-live="polite"
          aria-atomic="true"
          className="mt-3 empty:hidden"
        >
          {previewing && !upload.error && !upload.pending && (
            <p className="text-sm text-muted-foreground">
              Previewing your new photo. Save it to keep it.
            </p>
          )}
          {upload.pending && (
            <p className="text-sm text-muted-foreground">Uploading photo…</p>
          )}
          {upload.saved && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-blue-800">
              <CircleCheck className="size-4" aria-hidden="true" />
              Profile photo updated.
            </p>
          )}
          {upload.error && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{upload.error}</AlertDescription>
            </Alert>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          JPEG, PNG or WebP, up to 2 MB.
        </p>
      </div>
    </section>
  );
};

export default ProfileBanner;
