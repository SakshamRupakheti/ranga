# Product architecture and integration assessment

Date: 2026-11-02. Scope: first local editor milestone. API setup deferred by the founder.

## Implemented architecture

Next.js App Router, React, strict TypeScript, Tailwind 4 with custom CSS tokens, Lucide icons, Fabric.js 7, Zod validation, and IndexedDB through idb-keyval. No server secrets, authentication simulation, or paid API calls.

The domain model is a versioned document with immutable layer identifiers, dimensions, background, flat text/shape/image layers, references, timestamps, and creative-direction notes. Model changes enter undo history, trigger an immediate visual update, and are persisted after a 500 ms debounce. IndexedDB writes are serialized. Internal navigation awaits the save. Closing/reloading while unsaved requests the browser's native warning. Explicit versions store the last 20 snapshots.

The canvas renderer is an adapter, not the source of truth. Native transforms and typed text are reflected in the domain model. A raster asset is explicitly one image layer. Document backups do not rely on arbitrary Fabric object deserialization: supported types, geometry, colors, strings, asset URL forms, and IDs are validated first.

The landing page is server rendered. Browser-only workspace state lives in client components. Fabric is dynamically loaded on the editor route. Design assets are not fetched from remote reference URLs. Supported uploads are decoded before storage; file type, size, and pixel count are restricted.

## Proposed cloud milestone

Retain Next.js on Vercel. Choose a managed PostgreSQL provider and object storage only during service setup. Prefer Drizzle for typed SQL, explicit migrations, and a small schema boundary. Keep large assets in object storage, not JSON database columns. Proposed entities: users, projects, project versions, assets, brand kits, connected accounts, and generation jobs.

Before storing cloud data, integrate a maintained authentication provider, server-side ownership checks on every operation, secure sessions, and tests proving cross-user isolation. Design documents remain the same schema, while persistence moves behind an authenticated server repository. Local work must be offered for explicit migration rather than uploaded silently.

Image generation will require asynchronous jobs with persisted status, retries, cancellation, and limits. Model outputs must validate to supported design commands. Native typography and geometry changes should not regenerate images. Provider tokens stay server-side; encrypt connected-service tokens at rest, validate OAuth state/PKCE, and request only required scopes.

## Feasibility boundaries

| Capability | Current status | Conditions before release |
| --- | --- | --- |
| Native editable text, simple shapes, raster uploads, PNG/SVG/JSON export | Implemented locally | Complete broader accessibility/browser testing |
| References selected from user-owned/permitted uploads | Implemented locally | Cloud asset retention/authorization when sync is introduced |
| Accounts, cloud projects, background jobs | Deferred | Provider selection, credentials, billing limits, isolation tests |
| AI design conversation and validated edit commands | Deferred; no requests made | Secure OpenAI setup, current models/pricing review, cost controls, prompt-injection tests and evaluations |
| AI-generated images | Deferred | Current generation/editing API and pricing review; preserve raster labeling |
| Pinterest boards and Pins | Official API supports authorized account content; no connection built | Developer app/access tier approval, permitted scopes/endpoints, attribution and policy review |
| Unrestricted public Pinterest search | Not promised | Confirm exact available endpoint and granted access; do not scrape |
| Canva creation/import/export | Official Connect APIs exist; no connection built | OAuth app setup, scopes, review requirements, import/export format verification with actual files |
| Arbitrary Canva layer editing/round-trip fidelity | Not promised | Separate capability investigation; SVG export from Ranga is not a claim that Canva accepts it as a native editable document |
| Public launch | Blocked by launch checklist | Auth, storage, security, legal review, domain/HTTPS, identity and integrations |

Pinterest access tiers and authorized-account Pin APIs were checked in official documentation. Canva's official Connect overview was located; detailed integration review, format compatibility, and pricing are deliberately left to the API milestone. Ranga does not use the user's connected assistant plugins as an undocumented backend for application visitors.

## Official references

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), plus version-matched guides bundled in `node_modules/next/dist/docs/`.
- [Fabric installation](https://www.fabricjs.com/docs/getting-started/installing/) and installed Fabric 7 type definitions.
- [Pinterest access tiers](https://dev.pinterest.com/docs/key-concepts/access-tiers/).
- [Pinterest authorized-account Pins](https://developers.pinterest.com/docs/api/v5/pins-list/).
- [Canva Connect overview](https://www.canva.dev/docs/connect/).

## Important technical decisions

1. Local persistence first, explicitly requested, to make the design workflow useful before any API billing or account setup.
2. Structured layers before AI so future AI edits preserve user control and do not flatten the entire composition.
3. Four system typefaces initially, avoiding external font requests and unclear font licenses. Custom fonts need licensing and export fidelity work.
4. Raster-only uploads until a dedicated SVG sanitizer and vector import model are reviewed.
5. Bound local history and explicit versions; collaboration, conflict resolution, grouping, and masks remain follow-on editor work.
6. Production uses supported `next build --webpack` because the initial Windows host's Turbopack production worker failed. Development remains Turbopack.
