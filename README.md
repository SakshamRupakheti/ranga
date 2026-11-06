# Ranga

A native graphic design workspace with editable layers, persistent local collaboration, and manual Pinterest/ChatGPT handoff. The website name remains **Ranga**. Its final logo will be made using Ranga itself; the current wordmark is plain typography.

## Run locally

Use Node.js 24 and npm. Dependencies are pinned.

```sh
npm ci
npm run service
```

In a second terminal:

```sh
npm run dev -- --port 3001
```

Open <http://127.0.0.1:3001/projects>. Browser projects work without an account. Register a Ranga account for shared projects. Use **New shared design**, or **Share → Create shared copy** in an existing local project. Use another browser profile to register a second account and accept an invitation. The current service is loopback-only, so links work on this computer; remote team access requires the hosted infrastructure milestone.

No OpenAI, Pinterest, Canva, or paid-service credentials are required. Internal application HTTP endpoints and WebSockets power actual accounts and collaboration.

## Optional desktop workspace

Keep Ranga, ChatGPT, and Pinterest in one desktop window. **Discover** searches Pinterest and prepares a local ChatGPT prompt from one query. **Design** pairs the editor with ChatGPT; **Focus** expands Ranga. Start the local web app above, then run:

```sh
npm ci --prefix desktop
npm start --prefix desktop
```

The desktop preview uses Electron and needs no third-party API keys. Sign in and copy/import content manually. Browser-only projects stay in their original browser profile; move them with JSON backups or sign into Ranga for shared projects. Some website sign-ins may require the **Open in browser** fallback. See the [desktop guide](desktop/README.md) for setup, privacy, controls, tests, and current limits. This is a source-run preview; signed installers are not available yet.

Open a project before searching to include its brief, selected reference descriptions, dimensions, and recipe schema. **References** opens the project's tray below both websites. **Prompt** lets you review the instructions; **Copy & ChatGPT** copies them and focuses ChatGPT. Paste and submit yourself. **Bring into Ranga** accepts the result for preview, then adds a confirmed raster image or applies an editable recipe with a saved checkpoint. Completed website downloads also offer an explicit **Import download** handoff. Project queries, references, and instructions use the existing save/sync path and permissions. See [Ranga Bridge #1](https://github.com/SakshamRupakheti/ranga/issues/1).

## Working features

- Native text, rectangles, ellipses, raster uploads, logos, direct text editing, drag/resize/rotate, precise properties, line height, stacking, locking, visibility, duplication, multi-selection, undo/redo, zoom and preview.
- Separate browser and shared projects, search/sort, rename/duplicate/delete, and canvas-generated thumbnails.
- Email/password accounts using Better Auth, sessions, profile editing, account deletion, and password-reset flow using a private local development outbox. Email delivery and mailbox verification are not configured.
- Persistent Yjs editing with field-level changes, collaborative text, presence, selections/cursors, offline reconnect, per-user undo, server-enforced owner/editor/commenter/viewer roles, expiring invitations, and immediate membership revocation.
- Live project/layer/coordinate comments, replies, resolve/reopen, activity, notifications, shared snapshots and owner-controlled restoration.
- Pinterest/source links with attribution; permitted file/clipboard images, notes, collections, ordering, selection, and reference comparison. Source URLs are stored without scraping or downloading their images.
- External ChatGPT shortcut, saved keep/change instructions, deterministic prompt builder, exact JSON recipe schema, rendered composition previews, and separately editable supported layers.
- Confirmed image-to-canvas import from returned files or existing owned/generated references, centered placement, retained attribution, durable checkpoints, Undo/Redo, and shared permission checks.
- PNG/JPEG at document resolution, SVG with text/shapes and embedded images, portable JSON backups, a local brand kit, and light/dark themes.

## Try the complete local workflow

