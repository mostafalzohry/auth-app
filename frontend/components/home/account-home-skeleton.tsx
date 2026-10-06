import HomeLayout from "@/components/home/home-layout";

const bar = "animate-pulse rounded-md bg-muted";

const AccountHomeSkeleton = () => {
  return (
    <HomeLayout
      actions={<div className={`${bar} h-9 w-28`} />}
      mainProps={{ role: "status", "aria-live": "polite" }}
    >
      <span className="sr-only">Checking your session…</span>
      <div aria-hidden="true" className={`${bar} h-5 w-56`} />
      <div aria-hidden="true" className={`${bar} h-64 rounded-2xl`} />
      <div aria-hidden="true" className={`${bar} h-48 rounded-2xl`} />
    </HomeLayout>
  );
};

export default AccountHomeSkeleton;
