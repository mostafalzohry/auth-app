# Auth App

A full-stack authentication app: users sign up, sign in, see a protected home page, upload a profile photo and log out.

- Live frontend: https://auth-app-y3ub.vercel.app
- Swagger: https://auth-app-ten-phi.vercel.app/swagger

## Stack and features

- Backend: NestJS 12, Mongoose (MongoDB), Argon2, sharp, Swagger, Jest
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form, Yup, Vitest
- Signup, signin and logout with a cookie-based JWT
- Protected home page (`/welcome`) and profile-image upload
- CSRF protection and shared (MongoDB-backed) rate limiting
- Swagger API documentation at `/swagger`

## Local setup

Prerequisites: Node 24.9+, npm and a reachable MongoDB database.

```bash
git clone https://github.com/mostafalzohry/auth-app.git
cd auth-app
```

Install dependencies (from the repository root):

```bash
cd backend && npm ci && cd ..
cd frontend && npm ci && cd ..
```

### Backend environment

`backend/.env` lives inside the backend folder, beside `backend/package.json`. From the repository root, create it by copying the example only if `backend/.env` does not already exist. If it exists, edit it instead of overwriting it:

```bash
cp backend/.env.example backend/.env
```

Set these five keys:

```
NODE_ENV=development
PORT=3000
MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING
JWT_SECRET=YOUR_GENERATED_SECRET
AUTH_ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000
```

- Replace `MONGODB_URI` with your own connection string.
- Generate a secret with `openssl rand -hex 32` and use it in place of `YOUR_GENERATED_SECRET`.
- `http://localhost:3001` allows the frontend; `http://localhost:3000` allows local Swagger.
- `backend/.env.example` still lists `localhost:5173` origins. Replace them, or signin, signup, logout and uploads return 403.
- Never commit `backend/.env`. `TRUST_PROXY_HOPS` is not needed locally.

### Frontend environment

`BACKEND_URL` defaults to `http://localhost:3000` in development, so no frontend env file is needed. `JWT_SECRET` and `MONGODB_URI` belong only in the backend.

### Run

Terminal 1, from the repository root:

```bash
cd backend
npm run start:dev
```

Terminal 2, from the repository root:

```bash
cd frontend
npm run dev
```

- Frontend: http://localhost:3001
- Backend: http://localhost:3000
- Swagger: http://localhost:3000/swagger

## Checks

From `backend/`:

```bash
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

From `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
BACKEND_URL=http://localhost:3000 npm run build
```

## Important notes

- The JWT is stored in an HttpOnly cookie. Logout clears it but does not revoke a copied token before it expires (15 minutes).
- Avatar uploads accept JPEG, PNG or WebP up to 2 MiB and are processed into WebP stored in MongoDB.
- Next.js proxies `/api/auth/*` to `BACKEND_URL`, so the browser only calls the frontend's own origin.
- Backend database tests use mocks and frontend tests mock API responses. There are no real-database integration tests.
- See Swagger for endpoint details.

## Deployment (Vercel)

Create two Vercel projects from this repository, with root directories `backend` and `frontend`.

Backend: Node 24.x, install command `npm install --production=false`, and these environment variables:

```
NODE_ENV=production
MONGODB_URI=<your connection string>
JWT_SECRET=<your production secret>
AUTH_ALLOWED_ORIGINS=https://auth-app-y3ub.vercel.app,https://auth-app-ten-phi.vercel.app
TRUST_PROXY_HOPS=<value verified for the deployment>
NODE_OPTIONS=--experimental-require-module
```

Frontend:

```
BACKEND_URL=https://auth-app-ten-phi.vercel.app
```

- Environment variable changes need a redeployment. `BACKEND_URL` is applied at build time.
- `TRUST_PROXY_HOPS` is required in production. `1` is plausible on Vercel but has not been verified, so confirm it before relying on per-IP rate limits.
- Still to verify on a deployment: client-IP attribution behind the proxy, and avatar uploads through the Next.js proxy.
