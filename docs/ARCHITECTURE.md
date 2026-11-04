# Ranga architecture

Current scope: local native editor, collaborative workflow, manual creative handoff, and the first Discover desktop milestone. Updated 2026-11-04.

## Application boundaries

Next.js App Router serves the UI, custom CSS/Tailwind tokens, and local API proxy. React owns the current scene, Fabric 7 renders/interacts with it, and Zod validates supported documents. The editor is dynamically loaded. The public introduction remains server rendered and does not load the canvas engine.

Device projects use IndexedDB with serialized, debounced writes and bounded snapshots. Shared projects use a separate persistent Node.js HTTP/WebSocket service on loopback port 3003, proxied under `/api` by Next.js. Browser WebSockets connect directly to the service. This is deliberately not a serverless WebSocket deployment.

## Shared document model

Y.Map metadata holds dimensions/title/background/timestamps/brief. A Y.Map per layer holds independent object properties, with Y.Text for layer content. Y.Array holds stacking order. References use independent maps and an order array. The adapter writes changed fields rather than broadcasting complete Fabric JSON. Concurrent independent edits merge, text uses CRDT operations, deleted objects remain deleted against stale property updates, and rendering preserves unchanged Fabric instances.

Before accepting an update, the server applies it to a temporary copy, validates the full canonical scene, checks immutable project identity, checks every asset belongs to that project, and bounds encoded size. Only then does it apply, persist synchronously in SQLite WAL, broadcast and acknowledge. Version restoration is an owner-authorized transaction broadcast to all clients. Undo tracks only the local client's edit origin and is bounded at 100 entries.

Editor caches use y-indexeddb, keyed by account/project. On reconnect, clients merge the server state then send the missing local update against its state vector. Explicit offline events close transport and queue work; network recovery reconnects. Heartbeats detect abandoned connections. Presence, cursor positions, selections, and connection IDs are transient and never persisted in project history.

## Authentication and authorization

Better Auth provides email/password hashing, HttpOnly session cookies, login/logout, reset tokens, and account deletion. The service requires the configured origin on mutations and WebSocket handshakes. All protected reads check membership. Every mutation checks the specific role; every document update revalidates session and current role. Active sockets are checked periodically and immediately closed after access revocation.

Invitations use random 32-byte tokens, SHA-256 hashes in storage, seven-day expiry, optional email restriction, and single-user acceptance. Raw tokens are only shown to the owner and carried in the invitation URL fragment. Revoking a member invalidates their previously used invitations. No invitation emails are sent automatically.

The development profile has no email verification. Password resets are written to `.ranga-data/outbox` instead of sent. The local profile rejects non-loopback origins; it cannot be presented as production-ready authentication. See launch conditions for verified mailbox ownership, HTTPS/WSS, secrets, abuse prevention, session review, and infrastructure requirements.

## Storage and migrations

SQLite tables separate project Yjs state, memberships, hashed invites, assets, thumbnails, comments, versions, activity, and migration history. Better Auth owns its account/session tables. Binary asset and thumbnail data are outside CRDT state. Every asset/preview fetch is membership-authorized and uses private/no-store caching. Image decoding and pixel/file limits run server-side. Client image caching is bounded and cleared on account transitions.

Migrations 001 and 002 are transactional and tracked by filename. Schema version 1 adds only optional document fields, preserving earlier local backups. Cloud PostgreSQL and private object storage are planned, not configured. The local SQLite choice and migration tradeoff are documented in DECISIONS.md.

Account deletion removes owned projects and their assets/comments/versions through cascades, removes memberships, and anonymizes authored comments in remaining projects. Browser-only projects remain separate. Shared browser caches are local data; they are not encrypted and remain subject to browser-profile access. Scheduled backups, comprehensive retention, unused-asset collection, quotas, and multi-instance scaling remain production work.

## Manual integrations

Pinterest and ChatGPT are normal external links with `noopener noreferrer`. No passwords, cookies, extension data, or third-party APIs are accessed. Reference URLs preserve attribution without fetching content. User-permitted image upload/clipboard import is explicit.

The prompt builder deterministically serializes a design brief, selected reference descriptions, available image IDs, and the exact recipe schema. Recipe import treats generated data as untrusted, rejects unknown fields and arbitrary executable content, and maps supported entries into native editable layers. Applying preserves references and saves a preceding version. A flattened image stays a single raster layer.

## Official implementation references

The optional `desktop/` package composes separate sandboxed Electron `WebContentsView` panes for Ranga, ChatGPT, and Pinterest. Discover displays Pinterest and ChatGPT; Design displays Ranga with ChatGPT; Focus expands Ranga. The existing site selection and split controls remain. The prompt review area reserves 240 pixels below native views; a bounded slider adjusts pane proportions and a swap action reverses them. The toolbar stays 132 pixels high.

The file-based toolbar owns validated search/navigation/layout commands and explicit clipboard writes. Only the configured first-party Ranga view receives `ranga-preload.ts`, which publishes bounded project context, receives query/reference-navigation events, and offers a fixed ChatGPT-focus action. Main checks WebContents identity, main-frame identity, exact origin and editor route, project key and payload limits. Third-party panes and all popups have no preload or Node integration. There is no generic scripting, URL-loading, file, clipboard-read or cookie API in the first-party bridge.

An optional `discoveryQuery` field, limited to 500 characters, lives in schema-version-1 documents and Yjs metadata. The editor commits query changes through its existing permission checks, history and persistence path; the service independently validates roles and canonical documents. Viewers/commenters can search without changing the project, keeping that query only in desktop memory. Context is cleared on navigation away, session revocation, or renderer failure. No duplicate project/reference database is introduced.

Search normalizes a query and constructs a Pinterest website URL with `URLSearchParams`. It does not fetch results itself. A failed search navigation attempts Pinterest home once and retains the query for manual copying. ChatGPT opens at its normal home without query parameters, input automation or submission. Ranga's existing deterministic `buildPrompt` supplies the project brief, selected descriptions, dimensions, asset IDs and exact recipe schema; the toolbar combines it with the discovery query. The prompt remains local until the user copies and submits it. No third-party conversation is captured or persisted.

Each site retains its own persistent session. The existing loopback web app and service remain separate processes. Sign-in modals and embedded-browser rejection cannot reliably be detected without reading third-party content; the toolbar reports navigation/loading failures and recognizable sign-in routes, while the actual website supplies its own login UI. System-browser fallback opens only the site home without transferring OAuth URLs or session tokens. See [desktop guide](../desktop/README.md).

- Next.js version-matched guides in `node_modules/next/dist/docs/`, and [route handlers](https://nextjs.org/docs/app/getting-started/route-handlers).
- [Fabric documentation](https://www.fabricjs.com/docs/) and installed Fabric 7 type declarations.
- [Better Auth installation](https://www.better-auth.com/docs/installation), [SQLite adapter](https://www.better-auth.com/docs/adapters/sqlite), and installed package exports/type declarations.
- [Yjs shared types](https://docs.yjs.dev/api/shared-types) and [UndoManager](https://docs.yjs.dev/api/undo-manager).

## Explicit limitations

The current host is single-process and loopback-only. No public remote team access, email delivery, hosted database, managed storage, production backup schedule, legal policy, domain, external AI integration, or automated social-platform connection is implemented. Browser-only projects do not use the shared CRDT and can still conflict if edited in multiple tabs. Full accessibility, Firefox/Safari, real devices, persistent grouping/artboards, and realistic high-load benchmarking remain open.
