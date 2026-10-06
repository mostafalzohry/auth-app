"use client";

import { useState } from "react";
import { cn } from "cn";
import { getInitials } from "@/lib/user-display";

interface UserAvatarProps {
  name: string;
  src?: string | null;
  className?: string;
}

const UserAvatar = ({ name, src, className }: UserAvatarProps) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-semibold text-blue-900 select-none",
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated API image and blob previews cannot use next/image
        <img
          src={src ?? undefined}
          alt=""
          className="size-full object-cover"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        getInitials(name)
      )}
    </span>
  );
};

export default UserAvatar;
