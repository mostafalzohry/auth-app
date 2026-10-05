# AI assistance

Tool: Claude Code (Anthropic), used as a coding agent. I gave it small, scoped tasks with explicit constraints, and the AI wrote the code under those constraints. I also used ChatGPT for planning, writing prompts, and explanations.

## What I owned

- **Structure:** I specified the folder layout and the layers (domain / infrastructure / application / presentation), the users and auth file lists, a repository contract with an injection token, and domain files that do not depend on NestJS or Mongoose. Domain types are separate from the Mongoose schema.
- **Security design:**
  - Duplicate emails are prevented by a unique index, and the MongoDB duplicate-key error is translated into a domain error. I ruled out a lookup before insert, because two simultaneous signups with the same email can both pass that check; the unique index enforces uniqueness atomically.
  - Public user objects have no `passwordHash`, and the schema excludes it by default.
  - Argon2id with memoryCost 19456, timeCost 2, parallelism 1.
  - Passwords are never trimmed or transformed.
  - Passwords, hashes, credentials and the connection string must not appear in logs or responses.
- **API contract:** the validation rules, the 201/400/409/500 status codes, `Cache-Control: no-store`, and no session on signup.
- **Workflow:** small scoped steps, each ending with "stop after this step"; each step also said what to leave out. I asked for a read-only review before committing, and I do all Git work myself.
- **Test isolation:** automated tests must not use my `.env` or Atlas. I spotted that the e2e test set its environment after `AppModule` was imported, and told the AI to fix it.
- **Logging:** I asked for the connection-error logging to be fixed after the first version, said to use a logger adapter if the library options could not do it, and later required an allowlist of database error names.
- **Manual checks:** I tested signup in Postman and checked the saved document and the unique email index in Atlas.

## What the AI wrote

Under the constraints above, the AI wrote the config validation, Mongoose connection, sanitized logger, users and auth modules (signup DTO, controller, service, Argon2 hasher), the unit and e2e tests, a read-only review, and the refactor of email normalization, public-user mapping and the logger.

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
- **Duplication:** I asked for the repeated email normalization (DTO, service, repository) and the repeated public-field mapping to be reduced to one place each.

## Verification

Run by the AI with Node v24.21.0: `npm run build`, `npm run lint`, `npm test -- --runInBand`, `npm run test:e2e -- --runInBand`, Prettier check and `git diff --check`. At the last run, all passed: 9 unit suites (31 tests) and 2 e2e suites (22 tests). These tests use mocks and a stubbed Mongoose connection, so they do not prove Atlas connectivity or real index enforcement. The database tests use mocks, while the hashing tests use real Argon2.

Done by me, not verified by the AI: the Postman signup request and the Atlas document and index checks above.

Known limits: no rate limiting or CSRF protection yet; `no-store` is set only on responses that reach the auth controller; the unique index is built by Mongoose's automatic index build and has not been created or verified by a deployment script; the Argon2 native binary has not been checked on the deployment target.
