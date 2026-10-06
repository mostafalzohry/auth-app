import type { ReactNode } from "react";
import HomeBrand from "@/components/home/home-brand";

const container = "mx-auto w-full px-4 sm:w-4/5 sm:px-0";

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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div
          className={`${container} flex items-center justify-between gap-4 py-3`}
        >
          <HomeBrand />
          {actions}
        </div>
      </header>
      <main {...mainProps} className={`${container} space-y-5 py-6 sm:py-8`}>
        {children}
      </main>
    </div>
  );
};

export default HomeLayout;
