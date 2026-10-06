import { CircleCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import ProfileDetail from "@/components/home/profile-detail";
import type { PublicUser } from "@/lib/auth-api";
import { formatMemberSince } from "@/lib/user-display";

const ProfileCard = ({ user }: { user: PublicUser }) => {
  return (
    <Card className="min-w-0 border p-2 shadow-none ring-0 [--card-spacing:--spacing(6)]">
      <CardHeader>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
          <CircleCheck className="size-3.5" aria-hidden="true" />
          You&apos;re signed in
        </span>
        <h2 className="text-lg font-semibold">Profile</h2>
      </CardHeader>
      <CardContent>
        <dl className="space-y-4 text-base">
          <ProfileDetail label="Name" value={user.name} />
          <ProfileDetail label="Email" value={user.email} />
          <ProfileDetail
            label="Member since"
            value={formatMemberSince(user.createdAt)}
          />
        </dl>
      </CardContent>
    </Card>
  );
};

export default ProfileCard;
