import { Sparkles } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

const AuthBrand = () => {
  return (
    <aside className="bg-blue-950 bg-[url('/auth-background.svg')] bg-cover bg-center px-6 py-6 text-blue-50 sm:px-10 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-950">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <p className="text-base font-semibold">{APP_NAME}</p>
      </div>

      <div className="hidden lg:block">
        <h2 className="max-w-md text-4xl font-semibold tracking-tight text-balance">
          Welcome. Let&apos;s get you signed in.
        </h2>
        <p className="mt-4 max-w-md text-blue-200">
          Create an account or sign in to continue.
        </p>
      </div>

      <p className="hidden text-xs text-blue-300 lg:block">
        Made by Mostafa Elzohry.
      </p>
    </aside>
  );
};

export default AuthBrand;
