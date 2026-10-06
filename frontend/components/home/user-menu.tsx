import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/user-display";

interface UserMenuProps {
  name: string;
  pending: boolean;
  onSignOut: () => void;
}

const UserMenu = ({ name, pending, onSignOut }: UserMenuProps) => {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-900"
      >
        {getInitials(name)}
      </span>
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
