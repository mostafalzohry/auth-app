import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";

export default function SignupPage() {
  return (
    <AuthCard
      title="Create an account"
      description="Enter your name, email and a password."
      footer={
        <p className="text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/signin" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      }
    />
  );
}
