import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";

export default function SigninPage() {
  return (
    <AuthCard
      title="Sign in"
      description="Enter your email and password."
      footer={
        <p className="text-sm text-muted-foreground">
          No account yet?{" "}
          <Link href="/signup" className="underline underline-offset-4">
            Sign up
          </Link>
        </p>
      }
    />
  );
}
