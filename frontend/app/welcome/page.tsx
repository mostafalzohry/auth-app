import type { Metadata } from "next";
import { APP_NAME } from "@/lib/brand";
import WelcomeGate from "@/components/auth/welcome-gate";

export const metadata: Metadata = { title: `Home · ${APP_NAME}` };

const WelcomePage = () => {
  return <WelcomeGate />;
};

export default WelcomePage;
