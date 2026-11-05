# Living task list

Updated 2026-11-04. Preserve the existing Ranga editor. Revised direction: native collaboration and manual creative handoff, with no OpenAI, Pinterest, or Canva APIs in the MVP.

## Completed: native editor foundation

- [x] Ranga name, original editorial interface, structured stable-ID document model.
- [x] Text/shapes/raster uploads, native move/resize/rotate/direct text editing, precise properties, layer order, visibility/locks, duplication, undo/redo.
- [x] Device persistence, project rename/duplicate/delete, thumbnails, explicit versions, portable backups.
- [x] PNG/SVG export, original starting compositions, local brand kit.

## Completed: collaboration and manual tools

- [x] Separate persistent loopback Node.js HTTP/WebSocket service with tracked SQLite migrations.
- [x] Better Auth registration/login, sessions, profile edit, deletion, password-reset flow with private local outbox.
- [x] Shared projects with explicit local-to-server copy, search/sort, rename/duplicate/delete, authenticated thumbnails and member counts.
- [x] Server-enforced owner/editor/commenter/viewer permissions on reads, mutations, assets, previews, and live connections.
- [x] Expiring hashed single-user invitation links, optional email restriction, owner revocation.
- [x] Yjs field-level edits, text merging, concurrent creation/deletion handling, presence, remote selections/cursors, per-user undo.
- [x] Offline queue/reconnect, persisted acknowledgement, heartbeat checks and restart recovery.
- [x] Comments for project/layer/coordinate, replies, resolve/reopen, live notification, activity, version snapshots and owner restoration.
- [x] Pinterest/source shortcuts and attributed links, permitted image uploads/clipboard, notes, collections, ordering, selection, compare.
- [x] ChatGPT shortcut, deterministic brief/prompt, exact published JSON recipe schema, validation and editable import.
- [x] JPEG export, line height, preview, project search/sort, light/dark themes.
- [x] Isolation, concurrent-edit, permissions, reconnect, restart and recovery tests. Final browser/build outcomes are recorded in docs/VERIFICATION.md.
- [x] README, contributing guide, architecture decision log, migrations, CI configuration, launch checklist.

## Ranga Discover and Bridge ([Issue #1](https://github.com/SakshamRupakheti/ranga/issues/1))

- [x] Milestone 1: bounded unified search; encoded Pinterest website navigation; local project-aware ChatGPT prompt; Discover/Design/Focus modes; prompt review and copy/focus; explicit sign-in help, retry, manual-search and browser fallbacks.
- [x] Project query persistence through existing IndexedDB/Yjs paths, with role checks, stale-project rejection, and narrow first-party IPC. No third-party pane receives a preload.
- [x] Adjustable split proportions, swapping, focus expansion, original navigation/shortcuts, reference-board shortcut, and compact 132-pixel toolbar.
- [x] Milestone 2: collapsible Discover reference tray with provided drop/paste/file previews, source links and written references, attribution, image permission confirmation, classification, destination selection and real save/sync feedback, reusing the existing reference board and permissions.
- [ ] Milestone 3: fuller reference change instructions and explicit clipboard return through Bring into Ranga.
- [ ] Milestone 4: unified image/recipe preview, checkpoint, canvas handoff and recovery through existing authorized paths. Existing recipe import already supports validation and checkpoints.
- [ ] Milestone 5: end-to-end tray polish, accessibility/device testing and expanded failure coverage. A Windows native cross-view link-drag attempt did not reach the preview; browser-provided transfer data and paste/file/link fallbacks are tested. No arbitrary Pinterest image transfer is claimed.

## Partially complete or environment-dependent

- [x] Publish source and full commit history at SakshamRupakheti/ranga under the user-selected MIT license.
- [x] Optional API-free desktop workspace with separate Ranga/ChatGPT/Pinterest sessions, split view, manual handoff, and system-browser fallback.
- [ ] Signed desktop installers, bundled local server, update delivery, authenticated third-party compatibility, macOS/Linux verification, and desktop security review.

- [ ] Hosted collaboration usable by people on different computers. Current links and service are loopback-only.
- [ ] Replace development SQLite binary tables with managed PostgreSQL and private object storage; rehearse migration.
- [ ] Verified email ownership and actual password-reset email delivery. Local reset outbox works; email-restricted invitations do not prove mailbox ownership.
- [ ] Verify a successful hosted CI run and enable branch protection. Public repository and main/develop/feature branches are pushed; workflow configuration alone does not prove a hosted pass.
- [ ] Private preview deployment with persistent WebSocket hosting.
- [ ] Scheduled backups, restore drill from a backup file, quotas, retention, garbage collection, monitoring, multi-instance coordination.

## Next editor phase

- [ ] Persistent groups/ungroups, multiple artboards, guides/snapping, distribution and dedicated pan tool.
- [ ] Image crops/masks, safe SVG import, licensed font uploads, reusable/custom templates and advanced export presets.
- [ ] Shared brand kits with richer palettes, guidelines and reusable assets.
- [ ] Browser-only multi-tab conflict handling and storage quota recovery.
- [ ] Comprehensive accessibility, contrast/touch-target review, Firefox/Safari and physical phone/tablet checks.
- [ ] Realistic large-document performance benchmarks and load testing of collaboration.
- [ ] Make Ranga's final logo in Ranga with the founder.

## Public release gate

- [ ] Privacy policy, terms and support/contact channel approved for the actual hosting/data practices.
- [ ] Custom domain, HTTPS/WSS, favicon, secret rotation, verified production authorization and abuse review.
- [ ] All requirements in docs/LAUNCH_CHECKLIST.md verified before public launch.

## Dependency maintenance

- [ ] Resolve development-only minimatch advisory chain when upstream lint plugins support compatible fixed versions. Do not use forced incompatible major overrides.
- [ ] Upgrade ESLint with the matching Next lint plugins; ESLint 9.39.5 remains pinned for peer compatibility.

No automatic third-party account connections, scraping, paid API setup, public deployment, or logo generation has been performed.
