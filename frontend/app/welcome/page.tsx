import type { Metadata } from "next";
import { APP_NAME } from "@/lib/brand";
import { WelcomeGate } from "@/components/auth/welcome-gate";

export const metadata: Metadata = { title: `Welcome · ${APP_NAME}` };

export default function WelcomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <WelcomeGate />
    </main>
  );
}
