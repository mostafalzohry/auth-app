import type { ReactNode } from "react";
import HomeBrand from "@/components/home/home-brand";

const container = "mx-auto w-full px-6 sm:w-4/5 sm:px-0";

const HomeLayout = ({
  actions,
  children,
  mainProps,
}: {
  actions: ReactNode;
  children: ReactNode;
  mainProps?: React.ComponentProps<"main">;
}) => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div
          className={`${container} flex items-center justify-between gap-4 py-4`}
        >
          <HomeBrand />
          {actions}
        </div>
      </header>
      <main {...mainProps} className={`${container} space-y-10 py-12 sm:py-20`}>
        {children}
      </main>
    </div>
  );
};

export default HomeLayout;
