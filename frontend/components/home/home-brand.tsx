import { Sparkles } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

const HomeBrand = () => {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-950 text-blue-50">
        <Sparkles className="size-5" aria-hidden="true" />
      </span>
      <p className="truncate text-base font-semibold">{APP_NAME}</p>
    </div>
  );
};

export default HomeBrand;
