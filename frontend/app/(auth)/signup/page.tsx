import type { Metadata } from "next";
import Link from "next/link";
import AuthFormShell from "@/components/auth/auth-form-shell";
import { APP_NAME } from "@/lib/brand";
import SignupForm from "@/components/auth/signup-form";

export const metadata: Metadata = { title: `Create account · ${APP_NAME}` };

const SignupPage = () => {
  return (
    <AuthFormShell
      title="Create your account"
      description="It only takes a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/signin"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthFormShell>
  );
};

export default SignupPage;
