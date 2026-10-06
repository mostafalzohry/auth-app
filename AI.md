# AI assistance

Tool: Claude Code (Anthropic), used as a coding agent. I gave it small, scoped tasks with explicit constraints, and the AI wrote the code under those constraints. I also used ChatGPT for planning, writing prompts, and explanations.

## My role and decisions

I used AI-assisted planning, set implementation constraints, and reviewed the code the AI produced.

- **Structure:** I specified the folder layout and the layers (domain / infrastructure / application / presentation), the users and auth file lists, a repository contract with an injection token, and domain files that do not depend on NestJS or Mongoose. Domain types are separate from the Mongoose schema.
- **Security design:**
  - Duplicate emails are prevented by a unique index, and the MongoDB duplicate-key error is translated into a domain error. I ruled out a lookup before insert, because two simultaneous signups with the same email can both pass that check; the unique index enforces uniqueness atomically.
  - Public user objects have no `passwordHash`, and the schema excludes it by default.
  - Argon2id with memoryCost 19456, timeCost 2, parallelism 1.
  - Passwords are never trimmed or transformed.
  - Passwords, hashes, credentials and the connection string must not appear in logs or responses.
- **API contract:** the validation rules, the 201/400/409/500 status codes, `Cache-Control: no-store`, and signup that does not sign the user in.
- **Authentication design:** a signed JWT (HS256, fixed 15-minute lifetime) in an HttpOnly `auth.token` cookie that is not returned in JSON, with verified issuer and audience, no refresh tokens and no denylist. The same generic 401 for an unknown email and a wrong password, a dummy-hash check for unknown emails, a protected `GET /api/auth/me`, and an idempotent logout. I accepted that logout only clears the cookie, so a copied token stays valid until it expires. An initial session-based implementation was replaced with JWT authentication at my request.
- **CSRF and rate limiting:** I requested and reviewed these security improvements.
- **Swagger:** I requested Swagger documentation as AI-assisted work. The AI consulted the current NestJS and Swagger documentation and implemented `/swagger` and `/swagger-json` and the cookie-based security scheme; the choices followed my constraints (no weakened CSRF or rate limiting, no Bearer auth, no secrets in examples).
- **Frontend:** I requested a Next.js frontend (App Router, TypeScript, Tailwind, shadcn/ui, React Hook Form, Yup). The AI set it up in `frontend/` from current documentation and then built the sign-up, sign-in and `/welcome` pages: validation that mirrors the backend rules, a same-origin `/api/auth` proxy to the backend, and error handling for 400, 401, 403, 409, 429, 5xx and network failures. Frontend tests use mocked API responses.
- **Workflow:** small scoped steps, each ending with "stop after this step"; each step also said what to leave out. I asked for a read-only review before committing, and I do all Git work myself.
- **Test isolation:** automated tests must not use my `.env` or Atlas. Review identified that the e2e environment was configured after `AppModule` was imported. I requested a fix so automated tests would not depend on my local `.env` or Atlas.
- **Logging:** I asked for the connection-error logging to be fixed after the first version, said to use a logger adapter if the library options could not do it, and later required an allowlist of database error names.

## What the AI wrote

Under the constraints above, the AI wrote the config validation, Mongoose connection, sanitized logger, users and auth modules (signup and signin DTOs, controller, service, Argon2 hasher), the JWT authentication (token service, cookie adapter, guard, `/me` and logout), the CSRF middleware, CORS setup and MongoDB rate limiter, the Swagger setup and API documentation decorators, the unit and e2e tests, a read-only review, and the refactor of email normalization, public-user mapping and the logger.

## Example prompt

A prompt I sent, trimmed:

> Fix only the e2e test environment setup.
>
> Currently, AppModule is imported before beforeEach sets MONGODB_URI.
> Ensure safe test environment variables are set before AppModule's
> configuration is evaluated, and prevent tests from loading my local .env.
>
> Inspect the installed NestJS configuration API before implementing.
> Preserve the mocked database connection, existing assertions, and cleanup.
> Restore any environment variables changed by the tests.
>
> Run build, lint, unit tests, and e2e tests.
> Do not modify README.md, AI.md, or my .env.
> Do not commit, push, deploy, or add other features.
> Report changed files and verification results.

## What had to be corrected

