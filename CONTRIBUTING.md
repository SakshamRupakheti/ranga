# Contributing to Ranga

Work from the current checkout. Use `feature/*` branches from `develop`; merge only verified changes. Keep `main` stable. Do not force-push or commit secrets, private assets, account databases, reset emails, or invitation tokens.

## Local development

Use Node.js 24 and `npm ci`. Run `npm run service` and `npm run dev -- --port 3001` in separate terminals. Use `http://127.0.0.1:3001` consistently, including for invitations. The service binds to loopback on port 3003. No external API keys are required.

The service creates an ignored `.ranga-data/` directory for SQLite, its session secret, and a private password-reset outbox. Keep that directory private. Never log or commit its contents. Custom service environment variables must be set in the shell; the `tsx` service does not automatically read Next.js `.env.local`.

Read `AGENTS.md` and the version-matched Next.js guides before editing routes. Canonical documents live in `src/lib/document.ts`; Fabric is an adapter. Keep imported data schema-validated. New shared fields need a merge strategy, authorization checks, tests, and migration notes.

## Required checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

`npm test` creates a temporary loopback service on port 3004, tests multiple accounts, and deletes only its own temporary database. Do not run two copies simultaneously. Browser tests use separate Chrome profiles, their own test accounts, and clean up owned projects. CI uses Chromium and starts both production frontend and collaboration service. Local tests reuse running development services when available.

Check light/dark themes, phone layouts, direct canvas transforms, exports, and role restrictions when changing the editor. Add meaningful behavior tests for changes to persistence, collaboration, authentication, or untrusted input. Avoid tests that only mirror implementation details.

## Review and release

Describe the concrete behavior, validation, and remaining limitations. Update TASKS.md, architecture decisions, and verification evidence. External APIs, paid services, public deployment, and third-party account integrations are outside the current milestone. The launch checklist must be completed before public release. The public repository is https://github.com/SakshamRupakheti/ranga. Contributions are provided under the MIT license. Check the Actions tab for actual hosted check results.
