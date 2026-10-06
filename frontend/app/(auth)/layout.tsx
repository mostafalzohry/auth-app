import { AuthBrand } from "@/components/auth/auth-brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <AuthBrand />
      <main className="flex items-center justify-center bg-background px-6 py-10 sm:px-10 lg:py-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