- **Tests failed to load** under Node 22.23.2 with `Must use import to load ES Module: @nestjs/testing`. Jest's own message pointed to Node 24.9+. I directed the move to Node 24; with v24.21.0 the tests passed and no Jest configuration was changed.
- **Connection logging:** the first MongoDB step still logged raw driver stacks on every retry (the AI reported this as a limitation). This was reworked into a logger that rebuilds the retry message, redacts connection strings, replaces the final error, and uses an allowlist of database error names with a generic fallback.
- **e2e environment:** the AI first set the test environment too late, so the test passed because of my local `.env`. It now sets the environment before importing `AppModule`, and `.env` loading is skipped when `NODE_ENV=test`.
- **Smaller mistakes the AI fixed in its own checks:** a wrong Argon2 parameter order in a test assertion, an invalid `validationOptions` key for `@nestjs/config` 12, and TypeScript `import type` errors.
- **`no-store` header:** it is set by middleware on `/api/auth` registered before body parsing, so malformed-JSON errors get it too (an e2e test covers this).
- **JWT lifetime check:** the AI first relied on `maxAge` to limit token lifetime, but it limits a token's age, not its `exp - iat`. A new test caught a one-hour token being accepted, so verification now also requires `exp - iat` to be at most 15 minutes.
- **Cookie parsing:** the `cookie` package returns the first value when a name is repeated, so ambiguity is detected by counting `auth.token` entries in the header; two values are rejected.
- **Review follow-ups:** review led to stricter JWT timestamp validation and logger cleanup between tests. Focused regression tests cover both changes.
- **Rate-limiter error classification:** the first version treated every `MongooseError` as a database outage, which would have turned a `CastError` or `ValidationError` into a 503. It now maps only connectivity and operational driver errors, Mongoose server-selection errors and Mongoose buffering timeouts to a 503, and lets other errors become a generic 500. Tests were strengthened for duplicate-key exhaustion and for CSRF checks running before JSON parsing.
- **Duplication:** email normalization uses one shared helper at the DTO and repository boundaries. Public-user mapping uses one shared function, preserving filtering at the HTTP boundary.

## Verification

Run by the AI with Node v24.21.0: `npm run build`, `npm run lint`, `npm test -- --runInBand`, `npm run test:e2e -- --runInBand`, Prettier check and `git diff --check`. At the last run, all passed: 13 unit suites (116 tests) and 6 e2e suites (184 tests). The e2e tests use real JWT signing and verification and the real Argon2 hasher, with a stubbed Mongoose connection, an in-memory user repository and an in-memory fake of the rate-limit collection. No local MongoDB was available, so there is no integration test of the rate limiter: concurrent increments and TTL cleanup have not been tested against a real database. The database tests use mocks, while the hashing tests use real Argon2.

I manually tested the Postman authentication flow, including signup, signin, the protected endpoint and logout. I also checked the saved user document and unique email index in Atlas. These are my reported results; the AI did not independently observe them.

Limitations: logout clears the cookie, and copied JWTs remain valid until expiry. Nothing has been deployed, so the production proxy setting (`TRUST_PROXY_HOPS`) and client-IP attribution have not been verified. Rate limits are per IP in fixed windows, so IPv6 users can rotate addresses and a burst across a window boundary can briefly exceed the limit. The unique index has not been verified by a deployment script. The Argon2 native binary has not been checked on the deployment target.

## Authenticated home page and logout (frontend)

`/welcome` is now the authenticated home page. `WelcomeGate` uses `useCurrentUser` (calls `/api/auth/me`, ignores aborted/stale results, redirects to `/signin` on 401, safe error plus retry otherwise) and renders `components/home/*`: header with brand, initials avatar and Sign out; greeting; profile card (name, email, created date, "You're signed in"); API documentation card linking to Swagger in a new tab; a layout-matching skeleton. `getCurrentUser` validates the public-user shape (`lib/validation/public-user.ts`, no new dependency); malformed 200 responses show a safe error. `logout()` POSTs `/api/auth/logout` through the existing API helper; `useSignOut` shows a pending state, blocks duplicate requests, replaces the route with `/signin` on 204 and shows an error with retry on failure. No backend changes, no new dependencies.

Verification (Node 24, mocked API only): `npm run build` (temporary non-secret `BACKEND_URL`), `npm run lint`, `npm run typecheck` passed; `npm test`: 8 files, 70 tests passed; `git diff --check` clean. Not checked in a real browser by the AI.
