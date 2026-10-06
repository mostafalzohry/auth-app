# Auth App frontend

Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form and Yup. The API lives in `../backend`.

## Run

Use Node 24, then:

```bash
cd frontend
npm install
cp .env.example .env.local   # optional: BACKEND_URL defaults to http://localhost:3000
npm run dev                  # http://localhost:3001
```

Run the backend on port 3000 first (`cd ../backend && npm run start:dev`). The backend's `AUTH_ALLOWED_ORIGINS` must contain `http://localhost:3001`.

## Scripts

```bash
npm run build
npm run lint
npm run typecheck
```

## Structure

- `app/(auth)/` sign-in and sign-up pages with a shared centered layout
- `components/auth/` shared authentication UI
- `components/ui/` shadcn/ui components (Button, Input, Label, Card, Alert, Field)
- `lib/validation/` Yup schemas that mirror the backend rules
- `lib/api.ts` small fetch helper that sends `X-Auth-Request: 1`
- `next.config.ts` forwards `/api/*` to the backend so the browser only talks to its own origin and the auth cookie stays same-site

Only public settings belong here. `JWT_SECRET` and `MONGODB_URI` are backend-only.
