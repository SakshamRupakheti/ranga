# Verification record

## Discover milestone 1, 2026-11-04

Built on `c798c21` in `feature/ranga-discover`, associated with [Ranga Bridge #1](https://github.com/SakshamRupakheti/ranga/issues/1). This section records the new milestone; the earlier baseline below is retained as history.

| Check                                 | Result                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run typecheck`                   | Passed                                                                               |
| `npm run lint`                        | Passed with no warnings                                                              |
| `npm test`                            | 11 passed, including the authenticated temporary-service test                        |
| `npm run build`                       | Passed; Webpack production build and all routes generated                            |
| `npm run test:e2e`                    | 16 passed in 1.8 minutes on isolated ports 3011/3013 using Chrome and the dev server |
| `npm test --prefix desktop`           | 8 passed                                                                             |
| `npm run test:smoke --prefix desktop` | 2 passed against actual Electron views and controlled third-party fixtures           |

The browser suite ran with `RANGA_TEST_BASE_URL=http://127.0.0.1:3011` and `RANGA_TEST_SERVICE_PORT=3013`, using `.ranga-test-data/browser-3013`. Existing servers and user browser profiles were not restarted or used for these tests. Test-generated accounts were removed by the suite. The separate visual-test profile and preview process were cleaned up.

New coverage includes query normalization/encoding and bounds, optional metadata backup/Yjs round trips, shared viewer/commenter rejection, offline query persistence across service restart, real-editor bridge event handling, stale project rejection, per-project restoration, prompt composition and explicit ChatGPT focus. Existing recipes, raster imports, PNG/JPEG/SVG/JSON exports, comments, invitations, collaboration, offline recovery and local project workflows still pass.

Electron checks cover Discover/Design/Focus and legacy navigation, adjustable/swapped panes, a 960-pixel compact layout, prompt review, no automatic clipboard write on search, user-triggered copy, a simulated clipboard-write failure, denied remote clipboard reads, absent remote bridge/Node globals, exact IPC provenance including child-frame and remote-view rejection, oversized context rejection, readable sign-in-route status, failed Pinterest search followed by a home fallback, explicit retry, browser fallback and context removal when leaving a project. OS clipboard writes and external-browser launches are stubbed. The tests use no provider credentials and inspect no user's clipboard contents.

A separate production-build check connected the actual Ranga editor to Electron using a synthetic project. The native Windows window was inspected in Design and Discover modes with clearly labeled Pinterest/ChatGPT fixtures. The real editor published its project name, persisted the query, and supplied its recipe-schema prompt. A larger default window could extend below the display; startup sizing now respects the display work area. Earlier fixture failures were corrected: UTF-8 response encoding, textarea value assertions, and native resize checks against actual content size (Windows pixel rounding).

A live, read-only Pinterest browser check on 2026-11-04 populated the search box from `/search/pins/?q=...` but encountered a login gate. No login or challenge was completed. Authenticated result relevance and real ChatGPT/Pinterest account compatibility remain unverified. The implementation does not read remote DOM content and cannot classify every login modal, HTTP error page, or embedded-browser rejection; website UI plus manual retry/home/system-browser controls provide recovery.

Milestones 2–5 remain in TASKS.md: unified reference tray, preview/rights confirmation, clipboard return, and integrated canvas handoff. Hosted CI is tracked separately from these local results. No merge to main or public deployment was performed.

Updated 2026-11-03. Windows, Node.js 24.15.0, Next.js 16.4.4, React 19.3.1, Fabric 7.4.0, Better Auth 1.7.15 and Yjs 13.6.33. Browser checks use isolated Chrome profiles, not the founder's browser data.

## Current results

| Check                         | Result                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict TypeScript             | Passed                                                                                                                                            |
| ESLint                        | Passed without errors or warnings                                                                                                                 |
| Unit/service tests            | 10 passed; service test uses five isolated accounts and a temporary database                                                                      |
| Production build              | Passed with Webpack; all application routes generated                                                                                             |
| Development browser suite     | 15 passed in 1.4 minutes                                                                                                                          |
| Production browser suite      | 15 passed in 1.2 minutes against port 3001                                                                                                        |
| Runtime dependency audit      | Zero reported vulnerabilities                                                                                                                     |
| Full dependency audit refresh | Could not run: automatic approval review reached its usage limit. Previous development-only findings remain tracked, not represented as resolved. |
| Data/secret exclusion         | .env.local, .ranga-data/ and .ranga-test-data/ verified ignored                                                                                   |

A package audit is not a full security audit. Local verification does not imply production hosting readiness.

## Collaboration and security

The service test makes authenticated HTTP/WebSocket requests and checks unauthenticated denial, cross-user project/image/thumbnail denial, owner-only access management and deletion, commenter/viewer restrictions, and email-restricted invitations. Reusing an accepted invitation after a role downgrade does not restore the old higher role.

Two simultaneous connections edit different properties, create objects, and modify the same text. Both converge. Unit tests confirm deletion conflicts, concurrent creation and undo that preserves the other user's changes. Accepted updates are persisted before acknowledgement.

Tests create, reply to and resolve anchored comments; save and restore a version; reject a viewer's direct WebSocket mutation; revoke an active editor; reject the revoked invitation; merge offline changes on reconnect; and forcibly stop/restart the server. Projects, images, comments and sessions survive. Password-reset tests verify private outbox generation, token reuse rejection and invalidation of previous sessions. Account deletion removes owned projects.

## Browser workflows

- Two independently registered accounts create a graphic, explicitly share a local copy, upload a private image, create/accept an invitation, and see live presence/selections.
- One user moves an object while the other edits text. Both receive changes. A real offline edit is queued and recovered on reconnection.
- Comments, replies and resolution appear in the other browser. Revoking membership removes access immediately.
- Manual Pinterest/source attribution, notes, collections and reference image import work. The deterministic prompt includes selected notes. ChatGPT opens as an external shortcut.
- Invalid recipes are rejected. A valid recipe creates native editable layers, saves the preceding version and preserves references. JPEG decoding confirms the expected output width. JSON export and reload preserve the composition.
- Shared previews, rename, duplicate, search, sort and delete work. Dark theme persists. Shared dashboard and role-restricted editors fit a phone viewport.
- Commenter/viewer sessions show disabled mutation controls. A commenter selects a layer and posts a coordinate/layer comment. A viewer can read and locate the marker but cannot comment or edit.
- All 13 original workflows still pass: local autosave/reload, properties, undo/redo, PNG/SVG/JSON exports, real pointer drag, native resize/direct text editing, multi-selection movement, layer controls, snapshots, raster/reference uploads, brand kit, backup import/project management, and desktop/tablet/phone layouts.

## Visual evidence

Actual screenshots are in docs/screenshots/: editor desktop/tablet/mobile, collaboration, dark creative handoff, dark shared dashboard and landing screens. Desktop collaboration, the dark creative panel and the dark shared dashboard were visually inspected. Test graphics are synthetic test content, not customer work.

## Corrections made during verification

- Explicit offline/online handling closes transport, queues changes and reconnects. Awareness is resent after reconnection.
- Native canvas edits update only transformed objects, preserving unrelated incoming edits. Unchanged Fabric instances are reused.
- Recipe application waits for its server snapshot, preserves current references/brief and retains pasted input when application fails.
- Read-only roles can select layers for discussion while mutation controls remain disabled. Server checks independently enforce the same restrictions.
- Shared brand logos use authenticated asset uploads.
- Accepted invitation reuse is idempotent, preventing role restoration after downgrade. Role changes close existing connections so clients reopen with current controls.
- Tests target the reference upload input explicitly and distinguish application alerts from the framework route announcer.

## Remaining work

The service is single-process and loopback-only. Remote/public hosting, PostgreSQL/object storage migration, verified email delivery, hosted GitHub CI, HTTPS/domain, monitored scheduled backups and restore drills, load testing, full accessibility, Firefox/Safari, real touch devices, grouping/artboards and browser-only multi-tab conflict handling remain open.

Recovery uses a private development outbox, not email. Email-restricted invitations match account email without proving mailbox ownership. Non-loopback service origins are rejected. No OpenAI, Pinterest or Canva APIs were called.

The original editor baseline and build notes are retained in [VERIFICATION_LOCAL_EDITOR.md](VERIFICATION_LOCAL_EDITOR.md). Webpack remains the production build mode after the original Windows Turbopack CSS-worker failure. ESLint 9.39.5 is pinned for Next plugin compatibility; development-only advisories remain tracked.

## Desktop workspace and open-source milestone — 2026-11-03

The public repository is [SakshamRupakheti/ranga](https://github.com/SakshamRupakheti/ranga), licensed under MIT as selected by the user. The existing source history and main/develop/feature branches were pushed. No private application data or browser profiles are included. Hosted CI and branch protection remain separately tracked; a local pass is not a hosted CI result.

The optional Electron package compiles independently of the Next.js app. Five policy tests pass, covering local-origin restrictions, official-site/auth navigation, executable URL and credential rejection, fixed IPC commands, and pane geometry. A Windows Electron smoke test passes with an isolated temporary profile and explicit third-party fixtures. It exercises actual site switching and split layout, sandbox/context isolation, absence of Node/preload privileges in website panes, separate cookies for the same authentication host, real pointer-driven history, confirmation before external links, home-page-only browser fallback, native resize behavior, and an offline-local-server recovery message. The test does not log into or automate live third-party accounts.

The existing 10 unit/service tests and production Webpack build pass after adding the optional package; root lint and TypeScript checks pass. Local sandbox restrictions initially prevented loopback requests and Electron startup, so runtime verification was rerun with process/network permission. Native Windows pixel rounding is handled by checking pane bounds against the actual content size rather than the requested window size.

A separate visual profile loaded the real Ranga editor with no reported renderer errors. Native window inspection confirmed the Ranga dashboard/editor and the unauthenticated ChatGPT and Pinterest pages loaded. Authenticated third-party login, voice, uploads to those sites, provider challenges, installer delivery, and macOS/Linux operation are not verified. The desktop remains an experimental source-run preview with an external-browser fallback.
