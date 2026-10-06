# AI assistance

## Tools and workflow

- **Me:** I chose the scope and technologies, reviewed the generated code and proposed architecture, tested the application, and directed corrections when the behavior or structure did not match my requirements. I also performed all commits, pushes and deployments myself.
- **Method:** work was split into small tasks, each with explicit constraints (what to change, what to leave alone, what to run) and an instruction to stop afterwards. I asked for read-only reviews before committing.
- **Claude Code (Anthropic)** assisted with implementation, tests and code reviews.
- **ChatGPT** supported planning, technical explanations and prompt writing. I evaluated the suggestions and decided which approaches to use.

## My role and decisions

- **Technology and structure:** Next.js frontend, NestJS + MongoDB backend, and a layered backend (domain / infrastructure / application / presentation) with a repository contract and domain types separate from the Mongoose schema.
- **API behavior and security constraints:** validation rules and status codes (201/400/409/500), uniqueness enforced by a unique index rather than lookup-then-insert, no password hashes in public objects, no secrets or connection strings in logs or responses, and the same generic 401 for unknown email and wrong password.
- **Authentication:** an initial session-based approach was replaced by cookie-based JWT at my request (HttpOnly cookie, fixed 15-minute lifetime, no refresh tokens or denylist). I accepted that logout only clears the cookie.
- **Frontend:** the design direction, the profile-image upload feature, and the later architecture improvements (avoiding redundant requests, avatar module ownership, shared policy constants).
- **Testing:** a rule that automated tests must not use my local `.env` or Atlas, and the manual testing listed under Verification.

### Code review and corrections

I reviewed the generated code and requested additional read-only reviews. Some problems came from my own observations and others from AI reviewers; the list below keeps them apart.

- **My observations:** I used the browser Network tab to see the redundant `/me` requests, and I decided on the switch from server-side sessions to JWT.
- **Structure I directed:** I asked for better component separation on the home page, and I directed the avatar feature ownership and shared-policy refactors.
- **Review findings:** where an AI review or a test identified an issue, I requested the correction. I do not claim to have discovered those issues myself.

## AI-assisted implementation

Claude Code produced the code and tests below, following my requirements and review feedback.

- **Backend:** configuration, persistence, authentication, CSRF and rate limiting, sanitized logging, Swagger documentation, avatar processing and storage, with unit and e2e tests.
- **Frontend:** forms, the protected home page, logout, avatar upload UI and the shared current-user state, with component and unit tests.
- **Documentation and review:** Claude Code reviewed code on request and helped draft the README and this file; I reviewed and edited the results.

## Representative prompts

Edited excerpts from prompts I sent.

**Example A: isolating tests**

```
Fix only the e2e environment setup. Set safe test variables before
AppModule configuration is evaluated, prevent loading my local .env,
preserve database mocks and assertions, and restore changed environment
variables. Run build, lint and tests. Do not contact Atlas, commit,
push or add unrelated features.
```

This made the scope and the test boundaries explicit.

**Example B: redundant current-user requests**

```
Investigate repeated GET /api/auth/me calls after signin. Preserve the
post-signin cookie check, reuse the validated user on navigation,
deduplicate concurrent requests, and keep direct visits and reloads
authenticated through /me. Preserve stale-response handling, clear user
state on logout, and do not disable Strict Mode or persist tokens in
browser storage.
```

This connected an observed request sequence to required behavior.

**Example C: avatar architecture**

```
Move avatar presentation into the users feature while preserving API
URLs, responses and authentication -> rate limiting -> multipart parsing
order. Avoid circular dependencies and duplicate providers. Centralize
backend avatar policy constants, keep frontend validation independent,
and run the affected checks.
```

This defined the architectural improvement without changing the feature contract.

## Corrections and review follow-ups


- **Test environment set too late:** review identified that the e2e environment was configured after `AppModule` was imported, so tests could pass because of my local `.env`. I requested the fix; the environment is now set before the import, and `.env` loading is skipped when `NODE_ENV=test`.
- **Sanitizing database connection failures:** the first logging version still printed raw driver stacks on retries. I asked for it to be fixed and later required an allowlist of error names; the logger now rebuilds the message, redacts connection strings and falls back to a generic error.
- **JWT timestamp and lifetime validation:** a test written during implementation showed a one-hour token being accepted, because `maxAge` limits a token's age, not `exp - iat`, and review then called for stricter timestamp checks. I requested the corrections; verification now requires valid timestamps and `exp - iat` of at most 15 minutes.
- **Repeated `/me` calls:** I observed the repeated requests in the browser Network tab and requested reuse of the validated user and request deduplication, while preserving authentication checks and Strict Mode. The cause was that signin already checked the cookie and `/welcome` requested `/me` again, with Strict Mode adding a cancelled duplicate. An in-memory store now shares one in-flight request and holds nothing in browser storage.
- **Avatar module ownership and policy duplication:** I directed these refactors as scoped tasks. Avatar code moved from the auth module to the users feature, and backend limits and formats now live in one policy file. The frontend keeps its own copy, and a contract test checks the two agree.

Review findings not yet resolved in the current code:

- **Stale `/me` responses:** `refreshCurrentUser` in `frontend/lib/current-user.ts` only guards the stored value with a generation counter. A caller already awaiting the shared request still receives the resolved user even if logout or signin ran in the meantime.
- **Avatar-upload 401:** `avatarUploadErrorMessage` shows "Your session has ended" for a 401, but I found no code that clears the current user or redirects to `/signin` in that case.
- **BSON conversion:** `findAvatar` converts the stored value with a fallback for non-Buffer data (`Buffer.from(stored.buffer)`). It has not been run against a real MongoDB.

## Verification and limitations

**Existing checks:** build, lint, typecheck (frontend), unit and e2e tests, Prettier and `git diff --check`.

**Latest reported counts (previously reported results, not rerun for this documentation change):**

- Backend: 15 unit suites / 138 tests; 7 e2e suites / 220 tests.
- Frontend: 12 files / 107 tests.

**What the tests exercise:** real Sharp, Argon2 and JWT signing and verification in the relevant tests, with image fixtures. Database operations (in-memory repository and rate-limit model) and frontend API responses are mocked. These tests do not verify real MongoDB concurrency, the BSON round trip for stored avatars, TTL cleanup, or upload behavior through a deployed proxy.

**Manual results reported by me:**

- Postman signup, signin, protected endpoint and logout passed.
- The saved user document and unique email index were checked in Atlas.
- The deployed frontend authentication flow passed.

**Limitations:**

- Logout clears the cookie; a copied JWT stays valid until it expires.
- Client-IP attribution behind the production proxy, the proxy-hops setting, and large uploads through the frontend proxy are not verified by automated tests.
- Rate limits are per IP in fixed windows, so a burst across a window boundary can briefly exceed the limit.
- No real-browser testing was done by the AI.
