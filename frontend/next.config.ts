import type { NextConfig } from "next";

function backendOrigin(): string {
  const raw =
    process.env.BACKEND_URL ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "http://localhost:3000");
  if (!raw) {
    throw new Error(
      "BACKEND_URL is required for production builds, for example https://your-backend.example.com",
    );
  }
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("BACKEND_URL must be an http(s) URL");
  }
  return url.origin;
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${backendOrigin()}/api/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
