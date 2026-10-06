import type { ReactNode } from "react";

const ProfileDetail = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => {
  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
};

export default ProfileDetail;