1. Open **Projects → New design** and add text, shapes or an image. Work saves automatically on this device.
2. Open **References** to collect permitted images, written directions and source links; select the references you want to discuss. In desktop, **Discover** places this tray below Pinterest and ChatGPT.
3. Set the brief and keep/change instructions under **Creative tools**. Review and copy the prompt, then paste/send it in your own ChatGPT account. Attach permitted images yourself.
4. Choose **Bring into Ranga** and paste a result or select a file. For an image, confirm permission and Owned/Generated use, then **Add image layer**. For a recipe, review the rendered design and **Apply validated design**. Links and descriptions can be saved as references.
5. Edit the result on the canvas. Use **Undo**, **Redo**, or **History** to recover. Export PNG, JPEG, SVG or an editable Ranga backup. **Share → Create shared copy** enables the local collaborative workflow.

The [recipe guide](docs/DESIGN_RECIPE.md) explains supported input, limits and recovery. Website results remain user-provided; Ranga does not read or automate the external accounts.

## Data and limits

Browser projects and the brand kit live in IndexedDB and are accessible to anyone using that browser profile. Shared projects, accounts, comments, versions, assets, and previews live in `.ranga-data/ranga.sqlite` on the local server. A generated session secret and password-reset outbox also live in that ignored directory. Keep it private. Shared editors cache document state per account/project in IndexedDB for reconnecting. Browser caches are not encrypted and are not a substitute for server authorization.

Sharing creates an explicit copy; no browser project is uploaded automatically. Shared assets are fetched through authenticated endpoints and referenced by ID in collaboration messages. They are stored in separate SQLite binary tables in this development profile. Production PostgreSQL and object storage remain planned.

Uploads: PNG/JPEG/WebP, 5 MB, 24 megapixels, and at most 10,000 pixels per side. Documents: 100–4096 pixels per side, 200 layers, 12 references, 20 saved versions. Shared encoded documents are capped at 8 MB, and individual WebSocket messages at 1 MB. Recipes are limited to 2 MB. JSON backups are limited to 30 MB. SVG and external image URLs are rejected on upload/import; SVG export is supported. The private HTTP service also applies request and authentication rate limits.

A backup contains the current composition and reference assets, not comments, collaborator permissions, snapshots, or the separate brand kit. Raster images stay raster layers. SVG fonts depend on the destination's installed fonts. Export before clearing browser data.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The production build uses `next build --webpack`; the original Windows host's Turbopack production CSS worker failed. Development uses Turbopack. Browser tests use separate Chrome profiles locally and Chromium in CI. Test services use temporary databases; no tests use the user's browser data. See [verification](docs/VERIFICATION.md).

## Project map

```text
src/app/                   Routes, custom visual tokens
src/components/            Canvas adapter, editor, accounts, reference/team tools
src/lib/document.ts        Renderer-independent document schema
src/lib/shared-document.ts Field-level Yjs mapping
src/lib/design-recipe.ts   Strict editable exchange schema and prompt builder
src/lib/storage.ts         Browser project persistence
src/server/                Authenticated local HTTP/WebSocket service
migrations/                Tracked database changes
public/                    Published recipe schema
desktop/                   Optional isolated Electron workspace
```

See [architecture](docs/ARCHITECTURE.md), [decisions](docs/DECISIONS.md), [recipe format](docs/DESIGN_RECIPE.md), [contributing](CONTRIBUTING.md), [task list](TASKS.md), and [launch checklist](docs/LAUNCH_CHECKLIST.md).

## Remaining infrastructure and editor work

This is a tested local development application, not a public hosted service. Public deployment, remote collaboration, verified email delivery, managed PostgreSQL/object storage, scheduled backups, monitoring, legal pages, a custom domain, and full browser/accessibility review remain open. Persistent groups, multiple artboards, snapping/guides, crop masks, custom fonts, shared brand kits, and advanced templates are the next editor phase.

## Open source

Ranga is published under the [MIT license](LICENSE) at [SakshamRupakheti/ranga](https://github.com/SakshamRupakheti/ranga). Contributions are welcome; read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). Dependencies retain their own licenses. Uploaded user artwork and external websites are not covered by Ranga's license.

The source repository is public. The application is still a local development preview, with hosting readiness tracked separately. GitHub Actions checks are configured; a committed workflow file alone is not proof of a successful hosted run. No deployment or branch-protection configuration is implied.
