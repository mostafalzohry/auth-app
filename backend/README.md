# Auth API (NestJS + MongoDB)

Sign up, sign in, a protected current-user endpoint and logout, using a short-lived JWT in an HttpOnly cookie. Built with NestJS 12, Mongoose (MongoDB), Argon2id password hashing, CSRF protection and MongoDB-backed rate limiting. The frontend is not part of this folder.

## Node.js requirement

Node.js **24.9 or newer** (`engines.node` is `24.x`). Jest only loads the ESM-only NestJS 12 packages through `require()` on Node 24.9+; on Node 22 the tests fail with "Must use import to load ES Module".

With Node 24 installed through Homebrew (`brew install node@24`), activate it for the current shell session only:

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
node -v   # v24.x, at least 24.9
```

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then edit .env
npm run start:dev      # http://localhost:3000
```

## Environment variables

| Name                   | Required        | Notes                                                                                                                |
| ---------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`          | yes             | `mongodb://` or `mongodb+srv://` connection string.                                                                  |
| `JWT_SECRET`           | yes             | At least 32 bytes. Generate one locally: `openssl rand -hex 32`. Never commit it.                                    |
| `AUTH_ALLOWED_ORIGINS` | yes             | Comma-separated exact browser origins allowed to call `/api/auth`. No paths, no wildcards, https only in production. |
| `TRUST_PROXY_HOPS`     | production only | Number of trusted reverse-proxy hops (0–5). Ignored outside production. See "Deploy on Vercel".                      |
| `NODE_ENV`             | no              | `development` (default), `test` or `production`. `production` makes the auth cookie `Secure`.                        |
| `PORT`                 | no              | Default `3000`.                                                                                                      |

`.env.example` has local examples. For a Vite frontend use `AUTH_ALLOWED_ORIGINS=http://localhost:5173` (add `http://127.0.0.1:5173` if you open the app that way).

## API and manual testing (Postman or curl)

| Method and path         | Purpose                                                                     |
| ----------------------- | --------------------------------------------------------------------------- |
| `GET /`                 | hi i am mostafa                                                             |
| `POST /api/auth/signup` | Create an account (5 attempts per IP per 15 minutes)                        |
| `POST /api/auth/signin` | Sets the `auth.token` cookie (10 attempts per IP per 15 minutes)            |
| `GET /api/auth/me`      | Protected: current user                                                     |
| `POST /api/auth/logout` | Clears the cookie                                                           |
| `POST /api/auth/avatar` | Protected: upload or replace the profile image (10 per user per 15 minutes) |
| `GET /api/auth/avatar`  | Protected: the current user's image (`image/webp`), 404 if none             |

Every authentication POST needs:

- `Origin` equal to one of `AUTH_ALLOWED_ORIGINS` (Postman does not add it for you)
- `X-Auth-Request: 1`
- `Content-Type: application/json` for signup and signin (logout needs no body); `multipart/form-data` only on `POST /api/auth/avatar`

Errors are generic: 403 CSRF check failed, 415 wrong content type, 429 rate limit (see `Retry-After`), 503 rate-limit store unavailable.

The token is a 15-minute HS256 JWT that is never returned in JSON. Logout clears the cookie but does not revoke tokens: a copied JWT stays valid until it expires.

### Profile image

