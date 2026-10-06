# Mostafa's Space (frontend)

Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form and Yup. The API lives in `../backend`.

## Run locally

Use Node 24, then:

```bash
cd frontend
npm install
cp .env.example .env.local   # BACKEND_URL defaults to http://localhost:3000 in development
npm run dev                  # http://localhost:3001
```

Run the backend on port 3000 first (`cd ../backend && npm run start:dev`). The backend's `AUTH_ALLOWED_ORIGINS` must contain `http://localhost:3001` (the exact origin of this dev server).

Pages: `/signup`, `/signin`, and `/welcome` (shown after signing in; it checks `GET /api/auth/me` first).

## Environment

| Name | Where | Notes |
|---|---|---|
| `BACKEND_URL` | server only, read when Next.js builds or starts | Origin of the NestJS backend, for example `https://your-backend.example.com`. Required for production builds. Not a secret. |

`JWT_SECRET` and `MONGODB_URI` belong only to the backend.

## API proxy

The browser only calls relative `/api/auth/*` URLs. `next.config.ts` rewrites them to `BACKEND_URL`, so requests stay same-origin and the HttpOnly `auth.token` cookie is stored for the frontend's own origin. Only `/api/auth/*` is proxied (not Swagger or the backend root). The browser's `Origin`, `Cookie`, `X-Auth-Request` and `Sec-Fetch-Site` headers reach the backend unchanged, and the backend's status, `Set-Cookie`, `Cache-Control` and `Retry-After` come back unchanged (checked locally against a mock backend).

Multipart uploads (`POST /api/auth/avatar`) use the same proxy; the fetch helper sends `FormData` without a manual `Content-Type` so the browser adds the boundary. Passing a 2 MiB multipart body through the Next.js rewrite has not been tested against a real deployment.

Because the backend's CSRF check requires the request `Origin` to be allowed, the frontend origin must be listed in the backend's `AUTH_ALLOWED_ORIGINS`.

## Scripts

```bash
npm run build       # needs BACKEND_URL
npm run lint
npm run typecheck
npm test            # Vitest with mocked API responses
```

## Structure

- `app/(auth)/` sign-in and sign-up pages with the split layout
- `app/welcome/` the page shown after signing in
- `components/auth/` shared authentication UI, the two forms and the welcome check
- `components/ui/` shadcn/ui components
- `lib/validation/` Yup schemas that mirror the backend rules
- `lib/api.ts`, `lib/auth-api.ts`, `lib/auth-errors.ts` request helper, the three endpoints and user-facing error messages
- `next.config.ts` the `/api/auth` rewrite
