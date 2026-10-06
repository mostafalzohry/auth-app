import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/home/user-avatar";

interface UserMenuProps {
  name: string;
  avatarUrl?: string;
  pending: boolean;
  onSignOut: () => void;
}

const UserMenu = ({ name, avatarUrl, pending, onSignOut }: UserMenuProps) => {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <UserAvatar name={name} src={avatarUrl} className="size-9 text-sm" />
      <Button
        variant="outline"
        onClick={onSignOut}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <LogOut aria-hidden="true" />
        )}
        {pending ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
};

export default UserMenu;
