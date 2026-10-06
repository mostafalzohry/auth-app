import type { Metadata } from "next";
import Link from "next/link";
import AuthFormShell from "@/components/auth/auth-form-shell";
import { APP_NAME } from "@/lib/brand";
import SigninForm from "@/components/auth/signin-form";

export const metadata: Metadata = { title: `Sign in · ${APP_NAME}` };

const SigninPage = () => {
  return (
    <AuthFormShell
      title="Welcome back"
      description="Sign in to pick up where you left off."
      footer={
        <>
          New here?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Create one
          </Link>
        </>
      }
    >
      <SigninForm />
    </AuthFormShell>
  );
};

export default SigninPage;
