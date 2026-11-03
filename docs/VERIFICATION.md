# Verification record

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
