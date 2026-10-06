import type { ReactNode } from "react";

interface AuthFormShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

const AuthFormShell = ({
  title,
  description,
  children,
  footer,
}: AuthFormShellProps) => {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
      <p className="text-center text-sm text-muted-foreground">{footer}</p>
    </div>
  );
};

export default AuthFormShell;
