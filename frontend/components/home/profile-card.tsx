import { CircleCheck } from "lucide-react";
import ProfileDetail from "@/components/home/profile-detail";
import type { PublicUser } from "@/lib/auth-api";
import { formatMemberSince } from "@/lib/user-display";

const ProfileCard = ({ user }: { user: PublicUser }) => {
  return (
    <section
      aria-labelledby="account-details"
      className="rounded-2xl border bg-white px-5 py-4 shadow-sm sm:px-6"
    >
      <h2 id="account-details" className="text-base font-semibold">
        Account details
      </h2>
      <dl className="mt-2 divide-y">
        <ProfileDetail label="Name" value={user.name} />
        <ProfileDetail label="Email" value={user.email} />
        <ProfileDetail
          label="Member since"
          value={formatMemberSince(user.createdAt)}
        />
        <ProfileDetail
          label="Status"
          value={
            <span className="inline-flex items-center gap-1.5 text-blue-800">
              <CircleCheck className="size-4" aria-hidden="true" />
              You&apos;re signed in
            </span>
          }
        />
      </dl>
    </section>
  );
};

export default ProfileCard;