`POST /api/auth/avatar` takes exactly one file in the multipart field `file` (JPEG, PNG or WebP, at most 2 MiB, at most 24 megapixels; no other fields or parts). The owner is the user in the verified `auth.token` cookie. Authentication and the per-user rate limit run before the body is buffered. The bytes are checked by magic number (SVG, GIF and corrupt files are rejected), decoded with [sharp](https://sharp.pixelplumbing.com/), auto-oriented, resized to fit 256x256, stripped of metadata, re-encoded as WebP (at most 128 KiB) and stored as binary in the user's own `users` document (`avatarData`, `avatarContentType`, `avatarVersion`), replacing the previous image in one update that never touches credentials. `avatarData` is `select: false`, so no normal user or credential query loads it. Public user JSON gets an optional relative `avatarUrl` (`/api/auth/avatar?v=<version>`), never image bytes. `GET /api/auth/avatar` returns `image/webp` with `nosniff` and `Cache-Control: private, no-store`. Responses: 400 bad or corrupt upload, 401, 403, 413 too large, 415 unsupported, 429, 503.

## Swagger UI

- UI: `http://localhost:3000/swagger`
- OpenAPI JSON: `http://localhost:3000/swagger-json`

To use "Try it out", the origin of the `/swagger` page must be listed in `AUTH_ALLOWED_ORIGINS` (for example `http://localhost:3000` locally). The page adds `X-Auth-Request: 1` to authentication POSTs and sends cookies. The browser sets `Origin` and `Cookie` itself.

1. `POST /api/auth/signup` with a name, an email and a password that meets the rules.
2. `POST /api/auth/signin` with the same email and password. The response sets the `auth.token` cookie in your browser.
3. `GET /api/auth/me` returns the user, using that cookie.
4. `POST /api/auth/logout` clears the cookie; `GET /api/auth/me` then returns 401.

There is no Authorize step: an HttpOnly cookie cannot be injected from a page.

## Scripts

```bash
npm run build
npm run lint
npm test -- --runInBand             # unit tests
npm run test:e2e -- --runInBand     # e2e tests (no database needed)
npx prettier --check "src/**/*.ts" "test/**/*.ts"
```

Automated tests never read `.env` and never contact MongoDB; the database is replaced by test doubles.

## Deploy on Vercel

Vercel deploys NestJS with zero configuration: it detects `src/main.ts` and serves the app as one Vercel Function. No `vercel.json` and no exported handler are needed, and none is included. Sources: [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs), [supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

### Dashboard steps

1. Push the repository to GitHub, then in Vercel choose **Add New → Project** and import it.
2. **Root Directory:** `backend` (the app is in a subfolder).
3. **Framework Preset:** NestJS (auto-detected). Leave Build Command and Output Directory empty.
4. **Install Command:** override with `npm install --production=false`. Setting `NODE_ENV=production` as a project variable makes npm skip devDependencies, which Vercel documents as a cause of missing build dependencies ([guide](https://vercel.com/kb/guide/dependencies-from-package-json-missing-after-install)).
5. **Node.js Version:** 24.x (`engines.node` already pins it).
6. **Environment Variables** (Settings → Environment Variables; mark secrets as Sensitive):
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = your Atlas connection string
   - `JWT_SECRET` = a new value from `openssl rand -hex 32` (not your local one)
   - `AUTH_ALLOWED_ORIGINS` = your exact frontend `https://` origin, plus the exact backend `https://` origin if you want to use `/swagger` on it, for example `https://my-frontend.example.com,https://my-api.vercel.app`
   - `TRUST_PROXY_HOPS` = `1` (proposed, **unverified**, see below)
7. Deploy. The backend origin is only known after the first deploy, so add it to `AUTH_ALLOWED_ORIGINS` and redeploy to use Swagger there.

Preview deployments get their own origins, which are not in the allow-list (wildcards are not supported), so authentication POSTs from them return 403 unless you add each origin.

### Frontend and cookie requirement

The cookie is `SameSite=Lax` and requests with `Sec-Fetch-Site: cross-site` are rejected. The frontend and API must therefore be same-site, for example `app.example.com` and `api.example.com`, or the frontend proxying `/api` to the backend. Two separate `*.vercel.app` hosts are likely cross-site; verify this before relying on it.

### MongoDB Atlas network access

Vercel uses dynamic egress IPs by default. Your Atlas project only accepts connections from its IP access list. On a plan without Static IPs this means allowing `0.0.0.0/0` ("access from anywhere"), which is a real security trade-off: the database is then protected only by its credentials and TLS, so use a strong, least-privilege database user. Vercel [Static IPs](https://vercel.com/docs/networking/static-ips) give fixed egress addresses you can allow-list instead, but they are available on Pro and Enterprise plans only (listed at $100/month per project plus data transfer). This repository does not change any Atlas setting. Shared free Atlas tiers also have connection and throughput limits; check the Atlas documentation for your tier.

### Client IP and `TRUST_PROXY_HOPS`

Rate limits use `req.ip`. In production Express trusts exactly `TRUST_PROXY_HOPS` proxies in front of the app ([Express docs](https://expressjs.com/en/guide/behind-proxies.html)). Vercel documents that it overwrites `X-Forwarded-For` with the client's public IP and does not forward external values ([docs](https://vercel.com/docs/headers/request-headers)). That makes `1` plausible, but how many proxies the function actually sees has not been verified on a deployment. Verify it after deploying (checklist below); a wrong value either puts every user in one bucket (too low) or lets clients spoof their IP (too high).

### Database indexes

The unique email index (`users`) and the TTL index on `rate_limits.expiresAt` are created by Mongoose when the app starts. This is additive and idempotent; the app never calls `syncIndexes` and never drops anything. The Atlas database user needs permission to create indexes.

### Post-deployment checklist

- `GET /` returns `hi i am mostafa`; `/swagger` loads with styles and scripts (no 404s in the browser network tab) and `/swagger-json` returns JSON. If the Swagger assets 404, serve them from a CDN with `customCssUrl` and `customJs` in `src/swagger.setup.ts`.
- Signup and signin succeed (this proves Atlas connectivity and that Argon2's native binary loads). Check the Vercel function logs for startup errors.
- The signin `Set-Cookie` header contains `auth.token`, `HttpOnly`, `SameSite=Lax`, `Path=/` and `Secure`. `GET /api/auth/me` returns the user, and `POST /api/auth/logout` clears the cookie.
- CSRF: a signin POST without `Origin`, or with another origin, returns 403 and nothing is hashed.
- Rate limit: the 11th signin from one network returns 429 with `Retry-After`. A different network (for example a phone) is still allowed, and repeating requests with a made-up `X-Forwarded-For` does not avoid the limit. If a second network is also blocked, `TRUST_PROXY_HOPS` is too low; if spoofing evades the limit, it is too high.
- Atlas: the `users` collection has the unique `email` index and `rate_limits` has the TTL index on `expiresAt`.
- Avatar: upload a small PNG in the app and reload; this proves sharp's Linux binary loads on Vercel and that the document write works in Atlas. The request body must stay under Vercel's function request-size limit (a 2 MiB file plus multipart overhead is expected to fit; confirm in Vercel's documentation).
- Logs contain no tokens, cookies, passwords or connection strings.
