import HomeLayout from "@/components/home/home-layout";

const bar = "animate-pulse rounded-md bg-muted";

const AccountHomeSkeleton = () => {
  return (
    <HomeLayout
      actions={<div className={`${bar} h-9 w-28`} />}
      mainProps={{ role: "status", "aria-live": "polite" }}
    >
      <span className="sr-only">Checking your session…</span>
      <div className="space-y-3" aria-hidden="true">
        <div className={`${bar} h-12 w-2/3`} />
        <div className={`${bar} h-5 w-1/2`} />
      </div>
      <div className="grid gap-8 md:grid-cols-2" aria-hidden="true">
        <div className={`${bar} h-72`} />
        <div className={`${bar} h-72`} />
      </div>
    </HomeLayout>
  );
};

export default AccountHomeSkeleton;
